import type { BackendAuthenticatedRequesterContext } from "../auth/requesterContext";
import type { WorkspaceRole } from "../auth/accountContracts";
import type { BackendProviderKeyRecord } from "../repositories/repositoryContracts";
import type {
  BackendSupportedProviderId,
} from "../contracts/providerSettingsHttpTypes";
import type {
  BackendGenerationRuntimeConfig,
} from "./generationRuntimeConfig";

export type BackendGenerationJobLifecycleState =
  | "rejected"
  | "submitted"
  | "running"
  | "processing"
  | "metadata_ready"
  | "generated_metadata_ready"
  | "artifact_storage_failed"
  | "delivery_unavailable"
  | "failed";

export interface BackendGenerationImageJobRequest {
  executionBillingMode?: "byok" | "platform_paid";
  generationKind: "image";
  prompt: string;
  providerId: "openai";
  requestId: string;
}

export interface BackendGenerationVideoJobRequest {
  executionBillingMode?: "byok";
  generationKind: "video";
  prompt: string;
  providerId: "mock_local";
  requestId: string;
}

export type BackendGenerationJobRequestParseResult =
  | {
      kind: "valid";
      request: BackendGenerationImageJobRequest | BackendGenerationVideoJobRequest;
    }
  | {
      kind: "invalid";
      code:
        | "invalid_billing_mode"
        | "invalid_provider"
        | "invalid_generation_kind"
        | "invalid_prompt"
        | "invalid_request_id"
        | "unsupported_field";
      message: string;
      rejectedFields?: string[];
    };

export type BackendGenerationPromptValidationResult =
  | {
      kind: "valid_prompt";
      prompt: string;
    }
  | {
      kind: "invalid_prompt";
      message: string;
    };

export type BackendGenerationExecutionPreconditionResult =
  | {
      kind: "ready";
    }
  | {
      kind: "blocked";
      code:
        | "generation_runtime_disabled"
        | "vendor_calls_disabled"
        | "sign_in_required"
        | "workspace_permission_not_verified"
        | "workspace_owner_or_admin_required"
        | "provider_key_not_configured"
        | "invalid_prompt"
        | "unsupported_generation_request"
        | "rate_limit_not_configured"
        | "idempotency_not_configured"
        | "single_flight_not_configured"
        | "cost_controls_not_configured";
      message: string;
    };

export type BackendGenerationExecutionControlReadiness = {
  kind: "generation_execution_controls_readiness";
  costControlsReady: boolean;
  idempotencyReady: boolean;
  rateLimitReady: boolean;
  singleFlightReady: boolean;
};

export type BackendGenerationExecutionControlReadinessEnv = Record<
  string,
  string | undefined
>;

export const generationExecutionControlReadinessEnvName =
  "FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY";

export interface BackendGenerationMetadataOnlyArtifactResponse {
  artifactId: string;
  providerId: BackendSupportedProviderId;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  deliveryStatus: "unavailable";
}

const maxPromptLength = 4_000;
const allowedRequestFields = new Set([
  "generationKind",
  "prompt",
  "providerId",
  "requestId",
  "executionBillingMode",
]);

