import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import { expect, test, type Page } from "@playwright/test";
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

const tinyPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const imageMetadataResponse = {
  kind: "generation_job_metadata_ready",
  status: "generated_metadata_ready",
  message:
    "Mock local image generation produced verified local metadata for backend smoke only; delivery remains unavailable.",
  artifact: {
    artifactId: "phase171-image-artifact",
    providerId: "mock_local",
    contentType: "image/png",
    sizeBytes: tinyPngBytes.length,
    sha256:
      "1711711711711711711711711711711711711711711711711711711711711711",
    createdAt: "2026-06-07T00:00:00.000Z",
    deliveryStatus: "unavailable",
  },
  runtime: {
    vendorCallsEnabled: false,
  },
  attemptedProviderIds: ["mock_local"],
};

const videoUnavailableResponse = {
  kind: "generation_job_rejected",
  status: "video_artifact_storage_unavailable",
  message:
    "Mock video generation preconditions passed, but verified video artifact storage is not available yet.",
  runtime: {
    vendorCallsEnabled: false,
  },
  attemptedProviderIds: ["mock_local"],
  generationKind: "video",
  lifecycle: "failed",
  lifecycleTrace: ["submitted", "processing", "failed"],
  diagnosticCode: "video_artifact_verification_unavailable",
  failureCategory: "artifact_storage",
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

const controlsReady = {
  kind: "generation_execution_controls_readiness" as const,
  costControlsReady: true,
  idempotencyReady: true,
  rateLimitReady: true,
  singleFlightReady: true,
};

const authenticatedRequester = createAuthenticatedRequesterContext({
  authProvider: "supabase",
  authSubject: "phase171-subject",
  supabaseUserId: "phase171-supabase-user",
  userId: "phase171-user",
  workspaceAuthority: "verified",
  workspaceId: "phase171-workspace",
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
  prompt: "Create a deterministic local mock image for backend preview.",
  providerId: "openai",
  requestId: "phase171mock0001",
};

const forbiddenTokens = [
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "runwayml.com",
  "supabase.co/storage",
  "base64",
  "b64_json",
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
];

const expectNoSensitiveFields = (body: unknown) => {
  const serialized = JSON.stringify(body);

  for (const forbidden of forbiddenTokens) {
    expect(serialized).not.toContain(forbidden);
  }

  expect(serialized).not.toContain("http://");
  expect(serialized).not.toContain("https://");
  expect(serialized).not.toContain("/exports/");
};

const startGenerationServer = async (options: {
  authenticated?: boolean;
  localPreviewEnabled?: boolean;
  storageRoot?: string;
}) => {
  const app = express();
  const registry = createInMemoryGeneratedImageArtifactRegistry();

  app.use(express.json());
  app.use(
    createGenerationRouter({
      generatedImageLocalPreviewEnabled: options.localPreviewEnabled,
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
    throw new Error("Phase 171 test server did not expose a TCP port.");
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

const getPreview = async (
  baseUrl: string,
  input: {
    artifactId: string;
    headers?: HeadersInit;
    jobId: string;
  },
): Promise<Response> =>
  fetch(
    `${baseUrl}/generation/jobs/${encodeURIComponent(input.jobId)}/artifacts/${encodeURIComponent(input.artifactId)}/preview`,
    {
      headers: input.headers,
    },
  );

const expectPngResponse = async (response: Response) => {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-disposition")).toBeNull();

  const bytes = Buffer.from(await response.arrayBuffer());

  expect([...bytes.subarray(0, 8)]).toEqual([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]);
};

const installNetworkTripwires = async (page: Page) => {
  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (
      url.includes("api.openai.com") ||
      url.includes("generativelanguage.googleapis.com") ||
      url.includes("runway") ||
      url.includes("pika") ||
      url.includes("veo") ||
      url.includes("supabase.co/storage")
    ) {
      throw new Error(`Unexpected external provider/storage call: ${url}`);
    }

    await route.continue();
  });
};

const expectNoFrontendSensitiveTokens = async (page: Page) => {
  const visibleText = await page.locator("body").innerText();
  const browserState = await page.evaluate(() =>
    JSON.stringify({
      cookies: document.cookie,
      localStorage: { ...window.localStorage },
      sessionStorage: { ...window.sessionStorage },
      url: window.location.href,
    }),
  );
  const combined = `${visibleText}\n${browserState}`;

  for (const forbidden of forbiddenTokens) {
    expect(combined).not.toContain(forbidden);
  }
};

test.describe("Phase 171 generated image backend-mediated local preview", () => {
  test("preview route is disabled by default and fails closed", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase171-disabled-"),
    );
    const server = await startGenerationServer({
      authenticated: true,
      localPreviewEnabled: false,
      storageRoot,
    });

    try {
      const generated = await postGenerationJob(server.url);

      if (generated.body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      const preview = await getPreview(server.url, {
        artifactId: generated.body.artifact.artifactId,
        jobId: generationRequest.requestId,
      });
      const body = (await preview.json()) as BackendGeneratedArtifactAccessResponse;

      expect(preview.status).toBe(503);
      expect(body.kind).toBe("generated_artifact_access_unavailable");
      expect(body.deliveryStatus).toBe("unavailable");
      expectNoSensitiveFields(body);
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("enabled preview route serves registered mock image bytes through backend only", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase171-preview-"),
    );
    const server = await startGenerationServer({
      authenticated: true,
      localPreviewEnabled: true,
      storageRoot,
    });

    try {
      const generated = await postGenerationJob(server.url);

      expect(generated.status).toBe(200);
      expect(generated.body.kind).toBe("generation_job_metadata_ready");

      if (generated.body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      expectNoSensitiveFields(generated.body);

      const preview = await getPreview(server.url, {
        artifactId: generated.body.artifact.artifactId,
        jobId: generationRequest.requestId,
      });

      await expectPngResponse(preview);
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("unknown, mismatched, and unauthenticated preview requests fail closed", async () => {
    const storageRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "phase171-fail-"),
    );
    const server = await startGenerationServer({
      authenticated: true,
      localPreviewEnabled: true,
      storageRoot,
    });

    try {
      const generated = await postGenerationJob(server.url);

      if (generated.body.kind !== "generation_job_metadata_ready") {
        throw new Error("Expected mock image metadata-ready response.");
      }

      const unknown = await getPreview(server.url, {
        artifactId: "missing_artifact",
        jobId: generationRequest.requestId,
      });
      const mismatched = await getPreview(server.url, {
        artifactId: generated.body.artifact.artifactId,
        jobId: "different_job",
      });

      for (const response of [unknown, mismatched]) {
        const body = (await response.json()) as BackendGeneratedArtifactAccessResponse;

        expect(response.status).toBe(404);
        expect(body.kind).toBe("generated_artifact_access_unavailable");
        expect(body.deliveryStatus).toBe("unavailable");
        expectNoSensitiveFields(body);
      }
    } finally {
      await server.close();
      await fs.rm(storageRoot, { force: true, recursive: true });
    }

    const unauthenticated = await startGenerationServer({
      authenticated: false,
      localPreviewEnabled: true,
      storageRoot,
    });

    try {
      const response = await getPreview(unauthenticated.url, {
        artifactId: "phase171-image-artifact",
        headers: {
          "x-user-id": "phase171-user",
          "x-workspace-id": "phase171-workspace",
        },
        jobId: generationRequest.requestId,
      });
      const body = (await response.json()) as BackendGeneratedArtifactAccessResponse;

      expect(response.status).toBe(401);
      expect(body.status).toBe("unauthenticated");
      expectNoSensitiveFields(body);
    } finally {
      await unauthenticated.close();
    }
  });

  test("frontend renders only a backend-mediated relative image preview", async ({
    page,
  }) => {
    const generationRequests: unknown[] = [];
    const previewRequests: string[] = [];

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await installNetworkTripwires(page);
    await page.route("**/generation/jobs", async (route) => {
      const body = route.request().postDataJSON() as { generationKind?: string };
      generationRequests.push(body);

      await route.fulfill({
        body: JSON.stringify(
          body.generationKind === "video"
            ? videoUnavailableResponse
            : imageMetadataResponse,
        ),
        contentType: "application/json",
        status: body.generationKind === "video" ? 503 : 200,
      });
    });
    await page.route("**/generation/jobs/*/artifacts/*/preview", async (route) => {
      previewRequests.push(route.request().url());
      await route.fulfill({
        body: tinyPngBytes,
        contentType: "image/png",
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
        status: 200,
      });
    });

    await page.goto("/mixer");

    await page
      .getByLabel("Image prompt")
      .fill("Phase 171 backend-mediated preview smoke.");
    await page.getByRole("button", { name: "Generate Image" }).click();

    const preview = page.getByRole("img", {
      name: "Backend-mediated generated image preview",
    });

    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute(
      "src",
      /\/generation\/jobs\/.+\/artifacts\/phase171-image-artifact\/preview/,
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "mock_local",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "unavailable",
    );

    await page
      .getByLabel("Video prompt")
      .fill("Phase 171 video should remain unavailable.");
    await page.getByRole("button", { name: "Generate Video" }).click();

    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "video_artifact_storage_unavailable",
    );
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0);
    await expectNoFrontendSensitiveTokens(page);

    expect(generationRequests).toHaveLength(2);
    expect(previewRequests).toHaveLength(1);
    expect(previewRequests[0]).toContain("/generation/jobs/");
    expect(previewRequests[0]).toContain("/artifacts/phase171-image-artifact/preview");
    expect(previewRequests[0]).not.toContain("/exports/");
    expect(previewRequests[0]).not.toContain("supabase");
  });
});
