import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthProfile, UserRole } from "@shared/schema";
import {
  getSupabaseBrowserClient,
  requireSupabaseBrowserClient,
  waitForAuthProfile,
} from "@/lib/supabase";

type RegistrationRole = Exclude<UserRole, "admin">;

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  role: RegistrationRole;
  fullName: string;
  phone?: string;
  email: string;
  password: string;
  universityId?: string;
  universityEmail?: string;
  studentNumber?: string;
  roommateOptIn?: boolean;
  businessName?: string;
  businessRegistrationNumber?: string;
};

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AuthProfile | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveProfile(userId: string) {
  const profile = await waitForAuthProfile(userId);

  if (!profile) {
    throw new Error(
      "Your auth account exists, but the app profile was not created. Re-run schema.sql in Supabase so the auth profile trigger is installed.",
    );
  }

  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function syncSession(nextSession: Session | null) {
      if (!isActive) {
        return;
      }

      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const nextProfile = await resolveProfile(nextSession.user.id);
        if (!isActive) {
          return;
        }

        setProfile(nextProfile);
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("Failed to load auth profile:", error);
        setProfile(null);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    async function initializeAuth() {
      try {
        const client = await getSupabaseBrowserClient();
        if (!client) {
          if (isActive) {
            setIsConfigured(false);
            setSession(null);
            setProfile(null);
            setIsLoading(false);
          }
          return;
        }

        if (isActive) {
          setIsConfigured(true);
        }

        const { data, error } = await client.auth.getSession();
        if (error) {
          throw error;
        }

        await syncSession(data.session);

        const { data: subscription } = client.auth.onAuthStateChange(
          (_event, nextSession) => {
            void syncSession(nextSession);
          },
        );

        if (!isActive) {
          subscription.subscription.unsubscribe();
          return;
        }

        cleanup = () => {
          subscription.subscription.unsubscribe();
        };
      } catch (error) {
        console.error("Failed to initialize Supabase auth:", error);
        if (isActive) {
          setIsConfigured(false);
          setSession(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    }

    let cleanup = () => {};
    void initializeAuth();

    return () => {
      isActive = false;
      cleanup();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      profile,
      async signIn(input) {
        const client = await requireSupabaseBrowserClient();

        const { error } = await client.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

        if (error) {
          throw new Error(error.message);
        }
      },
      async signUp(input) {
        const client = await requireSupabaseBrowserClient();

        const metadata: Record<string, unknown> = {
          role: input.role,
          full_name: input.fullName,
          phone: input.phone?.trim() || undefined,
        };

        if (input.role === "student") {
          metadata.university_id = input.universityId || undefined;
          metadata.university_email = input.universityEmail?.trim() || undefined;
          metadata.student_number = input.studentNumber?.trim() || undefined;
          metadata.roommate_opt_in = Boolean(input.roommateOptIn);
        }

        if (input.role === "owner") {
          metadata.business_name = input.businessName?.trim() || undefined;
          metadata.business_registration_number =
            input.businessRegistrationNumber?.trim() || undefined;
        }

        const { data, error } = await client.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: metadata,
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data.session?.user) {
          const nextProfile = await resolveProfile(data.session.user.id);
          setSession(data.session);
          setProfile(nextProfile);
        }

        return {
          needsEmailConfirmation: !data.session,
        };
      },
      async signOut() {
        const client = await requireSupabaseBrowserClient();

        const { error } = await client.auth.signOut();
        if (error) {
          throw new Error(error.message);
        }

        setSession(null);
        setProfile(null);
      },
      async refreshProfile() {
        const currentUser = session?.user;
        if (!currentUser) {
          setProfile(null);
          return null;
        }

        const nextProfile = await resolveProfile(currentUser.id);
        setProfile(nextProfile);
        return nextProfile;
      },
    }),
    [isConfigured, isLoading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
