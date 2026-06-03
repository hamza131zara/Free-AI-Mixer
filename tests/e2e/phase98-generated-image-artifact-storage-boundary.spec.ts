import { expect, test } from "@playwright/test";
import express from "express";
import { mkdtempSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import {
  createLocalGeneratedImageArtifactStorage,
  createNotConfiguredGeneratedImageArtifactStorage,
  type GeneratedImageArtifactMetadata,
} from "../../backend/generation/generatedImageArtifactStorage";
import {
  verifyGeneratedImageArtifactBytes,
  type GeneratedImageArtifactContentType,
  type GeneratedImageArtifactFormat,
} from "../../backend/generation/generatedImageArtifactVerification";
import { createOpenAiImageGenerationAdapter } from "../../backend/generation/openAiImageGenerationAdapter";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import { createGenerationRouter } from "../../backend/routes/generation";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE98_OPENAI_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE98_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE98_SECRET_REF_DO_NOT_RETURN";
const jwtLike = "phase98.header.payload";
const serviceRoleLike = "supabase_service_role_PHASE98_DO_NOT_RETURN";
const encryptionKeyLike = Buffer.alloc(32).toString("base64");
const providerResponseBody = "FAKE_PHASE98_PROVIDER_BODY_DO_NOT_RETURN";
const providerImageUrl = "https://example.invalid/phase98-provider-image.png";
const base64Image = Buffer.from("FAKE_PHASE98_IMAGE_BYTES_DO_NOT_RETURN").toString(
  "base64",
);

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const webpBytes = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const expectNoPublicLeak = (serialized: string): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    jwtLike,
    serviceRoleLike,
    encryptionKeyLike,
    providerResponseBody,
    providerImageUrl,
    base64Image,
    "encrypted_payload",
    "secret_ref",
    "signedUrl",
    "publicUrl",
    "downloadUrl",
    "localPath",
    "filePath",
    "rootPath",
    "directoryPath",
    "providerResponseBody",
    "providerMetadata",
    "requestId",
    "rawPrompt",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

class Phase98ProviderKeyRepository implements BackendProviderKeyRepository {
  async getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined> {
    return {
      providerKeyId,
      providerName: "openai",
      workspaceId: "phase98-workspace",
      ownerId: "phase98-owner",
      createdByUserId: "phase98-owner",
      encryptedSecret: {
        algorithm: "AES-256-GCM",
        encryptedPayload,
        keyVersion: "v1",
      },
      status: "active",
    };
  }

  async listForWorkspace(): Promise<BackendProviderKeyRecord[]> {
    return [];
  }

  async createProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 98 tests.",
    };
  }

  async replaceProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 98 tests.",
    };
  }

  async revokeProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 98 tests.",
    };
  }

  async updateProviderKeyValidationState(
    _input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult> {
    return {
      kind: "validation_state_unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 98 tests.",
    };
  }
}

const createReadyVault = (): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 98 tests.",
  }),
  decryptProviderKey: async () => ({
    kind: "vault_provider_key_decrypted",
    status: "decrypted",
    plaintextKey: rawProviderKey,
  }),
  storeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 98 tests.",
  }),
  revokeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 98 tests.",
  }),
  rotateProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 98 tests.",
  }),
});

const createFetchForImageSuccess = (): typeof fetch =>
  (async () =>
    ({
      headers: new Headers({ "x-request-id": "req_phase98_do_not_return" }),
      json: async () => ({
        data: [{ b64_json: base64Image, url: providerImageUrl }],
      }),
      status: 200,
      text: async () => providerResponseBody,
    }) as Response) as typeof fetch;

const verifyImage = (
  bytes: Uint8Array,
  format: GeneratedImageArtifactFormat,
  contentType: GeneratedImageArtifactContentType,
) =>
  verifyGeneratedImageArtifactBytes({
    bytes,
    contentType,
    format,
    maxBytes: 1024,
  });

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const startGenerationApp = async (
  requesterContext: BackendRequesterContext,
): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: BackendRequesterContext }).backendRequesterContext =
      requesterContext;
    next();
  });
  app.use(
    createGenerationRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_session_provider",
      },
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
};

