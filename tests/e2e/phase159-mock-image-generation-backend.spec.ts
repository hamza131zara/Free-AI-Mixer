import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import { expect, test } from "@playwright/test";
import { createAuthenticatedRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type { BackendGenerationJobMutationResponse } from "../../backend/contracts/generationRuntimeHttpTypes";
import { createLocalGeneratedImageArtifactStorage } from "../../backend/generation/generatedImageArtifactStorage";
import {
  generationRouteExecutionModeEnvName,
  parseGenerationRouteExecutionMode,
} from "../../backend/generation/generationRuntimeConfig";
import { createGenerationRouter } from "../../backend/routes/generation";

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

const controlsReady = {
  kind: "generation_execution_controls_readiness" as const,
  costControlsReady: true,
  idempotencyReady: true,
  rateLimitReady: true,
  singleFlightReady: true,
};

const authenticatedRequester = createAuthenticatedRequesterContext({
  authProvider: "supabase",
  authSubject: "phase159-subject",
  supabaseUserId: "phase159-supabase-user",
  userId: "phase159-user",
  workspaceAuthority: "verified",
  workspaceId: "phase159-workspace",
  workspaceRole: "owner",
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

const generationRequest = {
  generationKind: "image",
  prompt: "Create a deterministic local mock image for backend artifact storage.",
  providerId: "openai",
  requestId: "phase159mock0001",
};

const startGenerationServer = async (options: {
  storageRoot?: string;
  includeThrowingExecutionDeps?: boolean;
}) => {
  const app = express();

  app.use(express.json());
  app.use(
    createGenerationRouter({
      generationExecutionControlReadiness: controlsReady,
      generationRouteExecutionMode: "mock_image_local_only",
      generationRuntimeConfig,
      ...(options.storageRoot
        ? {
            generatedImageArtifactStorage:
              createLocalGeneratedImageArtifactStorage({
                rootPath: options.storageRoot,
              }),
          }
        : {}),
      ...(options.includeThrowingExecutionDeps
        ? {
            openAiRealProviderFetch: (async () => {
              throw new Error("provider fetch must not be called");
            }) as typeof fetch,
            providerKeyRepository: {
              getActiveValidatedProviderKeyForWorkspaceProvider: async () => {
                throw new Error("provider key lookup must not be called");
              },
            } as never,
            providerSecretVault: {
              getVaultReadiness: () => {
                throw new Error("vault readiness must not be called");
              },
            } as never,
          }
        : {}),
      routeAccessResolver: {
        resolve: async () => authenticatedRequester,
      },
      runtimeConfig,
      workspaceMembershipRepository: ownerMembershipRepository,
    }),
  );

  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Phase 159 test server did not expose a TCP port.");
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

const postGenerationJob = async (
  baseUrl: string,
): Promise<{
  body: BackendGenerationJobMutationResponse;
  status: number;
}> => {
  const response = await fetch(`${baseUrl}/generation/jobs`, {
    body: JSON.stringify(generationRequest),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  return {
    body: (await response.json()) as BackendGenerationJobMutationResponse,
    status: response.status,
  };
};

const expectNoSensitiveGenerationFields = (body: unknown) => {
  const serialized = JSON.stringify(body);

  for (const forbidden of [
    "base64",
    "b64_json",
    "bytes",
    "downloadUrl",
    "encrypted_payload",
    "filePath",
    "internalRef",
    "localPath",
    "publicUrl",
    "rootPath",
    "secret_ref",
    "signedUrl",
    "storageRef",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }

  expect(serialized).not.toContain("http://");
  expect(serialized).not.toContain("https://");
};

test.describe("Phase 159 mock image generation backend", () => {
  test("mock_image_local_only stores verified PNG bytes and returns safe metadata", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase159-mock-image-"),
    );
    const server = await startGenerationServer({
      includeThrowingExecutionDeps: true,
      storageRoot,
    });

    try {
      const { body, status } = await postGenerationJob(server.url);

      expect(status).toBe(200);
      expect(body.kind).toBe("generation_job_metadata_ready");

      if (body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock metadata-ready response.");
      }

      expect(body.status).toBe("generated_metadata_ready");
      expect(body.message).toContain("Mock local image generation");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["mock_local"]);
      expect(body.artifact.providerId).toBe("mock_local");
      expect(body.artifact.contentType).toBe("image/png");
      expect(body.artifact.sizeBytes).toBeGreaterThan(0);
      expect(body.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(body.artifact.deliveryStatus).toBe("unavailable");
      expectNoSensitiveGenerationFields(body);

      const jobDirectoryEntries = await fs.readdir(
        path.join(storageRoot, generationRequest.requestId),
      );

      expect(jobDirectoryEntries).toHaveLength(1);
      expect(jobDirectoryEntries[0]).toMatch(/\.png$/);
      expect(JSON.stringify(body)).not.toContain(storageRoot);
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("mock_image_local_only fails closed when generated image storage is missing", async () => {
    const server = await startGenerationServer({});

    try {
      const { body, status } = await postGenerationJob(server.url);

      expect(status).toBe(503);
      expect(body.kind).toBe("generation_job_rejected");

      if (body.kind !== "generation_job_rejected") {
        throw new Error("Expected mock storage-unavailable rejection.");
      }

      expect(body.status).toBe("artifact_storage_unavailable");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["mock_local"]);
      expectNoSensitiveGenerationFields(body);
    } finally {
      await server.close();
    }
  });

  test("mock route mode is explicit and real provider modes remain selectable separately", () => {
    expect(
      parseGenerationRouteExecutionMode({
        [generationRouteExecutionModeEnvName]: "mock_image_local_only",
      }),
    ).toBe("mock_image_local_only");
    expect(
      parseGenerationRouteExecutionMode({
        [generationRouteExecutionModeEnvName]: "real_provider_local_only",
      }),
    ).toBe("real_provider_local_only");
    expect(
      parseGenerationRouteExecutionMode({
        [generationRouteExecutionModeEnvName]: "openai_adapter_mock_storage_only",
      }),
    ).toBe("openai_adapter_mock_storage_only");
  });
});
