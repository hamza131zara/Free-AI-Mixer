import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  resolveProductionRlsReadiness,
} from "../../backend/auth/productionRlsReadiness";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const rlsDraft = readSource("docs/security/phase140-supabase-rls-policy-draft.sql");

test.describe("phase175c production rls configuration readiness boundary pack", () => {
  test("production rls readiness validates policy draft without applying migrations or enabling runtime", async () => {
    expect(resolveProductionRlsReadiness({ policyDraftText: rlsDraft })).toEqual({
      kind: "ready",
      policyDraftValid: true,
      requiredPolicyNames: [
        "export_jobs_owner_select",
        "export_jobs_workspace_member_select",
        "export_artifacts_workspace_member_select",
        "workspace_memberships_self_select",
      ],
      remoteSmoke: {
        kind: "disabled",
        configured: false,
      },
      routeRuntimeEnabled: false,
      migrationsApplied: false,
      publicLaunchEnabled: false,
    });

    expect(
      resolveProductionRlsReadiness({
        policyDraftText: rlsDraft,
        env: {
          FREE_AI_MIXER_RUN_REMOTE_SUPABASE_RLS_SMOKE: "1",
          FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
          FREE_AI_MIXER_SUPABASE_ANON_KEY: "redacted-anon-key",
        },
        requireRemoteSmoke: true,
      }),
    ).toEqual({
      kind: "ready",
      policyDraftValid: true,
      requiredPolicyNames: [
        "export_jobs_owner_select",
        "export_jobs_workspace_member_select",
        "export_artifacts_workspace_member_select",
        "workspace_memberships_self_select",
      ],
      remoteSmoke: {
        kind: "configured",
        configured: true,
      },
      routeRuntimeEnabled: false,
      migrationsApplied: false,
      publicLaunchEnabled: false,
    });
  });

  test("production rls readiness fails closed for missing invalid or required remote smoke config", async () => {
    expect(resolveProductionRlsReadiness({})).toEqual({
      kind: "unavailable",
      reason: "missing_policy_draft",
      policyDraftValid: false,
      missingRequirements: ["policy_draft_text"],
      remoteSmoke: {
        kind: "disabled",
        configured: false,
      },
      routeRuntimeEnabled: false,
      migrationsApplied: false,
      publicLaunchEnabled: false,
    });

    const invalid = resolveProductionRlsReadiness({
      policyDraftText: "DRAFT ONLY",
    });

    expect(invalid.kind).toBe("unavailable");
    expect(invalid).toMatchObject({
      kind: "unavailable",
      reason: "invalid_policy_draft",
      policyDraftValid: false,
      remoteSmoke: {
        kind: "disabled",
        configured: false,
      },
      routeRuntimeEnabled: false,
      migrationsApplied: false,
      publicLaunchEnabled: false,
    });

    if (invalid.kind !== "unavailable") {
      throw new Error("Expected invalid RLS draft to be unavailable");
    }

    expect(invalid.missingRequirements).toContain(
      "alter table public.export_jobs enable row level security",
    );

    expect(
      resolveProductionRlsReadiness({
        policyDraftText: rlsDraft,
        env: {
          FREE_AI_MIXER_RUN_REMOTE_SUPABASE_RLS_SMOKE: "1",
        },
        requireRemoteSmoke: true,
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "remote_smoke_not_configured",
      policyDraftValid: false,
      missingRequirements: [
        "FREE_AI_MIXER_SUPABASE_URL",
        "FREE_AI_MIXER_SUPABASE_ANON_KEY",
      ],
      remoteSmoke: {
        kind: "not_configured",
        configured: false,
        missingEnv: [
          "FREE_AI_MIXER_SUPABASE_URL",
          "FREE_AI_MIXER_SUPABASE_ANON_KEY",
        ],
      },
      routeRuntimeEnabled: false,
      migrationsApplied: false,
      publicLaunchEnabled: false,
    });
  });

  test("production rls readiness is not route wired and has no cli service role or frontend storage behavior", async () => {
    const readinessSource = readSource("backend/auth/productionRlsReadiness.ts");
    const rlsVerificationSource = readSource("backend/auth/supabaseRlsVerification.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    expect(readinessSource).toContain("resolveProductionRlsReadiness");
    expect(readinessSource).toContain("verifySupabaseRlsPolicyDraftText");
    expect(readinessSource).toContain("readSupabaseRlsRemoteSmokeConfig");
    expect(readinessSource).toContain("routeRuntimeEnabled: false");
    expect(readinessSource).toContain("migrationsApplied: false");
    expect(readinessSource).toContain("publicLaunchEnabled: false");

    expect(routeSource).not.toContain("resolveProductionRlsReadiness");
    expect(routeSource).not.toContain("productionRlsReadiness");

    expect(readinessSource + rlsVerificationSource).not.toContain("supabase start");
    expect(readinessSource + rlsVerificationSource).not.toContain("supabase db push");
    expect(readinessSource + rlsVerificationSource).not.toContain("supabase migration up");
    expect(readinessSource + rlsVerificationSource).not.toContain("SERVICE_ROLE");
    expect(readinessSource + rlsVerificationSource).not.toContain("service_role");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("service_role");
  });
});
