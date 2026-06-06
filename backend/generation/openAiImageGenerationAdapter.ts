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
  BackendGenerationSafeDiagnosticCode,
  BackendGenerationSafeFailureCategory,
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
  requestShape?: OpenAiImageGenerationRequestShape;
  size?: OpenAiImageGenerationSize;
  timeoutMs?: number;
}

export type OpenAiImageGenerationModel = "gpt-image-2";
export type OpenAiImageGenerationSize = "1024x1024";
export type OpenAiImageGenerationQuality = "low" | "auto";
export type OpenAiImageGenerationRequestShape = "minimal" | "single_image_low";

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

const diagnostic = (
  diagnosticCode: BackendGenerationSafeDiagnosticCode,
  failureCategory: BackendGenerationSafeFailureCategory,
) => ({ diagnosticCode, failureCategory });

const artifactStorageUnavailableResult = (
  diagnosticCode: BackendGenerationSafeDiagnosticCode = "real_provider_storage_not_ready",
  failureCategory: BackendGenerationSafeFailureCategory = "artifact_storage",
): BackendGenerationProviderExecutionResult => ({
    kind: "artifact_storage_unavailable",
    status: "artifact_storage_unavailable",
    errorCode: "artifact_storage_unavailable",
    message:
      "OpenAI image generation returned a provider result, but generated artifact storage is not configured.",
    ...diagnostic(diagnosticCode, failureCategory),
  });

const invalidCredentialsResult =
  (): BackendGenerationProviderExecutionResult => ({
    kind: "generation_failed",
    status: "generation_failed",
    errorCode: "invalid_credentials",
    message: "Stored OpenAI provider credentials were rejected.",
  });

const invalidPromptResult = (
  diagnosticCode?: BackendGenerationSafeDiagnosticCode,
): BackendGenerationProviderExecutionResult => ({
  kind: "invalid_prompt",
  status: "invalid_prompt",
  errorCode: "invalid_prompt",
  message: "OpenAI image generation prompt is invalid or unsafe.",
  ...(diagnosticCode
    ? diagnostic(diagnosticCode, "provider_status")
    : {}),
});

const providerUnavailableResult =
  (
    diagnosticCode: BackendGenerationSafeDiagnosticCode = "provider_fetch_failed",
  ): BackendGenerationProviderExecutionResult => ({
    kind: "provider_unavailable",
    status: "provider_unavailable",
    errorCode: "provider_unavailable",
    message: "OpenAI image generation is unavailable.",
    ...diagnostic(diagnosticCode, "provider_fetch"),
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
    ...diagnostic("vault_decrypt_failed", "vault"),
  });

const invalidProviderResult = (): BackendGenerationProviderExecutionResult => ({
  kind: "invalid_provider",
  status: "invalid_provider",
  errorCode: "invalid_provider",
  message: "OpenAI image generation supports only the OpenAI provider.",
});

const safeGenerationFailedResult = (
  diagnosticCode: BackendGenerationSafeDiagnosticCode = "provider_unexpected_status",
  failureCategory: BackendGenerationSafeFailureCategory = "provider_status",
): BackendGenerationProviderExecutionResult => ({
  kind: "generation_failed",
  status: "generation_failed",
  errorCode: "generation_failed",
  message: "OpenAI image generation failed with a sanitized backend error.",
    ...diagnostic(diagnosticCode, failureCategory),
});

const providerKeyLookupFailedResult =
  (): BackendGenerationProviderExecutionResult =>
    safeGenerationFailedResult(
      "provider_key_lookup_failed",
      "provider_key_repository",
    );

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

const isValidPrompt = (prompt: string): boolean => {
  const trimmed = prompt.trim();
  return trimmed.length > 0 && trimmed.length <= 4_000;
};

const parseJsonSafely = async (
  response: Response,
): Promise<
  | { kind: "parsed"; value: unknown }
  | { kind: "malformed_json" }
> => {
  try {
    return { kind: "parsed", value: await response.json() };
  } catch {
    return { kind: "malformed_json" };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeSafeOpenAiErrorToken = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]/g, "_")
    .slice(0, 128);

  return normalized.length > 0 ? normalized : undefined;
};

const readOpenAiSafeErrorTokens = (value: unknown): string[] => {
  if (!isRecord(value) || !isRecord(value.error)) {
    return [];
  }

  return [
    normalizeSafeOpenAiErrorToken(value.error.code),
    normalizeSafeOpenAiErrorToken(value.error.type),
  ].filter((token): token is string => Boolean(token));
};

const tokenIncludes = (tokens: string[], patterns: string[]): boolean =>
  tokens.some((token) => patterns.some((pattern) => token.includes(pattern)));

const mapOpenAiBadRequestResult = (
  value: unknown,
): BackendGenerationProviderExecutionResult => {
  const tokens = readOpenAiSafeErrorTokens(value);

  if (
    tokenIncludes(tokens, [
      "moderation",
      "content_policy",
      "policy_violation",
      "safety",
    ])
  ) {
    return invalidPromptResult("provider_moderation_blocked");
  }

  if (
    tokenIncludes(tokens, [
      "invalid_prompt",
      "prompt_invalid",
      "prompt_rejected",
      "prompt",
    ])
  ) {
    return invalidPromptResult("provider_invalid_prompt");
  }

  if (
    tokenIncludes(tokens, [
      "organization_verification",
      "org_verification",
      "project_verification",
      "verification_required",
      "verified_organization",
    ])
  ) {
    return safeGenerationFailedResult(
      "provider_org_verification_required",
      "provider_status",
    );
  }

  if (
    tokenIncludes(tokens, [
      "unsupported_model",
      "model_not_found",
      "model_not_supported",
      "model",
    ])
  ) {
    return safeGenerationFailedResult(
      "provider_model_unsupported",
      "provider_status",
    );
  }

  if (tokenIncludes(tokens, ["response_format", "output_format"])) {
    return safeGenerationFailedResult(
      "provider_response_format_unsupported",
      "provider_status",
    );
  }

  if (
    tokenIncludes(tokens, [
      "invalid_request",
      "bad_request",
      "invalid_value",
      "invalid_type",
      "invalid_body",
      "missing_required_parameter",
      "unknown_parameter",
    ])
  ) {
    return safeGenerationFailedResult(
      "provider_request_shape_invalid",
      "provider_status",
    );
  }

  return safeGenerationFailedResult("provider_unexpected_400", "provider_status");
};

