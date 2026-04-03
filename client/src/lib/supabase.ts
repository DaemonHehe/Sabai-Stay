import {
  createClient,
  type AuthError,
  type PostgrestError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  authProfileSchema,
  appUserSchema,
  ownerProfileSchema,
  studentProfileSchema,
  universitySchema,
  type AuthProfile,
  type University,
} from "@shared/schema";

type BrowserSupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type PublicConfigResponse = {
  configured?: boolean;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
};

type UniversityRow = {
  id: string;
  name: string;
  email_domain: string;
  campus: string | null;
  city: string | null;
  created_at: string;
};

type AppUserRow = {
  id: string;
  role: "student" | "owner" | "admin";
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type StudentProfileRow = {
  user_id: string;
  university_id: string | null;
  student_number: string | null;
  university_email: string | null;
  verification_status: "pending" | "verified" | "rejected";
  verified_at: string | null;
  roommate_opt_in: boolean;
  created_at: string;
  updated_at: string;
};

type OwnerProfileRow = {
  user_id: string;
  business_name: string | null;
  business_registration_number: string | null;
  verification_status: "pending" | "verified" | "rejected";
  verification_documents: unknown;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export const browserSupabaseConfigError =
  "Supabase browser auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or provide SUPABASE_URL plus SUPABASE_ANON_KEY on the server.";

let cachedConfig: BrowserSupabaseConfig | null | undefined;
let configPromise: Promise<BrowserSupabaseConfig | null> | null = null;
let browserClient: SupabaseClient | null = null;

function throwSupabaseError(
  error: AuthError | PostgrestError | { message: string } | null,
) {
  if (error) {
    throw new Error(error.message);
  }
}

function normalizeUniversityRow(row: UniversityRow): University {
  return universitySchema.parse({
    id: row.id,
    name: row.name,
    emailDomain: row.email_domain,
    campus: row.campus,
    city: row.city,
    createdAt: row.created_at,
  });
}

function normalizeAppUserRow(row: AppUserRow) {
  return appUserSchema.parse({
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function normalizeStudentProfileRow(row: StudentProfileRow) {
  return studentProfileSchema.parse({
    userId: row.user_id,
    universityId: row.university_id,
    studentNumber: row.student_number,
    universityEmail: row.university_email,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at,
    roommateOptIn: row.roommate_opt_in,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function normalizeOwnerProfileRow(row: OwnerProfileRow) {
  return ownerProfileSchema.parse({
    userId: row.user_id,
    businessName: row.business_name,
    businessRegistrationNumber: row.business_registration_number,
    verificationStatus: row.verification_status,
    verificationDocuments: Array.isArray(row.verification_documents)
      ? row.verification_documents
      : [],
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function getConfigFromEnv(): BrowserSupabaseConfig | null {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ??
    import.meta.env.EXPO_PUBLIC_SUPABASE_URL ??
    null;
  const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    null;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

async function getConfigFromServer(): Promise<BrowserSupabaseConfig | null> {
  const response = await fetch("/api/config/public", {
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as PublicConfigResponse;

  if (!data.configured || !data.supabaseUrl || !data.supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl: data.supabaseUrl,
    supabaseAnonKey: data.supabaseAnonKey,
  };
}

export async function getBrowserSupabaseConfig() {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  if (!configPromise) {
    configPromise = (async () => {
      const envConfig = getConfigFromEnv();
      if (envConfig) {
        cachedConfig = envConfig;
        return envConfig;
      }

      try {
        const serverConfig = await getConfigFromServer();
        cachedConfig = serverConfig;
        return serverConfig;
      } catch (error) {
        console.error("Failed to load public Supabase config:", error);
        cachedConfig = null;
        return null;
      } finally {
        configPromise = null;
      }
    })();
  }

  return configPromise;
}

export async function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const config = await getBrowserSupabaseConfig();
  if (!config) {
    return null;
  }

  browserClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "sabai-stay-auth",
    },
  });

  return browserClient;
}

export async function requireSupabaseBrowserClient() {
  const client = await getSupabaseBrowserClient();

  if (!client) {
    throw new Error(browserSupabaseConfigError);
  }

  return client;
}

export async function getSupabaseAccessToken() {
  const client = await getSupabaseBrowserClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getSession();
  throwSupabaseError(error);
  return data.session?.access_token ?? null;
}

export async function listUniversities(): Promise<University[]> {
  const client = await requireSupabaseBrowserClient();
  const { data, error } = await client
    .from("universities")
    .select("*")
    .order("name", { ascending: true });

  throwSupabaseError(error);
  return (data ?? []).map((row) => normalizeUniversityRow(row as UniversityRow));
}

export async function loadAuthProfile(userId: string): Promise<AuthProfile | null> {
  const client = await requireSupabaseBrowserClient();
  const { data: appUserData, error: appUserError } = await client
    .from("app_users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  throwSupabaseError(appUserError);

  if (!appUserData) {
    return null;
  }

  const appUser = normalizeAppUserRow(appUserData as AppUserRow);

  const [
    { data: studentProfileData, error: studentProfileError },
    { data: ownerProfileData, error: ownerProfileError },
  ] = await Promise.all([
    client.from("student_profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.from("owner_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  throwSupabaseError(studentProfileError);
  throwSupabaseError(ownerProfileError);

  return authProfileSchema.parse({
    appUser,
    studentProfile: studentProfileData
      ? normalizeStudentProfileRow(studentProfileData as StudentProfileRow)
      : null,
    ownerProfile: ownerProfileData
      ? normalizeOwnerProfileRow(ownerProfileData as OwnerProfileRow)
      : null,
  });
}

export async function waitForAuthProfile(
  userId: string,
  attempts = 6,
  delayMs = 250,
): Promise<AuthProfile | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const profile = await loadAuthProfile(userId);
    if (profile) {
      return profile;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }

  return null;
}
