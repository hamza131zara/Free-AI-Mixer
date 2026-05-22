import {
  readSupabaseRlsRemoteSmokeConfig,
  verifySupabaseRlsPolicyDraftText,
  type SupabaseRlsRemoteSmokeEnv,
} from "./supabaseRlsVerification";

export type ProductionRlsReadinessUnavailableReason =
  | "missing_policy_draft"
  | "invalid_policy_draft"
  | "remote_smoke_not_configured";

export type ProductionRlsRemoteSmokeReadiness =
  | {
      kind: "disabled";
      configured: false;
    }
  | {
      kind: "not_configured";
      configured: false;
      missingEnv: string[];
    }
  | {
      kind: "configured";
      configured: true;
    };

export type ProductionRlsReadinessDecision =
  | {
      kind: "unavailable";
      reason: ProductionRlsReadinessUnavailableReason;
      policyDraftValid: false;
      missingRequirements: string[];
      remoteSmoke: ProductionRlsRemoteSmokeReadiness;
      routeRuntimeEnabled: false;
      migrationsApplied: false;
      publicLaunchEnabled: false;
    }
  | {
      kind: "ready";
      policyDraftValid: true;
      requiredPolicyNames: string[];
      remoteSmoke: ProductionRlsRemoteSmokeReadiness;
      routeRuntimeEnabled: false;
      migrationsApplied: false;
      publicLaunchEnabled: false;
    };

export interface ResolveProductionRlsReadinessInput {
  policyDraftText?: string;
  env?: SupabaseRlsRemoteSmokeEnv;
  requireRemoteSmoke?: boolean;
}

const requiredPolicyNames = [
  "export_jobs_owner_select",
  "export_jobs_workspace_member_select",
  "export_artifacts_workspace_member_select",
  "workspace_memberships_self_select",
];

const mapRemoteSmokeReadiness = (
  env: SupabaseRlsRemoteSmokeEnv | undefined,
): ProductionRlsRemoteSmokeReadiness => {
  const remoteSmokeConfig = readSupabaseRlsRemoteSmokeConfig(env);

  if (remoteSmokeConfig.kind === "configured") {
    return {
      kind: "configured",
      configured: true,
    };
  }

  if (remoteSmokeConfig.kind === "not_configured") {
    return {
      kind: "not_configured",
      configured: false,
      missingEnv: remoteSmokeConfig.missingEnv,
    };
  }

  return {
    kind: "disabled",
    configured: false,
  };
};

/**
 * Phase 175-C production RLS readiness boundary.
 *
 * This validates RLS readiness inputs without applying policies or changing
 * route/runtime behavior.
 *
 * Safety rules:
 * - no Supabase CLI execution
 * - no migration application
 * - no route behavior change
 * - no service-role usage
 * - no frontend Supabase/storage access
 * - no public artifact delivery enablement
 */
export const resolveProductionRlsReadiness = ({
  policyDraftText,
  env,
  requireRemoteSmoke = false,
}: ResolveProductionRlsReadinessInput): ProductionRlsReadinessDecision => {
  const remoteSmoke = mapRemoteSmokeReadiness(env);

  if (!policyDraftText?.trim()) {
    return {
      kind: "unavailable",
      reason: "missing_policy_draft",
      policyDraftValid: false,
      missingRequirements: ["policy_draft_text"],
      remoteSmoke,
      routeRuntimeEnabled: false,
      migrationsApplied: false,
      publicLaunchEnabled: false,
    };
  }

  const draftVerification = verifySupabaseRlsPolicyDraftText(policyDraftText);

  if (draftVerification.kind !== "valid") {
    return {
      kind: "unavailable",
      reason: "invalid_policy_draft",
      policyDraftValid: false,
      missingRequirements: draftVerification.missingRequirements,
      remoteSmoke,
      routeRuntimeEnabled: false,
      migrationsApplied: false,
      publicLaunchEnabled: false,
    };
  }

  if (requireRemoteSmoke && remoteSmoke.kind !== "configured") {
    return {
      kind: "unavailable",
      reason: "remote_smoke_not_configured",
      policyDraftValid: false,
      missingRequirements:
        remoteSmoke.kind === "not_configured"
          ? remoteSmoke.missingEnv
          : ["FREE_AI_MIXER_RUN_REMOTE_SUPABASE_RLS_SMOKE"],
      remoteSmoke,
      routeRuntimeEnabled: false,
      migrationsApplied: false,
      publicLaunchEnabled: false,
    };
  }

  return {
    kind: "ready",
    policyDraftValid: true,
    requiredPolicyNames,
    remoteSmoke,
    routeRuntimeEnabled: false,
    migrationsApplied: false,
    publicLaunchEnabled: false,
  };
};
