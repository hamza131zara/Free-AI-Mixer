export interface FrontendSupabaseAuthReadinessEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  [key: string]: string | undefined;
}

export type FrontendSupabaseAuthReadiness =
  | {
      kind: "supabase_auth_not_configured";
      reason:
        | "missing_supabase_url"
        | "missing_supabase_anon_key"
        | "service_role_env_forbidden";
      forbiddenEnvKey?: string;
    }
  | {
      kind: "supabase_auth_configured";
      projectUrl: string;
      anonKey: string;
    };

const readTrimmed = (
  env: FrontendSupabaseAuthReadinessEnv,
  key: string,
): string | undefined => {
  const value = env[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const findForbiddenPublicServiceRoleEnv = (
  env: FrontendSupabaseAuthReadinessEnv,
): string | undefined =>
  Object.keys(env).find(
    (key) => key.startsWith("VITE_") && key.includes("SERVICE_ROLE"),
  );

export const readFrontendSupabaseAuthReadiness = (
  env: FrontendSupabaseAuthReadinessEnv,
): FrontendSupabaseAuthReadiness => {
  const forbiddenEnvKey = findForbiddenPublicServiceRoleEnv(env);

  if (forbiddenEnvKey) {
    return {
      kind: "supabase_auth_not_configured",
      reason: "service_role_env_forbidden",
      forbiddenEnvKey,
    };
  }

  const projectUrl = readTrimmed(env, "VITE_SUPABASE_URL");

  if (!projectUrl) {
    return {
      kind: "supabase_auth_not_configured",
      reason: "missing_supabase_url",
    };
  }

  const anonKey = readTrimmed(env, "VITE_SUPABASE_ANON_KEY");

  if (!anonKey) {
    return {
      kind: "supabase_auth_not_configured",
      reason: "missing_supabase_anon_key",
    };
  }

  return {
    kind: "supabase_auth_configured",
    projectUrl,
    anonKey,
  };
};
