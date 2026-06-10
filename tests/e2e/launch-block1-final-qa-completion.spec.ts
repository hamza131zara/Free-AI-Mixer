import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createAuthenticatedRequesterContext,
  createUnauthenticatedRequesterContext,
} from "../../backend/auth/requesterContext";
import { decideProductionAuthOwnership } from "../../backend/auth/productionAuthOwnershipPolicy";
import { resolveSelectedRouteAccess } from "../../backend/auth/protectedRouteGuards";
import { parseSupabaseConfig } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";
import { getProductionPersistenceBoundarySummary } from "../../backend/persistence/productionSupabasePersistenceBoundary";
import { createProductionSupabasePersistenceWriterFromClientFactory } from "../../backend/persistence/supabaseProductionPersistenceWriter";

const readProjectFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const forbiddenPublicTokens = [
  "encrypted_payload",
  "secret_ref",
  "service-role",
  "service_role",
  "jwt_secret",
  "provider_response_body",
  "provider_headers",
  "local_path",
  "internal_ref",
  "base64",
  "public_url",
  "signed_url",
  "download_url",
  "sk-",
];

const expectNoPublicLeakTokens = (value: unknown) => {
  const serialized = JSON.stringify(value);

  for (const token of forbiddenPublicTokens) {
    expect(serialized).not.toContain(token);
  }
};

test.describe("Launch Block 1 final QA completion", () => {
  test("auth and ownership boundaries close safely without trusting frontend headers", async () => {
    const runtimeConfig = {
      kind: "auth_provider_configured" as const,
      provider: "future_jwt_provider" as const,
      issuer: "https://auth.example.test",
      audience: "free-ai-mixer",
    };
    const accessDecision = await resolveSelectedRouteAccess({
      headers: {
        "x-user-id": "spoofed-user",
        "x-workspace-id": "spoofed-workspace",
      },
      requesterResolver: {
        resolve: async () =>
          createUnauthenticatedRequesterContext("missing_credentials"),
      },
      runtimeConfig,
    });

    expect(accessDecision).toMatchObject({
      code: "auth_required",
      kind: "denied",
      statusCode: 401,
    });

    const requesterContext = createAuthenticatedRequesterContext({
      appUserId: "block1-final-app-user",
      authProvider: "jwt",
      authSubject: "block1-final-subject",
      userId: "block1-final-user",
      workspaceAuthority: "verified",
      workspaceId: "block1-final-workspace",
    });

    expect(
      decideProductionAuthOwnership({
        membershipRole: "owner",
        requesterContext,
        surface: "generation_jobs",
      }),
    ).toMatchObject({ kind: "allowed", role: "owner" });
    expect(
      decideProductionAuthOwnership({
        membershipRole: "member",
        requesterContext,
        surface: "generated_artifacts",
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "workspace_owner_or_admin_required",
    });
    expectNoPublicLeakTokens({ accessDecision });
  });

  test("Supabase persistence closes honestly when env or tables are unavailable", () => {
    const summary = getProductionPersistenceBoundarySummary();
    const writer = createProductionSupabasePersistenceWriterFromClientFactory(
      createSupabaseClientFactory(parseSupabaseConfig({})),
    );

    expect(summary.autoApplyRemoteMigrations).toBe(false);
    expect(summary.directFrontendSupabaseDbAccess).toBe(false);
    expect(summary.directFrontendSupabaseStorageAccess).toBe(false);
    expect(summary.tables.map((table) => table.tableName)).toEqual(
      expect.arrayContaining([
        "projects",
        "generation_jobs",
        "generated_artifact_records",
        "image_generation_history",
        "provider_keys",
      ]),
    );
    expect(writer.getReadiness()).toMatchObject({
      kind: "unavailable",
      status: "persistence_unavailable",
    });
    expectNoPublicLeakTokens(summary);
  });

  test("Block 1 docs and source boundaries are complete without unsafe launch behavior", () => {
    const architecture = readProjectFile("docs/architecture.md");
    const roadmap = readProjectFile("docs/roadmap.md");
    const knownIssues = readProjectFile("docs/known-issues.md");
    const phases = readProjectFile("docs/phases.md");
    const migration = readProjectFile(
      "backend/db/migrations/0004_launch_block1_project_generation_persistence_draft.sql",
    );
    const authPolicy = readProjectFile(
      "backend/auth/productionAuthOwnershipPolicy.ts",
    );
    const persistenceBoundary = readProjectFile(
      "backend/persistence/productionSupabasePersistenceBoundary.ts",
    );
    const supabaseWriter = readProjectFile(
      "backend/persistence/supabaseProductionPersistenceWriter.ts",
    );
    const generationRoute = readProjectFile("backend/routes/generation.ts");
    const projectHistoryRoute = readProjectFile("backend/routes/projectHistory.ts");
    const providerSettingsRoute = readProjectFile(
      "backend/routes/providerSettings.ts",
    );
    const block0Policy = readProjectFile(
      "src/services/providerCapabilityPolicyService.ts",
    );
    const frontendSources = [
      readProjectFile("src/services/projectLibraryService.ts"),
      readProjectFile("src/services/exportHistoryService.ts"),
      readProjectFile("src/services/auth/authenticatedFetch.ts"),
    ].join("\n");
    const combinedDocs = [architecture, roadmap, knownIssues, phases].join("\n");
    const backendBlock1Sources = [
      authPolicy,
      persistenceBoundary,
      supabaseWriter,
      generationRoute,
      projectHistoryRoute,
      providerSettingsRoute,
    ].join("\n");

    expect(combinedDocs).toContain(
      "Launch Block 1 is complete enough to close before Block 2",
    );
    expect(combinedDocs).toContain(
      "repository-backed Supabase persistence writer",
    );
    expect(combinedDocs).toContain("manual");
    expect(combinedDocs).toContain("Block 2");
    expect(block0Policy).toContain(
      "Free workspace and mock/demo generation are available.",
    );
    expect(migration).toContain("Do not auto-apply this migration to production.");
    expect(migration).toContain("Frontend direct Supabase DB/storage access remains forbidden");
    expect(backendBlock1Sources).toContain("decideProductionAuthOwnership");
    expect(backendBlock1Sources).toContain("persistence_unavailable");
    expect(backendBlock1Sources).toContain("persistence_write_failed");

    for (const forbidden of [
      "createCheckoutSession",
      "stripe.checkout",
      "api.openai.com/v1/images",
      "signedUrl:",
      "publicUrl:",
      "downloadUrl:",
    ]) {
      expect(backendBlock1Sources).not.toContain(forbidden);
    }

    for (const forbidden of [
      "createClient(",
      "supabase.from(",
      "storage.from(",
      "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
      "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      expect(frontendSources).not.toContain(forbidden);
    }
  });
});
