import { expect, test } from "@playwright/test";
import { promises as fs, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createLocalGeneratedImageArtifactStorage,
  type GeneratedImageArtifactStorage,
} from "../../backend/generation/generatedImageArtifactStorage";
import { createOpenAiImageGenerationAdapter } from "../../backend/generation/openAiImageGenerationAdapter";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE156_OPENAI_KEY_DO_NOT_RETURN";
const encryptedPayload = "PHASE156_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "PHASE156_SECRET_REF_DO_NOT_RETURN";
const promptText = "A phase 156 prompt that must stay out of responses";
const providerEndpoint = "https://api.openai.com/v1/images/generations";
const providerImageUrl = "https://provider.example/phase156-image.png";
const providerRequestId = "req_phase156_do_not_return";
const rawProviderBody = "PHASE156_PROVIDER_BODY_DO_NOT_RETURN";
const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const validPngBase64 = pngBytes.toString("base64");

interface FetchCalls {
  imageFetch: number;
  imageGenerationFetch: number;
}

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const createActiveValidatedKey = (): BackendProviderKeyRecord => ({
  providerKeyId: "phase156-provider-key",
  providerName: "openai",
  workspaceId: "phase156-workspace",
  ownerId: "phase156-owner",
  createdByUserId: "phase156-owner",
  encryptedSecret: {
    algorithm: "AES-256-GCM",
    encryptedPayload,
    keyVersion: "v1",
  },
  secretRef,
  status: "active",
  verificationStatus: "validated",
  needsReverification: false,
});

const createProviderKeyRepository = (): BackendProviderKeyRepository => ({
  getByProviderKeyId: async () => createActiveValidatedKey(),
  getActiveValidatedProviderKeyForWorkspaceProvider: async () =>
    createActiveValidatedKey(),
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in Phase 156.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in Phase 156.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in Phase 156.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in Phase 156.");
  },
});

const createReadyVault = (): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in Phase 156.");
  },
  decryptProviderKey: async () => ({
    kind: "vault_provider_key_decrypted",
    plaintextKey: rawProviderKey,
    status: "decrypted",
  }),
  storeProviderKey: async () => {
    throw new Error("Vault store must not run in Phase 156.");
  },
  revokeProviderKey: async () => {
    throw new Error("Vault revoke must not run in Phase 156.");
  },
  rotateProviderKey: async () => {
    throw new Error("Vault rotate must not run in Phase 156.");
  },
});

