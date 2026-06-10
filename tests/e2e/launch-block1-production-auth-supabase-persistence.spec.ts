import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createAuthenticatedRequesterContext,
  createUnauthenticatedRequesterContext,
} from "../../backend/auth/requesterContext";
import { decideProductionAuthOwnership } from "../../backend/auth/productionAuthOwnershipPolicy";
import { resolveSelectedRouteAccess } from "../../backend/auth/protectedRouteGuards";
import { createTrustedAuthProviderStrategyFromRuntimeConfig } from "../../backend/auth/trustedAuthProviderComposition";
import { decideProviderKeyAuthorization } from "../../backend/authorization/providerKeyAuthorization";
import {
  forbiddenProductionPersistencePublicFields,
  getProductionPersistenceBoundarySummary,
} from "../../backend/persistence/productionSupabasePersistenceBoundary";

const readProjectFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const serializedDoesNotLeak = (value: unknown) => {
  const serialized = JSON.stringify(value);

  for (const forbidden of [
    "encrypted_payload",
    "secret_ref",
    "service-role",
    "service_role",
    "api_key",
    "jwt_secret",
    "provider_response_body",
    "provider_headers",
    "local_path",
    "internal_ref",
    "base64",
    "bytes",
    "public_url",
    "signed_url",
    "download_url",
    "sk-",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("Launch Block 1 production auth and Supabase persistence", () => {
  test("protected auth boundary rejects unauthenticated and arbitrary workspace headers", async () => {
    const runtimeConfig = {
      kind: "auth_provider_configured" as const,
      provider: "future_jwt_provider" as const,
      issuer: "https://auth.example.test",
      audience: "free-ai-mixer",
    };
    const accessDecision = await resolveSelectedRouteAccess({
      headers: {
        "x-user-id": "attacker-user",
        "x-workspace-id": "attacker-workspace",
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

    const jwtStrategy =
      createTrustedAuthProviderStrategyFromRuntimeConfig(runtimeConfig);
    const requesterContext = await jwtStrategy.resolveRequesterContext({
      headers: {
        "x-user-id": "attacker-user",
        "x-workspace-id": "attacker-workspace",
      },
    });

    expect(requesterContext).toMatchObject({
      kind: "unauthenticated",
      reason: "missing_credentials",
    });
    serializedDoesNotLeak({ accessDecision, requesterContext });
  });

  test("workspace owner/admin policy allows protected mutations and blocks members", () => {
    const requesterContext = createAuthenticatedRequesterContext({
      appUserId: "block1-app-user",
      authProvider: "jwt",
      authSubject: "block1-subject",
      userId: "block1-user",
      workspaceAuthority: "verified",
      workspaceId: "block1-workspace",
    });

    expect(
      decideProductionAuthOwnership({
        membershipRole: "owner",
        requesterContext,
        surface: "provider_keys",
      }),
    ).toMatchObject({ kind: "allowed", role: "owner" });
    expect(
      decideProductionAuthOwnership({
        membershipRole: "admin",
        requesterContext,
        surface: "generation_jobs",
      }),
    ).toMatchObject({ kind: "allowed", role: "admin" });
    expect(
      decideProductionAuthOwnership({
        membershipRole: "member",
        requesterContext,
        surface: "generated_artifacts",
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "workspace_owner_or_admin_required",
      statusCode: 403,
    });

    expect(
      decideProviderKeyAuthorization({
        action: "add_provider_key",
        actorRole: "member",
        requesterContext,
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "workspace_member_forbidden",
    });
  });

  test("Supabase persistence boundary covers Block 1 tables with safe metadata only", () => {
    const summary = getProductionPersistenceBoundarySummary();
    const tableNames = summary.tables.map((table) => table.tableName);

    expect(summary.autoApplyRemoteMigrations).toBe(false);
    expect(summary.directFrontendSupabaseDbAccess).toBe(false);
    expect(summary.directFrontendSupabaseStorageAccess).toBe(false);
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "app_users",
        "workspaces",
        "workspace_memberships",
        "projects",
        "generation_jobs",
        "generated_artifact_records",
        "image_generation_history",
        "provider_keys",
        "audit_log",
        "analytics_events",
      ]),
    );
    expect(
      summary.tables.find((table) => table.tableName === "projects")?.migration,
    ).toBe("0004_launch_block1_project_generation_persistence_draft.sql");
    expect(
      summary.tables.find((table) => table.tableName === "generation_jobs")
        ?.safeMetadataOnly,
    ).toBe(true);
    expect(forbiddenProductionPersistencePublicFields).toContain(
      "encrypted_payload",
    );
    expect(forbiddenProductionPersistencePublicFields).toContain("secret_ref");
    serializedDoesNotLeak(summary);
  });

  test("migration drafts and docs stay manual, backend-owned, and secret-safe", () => {
    const migration = readProjectFile(
      "backend/db/migrations/0004_launch_block1_project_generation_persistence_draft.sql",
    );
    const architecture = readProjectFile("docs/architecture.md");
    const roadmap = readProjectFile("docs/roadmap.md");
    const knownIssues = readProjectFile("docs/known-issues.md");
    const phases = readProjectFile("docs/phases.md");
    const block0Policy = readProjectFile(
      "src/services/providerCapabilityPolicyService.ts",
    );
    const authPolicy = readProjectFile(
      "backend/auth/productionAuthOwnershipPolicy.ts",
    );
    const persistenceBoundary = readProjectFile(
      "backend/persistence/productionSupabasePersistenceBoundary.ts",
    );
    const combined = [
      architecture,
      roadmap,
      knownIssues,
      phases,
      block0Policy,
    ].join("\n");

    for (const table of [
      "projects",
      "generation_jobs",
      "generated_artifact_records",
      "image_generation_history",
    ]) {
      expect(migration).toContain(`create table if not exists ${table}`);
    }

    expect(migration).toContain("Do not auto-apply this migration to production.");
    expect(migration).toContain("alter table projects enable row level security");
    expect(migration).toContain("Frontend direct Supabase DB/storage access remains forbidden");
    expect(combined).toContain("Block 1 - Production Auth + Supabase Persistence");
    expect(combined).toContain("Free workspace and mock/demo generation are available.");
    expect(combined).toContain("BYOK does not create free provider credits");
    expect(combined).toContain("no remote production migration auto-apply");
    expect(combined).toContain("browser-local history fallback");

    const newBlock1Sources = [migration, authPolicy, persistenceBoundary].join("\n");

    for (const forbidden of [
      "createCheckoutSession",
      "stripe.checkout",
      "api.openai.com/v1/images",
      "signedUrl:",
      "publicUrl:",
      "downloadUrl:",
    ]) {
      expect(newBlock1Sources).not.toContain(forbidden);
    }
  });
});