const unsupportedRequestFields = new Set([
  "apiKey",
  "rawApiKey",
  "workspaceId",
  "providerKeyId",
  "model",
  "n",
  "count",
  "images",
  "image",
  "dimensions",
  "size",
  "uploads",
  "files",
  "mask",
  "edit",
  "stream",
  "delivery",
  "deliveryOptions",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const validateGenerationPrompt = (
  value: unknown,
): BackendGenerationPromptValidationResult => {
  if (typeof value !== "string") {
    return {
      kind: "invalid_prompt",
      message: "Generation prompt must be a string.",
    };
  }

  const prompt = value.trim();

  if (!prompt) {
    return {
      kind: "invalid_prompt",
      message: "Generation prompt is required.",
    };
  }

  if (prompt.length > maxPromptLength) {
    return {
      kind: "invalid_prompt",
      message: "Generation prompt exceeds the maximum supported length.",
    };
  }

  return {
    kind: "valid_prompt",
    prompt,
  };
};

export const parseGenerationJobRequest = (
  body: unknown,
): BackendGenerationJobRequestParseResult => {
  if (!isRecord(body)) {
    return {
      kind: "invalid",
      code: "invalid_prompt",
      message: "Generation request body must be an object.",
    };
  }

  const rejectedFields = Object.keys(body).filter(
    (field) =>
      unsupportedRequestFields.has(field) || !allowedRequestFields.has(field),
  );

  if (rejectedFields.length > 0) {
    return {
      kind: "invalid",
      code: "unsupported_field",
      message:
        "Generation request includes fields that are not supported by the current backend boundary.",
      rejectedFields,
    };
  }

  if (body.generationKind !== "image" && body.generationKind !== "video") {
    return {
      kind: "invalid",
      code: "invalid_generation_kind",
      message: "Only image and mock-local video generation are modeled in this boundary.",
    };
  }

  if (body.generationKind === "image" && body.providerId !== "openai") {
    return {
      kind: "invalid",
      code: "invalid_provider",
      message: "Only OpenAI image generation is modeled in this boundary.",
    };
  }

  if (body.generationKind === "video" && body.providerId !== "mock_local") {
    return {
      kind: "invalid",
      code: "invalid_provider",
      message: "Only mock-local video generation is modeled in this boundary.",
    };
  }

  if (
    "executionBillingMode" in body &&
    body.executionBillingMode !== "byok" &&
    body.executionBillingMode !== "platform_paid"
  ) {
    return {
      kind: "invalid",
      code: "invalid_billing_mode",
      message: "Generation billing mode is not supported by this backend boundary.",
    };
  }

  if (body.generationKind === "video" && body.executionBillingMode === "platform_paid") {
    return {
      kind: "invalid",
      code: "invalid_billing_mode",
      message: "Platform-paid video generation is not supported in this block.",
    };
  }

  const prompt = validateGenerationPrompt(body.prompt);

  if (prompt.kind !== "valid_prompt") {
    return {
      kind: "invalid",
      code: "invalid_prompt",
      message: prompt.message,
    };
  }

  if (
    typeof body.requestId !== "string" ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(body.requestId)
  ) {
    return {
      kind: "invalid",
      code: "invalid_request_id",
      message: "Generation request id must be a safe idempotency token.",
    };
  }

  return {
    kind: "valid",
    request:
      body.generationKind === "video"
        ? {
            executionBillingMode:
              body.executionBillingMode === "byok" ? "byok" : undefined,
            generationKind: "video",
            prompt: prompt.prompt,
            providerId: "mock_local",
            requestId: body.requestId,
          }
        : {
            executionBillingMode:
              body.executionBillingMode === "platform_paid"
                ? "platform_paid"
                : body.executionBillingMode === "byok"
                  ? "byok"
                  : undefined,
            generationKind: "image",
            prompt: prompt.prompt,
            providerId: "openai",
            requestId: body.requestId,
          },
  };
};

export const getGenerationExecutionControlReadiness =
  (): BackendGenerationExecutionControlReadiness => ({
    kind: "generation_execution_controls_readiness",
    costControlsReady: false,
    idempotencyReady: false,
    rateLimitReady: false,
    singleFlightReady: false,
  });

export const parseGenerationExecutionControlReadiness = (
  env: BackendGenerationExecutionControlReadinessEnv = process.env,
): BackendGenerationExecutionControlReadiness => {
  if (env[generationExecutionControlReadinessEnvName] !== "1") {
    return getGenerationExecutionControlReadiness();
  }

  return {
    kind: "generation_execution_controls_readiness",
    costControlsReady: true,
    idempotencyReady: true,
    rateLimitReady: true,
    singleFlightReady: true,
  };
};

export const evaluateGenerationGatePreconditions = (
  config: BackendGenerationRuntimeConfig,
): BackendGenerationExecutionPreconditionResult => {
  if (!config.runtimeEnabled) {
    return {
      kind: "blocked",
      code: "generation_runtime_disabled",
      message: "Generation runtime is disabled.",
    };
  }

  if (
    config.providerAdapter !== "openai_image_minimal" ||
    !config.allowRealProviderCalls
  ) {
    return {
      kind: "blocked",
      code: "vendor_calls_disabled",
      message: "Generation provider calls are disabled.",
    };
  }

  return { kind: "ready" };
};

export const evaluateGenerationRequesterPreconditions = (
  requesterContext: BackendAuthenticatedRequesterContext | undefined,
): BackendGenerationExecutionPreconditionResult => {
  if (!requesterContext) {
    return {
      kind: "blocked",
      code: "sign_in_required",
      message: "Sign in is required before generation can execute.",
    };
  }

  if (!requesterContext.workspaceId) {
    return {
      kind: "blocked",
      code: "workspace_permission_not_verified",
      message: "Backend-derived workspace context is required.",
    };
  }

  return { kind: "ready" };
};

export const evaluateGenerationRolePreconditions = (
  role: WorkspaceRole | undefined,
): BackendGenerationExecutionPreconditionResult => {
  if (role === "owner" || role === "admin") {
    return { kind: "ready" };
  }

  return {
    kind: "blocked",
    code: "workspace_owner_or_admin_required",
    message: "Workspace owner or admin permission is required for generation.",
  };
};

export const isActiveValidatedProviderKeyForGeneration = (
  record: BackendProviderKeyRecord | undefined,
  providerId: "openai" = "openai",
): record is BackendProviderKeyRecord => {
  if (!record) {
    return false;
  }

  return (
    record.providerName === providerId &&
    record.status === "active" &&
    record.verificationStatus === "validated" &&
    record.needsReverification === false &&
    !record.revokedAt &&
    !record.disabledAt &&
    !record.rotatedAt &&
    !record.deletedAt
  );
};

export const selectActiveValidatedProviderKeyForGeneration = (
  records: BackendProviderKeyRecord[],
  providerId: "openai" = "openai",
): BackendProviderKeyRecord | undefined =>
  records.find((record) =>
    isActiveValidatedProviderKeyForGeneration(record, providerId),
  );

export const evaluateGenerationControlPreconditions = (
  readiness: BackendGenerationExecutionControlReadiness,
): BackendGenerationExecutionPreconditionResult => {
  if (!readiness.rateLimitReady) {
    return {
      kind: "blocked",
      code: "rate_limit_not_configured",
      message: "Generation rate limiting is not configured.",
    };
  }

  if (!readiness.idempotencyReady) {
    return {
      kind: "blocked",
      code: "idempotency_not_configured",
      message: "Generation idempotency is not configured.",
    };
  }

  if (!readiness.singleFlightReady) {
    return {
      kind: "blocked",
      code: "single_flight_not_configured",
      message: "Generation single-flight protection is not configured.",
    };
  }

  if (!readiness.costControlsReady) {
    return {
      kind: "blocked",
      code: "cost_controls_not_configured",
      message: "Generation cost controls are not configured.",
    };
  }

  return { kind: "ready" };
};
