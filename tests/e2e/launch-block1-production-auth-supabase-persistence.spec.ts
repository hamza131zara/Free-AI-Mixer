import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { expect, test } from "@playwright/test";
import {
  createAuthenticatedRequesterContext,
  createUnauthenticatedRequesterContext,
} from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import { decideProductionAuthOwnership } from "../../backend/auth/productionAuthOwnershipPolicy";
import { resolveSelectedRouteAccess } from "../../backend/auth/protectedRouteGuards";
import { createTrustedAuthProviderStrategyFromRuntimeConfig } from "../../backend/auth/trustedAuthProviderComposition";
import { decideProviderKeyAuthorization } from "../../backend/authorization/providerKeyAuthorization";
import { createInMemoryGeneratedImageArtifactRegistry } from "../../backend/generation/generatedImageArtifactRegistry";
import { createLocalGeneratedImageArtifactStorage } from "../../backend/generation/generatedImageArtifactStorage";
import { createRegistryBackedGeneratedImageArtifactAccessResolver } from "../../backend/generation/generatedImageArtifactAccess";
import { createGenerationRouter } from "../../backend/routes/generation";
import { createProjectHistoryRouter } from "../../backend/routes/projectHistory";
import {
  createNotConfiguredProductionSupabasePersistenceWriter,
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

const runtimeConfig = {
  kind: "auth_provider_configured" as const,
  provider: "future_jwt_provider" as const,
};

const generationRuntimeConfig = {
  kind: "generation_runtime_config" as const,
  allowRealProviderCalls: false,
  providerAdapter: "not_configured" as const,
  runtimeEnabled: true,
};

const generationControlsReady = {
  kind: "generation_execution_controls_readiness" as const,
  costControlsReady: true,
  idempotencyReady: true,
  rateLimitReady: true,
  singleFlightReady: true,
};

const ownerRequesterContext = createAuthenticatedRequesterContext({
  appUserId: "block1-app-user",
  authProvider: "jwt",
  authSubject: "block1-subject",
  userId: "block1-user",
  workspaceAuthority: "verified",
  workspaceId: "block1-workspace",
});

const ownerMembershipRepository: WorkspaceMembershipRepository = {
  getMembership: async ({ userId, workspaceId }) => ({
    kind: "member",
    membership: {
      role: "owner",
      source: "workspace_memberships",
      status: "active",
      userId,
      workspaceId,
    },
  }),
};

const viewerMembershipRepository: WorkspaceMembershipRepository = {
  getMembership: async ({ userId, workspaceId }) => ({
    kind: "member",
    membership: {
      role: "viewer",
      source: "workspace_memberships",
      status: "active",
      userId,
      workspaceId,
    },
  }),
};

const startExpressServer = async (app: express.Express) => {
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Launch Block 1 test server did not expose a TCP port.");
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    server,
    url: `http://127.0.0.1:${address.port}`,
  } satisfies {
    close: () => Promise<void>;
    server: Server;
    url: string;
  };
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

  test("production generation routes fail closed when trusted auth is not configured", async () => {
    const app = express();

    app.use(express.json());
    app.use(
      createGenerationRouter({
        generationExecutionControlReadiness: generationControlsReady,
        generationRouteExecutionMode: "mock_image_local_only",
        generationRuntimeConfig,
        routeAccessResolver: {
          resolve: async () =>
            createUnauthenticatedRequesterContext("auth_not_configured"),
        },
        runtimeConfig: {
          kind: "auth_provider_not_configured",
        },
      }),
    );
    const server = await startExpressServer(app);

    try {
      const response = await fetch(`${server.url}/generation/jobs`, {
        body: JSON.stringify({
          generationKind: "image",
          prompt: "Create a local mock image for Block 1 auth testing.",
          providerId: "openai",
          requestId: "block1auth001",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "spoofed-user",
          "x-workspace-id": "spoofed-workspace",
        },
        method: "POST",
      });
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toMatchObject({
        kind: "generation_job_rejected",
        status: "auth_not_configured",
      });
      serializedDoesNotLeak(body);
    } finally {
      await server.close();
    }
  });

  test("local mock generation remains explicit and reports unavailable persistence without fake success", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "free-ai-mixer-block1-"));
    const app = express();
    const registry = createInMemoryGeneratedImageArtifactRegistry();
    const persistenceWriter =
      createNotConfiguredProductionSupabasePersistenceWriter();

    app.use(express.json());
    app.use(
      createGenerationRouter({
        generatedImageArtifactAccessResolver:
          createRegistryBackedGeneratedImageArtifactAccessResolver({
            registry,
          }),
        generatedImageArtifactRegistry: registry,
        generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
          rootPath: storageRoot,
        }),
        generationExecutionControlReadiness: generationControlsReady,
        generationRouteExecutionMode: "mock_image_local_only",
        generationRuntimeConfig,
        productionAuthOwnershipPolicyEnabled: true,
        productionPersistenceWriter: persistenceWriter,
        routeAccessResolver: {
          resolve: async () => ownerRequesterContext,
        },
        runtimeConfig,
        workspaceMembershipRepository: ownerMembershipRepository,
      }),
    );
    const server = await startExpressServer(app);

    try {
      const response = await fetch(`${server.url}/generation/jobs`, {
        body: JSON.stringify({
          generationKind: "image",
          prompt: "Create a deterministic local mock image for Block 1.",
          providerId: "openai",
          requestId: "block1mock001",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "spoofed-user",
          "x-workspace-id": "spoofed-workspace",
        },
        method: "POST",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        attemptedProviderIds: ["mock_local"],
        kind: "generation_job_metadata_ready",
        persistence: {
          status: "persistence_unavailable",
        },
        runtime: {
          vendorCallsEnabled: false,
        },
        status: "generated_metadata_ready",
      });
      expect(body.persistence.message).toContain("browser-local history");
      serializedDoesNotLeak(body);
    } finally {
      await server.close();
      rmSync(storageRoot, { force: true, recursive: true });
    }
  });

  test("generated artifact access does not bypass production ownership policy", async () => {
    const app = express();

    app.use(express.json());
    app.use(
      createGenerationRouter({
        generationRouteExecutionMode: "mock_image_local_only",
        generationRuntimeConfig,
        productionAuthOwnershipPolicyEnabled: true,
        routeAccessResolver: {
          resolve: async () => ownerRequesterContext,
        },
        runtimeConfig,
        workspaceMembershipRepository: viewerMembershipRepository,
      }),
    );
    const server = await startExpressServer(app);

    try {
      const response = await fetch(
        `${server.url}/generation/jobs/block1job/artifacts/block1artifact/access`,
        {
          headers: {
            "x-user-id": "block1-user",
            "x-workspace-id": "block1-workspace",
          },
        },
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toMatchObject({
        deliveryStatus: "unavailable",
        kind: "generated_artifact_access_unavailable",
        status: "generated_artifact_access_unavailable",
      });
      serializedDoesNotLeak(body);
    } finally {
      await server.close();
    }
  });

  test("project and history routes expose persistence unavailable instead of fake durable success", async () => {
    const app = express();

    app.use(express.json());
    app.use(
      createProjectHistoryRouter({
        productionPersistenceWriter:
          createNotConfiguredProductionSupabasePersistenceWriter(),
        routeAccessResolver: {
          resolve: async () => ownerRequesterContext,
        },
        runtimeConfig,
      }),
    );
    const server = await startExpressServer(app);

    try {
      const projectsResponse = await fetch(
        `${server.url}/project-library/projects`,
        {
          headers: {
            "x-user-id": "spoofed-user",
            "x-workspace-id": "spoofed-workspace",
          },
        },
      );
      const historyResponse = await fetch(
        `${server.url}/project-library/history`,
      );
      const projectsBody = await projectsResponse.json();
      const historyBody = await historyResponse.json();

      expect(projectsResponse.status).toBe(200);
      expect(projectsBody).toMatchObject({
        kind: "project_library",
        persistence: "persistence_unavailable",
        projects: [],
        status: "authenticated",
      });
      expect(projectsBody.message).toContain("browser-local");
      expect(historyResponse.status).toBe(200);
      expect(historyBody).toMatchObject({
        exports: [],
        historyState: "persistence_unavailable",
        kind: "export_history",
        status: "authenticated",
      });
      expect(historyBody.message).toContain("browser-local");
      serializedDoesNotLeak({ historyBody, projectsBody });
    } finally {
      await server.close();
    }
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
