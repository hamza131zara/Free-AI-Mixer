export interface SupabaseRlsDraftVerificationResult {
  kind: "valid" | "invalid";
  missingRequirements: string[];
}

export type SupabaseRlsRemoteSmokeConfig =
  | {
      kind: "disabled";
      reason: "opt_in_env_not_enabled";
    }
  | {
      kind: "not_configured";
      missingEnv: string[];
    }
  | {
      kind: "configured";
      supabaseUrl: string;
      anonKeyPresent: true;
    };

export interface SupabaseRlsRemoteSmokeEnv {
  FREE_AI_MIXER_RUN_REMOTE_SUPABASE_RLS_SMOKE?: string;
  FREE_AI_MIXER_SUPABASE_URL?: string;
  FREE_AI_MIXER_SUPABASE_ANON_KEY?: string;
}

/**
 * Phase 141 RLS verification boundary.
 *
 * This verifies the docs-only RLS policy draft text offline and defines
 * a remote smoke configuration boundary.
 *
 * It intentionally does not connect to Supabase, run CLI migrations,
 * apply policies, trust headers, enforce routes, or enable artifact delivery.
 */
export const verifySupabaseRlsPolicyDraftText = (
  draftText: string,
): SupabaseRlsDraftVerificationResult => {
  const requirements = [
    "DRAFT ONLY",
    "alter table public.export_jobs enable row level security",
    "alter table public.export_artifacts enable row level security",
    "alter table public.workspace_memberships enable row level security",
    "export_jobs_owner_select",
    "export_jobs_workspace_member_select",
    "export_artifacts_workspace_member_select",
    "workspace_memberships_self_select",
    "auth.uid()",
    "wm.status = 'active'",
  ];

  const missingRequirements = requirements.filter(
    (requirement) => !draftText.includes(requirement),
  );

  return {
    kind: missingRequirements.length === 0 ? "valid" : "invalid",
    missingRequirements,
  };
};

export const readSupabaseRlsRemoteSmokeConfig = (
  env: SupabaseRlsRemoteSmokeEnv = process.env,
): SupabaseRlsRemoteSmokeConfig => {
  if (env.FREE_AI_MIXER_RUN_REMOTE_SUPABASE_RLS_SMOKE !== "1") {
    return {
      kind: "disabled",
      reason: "opt_in_env_not_enabled",
    };
  }

  const supabaseUrl = env.FREE_AI_MIXER_SUPABASE_URL?.trim();
  const supabaseAnonKey = env.FREE_AI_MIXER_SUPABASE_ANON_KEY?.trim();

  const missingEnv: string[] = [];

  if (!supabaseUrl) {
    missingEnv.push("FREE_AI_MIXER_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    missingEnv.push("FREE_AI_MIXER_SUPABASE_ANON_KEY");
  }

  if (missingEnv.length > 0) {
    return {
      kind: "not_configured",
      missingEnv,
    };
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      kind: "not_configured",
      missingEnv:
        missingEnv.length > 0
          ? missingEnv
          : [
              "FREE_AI_MIXER_SUPABASE_URL",
              "FREE_AI_MIXER_SUPABASE_ANON_KEY",
            ],
    };
  }

  return {
    kind: "configured",
    supabaseUrl,
    anonKeyPresent: true,
  };
};


