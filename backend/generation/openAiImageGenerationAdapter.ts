import type { BackendProviderKeyRecord, BackendProviderKeyRepository } from "../repositories/repositoryContracts";
import type {
  ProviderSecretVault,
  ProviderSecretVaultSecretHandle,
} from "../providers/providerSecretVault";
import type {
  BackendGenerateImageFromStoredProviderKeyInput,
  BackendGenerationProviderAdapter,
  BackendGenerationProviderExecutionResult,
  BackendGenerationProviderPollResult,
  BackendGenerationProviderReadiness,
  BackendGenerationProviderSubmitResult,
  BackendGenerationPollRequest,
  BackendGenerationSubmitRequest,
} from "./generationProviderAdapter";
import type { GeneratedImageArtifactStorage } from "./generatedImageArtifactStorage";
import {
  verifyGeneratedImageArtifactBytes,
  type GeneratedImageArtifactContentType,
  type GeneratedImageArtifactFormat,
} from "./generatedImageArtifactVerification";

export interface OpenAiImageGenerationAdapterOptions {
  fetchImpl?: typeof fetch;
  generatedImageArtifactStorage?: GeneratedImageArtifactStorage;
  maxImageBytes?: number;
  model?: OpenAiImageGenerationModel;
  providerKeyRepository: BackendProviderKeyRepository;
  providerSecretVault: ProviderSecretVault;
  quality?: OpenAiImageGenerationQuality;
  size?: OpenAiImageGenerationSize;
  timeoutMs?: number;
}

export type OpenAiImageGenerationModel = "gpt-image-2";
export type OpenAiImageGenerationSize = "1024x1024";
export type OpenAiImageGenerationQuality = "low" | "auto";

const openAiImagesGenerationsEndpoint =
  "https://api.openai.com/v1/images/generations";
const defaultModel: OpenAiImageGenerationModel = "gpt-image-2";
const defaultQuality: OpenAiImageGenerationQuality = "low";
const defaultSize: OpenAiImageGenerationSize = "1024x1024";
const defaultTimeoutMs = 10_000;
const defaultMaxImageBytes = 8 * 1024 * 1024;

const toSecretHandle = (
  record: BackendProviderKeyRecord,
): ProviderSecretVaultSecretHandle | undefined => {
  if (record.encryptedSecret) {
    return {
      kind: "encrypted_secret",
      algorithm: record.encryptedSecret.algorithm,
      encryptedPayload: record.encryptedSecret.encryptedPayload,
      keyVersion: record.encryptedSecret.keyVersion,
    };
  }

  if (record.secretRef) {
    return {
      kind: "external_secret_ref",
      keyVersion: "external-ref-v1",
      secretRef: record.secretRef,
    };
  }

  return undefined;
};

const unavailableResult = (): BackendGenerationProviderExecutionResult => ({
  kind: "generation_unavailable",
  status: "not_configured",
  errorCode: "generation_unavailable",
  message: "OpenAI image generation is not configured.",
});

const artifactStorageUnavailableResult =
  (): BackendGenerationProviderExecutionResult => ({
    kind: "artifact_storage_unavailable",
    status: "artifact_storage_unavailable",
    errorCode: "artifact_storage_unavailable",
    message:
      "OpenAI image generation returned a provider result, but generated artifact storage is not configured.",
  });

const invalidCredentialsResult =
  (): BackendGenerationProviderExecutionResult => ({
    kind: "generation_failed",
    status: "generation_failed",
    errorCode: "invalid_credentials",
    message: "Stored OpenAI provider credentials were rejected.",
  });

const invalidPromptResult = (): BackendGenerationProviderExecutionResult => ({
  kind: "invalid_prompt",
  status: "invalid_prompt",
  errorCode: "invalid_prompt",
  message: "OpenAI image generation prompt is invalid or unsafe.",
});

const providerUnavailableResult =
  (): BackendGenerationProviderExecutionResult => ({
    kind: "provider_unavailable",
    status: "provider_unavailable",
    errorCode: "provider_unavailable",
    message: "OpenAI image generation is unavailable.",
  });

