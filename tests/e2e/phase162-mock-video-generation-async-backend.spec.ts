import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import { expect, test } from "@playwright/test";
import { createAuthenticatedRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type { BackendGenerationJobMutationResponse } from "../../backend/contracts/generationRuntimeHttpTypes";
import {
  createLocalGeneratedImageArtifactStorage,
  type GeneratedImageArtifactStorage,
} from "../../backend/generation/generatedImageArtifactStorage";
import {
  generationRouteExecutionModeEnvName,
  parseGenerationRouteExecutionMode,
  type BackendGenerationRouteExecutionMode,
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
  authSubject: "phase162-subject",
  supabaseUserId: "phase162-supabase-user",
  userId: "phase162-user",
  workspaceAuthority: "verified",
  workspaceId: "phase162-workspace",
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

const throwingStorage: GeneratedImageArtifactStorage = {
  cleanup: async () => {
    throw new Error("video mock mode must not call artifact cleanup");
  },
  store: async () => {
    throw new Error("video mock mode must not write fake video artifacts");
  },
};

const startGenerationServer = async (options: {
  mode: BackendGenerationRouteExecutionMode;
  storage?: GeneratedImageArtifactStorage;
}) => {
  const app = express();

  app.use(express.json());
  app.use(
    createGenerationRouter({
      generatedImageArtifactStorage: options.storage,
      generationExecutionControlReadiness: controlsReady,
      generationRouteExecutionMode: options.mode,
      generationRuntimeConfig,
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
    throw new Error("Phase 162 test server did not expose a TCP port.");
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
  body: Record<string, unknown>,
): Promise<{
  body: BackendGenerationJobMutationResponse;
  status: number;
}> => {
  const response = await fetch(`${baseUrl}/generation/jobs`, {
    body: JSON.stringify(body),
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
    "api.openai.com",
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
    "videoBytes",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }

  expect(serialized).not.toContain("http://");
  expect(serialized).not.toContain("https://");
};

const videoRequest = {
  generationKind: "video",
  prompt: "A safe mock-local video generation request.",
  providerId: "mock_local",
  requestId: "phase162video0001",
};

const imageRequest = {
  generationKind: "image",
  prompt: "A deterministic local mock image for regression coverage.",
  providerId: "openai",
  requestId: "phase162image0001",
};

test.describe("Phase 162 mock video generation async backend", () => {
  test("mock_video_local_only accepts video request and fails closed truthfully", async () => {
    const server = await startGenerationServer({
      mode: "mock_video_local_only",
      storage: throwingStorage,
    });

    try {
      const { body, status } = await postGenerationJob(server.url, videoRequest);

      expect(status).toBe(503);
      expect(body.kind).toBe("generation_job_rejected");

      if (body.kind !== "generation_job_rejected") {
        throw new Error("Expected mock video rejected response.");
      }

      expect(body.status).toBe("video_artifact_storage_unavailable");
      expect(body.generationKind).toBe("video");
      expect(body.lifecycle).toBe("failed");
      expect(body.lifecycleTrace).toEqual(["submitted", "processing", "failed"]);
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["mock_local"]);
      expect(body.diagnosticCode).toBe("video_artifact_verification_unavailable");
      expect(body.failureCategory).toBe("artifact_storage");
      expect(body.message).toContain("verified video artifact storage is not available");
      expectNoSensitiveGenerationFields(body);
    } finally {
      await server.close();
    }
  });

  test("video request is blocked outside mock_video_local_only mode", async () => {
    const server = await startGenerationServer({
      mode: "mock_image_local_only",
      storage: throwingStorage,
    });

    try {
      const { body, status } = await postGenerationJob(server.url, videoRequest);

      expect(status).toBe(503);
      expect(body.kind).toBe("generation_job_rejected");

      if (body.kind !== "generation_job_rejected") {
        throw new Error("Expected unsupported mode rejection.");
      }

      expect(body.status).toBe("generation_execution_blocked");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["mock_local"]);
      expectNoSensitiveGenerationFields(body);
    } finally {
      await server.close();
    }
  });

  test("mock image generation still stores verified metadata", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase162-image-regression-"),
    );
    const server = await startGenerationServer({
      mode: "mock_image_local_only",
      storage: createLocalGeneratedImageArtifactStorage({
        rootPath: storageRoot,
      }),
    });

    try {
      const { body, status } = await postGenerationJob(server.url, imageRequest);

      expect(status).toBe(200);
      expect(body.kind).toBe("generation_job_metadata_ready");

      if (body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      expect(body.status).toBe("generated_metadata_ready");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["mock_local"]);
      expect(body.artifact.providerId).toBe("mock_local");
      expect(body.artifact.contentType).toBe("image/png");
      expect(body.artifact.sizeBytes).toBeGreaterThan(0);
      expect(body.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      expectNoSensitiveGenerationFields(body);
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("mock video route mode is explicit and unsupported mode fails closed", () => {
    expect(
      parseGenerationRouteExecutionMode({
        [generationRouteExecutionModeEnvName]: "mock_video_local_only",
      }),
    ).toBe("mock_video_local_only");
    expect(
      parseGenerationRouteExecutionMode({
        [generationRouteExecutionModeEnvName]: "not_a_real_mode",
      }),
    ).toBe("disabled");
  });
});