const readFirstOpenAiImagePayload = (
  value: unknown,
):
  | { kind: "payload"; b64Json?: string; url?: string }
  | { kind: "unsupported"; diagnosticCode: BackendGenerationSafeDiagnosticCode } => {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return {
      diagnosticCode: "provider_response_shape_unsupported",
      kind: "unsupported",
    };
  }

  if (value.data.length === 0) {
    return { diagnosticCode: "provider_empty_data", kind: "unsupported" };
  }

  if (value.data.length !== 1) {
    return {
      diagnosticCode: "provider_response_shape_unsupported",
      kind: "unsupported",
    };
  }

  const [first] = value.data;
  if (!isRecord(first)) {
    return {
      diagnosticCode: "provider_response_shape_unsupported",
      kind: "unsupported",
    };
  }

  return {
    kind: "payload",
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

const createOpenAiImageGenerationRequestBody = ({
  model,
  prompt,
  quality,
  requestShape,
  size,
}: {
  model: OpenAiImageGenerationModel;
  prompt: string;
  quality: OpenAiImageGenerationQuality;
  requestShape: OpenAiImageGenerationRequestShape;
  size: OpenAiImageGenerationSize;
}): Record<string, unknown> => {
  const base = {
    model,
    prompt,
  };

  if (requestShape === "minimal") {
    return base;
  }

  return {
    ...base,
    n: 1,
    quality,
    size,
  };
};

export const createOpenAiImageGenerationAdapter = ({
  fetchImpl = globalThis.fetch,
  generatedImageArtifactStorage,
  maxImageBytes = defaultMaxImageBytes,
  model = defaultModel,
  providerKeyRepository,
  providerSecretVault,
  quality = defaultQuality,
  requestShape = "single_image_low",
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

    let record: BackendProviderKeyRecord | undefined;

    try {
      record = await providerKeyRepository.getByProviderKeyId(
        input.providerKeyId,
      );
    } catch {
      return providerKeyLookupFailedResult();
    }

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

    const decrypted = await (async () => {
      try {
        return await providerSecretVault.decryptProviderKey({
          providerKeyId: record.providerKeyId,
          secretHandle,
          workspaceId: input.workspaceId,
        });
      } catch {
        return undefined;
      }
    })();

    if (!decrypted || decrypted.kind !== "vault_provider_key_decrypted") {
      return vaultDecryptFailedResult();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(openAiImagesGenerationsEndpoint, {
        body: JSON.stringify(
          createOpenAiImageGenerationRequestBody({
            model,
            prompt: input.prompt.trim(),
            quality,
            requestShape,
            size,
          }),
        ),
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

        const parsedBody = await parseJsonSafely(response);

        if (parsedBody.kind === "malformed_json") {
          return artifactStorageUnavailableResult(
            "provider_malformed_json",
            "provider_response",
          );
        }

        const imagePayload = readFirstOpenAiImagePayload(parsedBody.value);

        if (imagePayload.kind === "unsupported") {
          return artifactStorageUnavailableResult(
            imagePayload.diagnosticCode,
            "provider_response",
          );
        }

        if (imagePayload.url) {
          return artifactStorageUnavailableResult(
            "provider_url_output_unsupported",
            "provider_response",
          );
        }

        if (typeof imagePayload.b64Json !== "string") {
          return artifactStorageUnavailableResult(
            "provider_missing_b64_json",
            "provider_response",
          );
        }

        const contentType: GeneratedImageArtifactContentType = "image/png";
        const verification = verifyGeneratedImageArtifactBytes({
          base64: imagePayload.b64Json,
          contentType,
          format: resolveFormatFromContentType(contentType),
          maxBytes: maxImageBytes,
        });

        if (verification.kind !== "verified") {
          return safeGenerationFailedResult(
            "artifact_verification_failed",
            "artifact_storage",
          );
        }

        const stored = await (async () => {
          try {
            return await generatedImageArtifactStorage.store({
              artifactId: input.jobId
                ? `${input.jobId}_openai_image`
                : `${input.requestId}_openai_image`,
              jobId: input.jobId ?? input.requestId,
              ownerId: "backend_generated_image_owner_unavailable",
              providerId: "openai",
              verifiedImage: verification.image,
              workspaceId: input.workspaceId,
            });
          } catch {
            return undefined;
          }
        })();

        if (!stored || stored.kind !== "stored") {
          return artifactStorageUnavailableResult(
            "artifact_storage_write_failed",
            "artifact_storage",
          );
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
        const parsedBody = await parseJsonSafely(response);

        return mapOpenAiBadRequestResult(
          parsedBody.kind === "parsed" ? parsedBody.value : undefined,
        );
      }

      if (response.status === 401 || response.status === 403) {
        return invalidCredentialsResult();
      }

      if (response.status === 429) {
        return rateLimitedResult();
      }

      if (response.status >= 500) {
        return providerUnavailableResult("provider_5xx");
      }

      return safeGenerationFailedResult("provider_unexpected_status");
    } catch (error) {
      return isAbortError(error)
        ? timeoutResult()
        : providerUnavailableResult("provider_fetch_failed");
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