const timeoutResult = (): BackendGenerationProviderExecutionResult => ({
  kind: "timeout",
  status: "timeout",
  errorCode: "timeout",
  message: "OpenAI image generation timed out.",
});

const rateLimitedResult = (): BackendGenerationProviderExecutionResult => ({
  kind: "rate_limited",
  status: "rate_limited",
  errorCode: "rate_limited",
  message: "OpenAI image generation is rate limited.",
});

const keyNotFoundResult = (): BackendGenerationProviderExecutionResult => ({
  kind: "key_not_found",
  status: "key_not_found",
  errorCode: "key_not_found",
  message: "Active OpenAI provider key was not found for generation.",
});

const vaultDecryptFailedResult =
  (): BackendGenerationProviderExecutionResult => ({
    kind: "vault_decrypt_failed",
    status: "vault_decrypt_failed",
    errorCode: "vault_decrypt_failed",
    message: "Stored OpenAI provider key could not be decrypted for generation.",
  });

const invalidProviderResult = (): BackendGenerationProviderExecutionResult => ({
  kind: "invalid_provider",
  status: "invalid_provider",
  errorCode: "invalid_provider",
  message: "OpenAI image generation supports only the OpenAI provider.",
});

const safeGenerationFailedResult = (): BackendGenerationProviderExecutionResult => ({
  kind: "generation_failed",
  status: "generation_failed",
  errorCode: "generation_failed",
  message: "OpenAI image generation failed with a sanitized backend error.",
});

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

