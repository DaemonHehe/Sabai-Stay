import { useEffect, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthProfile, UserRole } from "@shared/schema";
import {
  getSupabaseBrowserClient,
  requireSupabaseBrowserClient,
  waitForAuthProfile,
} from "@/lib/supabase";

type RegistrationRole = UserRole;

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
  studentNumber?: string;
  roommateOptIn?: boolean;
  businessName?: string;
  businessRegistrationNumber?: string;
};

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type AuthState = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  profile: AuthProfile | null;
};

type AuthContextValue = AuthState & {
  user: User | null;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AuthProfile | null>;
};

const subscribers = new Set<() => void>();
const initialState: AuthState = {
  isConfigured: false,
  isLoading: true,
  session: null,
  profile: null,
};

let authState = initialState;
let initializePromise: Promise<void> | null = null;
let authSubscriptionCleanup: (() => void) | null = null;
let hasInitialized = false;
let hasSessionExpiryListener = false;

function emitAuthState(nextState: AuthState) {
  authState = nextState;

  subscribers.forEach((subscriber) => {
    subscriber();
  });
}

function updateAuthState(partialState: Partial<AuthState>) {
  emitAuthState({
    ...authState,
    ...partialState,
  });
}

function subscribe(callback: () => void) {
  subscribers.add(callback);

  return () => {
    subscribers.delete(callback);
  };
}

function getSnapshot() {
  return authState;
}

function registerSessionExpiryListener() {
  if (hasSessionExpiryListener || typeof window === "undefined") {
    return;
  }

  hasSessionExpiryListener = true;
  window.addEventListener("sabai:session-expired", () => {
    updateAuthState({
      session: null,
      profile: null,
      isLoading: false,
    });
  });
}

async function resolveProfile(userId: string) {
  const profile = await waitForAuthProfile(userId);

  if (!profile) {
    throw new Error(
      "Your auth account exists, but the app profile was not created. Re-run schema.sql in Supabase so the auth profile trigger is installed.",
    );
  }

  return profile;
}

async function syncSession(nextSession: Session | null) {
  updateAuthState({
    session: nextSession,
  });

  if (!nextSession?.user) {
    updateAuthState({
      profile: null,
      isLoading: false,
    });
    return;
  }

  updateAuthState({
    isLoading: true,
  });

  try {
    const nextProfile = await resolveProfile(nextSession.user.id);
    updateAuthState({
      profile: nextProfile,
    });
  } catch (error) {
    console.error("Failed to load auth profile:", error);
    updateAuthState({
      profile: null,
    });
  } finally {
    updateAuthState({
      isLoading: false,
    });
  }
}

export async function initializeAuth() {
  if (hasInitialized) {
    return;
  }

  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    try {
      const client = await getSupabaseBrowserClient();
      if (!client) {
        updateAuthState({
          isConfigured: false,
          session: null,
          profile: null,
          isLoading: false,
        });
        return;
      }

      updateAuthState({
        isConfigured: true,
      });
      registerSessionExpiryListener();

      if (!authSubscriptionCleanup) {
        const { data: subscription } = client.auth.onAuthStateChange(
          (_event, nextSession) => {
            void syncSession(nextSession);
          },
        );

        authSubscriptionCleanup = () => {
          subscription.subscription.unsubscribe();
        };
      }

      const { data, error } = await client.auth.getSession();
      if (error) {
        throw error;
      }

      await syncSession(data.session);
      hasInitialized = true;
    } catch (error) {
      console.error("Failed to initialize Supabase auth:", error);
      updateAuthState({
        isConfigured: false,
        session: null,
        profile: null,
        isLoading: false,
      });
    } finally {
      initializePromise = null;
    }
  })();

  return initializePromise;
}

export async function loadAuthSessionDetails() {
  await initializeAuth();

  return {
    user: authState.session?.user ?? null,
    profile: authState.profile,
  };
}

async function signIn(input: SignInInput) {
  await initializeAuth();

  const client = await requireSupabaseBrowserClient();
  const { error } = await client.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function signUp(input: SignUpInput): Promise<SignUpResult> {
  await initializeAuth();

  const client = await requireSupabaseBrowserClient();

  const metadata: Record<string, unknown> = {
    role: input.role,
    full_name: input.fullName,
    phone: input.phone?.trim() || undefined,
  };

  if (input.role === "student") {
    metadata.university_id = input.universityId || undefined;
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
    updateAuthState({
      session: data.session,
      profile: nextProfile,
    });
  }

  return {
    needsEmailConfirmation: !data.session,
  };
}

async function sendPasswordResetEmail(email: string) {
  await initializeAuth();

  const client = await requireSupabaseBrowserClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function updatePassword(password: string) {
  await initializeAuth();

  const client = await requireSupabaseBrowserClient();
  const { error } = await client.auth.updateUser({
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function signOut() {
  await initializeAuth();

  const client = await requireSupabaseBrowserClient();
  const { error } = await client.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }

  updateAuthState({
    session: null,
    profile: null,
  });
}

async function refreshProfile() {
  await initializeAuth();

  const currentUser = authState.session?.user;
  if (!currentUser) {
    updateAuthState({
      profile: null,
    });
    return null;
  }

  const nextProfile = await resolveProfile(currentUser.id);
  updateAuthState({
    profile: nextProfile,
  });
  return nextProfile;
}

export function useAuth(): AuthContextValue {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void initializeAuth();
  }, []);

  return {
    ...state,
    user: state.session?.user ?? null,
    signIn,
    signUp,
    sendPasswordResetEmail,
    updatePassword,
    signOut,
    refreshProfile,
  };
}
