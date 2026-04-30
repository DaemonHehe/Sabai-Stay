function firstConfiguredEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function getSupabaseUrl() {
  return firstConfiguredEnv(
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_URL",
  );
}

export function getSupabaseAnonKey() {
  return firstConfiguredEnv(
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export function getSupabaseServerKey() {
  return firstConfiguredEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");
}