test.describe("phase98 generated image artifact storage boundary", () => {
  test("valid PNG JPEG and WEBP bytes verify with size and sha256 metadata", () => {
    const png = verifyImage(pngBytes, "png", "image/png");
    const jpeg = verifyImage(jpegBytes, "jpeg", "image/jpeg");
    const webp = verifyImage(webpBytes, "webp", "image/webp");

    for (const result of [png, jpeg, webp]) {
      expect(result.kind).toBe("verified");
      if (result.kind !== "verified") {
        continue;
      }

      expect(result.image.sizeBytes).toBeGreaterThan(0);
      expect(result.image.sha256).toMatch(/^[a-f0-9]{64}$/);
      expectNoPublicLeak(JSON.stringify(result.image));
    }
  });

  test("empty invalid oversized and mismatched images fail safely", () => {
    const empty = verifyGeneratedImageArtifactBytes({
      bytes: Buffer.alloc(0),
      contentType: "image/png",
      format: "png",
      maxBytes: 1024,
    });
    const invalidBase64 = verifyGeneratedImageArtifactBytes({
      base64: "not base64!",
      contentType: "image/png",
      format: "png",
      maxBytes: 1024,
    });
    const oversized = verifyGeneratedImageArtifactBytes({
      bytes: Buffer.concat([pngBytes, Buffer.alloc(2048)]),
      contentType: "image/png",
      format: "png",
      maxBytes: 16,
    });
    const mismatched = verifyGeneratedImageArtifactBytes({
      bytes: pngBytes,
      contentType: "image/jpeg",
      format: "jpeg",
      maxBytes: 1024,
    });

    expect(empty).toMatchObject({
      kind: "failed",
      code: "generated_image_empty",
    });
    expect(invalidBase64).toMatchObject({
      kind: "failed",
      code: "generated_image_invalid_base64",
    });
    expect(oversized).toMatchObject({
      kind: "failed",
      code: "generated_image_oversized",
    });
    expect(mismatched).toMatchObject({
      kind: "failed",
      code: "generated_image_invalid_format",
    });

    for (const result of [empty, invalidBase64, oversized, mismatched]) {
      expectNoPublicLeak(JSON.stringify(result));
    }
  });

  test("local storage writes verified bytes atomically and keeps paths internal-only", async () => {
    const rootPath = mkdtempSync(path.join(os.tmpdir(), "phase98-generated-"));
    const verified = verifyImage(pngBytes, "png", "image/png");
    expect(verified.kind).toBe("verified");

    if (verified.kind !== "verified") {
      return;
    }

    const storage = createLocalGeneratedImageArtifactStorage({
      now: () => "2026-06-03T00:00:00.000Z",
      rootPath,
    });
    const stored = await storage.store({
      artifactId: "phase98_artifact",
      jobId: "phase98_job",
      ownerId: "phase98_owner",
      providerId: "openai",
      verifiedImage: verified.image,
      workspaceId: "phase98_workspace",
    });

    expect(stored.kind).toBe("stored");
    if (stored.kind !== "stored") {
      return;
    }

    expect(stored.artifact).toEqual({
      artifactId: "phase98_artifact",
      jobId: "phase98_job",
      workspaceId: "phase98_workspace",
      ownerId: "phase98_owner",
      providerId: "openai",
      kind: "generated_image",
      format: "png",
      contentType: "image/png",
      sizeBytes: pngBytes.byteLength,
      sha256: verified.image.sha256,
      status: "available",
      createdAt: "2026-06-03T00:00:00.000Z",
    } satisfies GeneratedImageArtifactMetadata);
    expect(stored.internalRef.filePath).toContain(rootPath);
    expect(JSON.stringify(stored.artifact)).not.toContain(rootPath);
    expectNoPublicLeak(JSON.stringify(stored.artifact));

    const stat = await fs.stat(stored.internalRef.filePath);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBe(pngBytes.byteLength);
    await expect(
      fs.stat(path.join(rootPath, "phase98_job", "phase98_artifact.tmp")),
    ).rejects.toThrow();

    const cleaned = await storage.cleanup({
      artifactId: "phase98_artifact",
      jobId: "phase98_job",
    });
    expect(cleaned).toEqual({ kind: "cleaned" });
  });

  test("storage unavailable unsafe identities and cleanup escape attempts fail closed", async () => {
    const rootPath = mkdtempSync(path.join(os.tmpdir(), "phase98-unsafe-"));
    const verified = verifyImage(pngBytes, "png", "image/png");
    expect(verified.kind).toBe("verified");

    if (verified.kind !== "verified") {
      return;
    }

    const unavailable = await createNotConfiguredGeneratedImageArtifactStorage().store({
      artifactId: "phase98_artifact",
      jobId: "phase98_job",
      ownerId: "phase98_owner",
      providerId: "openai",
      verifiedImage: verified.image,
      workspaceId: "phase98_workspace",
    });
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });
    const unsafeStore = await storage.store({
      artifactId: "..",
      jobId: "phase98_job",
      ownerId: "phase98_owner",
      providerId: "openai",
      verifiedImage: verified.image,
      workspaceId: "phase98_workspace",
    });
    const unsafeCleanup = await storage.cleanup({
      artifactId: "phase98_artifact",
      jobId: "..",
    });

    expect(unavailable).toMatchObject({
      kind: "unavailable",
      code: "storage_not_configured",
    });
    expect(unsafeStore).toMatchObject({
      kind: "failed",
      code: "invalid_artifact_identity",
    });
    expect(unsafeCleanup).toMatchObject({
      kind: "failed",
      code: "invalid_artifact_identity",
    });
    expectNoPublicLeak(JSON.stringify([unavailable, unsafeStore, unsafeCleanup]));
  });

  test("OpenAI 2xx stays artifact-storage-unavailable and generation route remains disabled", async () => {
    const result = await createOpenAiImageGenerationAdapter({
      fetchImpl: createFetchForImageSuccess(),
      providerKeyRepository: new Phase98ProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
      timeoutMs: 10,
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "A safe single-image prompt",
      providerId: "openai",
      providerKeyId: "phase98-provider-key",
      requestId: "phase98-request",
      workspaceId: "phase98-workspace",
    });

    expect(result).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });
    expectNoPublicLeak(JSON.stringify(result));

    const { baseUrl, server } = await startGenerationApp({
      authProvider: "session",
      authSubject: "phase98-subject",
      kind: "authenticated",
      userId: "phase98-user",
      workspaceId: "phase98-workspace",
    });

    try {
      const jobResponse = await fetch(`${baseUrl}/generation/jobs`, {
        body: JSON.stringify({ prompt: "A safe prompt" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const jobBody = await jobResponse.json();

      expect(jobResponse.status).toBe(503);
      expect(jobBody.status).toBe("generation_runtime_disabled");
      expect(jobBody.runtime.vendorCallsEnabled).toBe(false);
      expectNoPublicLeak(JSON.stringify(jobBody));
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries avoid frontend changes provider calls public delivery fake artifacts and unrelated runtime expansion", () => {
    const storageSource = readSource(
      "backend/generation/generatedImageArtifactStorage.ts",
    );
    const verificationSource = readSource(
      "backend/generation/generatedImageArtifactVerification.ts",
    );
    const openAiAdapterSource = readSource(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    const generationRouteSource = readSource("backend/routes/generation.ts");
    const packageJson = readSource("package.json");
    const frontendSource = [
      readSource("src/services/sceneGenerationService.ts"),
      readSource("src/store/sceneStore.ts"),
      readSource("src/agents/sceneGenerationAgent.ts"),
      readSource("src/pages/MixerPage.tsx"),
    ].join("\n");
    const creditsBillingSource = [
      readSource("src/pages/CreditsPage.tsx"),
      readSource("src/services/billingService.ts"),
    ].join("\n");
    const exportRouteSource = readSource("backend/routes/exports.ts");

    expect(storageSource).toContain("GeneratedImageArtifactMetadata");
    expect(verificationSource).toContain("verifyGeneratedImageArtifactBytes");
    expect(openAiAdapterSource).toContain("artifactStorageUnavailableResult");
    expect(generationRouteSource).toContain("generation_runtime_disabled");
    expect(generationRouteSource).toContain("vendorCallsEnabled: false");

    for (const forbidden of [
      "signedUrl:",
      "publicUrl:",
      "downloadUrl:",
      "localPath:",
      "providerResponseBody:",
      "rawPrompt:",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
    ]) {
      expect(storageSource).not.toContain(forbidden);
      expect(verificationSource).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }

    expect(frontendSource).not.toContain("/v1/images/generations");
    expect(frontendSource).not.toContain("GeneratedImageArtifactMetadata");
    expect(creditsBillingSource).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(exportRouteSource).toContain("route_execution_disabled");
  });
});