const isValidPrompt = (prompt: string): boolean => {
  const trimmed = prompt.trim();
  return trimmed.length > 0 && trimmed.length <= 4_000;
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readFirstOpenAiImagePayload = (
  value: unknown,
): { b64Json?: string; url?: string } | undefined => {
  if (!isRecord(value) || !Array.isArray(value.data) || value.data.length !== 1) {
    return undefined;
  }

  const [first] = value.data;
  if (!isRecord(first)) {
    return undefined;
  }

  return {
    b64Json: typeof first.b64_json === "string" ? first.b64_json : undefined,
    url: typeof first.url === "string" ? first.url : undefined,
  };
};

const resolveFormatFromContentType = (
  contentType: GeneratedImageArtifactContentType,
): GeneratedImageArtifactFormat => {
  if (contentType === "image/jpeg") {
    return "jpeg";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  return "png";
};

export const createOpenAiImageGenerationAdapter = ({
  fetchImpl = globalThis.fetch,
  generatedImageArtifactStorage,
  maxImageBytes = defaultMaxImageBytes,
  model = defaultModel,
  providerKeyRepository,
  providerSecretVault,
  quality = defaultQuality,
  size = defaultSize,
  timeoutMs = defaultTimeoutMs,
}: OpenAiImageGenerationAdapterOptions): BackendGenerationProviderAdapter => ({
  providerId: "openai",

  getReadiness(): BackendGenerationProviderReadiness {
    if (typeof fetchImpl !== "function") {
      return {
        kind: "generation_unavailable",
        status: "not_configured",
        message: "OpenAI image generation fetch runtime is unavailable.",
      };
    }

    if (providerSecretVault.getVaultReadiness().kind !== "vault_ready") {
      return {
        kind: "generation_unavailable",
        status: "not_configured",
        message:
          "OpenAI image generation requires a configured backend provider-key vault.",
      };
    }

    return { kind: "generation_ready" };
  },

  async generateImageFromStoredProviderKey(
    input: BackendGenerateImageFromStoredProviderKeyInput,
  ): Promise<BackendGenerationProviderExecutionResult> {
    if (input.providerId !== "openai") {
      return invalidProviderResult();
    }

    if (input.generationKind !== "image" || !isValidPrompt(input.prompt)) {
      return invalidPromptResult();
    }

    const record = await providerKeyRepository.getByProviderKeyId(
      input.providerKeyId,
    );

    if (
      !record ||
      record.workspaceId !== input.workspaceId ||
      record.providerName !== "openai" ||
      record.status !== "active" ||
      record.deletedAt
    ) {
      return keyNotFoundResult();
    }

    const secretHandle = toSecretHandle(record);

    if (!secretHandle) {
      return vaultDecryptFailedResult();
    }

    const decrypted = await providerSecretVault.decryptProviderKey({
      providerKeyId: record.providerKeyId,
      secretHandle,
      workspaceId: input.workspaceId,
    });

    if (decrypted.kind !== "vault_provider_key_decrypted") {
      return vaultDecryptFailedResult();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(openAiImagesGenerationsEndpoint, {
        body: JSON.stringify({
          model,
          n: 1,
          prompt: input.prompt.trim(),
          quality,
          size,
        }),
        headers: {
          Authorization: `Bearer ${decrypted.plaintextKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      });

      if (response.status >= 200 && response.status < 300) {
        if (!generatedImageArtifactStorage) {
          return artifactStorageUnavailableResult();
        }

        const body = await parseJsonSafely(response);
        const imagePayload = readFirstOpenAiImagePayload(body);

        if (typeof imagePayload?.b64Json !== "string" || imagePayload.url) {
          return artifactStorageUnavailableResult();
        }

        const contentType: GeneratedImageArtifactContentType = "image/png";
        const verification = verifyGeneratedImageArtifactBytes({
          base64: imagePayload.b64Json,
          contentType,
          format: resolveFormatFromContentType(contentType),
          maxBytes: maxImageBytes,
        });

        if (verification.kind !== "verified") {
          return safeGenerationFailedResult();
        }

        const stored = await generatedImageArtifactStorage.store({
          artifactId: input.jobId
            ? `${input.jobId}_openai_image`
            : `${input.requestId}_openai_image`,
          jobId: input.jobId ?? input.requestId,
          ownerId: "backend_generated_image_owner_unavailable",
          providerId: "openai",
          verifiedImage: verification.image,
          workspaceId: input.workspaceId,
        });

        if (stored.kind !== "stored") {
          return artifactStorageUnavailableResult();
        }

        return {
          kind: "generated",
          status: "generated",
          artifact: {
            artifactId: stored.artifact.artifactId,
            contentType: stored.artifact.contentType,
            createdAt: stored.artifact.createdAt,
            generationKind: "image",
            providerId: "openai",
            sizeBytes: stored.artifact.sizeBytes,
            sha256: stored.artifact.sha256,
            status: "metadata_only",
            storageState: "metadata_only",
          },
          message: "OpenAI image generation produced verified artifact metadata.",
        };
      }

      if (response.status === 400) {
        return invalidPromptResult();
      }

      if (response.status === 401 || response.status === 403) {
        return invalidCredentialsResult();
      }

      if (response.status === 429) {
        return rateLimitedResult();
      }

      if (response.status >= 500) {
        return providerUnavailableResult();
      }

      return safeGenerationFailedResult();
    } catch (error) {
      return isAbortError(error) ? timeoutResult() : providerUnavailableResult();
    } finally {
      clearTimeout(timeout);
    }
  },

  async submit(
    _request: BackendGenerationSubmitRequest,
  ): Promise<BackendGenerationProviderSubmitResult> {
    return {
      kind: "failure",
      failureCode: "generation_runtime_disabled",
      metadata: {
        actualProviderResult: "not_executed",
        attemptNumber: 1,
        fallbackEnabled: false,
        failureCode: "generation_runtime_disabled",
        providerId: "openai",
        routingMode: "manual",
        state: "blocked",
      },
    };
  },

  async poll(
    _request: BackendGenerationPollRequest,
  ): Promise<BackendGenerationProviderPollResult> {
    return {
      kind: "failure",
      failureCode: "generation_runtime_disabled",
      metadata: {
        actualProviderResult: "not_executed",
        attemptNumber: 1,
        fallbackEnabled: false,
        failureCode: "generation_runtime_disabled",
        providerId: "openai",
        routingMode: "manual",
        state: "blocked",
      },
    };
  },
});