const createOpenAiResponseFetch = ({
  body,
  calls,
  onRequest,
}: {
  body: unknown;
  calls?: FetchCalls;
  onRequest?: (body: Record<string, unknown>) => void;
}): typeof fetch =>
  (async (input, init) => {
    calls && (calls.imageGenerationFetch += 1);
    expect(String(input)).toBe(providerEndpoint);
    expect(init?.method).toBe("POST");
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawProviderKey}`);

    const requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(JSON.stringify(requestBody)).toContain(promptText);
    expect(JSON.stringify(requestBody)).not.toContain(rawProviderKey);
    onRequest?.(requestBody);

    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": providerRequestId,
      },
      status: 200,
    });
  }) as typeof fetch;

const createProviderImageFetch = ({
  calls,
  fail = false,
  contentType = "image/png",
}: {
  calls: FetchCalls;
  contentType?: string;
  fail?: boolean;
}): typeof fetch =>
  (async (input, init) => {
    calls.imageFetch += 1;
    expect(String(input)).toBe(providerImageUrl);
    expect(init?.method).toBe("GET");

    if (fail) {
      throw new Error("mocked provider image URL fetch failure");
    }

    return new Response(pngBytes, {
      headers: {
        "Content-Type": contentType,
        "X-Request-Id": "phase156-image-request-id-not-returned",
      },
      status: 200,
    });
  }) as typeof fetch;

const makeStorageRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase156-generated-images-"));

const removeStorageRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { force: true, recursive: true });
};

const generate = async ({
  fetchBody,
  generatedImageArtifactStorage,
  providerImageFetchImpl,
  onRequest,
}: {
  fetchBody: unknown;
  generatedImageArtifactStorage?: GeneratedImageArtifactStorage;
  onRequest?: (body: Record<string, unknown>) => void;
  providerImageFetchImpl?: typeof fetch;
}) => {
  const calls: FetchCalls = { imageFetch: 0, imageGenerationFetch: 0 };
  const result = await createOpenAiImageGenerationAdapter({
    fetchImpl: createOpenAiResponseFetch({
      body: fetchBody,
      calls,
      onRequest,
    }),
    generatedImageArtifactStorage,
    model: "dall-e-3",
    providerImageFetchImpl,
    providerKeyRepository: createProviderKeyRepository(),
    providerSecretVault: createReadyVault(),
    requestShape: "minimal",
    timeoutMs: 10,
  }).generateImageFromStoredProviderKey?.({
    generationKind: "image",
    prompt: promptText,
    providerId: "openai",
    providerKeyId: "phase156-provider-key",
    requestId: "phase156_request",
    workspaceId: "phase156-workspace",
  });

  return { calls, result };
};

const expectNoLeak = (serialized: string): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    promptText,
    providerEndpoint,
    providerImageUrl,
    rawProviderBody,
    providerRequestId,
    validPngBase64,
    "phase156-image-request-id-not-returned",
    "Authorization",
    "Bearer ",
    "workspaceId",
    "ownerId",
    "providerKeyId",
    "encrypted_payload",
    "secret_ref",
    "service_role",
    "JWT",
    "request_id",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "internalRef",
    "filePath",
    "rootPath",
    "directoryPath",
    "\"b64_json\":",
    "\"base64\":",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase156 DALL-E-3 URL output server-side storage", () => {
  test("DALL-E-3 request omits response_format and does not explicitly request URL output", async () => {
    let observedRequestBody: Record<string, unknown> | undefined;
    const { result } = await generate({
      fetchBody: { data: [{ b64_json: validPngBase64 }] },
      onRequest: (body) => {
        observedRequestBody = body;
      },
    });

    expect(observedRequestBody).toEqual({
      model: "dall-e-3",
      n: 1,
      prompt: promptText,
      size: "1024x1024",
    });
    expect(observedRequestBody).not.toHaveProperty("response_format");
    expect(observedRequestBody).not.toHaveProperty("url");
    expect(observedRequestBody).not.toHaveProperty("output_format");
    expect(result).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });
    expectNoLeak(JSON.stringify(result));
  });

  test("provider URL output is fetched server-side and stored as safe metadata only", async () => {
    const rootPath = await makeStorageRoot();
    const calls: FetchCalls = { imageFetch: 0, imageGenerationFetch: 0 };

    try {
      const { result } = await generate({
        fetchBody: { data: [{ url: providerImageUrl }], rawProviderBody },
        generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
          now: () => "2026-06-07T00:00:00.000Z",
          rootPath,
        }),
        providerImageFetchImpl: createProviderImageFetch({ calls }),
      });

      expect(calls.imageFetch).toBe(1);
      expect(result).toMatchObject({
        kind: "generated",
        status: "generated",
        artifact: {
          artifactId: "phase156_request_openai_image",
          contentType: "image/png",
          createdAt: "2026-06-07T00:00:00.000Z",
          generationKind: "image",
          providerId: "openai",
          sizeBytes: 8,
          status: "metadata_only",
          storageState: "metadata_only",
        },
      });

      if (result?.kind === "generated") {
        expect(result.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      }

      expectNoLeak(JSON.stringify(result));
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("provider URL output without URL fetch dependency fails closed", async () => {
    const rootPath = await makeStorageRoot();

    try {
      const { result } = await generate({
        fetchBody: { data: [{ url: providerImageUrl }] },
        generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
          rootPath,
        }),
      });

      expect(result).toMatchObject({
        diagnosticCode: "provider_url_output_fetch_unavailable",
        failureCategory: "provider_response",
        kind: "generation_failed",
      });
      expectNoLeak(JSON.stringify(result));
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("provider URL fetch failure returns safe diagnostic without provider URL leak", async () => {
    const rootPath = await makeStorageRoot();
    const calls: FetchCalls = { imageFetch: 0, imageGenerationFetch: 0 };

    try {
      const { result } = await generate({
        fetchBody: { data: [{ url: providerImageUrl }] },
        generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
          rootPath,
        }),
        providerImageFetchImpl: createProviderImageFetch({ calls, fail: true }),
      });

      expect(calls.imageFetch).toBe(1);
      expect(result).toMatchObject({
        diagnosticCode: "provider_url_output_fetch_failed",
        failureCategory: "provider_response",
        kind: "generation_failed",
      });
      expectNoLeak(JSON.stringify(result));
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("b64_json response still verifies and stores through existing path", async () => {
    const rootPath = await makeStorageRoot();
    const calls: FetchCalls = { imageFetch: 0, imageGenerationFetch: 0 };

    try {
      const { result } = await generate({
        fetchBody: { data: [{ b64_json: validPngBase64 }] },
        generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
          now: () => "2026-06-07T00:00:00.000Z",
          rootPath,
        }),
        providerImageFetchImpl: createProviderImageFetch({ calls }),
      });

      expect(calls.imageFetch).toBe(0);
      expect(result).toMatchObject({
        kind: "generated",
        status: "generated",
        artifact: {
          artifactId: "phase156_request_openai_image",
          contentType: "image/png",
          providerId: "openai",
          sizeBytes: 8,
          status: "metadata_only",
        },
      });
      expectNoLeak(JSON.stringify(result));
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("missing b64_json and URL remains a safe provider response diagnostic", async () => {
    const rootPath = await makeStorageRoot();

    try {
      const { result } = await generate({
        fetchBody: { data: [{}], rawProviderBody },
        generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
          rootPath,
        }),
      });

      expect(result).toMatchObject({
        diagnosticCode: "provider_missing_b64_json",
        failureCategory: "provider_response",
        kind: "artifact_storage_unavailable",
      });
      expectNoLeak(JSON.stringify(result));
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("source and runbook document server-side URL handling without public delivery", () => {
    const adapterSource = readSource(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    const routeSource = readSource("backend/routes/generation.ts");
    const runbookSource = readSource(
      "docs/real-openai-generation-diagnostic-capture-runbook.md",
    );
    const packageJson = readSource("package.json");
    const frontendSource = [
      readSource("src/services/sceneGenerationService.ts"),
      readSource("src/store/sceneStore.ts"),
      readSource("src/agents/sceneGenerationAgent.ts"),
      readSource("src/pages/MixerPage.tsx"),
    ].join("\n");
    const exportRouteSource = readSource("backend/routes/exports.ts");

    expect(adapterSource).toContain("providerImageFetchImpl");
    expect(adapterSource).toContain("provider_url_output_fetch_failed");
    expect(routeSource).toContain("providerImageFetchImpl");
    expect(runbookSource).toContain("DALL-E-3 fallback uses provider URL output internally");
    expect(runbookSource).toContain("Provider URLs must never be printed or returned");

    for (const forbidden of [
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "publicUrl",
      "signedUrl",
      "downloadUrl",
    ]) {
      expect(adapterSource).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }

    expect(frontendSource).not.toContain("/generation/jobs");
    expect(exportRouteSource).toContain("route_execution_disabled");
  });
});
