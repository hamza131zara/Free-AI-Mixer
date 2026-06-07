import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import { expect, test } from "@playwright/test";
import { createAuthenticatedRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendGeneratedArtifactAccessResponse,
  BackendGenerationJobMutationResponse,
} from "../../backend/contracts/generationRuntimeHttpTypes";
import { createLocalGeneratedImageArtifactStorage } from "../../backend/generation/generatedImageArtifactStorage";
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
  authSubject: "phase169-subject",
  supabaseUserId: "phase169-supabase-user",
  userId: "phase169-user",
  workspaceAuthority: "verified",
  workspaceId: "phase169-workspace",
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
  prompt: "Create a deterministic local mock image for resolver wiring audit.",
  providerId: "openai",
  requestId: "phase169mock0001",
};

const startGenerationServer = async (options: {
  authenticated?: boolean;
  storageRoot?: string;
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
      ...(options.authenticated
        ? {
            routeAccessResolver: {
              resolve: async () => authenticatedRequester,
            },
          }
        : {}),
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
    throw new Error("Phase 169 test server did not expose a TCP port.");
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

const expectNoSensitiveFields = (body: unknown) => {
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
  ]) {
    expect(serialized).not.toContain(forbidden);
  }

  expect(serialized).not.toContain("http://");
  expect(serialized).not.toContain("https://");
  expect(serialized).not.toContain("/exports/");
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

const getAccess = async (
  baseUrl: string,
  input: {
    artifactId: string;
    headers?: HeadersInit;
    jobId: string;
  },
): Promise<{
  body: BackendGeneratedArtifactAccessResponse;
  status: number;
}> => {
  const response = await fetch(
    `${baseUrl}/generation/jobs/${encodeURIComponent(input.jobId)}/artifacts/${encodeURIComponent(input.artifactId)}/access`,
    {
      headers: input.headers,
    },
  );

  return {
    body: (await response.json()) as BackendGeneratedArtifactAccessResponse,
    status: response.status,
  };
};

test.describe("Phase 169 generated image access resolver wiring audit", () => {
  test("stored mock image metadata cannot be previewed until a backend resolver is wired", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase169-mock-image-"),
    );
    const server = await startGenerationServer({
      authenticated: true,
      storageRoot,
    });

    try {
      const generated = await postGenerationJob(server.url);

      expect(generated.status).toBe(200);
      expect(generated.body.kind).toBe("generation_job_metadata_ready");

      if (generated.body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      expect(generated.body.artifact.deliveryStatus).toBe("unavailable");
      expect(generated.body.artifact.providerId).toBe("mock_local");
      expectNoSensitiveFields(generated.body);
      expect(JSON.stringify(generated.body)).not.toContain("jobId");
      expect(JSON.stringify(generated.body)).not.toContain("workspaceId");
      expect(JSON.stringify(generated.body)).not.toContain("ownerId");

      const access = await getAccess(server.url, {
        artifactId: generated.body.artifact.artifactId,
        jobId: generationRequest.requestId,
      });

      expect(access.status).toBe(503);
      expect(access.body).toEqual({
        kind: "generated_artifact_access_unavailable",
        status: "access_not_configured",
        deliveryStatus: "unavailable",
        message: "Generated image artifact preview access is not configured.",
      });
      expectNoSensitiveFields(access.body);

      const jobDirectoryEntries = await fs.readdir(
        path.join(storageRoot, generationRequest.requestId),
      );

      expect(jobDirectoryEntries).toHaveLength(1);
      expect(JSON.stringify(access.body)).not.toContain(storageRoot);
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("arbitrary requester headers do not authenticate generated image access", async () => {
    const server = await startGenerationServer({ authenticated: false });

    try {
      const access = await getAccess(server.url, {
        artifactId: "phase169mock0001_mock_image",
        headers: {
          "x-user-id": "phase169-user",
          "x-workspace-id": "phase169-workspace",
        },
        jobId: generationRequest.requestId,
      });

      expect(access.status).toBe(401);
      expect(access.body.kind).toBe("generated_artifact_access_unavailable");
      expect(access.body.status).toBe("unauthenticated");
      expect(access.body.deliveryStatus).toBe("unavailable");
      expectNoSensitiveFields(access.body);
    } finally {
      await server.close();
    }
  });

  test("generated image access remains generation-specific and separate from export access", async () => {
    const server = await startGenerationServer({ authenticated: true });

    try {
      const exportAccess = await fetch(
        `${server.url}/exports/${generationRequest.requestId}/artifacts/phase169mock0001_mock_image/access`,
      );
      const generatedAccess = await getAccess(server.url, {
        artifactId: "phase169mock0001_mock_image",
        jobId: generationRequest.requestId,
      });

      expect(exportAccess.status).toBe(404);
      expect(generatedAccess.status).toBe(503);
      expect(generatedAccess.body.status).toBe("access_not_configured");
      expectNoSensitiveFields(generatedAccess.body);
    } finally {
      await server.close();
    }
  });
});
