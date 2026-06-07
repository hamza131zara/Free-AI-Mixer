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
  authSubject: "phase168-subject",
  supabaseUserId: "phase168-supabase-user",
  userId: "phase168-user",
  workspaceAuthority: "verified",
  workspaceId: "phase168-workspace",
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
  prompt: "Create a deterministic local mock image for access boundary audit.",
  providerId: "openai",
  requestId: "phase168mock0001",
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
    throw new Error("Phase 168 test server did not expose a TCP port.");
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

const expectNoSensitiveAccessFields = (body: unknown) => {
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

const getAccess = async (
  baseUrl: string,
  headers?: HeadersInit,
): Promise<{
  body: BackendGeneratedArtifactAccessResponse;
  status: number;
}> => {
  const response = await fetch(
    `${baseUrl}/generation/jobs/phase168mock0001/artifacts/phase168artifact/access`,
    {
      headers,
    },
  );

  return {
    body: (await response.json()) as BackendGeneratedArtifactAccessResponse,
    status: response.status,
  };
};

test.describe("Phase 168 generated image preview/access boundary", () => {
  test("generated artifact access route fails closed by default after auth", async () => {
    const server = await startGenerationServer({ authenticated: true });

    try {
      const { body, status } = await getAccess(server.url);

      expect(status).toBe(503);
      expect(body).toEqual({
        kind: "generated_artifact_access_unavailable",
        status: "access_not_configured",
        deliveryStatus: "unavailable",
        message: "Generated image artifact preview access is not configured.",
      });
      expectNoSensitiveAccessFields(body);
    } finally {
      await server.close();
    }
  });

  test("arbitrary frontend auth headers are not trusted for generated artifact access", async () => {
    const server = await startGenerationServer({ authenticated: false });

    try {
      const { body, status } = await getAccess(server.url, {
        "x-user-id": "phase168-user",
        "x-workspace-id": "phase168-workspace",
      });

      expect(status).toBe(401);
      expect(body.kind).toBe("generated_artifact_access_unavailable");
      expect(body.status).toBe("unauthenticated");
      expect(body.deliveryStatus).toBe("unavailable");
      expectNoSensitiveAccessFields(body);
    } finally {
      await server.close();
    }
  });

  test("generated artifact access is generation-specific and does not reuse export routes", async () => {
    const server = await startGenerationServer({ authenticated: true });

    try {
      const exportAccessResponse = await fetch(
        `${server.url}/exports/phase168mock0001/artifacts/phase168artifact/access`,
      );
      const generationAccess = await getAccess(server.url);

      expect(exportAccessResponse.status).toBe(404);
      expect(generationAccess.status).toBe(503);
      expect(JSON.stringify(generationAccess.body)).not.toContain("/exports/");
      expectNoSensitiveAccessFields(generationAccess.body);
    } finally {
      await server.close();
    }
  });

  test("mock image generation metadata behavior remains unchanged", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase168-mock-image-"),
    );
    const server = await startGenerationServer({
      authenticated: true,
      storageRoot,
    });

    try {
      const response = await fetch(`${server.url}/generation/jobs`, {
        body: JSON.stringify(generationRequest),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as BackendGenerationJobMutationResponse;

      expect(response.status).toBe(200);
      expect(body.kind).toBe("generation_job_metadata_ready");

      if (body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      expect(body.artifact.providerId).toBe("mock_local");
      expect(body.artifact.contentType).toBe("image/png");
      expect(body.artifact.deliveryStatus).toBe("unavailable");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["mock_local"]);
      expectNoSensitiveAccessFields(body);

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
});
