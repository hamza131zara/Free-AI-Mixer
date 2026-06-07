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
import { createRegistryBackedGeneratedImageArtifactAccessResolver } from "../../backend/generation/generatedImageArtifactAccess";
import { createInMemoryGeneratedImageArtifactRegistry } from "../../backend/generation/generatedImageArtifactRegistry";
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
  authSubject: "phase170-subject",
  supabaseUserId: "phase170-supabase-user",
  userId: "phase170-user",
  workspaceAuthority: "verified",
  workspaceId: "phase170-workspace",
  workspaceRole: "owner",
});

const otherRequester = createAuthenticatedRequesterContext({
  authProvider: "supabase",
  authSubject: "phase170-other-subject",
  supabaseUserId: "phase170-other-supabase-user",
  userId: "phase170-other-user",
  workspaceAuthority: "verified",
  workspaceId: "phase170-other-workspace",
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
  prompt: "Create a deterministic local mock image for registry descriptor audit.",
  providerId: "openai",
  requestId: "phase170mock0001",
};

const startGenerationServer = async (options: {
  authenticated?: boolean;
  requester?: typeof authenticatedRequester;
  storageRoot?: string;
}) => {
  const app = express();
  const registry = createInMemoryGeneratedImageArtifactRegistry();

  app.use(express.json());
  app.use(
    createGenerationRouter({
      generationExecutionControlReadiness: controlsReady,
      generationRouteExecutionMode: "mock_image_local_only",
      generationRuntimeConfig,
      ...(options.storageRoot
        ? {
            generatedImageArtifactAccessResolver:
              createRegistryBackedGeneratedImageArtifactAccessResolver({
                registry,
              }),
            generatedImageArtifactRegistry: registry,
            generatedImageArtifactStorage:
              createLocalGeneratedImageArtifactStorage({
                rootPath: options.storageRoot,
              }),
          }
        : {}),
      ...(options.authenticated
        ? {
            routeAccessResolver: {
              resolve: async () => options.requester ?? authenticatedRequester,
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
    throw new Error("Phase 170 test server did not expose a TCP port.");
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
    registry,
    server,
    url: `http://127.0.0.1:${address.port}`,
  } satisfies {
    close: () => Promise<void>;
    registry: ReturnType<typeof createInMemoryGeneratedImageArtifactRegistry>;
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

test.describe("Phase 170 generated image access registry descriptor boundary", () => {
  test("mock image generation registers artifact internally while public response stays metadata-only", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase170-mock-image-"),
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

      const artifactId = generated.body.artifact.artifactId;
      const record = server.registry.get({
        artifactId,
        jobId: generationRequest.requestId,
      });

      expect(record?.artifact.artifactId).toBe(artifactId);
      expect(record?.artifact.workspaceId).toBe("phase170-workspace");
      expect(record?.artifact.ownerId).toBe("phase170-user");
      expect(record?.internalRef).toBeDefined();
      expect(generated.body.artifact.deliveryStatus).toBe("unavailable");
      expectNoSensitiveFields(generated.body);
      expect(JSON.stringify(generated.body)).not.toContain(storageRoot);
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("registered artifact access resolves internally but still returns descriptor-disabled JSON", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase170-access-"),
    );
    const server = await startGenerationServer({
      authenticated: true,
      storageRoot,
    });

    try {
      const generated = await postGenerationJob(server.url);

      if (generated.body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      const access = await getAccess(server.url, {
        artifactId: generated.body.artifact.artifactId,
        jobId: generationRequest.requestId,
      });

      expect(access.status).toBe(503);
      expect(access.body).toEqual({
        kind: "generated_artifact_access_unavailable",
        status: "descriptor_not_enabled",
        deliveryStatus: "unavailable",
        message:
          "Generated image artifact metadata is registered, but preview delivery is not enabled.",
      });
      expectNoSensitiveFields(access.body);
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("unknown and mismatched generated artifact access fail closed", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase170-mismatch-"),
    );
    const server = await startGenerationServer({
      authenticated: true,
      storageRoot,
    });

    try {
      const generated = await postGenerationJob(server.url);

      if (generated.body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      const unknown = await getAccess(server.url, {
        artifactId: "missing_artifact",
        jobId: generationRequest.requestId,
      });
      const mismatched = await getAccess(server.url, {
        artifactId: generated.body.artifact.artifactId,
        jobId: "different_job",
      });

      for (const access of [unknown, mismatched]) {
        expect(access.status).toBe(503);
        expect(access.body.kind).toBe("generated_artifact_access_unavailable");
        expect(access.body.status).toBe("generated_artifact_access_unavailable");
        expect(access.body.deliveryStatus).toBe("unavailable");
        expectNoSensitiveFields(access.body);
      }
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("arbitrary headers and mismatched requester ownership do not expose registered artifacts", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase170-auth-"),
    );
    const ownerServer = await startGenerationServer({
      authenticated: true,
      storageRoot,
    });

    try {
      const generated = await postGenerationJob(ownerServer.url);

      if (generated.body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      const noAuthServer = await startGenerationServer({
        authenticated: false,
        storageRoot,
      });

      try {
        const arbitraryHeaders = await getAccess(noAuthServer.url, {
          artifactId: generated.body.artifact.artifactId,
          headers: {
            "x-user-id": "phase170-user",
            "x-workspace-id": "phase170-workspace",
          },
          jobId: generationRequest.requestId,
        });

        expect(arbitraryHeaders.status).toBe(401);
        expect(arbitraryHeaders.body.status).toBe("unauthenticated");
        expectNoSensitiveFields(arbitraryHeaders.body);
      } finally {
        await noAuthServer.close();
      }

      const otherServer = await startGenerationServer({
        authenticated: true,
        requester: otherRequester,
        storageRoot,
      });

      try {
        otherServer.registry.register(
          ownerServer.registry.get({
            artifactId: generated.body.artifact.artifactId,
            jobId: generationRequest.requestId,
          })!,
        );

        const wrongRequester = await getAccess(otherServer.url, {
          artifactId: generated.body.artifact.artifactId,
          jobId: generationRequest.requestId,
        });

        expect(wrongRequester.status).toBe(503);
        expect(wrongRequester.body.status).toBe(
          "generated_artifact_access_unavailable",
        );
        expectNoSensitiveFields(wrongRequester.body);
      } finally {
        await otherServer.close();
      }
    } finally {
      await ownerServer.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("default Phase 168 fail-closed behavior remains safe without registry wiring", async () => {
    const app = express();

    app.use(express.json());
    app.use(
      createGenerationRouter({
        generationExecutionControlReadiness: controlsReady,
        generationRouteExecutionMode: "mock_image_local_only",
        generationRuntimeConfig,
        routeAccessResolver: {
          resolve: async () => authenticatedRequester,
        },
        runtimeConfig,
        workspaceMembershipRepository: ownerMembershipRepository,
      }),
    );

    const rawServer = createServer(app);

    await new Promise<void>((resolve) => {
      rawServer.listen(0, "127.0.0.1", resolve);
    });

    const address = rawServer.address();

    if (!address || typeof address === "string") {
      throw new Error("Phase 170 raw server did not expose a TCP port.");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const access = await getAccess(baseUrl, {
        artifactId: "phase170artifact",
        jobId: "phase170job",
      });

      expect(access.status).toBe(503);
      expect(access.body.status).toBe("access_not_configured");
      expectNoSensitiveFields(access.body);
    } finally {
      await new Promise<void>((resolve, reject) => {
        rawServer.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
