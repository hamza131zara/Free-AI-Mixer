export type ProductionDeploymentReadinessMissingItem =
  | "node_env"
  | "auth_provider"
  | "auth_issuer"
  | "auth_audience"
  | "auth_jwks_uri"
  | "supabase_url"
  | "supabase_anon_key"
  | "supabase_artifacts_storage_bucket"
  | "supabase_uploads_storage_bucket"
  | "frontend_build_command"
  | "backend_start_command"
  | "deployment_docs"
  | "supabase_checklist";

export type ProductionDeploymentReadinessDecision =
  | {
      kind: "ready";
      missingItems: [];
      buildCommand: "npm run build";
      backendStartCommand: "npm run backend:start";
      publicLaunchEnabled: false;
      secretsCommitted: false;
    }
  | {
      kind: "not_ready";
      missingItems: ProductionDeploymentReadinessMissingItem[];
      buildCommand: "npm run build";
      backendStartCommand: "npm run backend:start";
      publicLaunchEnabled: false;
      secretsCommitted: false;
    };

export interface ProductionDeploymentReadinessInput {
  env: Record<string, string | undefined>;
  packageScripts: Record<string, string | undefined>;
  deploymentDocsText?: string;
  supabaseChecklistText?: string;
}

const requiredEnv: Array<{
  key: string;
  missingItem: ProductionDeploymentReadinessMissingItem;
}> = [
  { key: "NODE_ENV", missingItem: "node_env" },
  { key: "FREE_AI_MIXER_AUTH_PROVIDER", missingItem: "auth_provider" },
  { key: "FREE_AI_MIXER_AUTH_ISSUER", missingItem: "auth_issuer" },
  { key: "FREE_AI_MIXER_AUTH_AUDIENCE", missingItem: "auth_audience" },
  { key: "FREE_AI_MIXER_AUTH_JWKS_URI", missingItem: "auth_jwks_uri" },
  { key: "FREE_AI_MIXER_SUPABASE_URL", missingItem: "supabase_url" },
  { key: "FREE_AI_MIXER_SUPABASE_ANON_KEY", missingItem: "supabase_anon_key" },
  { key: "FREE_AI_MIXER_STORAGE_BUCKET_ARTIFACTS", missingItem: "supabase_artifacts_storage_bucket" },
  { key: "FREE_AI_MIXER_STORAGE_BUCKET_UPLOADS", missingItem: "supabase_uploads_storage_bucket" },
];

const hasValue = (value: string | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const docsContainDeploymentPlan = (docsText: string | undefined): boolean =>
  Boolean(
    docsText?.includes("Production deployment commands") &&
      docsText.includes("Frontend hosting") &&
      docsText.includes("Backend hosting") &&
      docsText.includes("No secrets committed"),
  );

const docsContainSupabaseChecklist = (docsText: string | undefined): boolean =>
  Boolean(
    docsText?.includes("Supabase project checklist") &&
      docsText.includes("RLS policies") &&
      docsText.includes("Storage bucket") &&
      docsText.includes("Anon key only"),
  );

/**
 * Phase 178 production environment + deployment pipeline readiness boundary.
 *
 * This helper validates deployment readiness inputs only. It does not deploy,
 * start servers, call Supabase, read secrets, or enable public launch.
 *
 * Safety rules:
 * - no secrets are returned
 * - no service-role behavior
 * - no public launch enablement
 * - no route behavior change
 * - no remote dependency
 */
export const resolveProductionDeploymentReadiness = ({
  env,
  packageScripts,
  deploymentDocsText,
  supabaseChecklistText,
}: ProductionDeploymentReadinessInput): ProductionDeploymentReadinessDecision => {
  const missingItems: ProductionDeploymentReadinessMissingItem[] = [];

  for (const requirement of requiredEnv) {
    if (!hasValue(env[requirement.key])) {
      missingItems.push(requirement.missingItem);
    }
  }

  if (packageScripts.build !== "tsc -b && vite build") {
    missingItems.push("frontend_build_command");
  }

  if (packageScripts["backend:start"] !== "tsx backend/server.ts") {
    missingItems.push("backend_start_command");
  }

  if (!docsContainDeploymentPlan(deploymentDocsText)) {
    missingItems.push("deployment_docs");
  }

  if (!docsContainSupabaseChecklist(supabaseChecklistText)) {
    missingItems.push("supabase_checklist");
  }

  const base = {
    buildCommand: "npm run build" as const,
    backendStartCommand: "npm run backend:start" as const,
    publicLaunchEnabled: false as const,
    secretsCommitted: false as const,
  };

  return missingItems.length === 0
    ? {
        kind: "ready",
        missingItems: [],
        ...base,
      }
    : {
        kind: "not_ready",
        missingItems,
        ...base,
      };
};
