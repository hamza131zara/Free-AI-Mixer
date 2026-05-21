import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  readSupabaseRlsRemoteSmokeConfig,
  verifySupabaseRlsPolicyDraftText,
} from "../../backend/auth/supabaseRlsVerification";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase141 rls verification remote opt-in smoke pack", () => {
  test("offline rls draft verification passes for the docs-only policy draft", async () => {
    const draftSource = readSource("docs/security/phase140-supabase-rls-policy-draft.sql");

    expect(verifySupabaseRlsPolicyDraftText(draftSource)).toEqual({
      kind: "valid",
      missingRequirements: [],
    });

    const invalid = verifySupabaseRlsPolicyDraftText("select 1;");

    expect(invalid.kind).toBe("invalid");
    expect(invalid.missingRequirements).toContain("DRAFT ONLY");
    expect(invalid.missingRequirements).toContain("auth.uid()");
  });

  test("remote rls smoke is opt-in and refuses incomplete configuration safely", async () => {
    expect(readSupabaseRlsRemoteSmokeConfig({})).toEqual({
      kind: "disabled",
      reason: "opt_in_env_not_enabled",
    });

    expect(
      readSupabaseRlsRemoteSmokeConfig({
        FREE_AI_MIXER_RUN_REMOTE_SUPABASE_RLS_SMOKE: "1",
      }),
    ).toEqual({
      kind: "not_configured",
      missingEnv: [
        "FREE_AI_MIXER_SUPABASE_URL",
        "FREE_AI_MIXER_SUPABASE_ANON_KEY",
      ],
    });

    expect(
      readSupabaseRlsRemoteSmokeConfig({
        FREE_AI_MIXER_RUN_REMOTE_SUPABASE_RLS_SMOKE: "1",
        FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
        FREE_AI_MIXER_SUPABASE_ANON_KEY: "anon-key-present-but-not-printed",
      }),
    ).toEqual({
      kind: "configured",
      supabaseUrl: "https://example.supabase.co",
      anonKeyPresent: true,
    });
  });

  test("rls verification boundary is not wired into routes runtime frontend storage or public artifacts", async () => {
    const rlsVerificationSource = readSource("backend/auth/supabaseRlsVerification.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");
    const membershipSource =
      readSource("backend/auth/workspaceMembership.ts") +
      "\n" +
      readSource("backend/auth/workspaceMembershipRepository.ts") +
      "\n" +
      readSource("backend/auth/workspaceMembershipEnforcement.ts");

    expect(rlsVerificationSource).toContain("verifySupabaseRlsPolicyDraftText");
    expect(rlsVerificationSource).toContain("readSupabaseRlsRemoteSmokeConfig");
    expect(rlsVerificationSource).toContain("FREE_AI_MIXER_RUN_REMOTE_SUPABASE_RLS_SMOKE");

    expect(routeSource).not.toContain("verifySupabaseRlsPolicyDraftText");
    expect(routeSource).not.toContain("readSupabaseRlsRemoteSmokeConfig");
    expect(appSource).not.toContain("verifySupabaseRlsPolicyDraftText");
    expect(appSource).not.toContain("readSupabaseRlsRemoteSmokeConfig");

    expect(routeSource).not.toContain("enable row level security");
    expect(routeSource).not.toContain("create policy");
    expect(routeSource).not.toContain("auth.uid()");
    expect(routeSource).not.toContain("applyRls");

    expect(membershipSource).not.toContain("enable row level security");
    expect(membershipSource).not.toContain("create policy");
    expect(membershipSource).not.toContain("auth.uid()");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
  });
});
