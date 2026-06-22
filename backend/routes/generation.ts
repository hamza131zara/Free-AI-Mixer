import { Router } from "express";
import type { Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import type { AsyncBackendRequesterContextResolver } from "../auth/requesterContextResolver";
import type { WorkspaceMembershipRepository } from "../auth/workspaceMembership";
import type { BackendRequesterContext } from "../auth/requesterContext";
import type { WorkspaceMembershipRole } from "../auth/workspaceMembership";
import { decideProductionAuthOwnership } from "../auth/productionAuthOwnershipPolicy";
import type {
  BackendGenerationCatalogResponse,
  BackendGeneratedArtifactAccessResponse,
  BackendGeneratedArtifactAccessUnavailableStatus,
  BackendGenerationHistoryResponse,
  BackendGenerationJobMutationResponse,
  BackendGenerationRuntimeStatusResponse,
} from "../contracts/generationRuntimeHttpTypes";
import type { ProviderSecretVault } from "../providers/providerSecretVault";
import type {
  BackendProjectRepository,
  BackendProviderKeyRepository,
} from "../repositories/repositoryContracts";
import { getProviderCatalog } from "../providers/providerCatalog";
import { getGenerationFailureMapping } from "../generation/generationFailureMapping";
import type {
  BackendGenerationRuntimeCompositionReadiness,
  BackendGenerationRuntimeConfig,
  BackendGenerationMockExecutionAdapterSelection,
  BackendGenerationOpenAiAdapterFetchMode,
  BackendGenerationOpenAiImageModelConfig,
  BackendGenerationRouteExecutionMode,
} from "../generation/generationRuntimeConfig";
import {
  parseGenerationMockExecutionAdapterSelection,
  parseGenerationRouteExecutionMode,
} from "../generation/generationRuntimeConfig";
import type {
  BackendGenerationExecutionControlReadiness,
  BackendGenerationExecutionPreconditionResult,
} from "../generation/generationRuntimeOrchestrator";
import {
  evaluateGenerationControlPreconditions,
  evaluateGenerationGatePreconditions,
  evaluateGenerationRequesterPreconditions,
  evaluateGenerationRolePreconditions,
  getGenerationExecutionControlReadiness,
  isActiveValidatedProviderKeyForGeneration,
  parseGenerationJobRequest,
} from "../generation/generationRuntimeOrchestrator";
import type {
  BackendGenerationProviderAdapter,
  BackendGenerationSafeDiagnostic,
} from "../generation/generationProviderAdapter";
import type { GeneratedImageArtifactStorage } from "../generation/generatedImageArtifactStorage";
import {
  createNotConfiguredGeneratedImageArtifactAccessResolver,
  type GeneratedImageArtifactAccessResolver,
} from "../generation/generatedImageArtifactAccess";
import type { CreditService } from "../credits/creditService";
import type { GeneratedImageProductionStorage } from "../generation/supabaseGeneratedImageProductionStorage";
import type { GeneratedImageArtifactRegistry } from "../generation/generatedImageArtifactRegistry";
import { verifyGeneratedImageArtifactBytes } from "../generation/generatedImageArtifactVerification";
import { createOpenAiImageGenerationAdapter } from "../generation/openAiImageGenerationAdapter";
import {
  evaluateProviderExecutionPolicy,
  type ProviderExecutionPolicyDecision,
} from "../generation/providerExecutionPolicy";
import {
  defaultGenerationRetryPolicy,
  defaultGenerationRoutingPreferences,
} from "../generation/generationProviderTypes";
import { chooseGenerationProvider } from "../generation/generationRouting";
import type {
  ProductionPersistenceWriteResult,
  ProductionSupabasePersistenceWriter,
} from "../persistence/productionSupabasePersistenceBoundary";

export interface CreateGenerationRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  generationRuntimeConfig?: BackendGenerationRuntimeConfig;
  generationRuntimeReadiness?: BackendGenerationRuntimeCompositionReadiness;
  providerKeyRepository?: BackendProviderKeyRepository;
  providerSecretVault?: ProviderSecretVault;
  workspaceMembershipRepository?: WorkspaceMembershipRepository;
  projectRepository?: BackendProjectRepository;
  routeAccessResolver?: AsyncBackendRequesterContextResolver;
  generationExecutionControlReadiness?: BackendGenerationExecutionControlReadiness;
  generationProviderAdapter?: Pick<
    BackendGenerationProviderAdapter,
    "getReadiness" | "providerId"
  >;
  generationMockExecutionAdapterSelection?: BackendGenerationMockExecutionAdapterSelection;
  generationMockExecutor?: (input: {
    providerId: "openai";
    requestId: string;
  }) => Promise<{ kind: "mock_execution_blocked" }>;
  generationOpenAiAdapterFetchMode?: BackendGenerationOpenAiAdapterFetchMode;
  generationOpenAiImageModelConfig?: BackendGenerationOpenAiImageModelConfig;
  generationByokDecryptForMockExecutionEnabled?: boolean;
  openAiAdapterMockFetch?: typeof fetch;
  openAiRealProviderFetch?: typeof fetch;
  openAiAdapterMaxImageBytes?: number;
  generatedImageArtifactStorage?: GeneratedImageArtifactStorage;
  generationOpenAiImageRealLocalSmokeEnabled?: boolean;
  generationRouteExecutionMode?: BackendGenerationRouteExecutionMode;
  generatedArtifactStorageReadiness?: {
    getReadiness?: () => "not_configured" | "ready";
  };
  generatedImageArtifactAccessResolver?: GeneratedImageArtifactAccessResolver;
  generatedImageArtifactRegistry?: GeneratedImageArtifactRegistry;
  generatedImageLocalPreviewEnabled?: boolean;
  generatedImageProductionStorage?: GeneratedImageProductionStorage;
  generatedImageProductionDeliveryEnabled?: boolean;
  productionAuthOwnershipPolicyEnabled?: boolean;
  productionPersistenceWriter?: ProductionSupabasePersistenceWriter;
  creditService?: CreditService;
}

const resolveAuthUnavailableCode = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): "auth_not_configured" | "auth_provider_unavailable" =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "auth_not_configured"
    : "auth_provider_unavailable";

const toRuntimeProviders = () =>
  getProviderCatalog().map((provider) => ({
    ...provider,
    executionState: "runtime_disabled" as const,
  }));

const createRuntimeSummary = () => {
  const supportedProviders = toRuntimeProviders();

  return {
    executionState: "disabled_by_default" as const,
    vendorCallsEnabled: false as const,
    routingPreferences: defaultGenerationRoutingPreferences,
    routingDecision: chooseGenerationProvider({
      availableProviderIds: supportedProviders.map((provider) => provider.id),
      preferences: defaultGenerationRoutingPreferences,
    }),
    retryPolicy: defaultGenerationRetryPolicy,
    supportedProviders,
  };
};

const toRuntimeSnapshot = (
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  vendorCallsEnabled: boolean = runtimeSummary.vendorCallsEnabled,
) => ({
  executionState: runtimeSummary.executionState,
  vendorCallsEnabled,
  routingPreferences: runtimeSummary.routingPreferences,
  retryPolicy: runtimeSummary.retryPolicy,
});

const rejectGenerationJob = (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  status: Extract<
    BackendGenerationJobMutationResponse,
    { kind: "generation_job_rejected" }
  >["status"],
  message: string,
  httpStatus: number,
  attemptedProviderIds: Extract<
    BackendGenerationJobMutationResponse,
    { kind: "generation_job_rejected" }
  >["attemptedProviderIds"] = [],
  diagnosticResult?: BackendGenerationSafeDiagnostic,
): void => {
  response.status(httpStatus).json({
    kind: "generation_job_rejected",
    status,
    message,
    runtime: toRuntimeSnapshot(runtimeSummary),
    attemptedProviderIds,
    ...(diagnosticResult?.diagnosticCode
      ? { diagnosticCode: diagnosticResult.diagnosticCode }
      : {}),
    ...(diagnosticResult?.failureCategory
      ? { failureCategory: diagnosticResult.failureCategory }
      : {}),
  });
};

const rejectGenerationJobWithVendorState = (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  status: Extract<
    BackendGenerationJobMutationResponse,
    { kind: "generation_job_rejected" }
  >["status"],
  message: string,
  httpStatus: number,
  vendorCallsEnabled: boolean,
  attemptedProviderIds: Extract<
    BackendGenerationJobMutationResponse,
    { kind: "generation_job_rejected" }
  >["attemptedProviderIds"] = [],
  diagnosticResult?: BackendGenerationSafeDiagnostic,
): void => {
  response.status(httpStatus).json({
    kind: "generation_job_rejected",
    status,
    message,
    runtime: toRuntimeSnapshot(runtimeSummary, vendorCallsEnabled),
    attemptedProviderIds,
    ...(diagnosticResult?.diagnosticCode
      ? { diagnosticCode: diagnosticResult.diagnosticCode }
      : {}),
    ...(diagnosticResult?.failureCategory
      ? { failureCategory: diagnosticResult.failureCategory }
      : {}),
  });
};

const mapParseErrorToFailureCode = (
  code: Exclude<
    ReturnType<typeof parseGenerationJobRequest>,
    { kind: "valid" }
  >["code"],
) => {
  if (code === "unsupported_field") {
    return "unsupported_generation_request" as const;
  }

  if (code === "invalid_provider") {
    return "provider_not_supported" as const;
  }

  if (code === "invalid_billing_mode") {
    return "unsupported_generation_request" as const;
  }

  return "invalid_prompt" as const;
};

const preconditionCodeToResponseStatus = (
  code: Exclude<
    BackendGenerationExecutionPreconditionResult,
    { kind: "ready" }
  >["code"],
): Extract<
  BackendGenerationJobMutationResponse,
  { kind: "generation_job_rejected" }
>["status"] => {
  if (code === "sign_in_required") {
    return "unauthenticated";
  }

  return code;
};

const providerPolicyStatusToFailureCode = (
  status: Exclude<
    ProviderExecutionPolicyDecision,
    { status: "provider_execution_allowed" }
  >["status"],
) => status;

const rejectProviderExecutionPolicyDecision = (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  decision: Exclude<
    ProviderExecutionPolicyDecision,
    { status: "provider_execution_allowed" }
  >,
): void => {
  const failureCode = providerPolicyStatusToFailureCode(decision.status);
  const failure = getGenerationFailureMapping(failureCode);

  rejectGenerationJobWithVendorState(
    response,
    runtimeSummary,
    failureCode,
    decision.message || failure.message,
    failure.httpStatus,
    false,
    decision.providerId === "mock_local" ? ["mock_local"] : [decision.providerId],
    {
      diagnosticCode: decision.diagnosticCode,
      failureCategory: "provider_policy",
    },
  );
};

const rejectOpenAiAdapterMockResult = (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  result: Awaited<
    ReturnType<
      NonNullable<BackendGenerationProviderAdapter["generateImageFromStoredProviderKey"]>
    >
  >,
): void => {
  if (result.kind === "artifact_storage_unavailable") {
    rejectGenerationJob(
      response,
      runtimeSummary,
      "artifact_storage_unavailable",
      result.message,
      503,
      ["openai"],
      result,
    );
    return;
  }

  if (result.kind === "vault_decrypt_failed") {
    rejectGenerationJob(
      response,
      runtimeSummary,
      "vault_decrypt_failed",
      result.message,
      503,
      ["openai"],
      result,
    );
    return;
  }

  const failure = getGenerationFailureMapping("generation_execution_blocked");
  rejectGenerationJob(
    response,
    runtimeSummary,
    "generation_execution_blocked",
    failure.message,
    failure.httpStatus,
    ["openai"],
  );
};

const sendOpenAiAdapterMockStorageResult = (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  result: Awaited<
    ReturnType<
      NonNullable<BackendGenerationProviderAdapter["generateImageFromStoredProviderKey"]>
    >
  >,
): void => {
  if (result.kind === "generated") {
    const { artifact } = result;

    if (!artifact.contentType || !artifact.sizeBytes || !artifact.sha256) {
      const failure = getGenerationFailureMapping("artifact_storage_unavailable");
      rejectGenerationJob(
        response,
        runtimeSummary,
        "artifact_storage_unavailable",
        failure.message,
        failure.httpStatus,
        ["openai"],
      );
      return;
    }

    response.status(200).json({
      kind: "generation_job_metadata_ready",
      status: "generated_metadata_ready",
      message:
        "Mock OpenAI adapter output was verified and stored locally for backend smoke only; delivery remains unavailable.",
      artifact: {
        artifactId: artifact.artifactId,
        providerId: artifact.providerId,
        contentType: artifact.contentType,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
        createdAt: artifact.createdAt,
        deliveryStatus: "unavailable",
      },
      runtime: toRuntimeSnapshot(runtimeSummary),
      attemptedProviderIds: ["openai"],
    });
    return;
  }

  rejectOpenAiAdapterMockResult(response, runtimeSummary, result);
};

const sendOpenAiRealLocalProviderResult = (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  result: Awaited<
    ReturnType<
      NonNullable<BackendGenerationProviderAdapter["generateImageFromStoredProviderKey"]>
    >
  >,
): void => {
  if (result.kind === "generated") {
    const { artifact } = result;

    if (!artifact.contentType || !artifact.sizeBytes || !artifact.sha256) {
      const failure = getGenerationFailureMapping("artifact_storage_unavailable");
      rejectGenerationJobWithVendorState(
        response,
        runtimeSummary,
        "artifact_storage_unavailable",
        failure.message,
        failure.httpStatus,
        true,
        ["openai"],
        {
          diagnosticCode: "artifact_storage_write_failed",
          failureCategory: "artifact_storage",
        },
      );
      return;
    }

    response.status(200).json({
      kind: "generation_job_metadata_ready",
      status: "generated_metadata_ready",
      message:
        "OpenAI image generation produced verified local metadata; delivery remains unavailable.",
      artifact: {
        artifactId: artifact.artifactId,
        providerId: artifact.providerId,
        contentType: artifact.contentType,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
        createdAt: artifact.createdAt,
        deliveryStatus: "unavailable",
      },
      runtime: toRuntimeSnapshot(runtimeSummary, true),
      attemptedProviderIds: ["openai"],
    });
    return;
  }

  const responseStatus =
    result.kind === "artifact_storage_unavailable"
      ? "artifact_storage_unavailable"
      : result.kind === "vault_decrypt_failed"
        ? "vault_decrypt_failed"
        : result.kind === "invalid_prompt"
          ? "invalid_prompt"
          : result.kind === "invalid_provider"
            ? "invalid_provider"
            : result.kind === "key_not_found"
              ? "provider_key_not_configured"
              : result.kind === "generation_failed" &&
                  result.errorCode === "invalid_credentials"
                ? "invalid_credentials"
                : result.kind === "provider_unavailable"
                  ? "provider_unavailable"
                  : result.kind === "rate_limited"
                    ? "rate_limited"
                    : result.kind === "timeout"
                      ? "timeout"
                      : "generation_failed";
  const failureCode =
    responseStatus === "invalid_provider" ? "provider_not_supported" : responseStatus;
  const failure = getGenerationFailureMapping(failureCode);

  rejectGenerationJobWithVendorState(
    response,
    runtimeSummary,
    responseStatus,
    failure.message,
    failure.httpStatus,
    true,
    ["openai"],
    result,
  );
};

const sendOpenAiRealLocalProviderUnexpectedError = (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
): void => {
  const failure = getGenerationFailureMapping("generation_failed");
  rejectGenerationJobWithVendorState(
    response,
    runtimeSummary,
    "generation_failed",
    failure.message,
    failure.httpStatus,
    true,
    ["openai"],
    {
      diagnosticCode: "generation_execution_unhandled_exception",
      failureCategory: "generation_runtime",
    },
  );
};

const mockLocalProviderId = "mock_local" as const;
const mockLocalPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const safeGeneratedArtifactSegmentRegex = /^[A-Za-z0-9_-]{1,120}$/;
const safeProjectIdRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isSafeGeneratedArtifactSegment = (value: string): boolean =>
  safeGeneratedArtifactSegmentRegex.test(value);

const setPrivateGenerationResponseHeaders = (response: Response): void => {
  response.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.removeHeader("ETag");
};

const preventPrivateGenerationEtag = (response: Response): void => {
  const setHeader = response.setHeader.bind(response);

  response.setHeader = ((name: string, value: number | string | readonly string[]) => {
    if (name.toLowerCase() === "etag") {
      return response;
    }

    return setHeader(name, value);
  }) as Response["setHeader"];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractProjectScopedGenerationBody = (
  body: unknown,
):
  | {
      kind: "valid";
      body: Record<string, unknown>;
      projectId: string;
    }
  | {
      kind: "invalid";
      message: string;
    } => {
  if (!isRecord(body) || body.generationKind !== "image") {
    return {
      kind: "valid",
      body: isRecord(body) ? body : {},
      projectId: "",
    };
  }

  if (typeof body.projectId !== "string" || !safeProjectIdRegex.test(body.projectId)) {
    return {
      kind: "invalid",
      message: "A valid project ID is required before image generation can run.",
    };
  }

  const { projectId, ...generationBody } = body;

  return {
    kind: "valid",
    body: generationBody,
    projectId,
  };
};

const sendGeneratedArtifactAccessUnavailable = (
  response: Response<BackendGeneratedArtifactAccessResponse>,
  status: BackendGeneratedArtifactAccessUnavailableStatus,
  message: string,
  httpStatus: number,
): void => {
  response.status(httpStatus).json({
    kind: "generated_artifact_access_unavailable",
    status,
    deliveryStatus: "unavailable",
    message,
  });
};

const sendGenerationHistoryRejected = (
  response: Response<BackendGenerationHistoryResponse>,
  status: Extract<
    BackendGenerationHistoryResponse,
    { kind: "generation_history_rejected" }
  >["status"],
  message: string,
  httpStatus: number,
): void => {
  response.status(httpStatus).json({
    kind: "generation_history_rejected",
    status,
    message,
  });
};

const isGeneratedPreviewContentType = (
  contentType: string,
): contentType is "image/png" | "image/jpeg" | "image/webp" =>
  contentType === "image/png" ||
  contentType === "image/jpeg" ||
  contentType === "image/webp";

const isInsideGeneratedPreviewRoot = (
  rootPath: string,
  targetPath: string,
): boolean => {
  const relative = path.relative(rootPath, targetPath);

  return (
    relative.length > 0 &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
};

const getActiveMembershipRole = (
  membershipResult: Awaited<
    ReturnType<WorkspaceMembershipRepository["getMembership"]>
  >,
): WorkspaceMembershipRole | undefined =>
  membershipResult.kind === "member" &&
  membershipResult.membership.status === "active"
    ? membershipResult.membership.role
    : undefined;

const getProductionOwnershipFailure = (
  requesterContext: BackendRequesterContext,
  membershipResult: Awaited<
    ReturnType<WorkspaceMembershipRepository["getMembership"]>
  >,
  surface: Parameters<typeof decideProductionAuthOwnership>[0]["surface"],
) => {
  const decision = decideProductionAuthOwnership({
    membershipRole: getActiveMembershipRole(membershipResult),
    requesterContext,
    surface,
  });

  return decision.kind === "denied" ? decision : undefined;
};

const toPersistenceResponse = (
  results: ProductionPersistenceWriteResult[],
): Extract<
  BackendGenerationJobMutationResponse,
  { kind: "generation_job_metadata_ready" }
>["persistence"] | undefined => {
  if (results.length === 0) {
    return undefined;
  }

  const unavailable = results.find((result) => result.kind === "unavailable");

  if (unavailable?.kind === "unavailable") {
    return {
      status: "persistence_unavailable",
      message: unavailable.message,
    };
  }

  return {
    status: "persisted",
  };
};

const sendMockLocalImageStorageResult = async (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  input: {
    artifactId: string;
    jobId: string;
    ownerId: string;
    projectId?: string;
    productionStorage?: GeneratedImageProductionStorage;
    registry?: GeneratedImageArtifactRegistry;
    storage?: GeneratedImageArtifactStorage;
    persistenceWriter?: ProductionSupabasePersistenceWriter;
    workspaceId: string;
  },
): Promise<void> => {
  if (!input.storage && !input.productionStorage) {
    const failure = getGenerationFailureMapping("artifact_storage_unavailable");
    rejectGenerationJob(
      response,
      runtimeSummary,
      "artifact_storage_unavailable",
      failure.message,
      failure.httpStatus,
      [mockLocalProviderId],
    );
    return;
  }

  const verified = verifyGeneratedImageArtifactBytes({
    bytes: mockLocalPngBytes,
    contentType: "image/png",
    format: "png",
    maxBytes: 1024,
  });

  if (verified.kind !== "verified") {
    const failure = getGenerationFailureMapping("artifact_storage_unavailable");
    rejectGenerationJob(
      response,
      runtimeSummary,
      "artifact_storage_unavailable",
      failure.message,
      failure.httpStatus,
      [mockLocalProviderId],
      {
        diagnosticCode: "artifact_verification_failed",
        failureCategory: "artifact_storage",
      },
    );
    return;
  }

  const productionStored = input.productionStorage
    ? await input.productionStorage.store({
        artifactId: input.artifactId,
        jobId: input.jobId,
        ownerId: input.ownerId,
        providerId: mockLocalProviderId,
        verifiedImage: verified.image,
        workspaceId: input.workspaceId,
      })
    : undefined;

  if (productionStored?.kind === "stored") {
    const { artifact, storageRef } = productionStored;
    const persistenceResults: ProductionPersistenceWriteResult[] = [];

    if (input.persistenceWriter) {
      persistenceResults.push(
        await input.persistenceWriter.persistGenerationJobMetadata({
          generationKind: "image",
          jobId: input.jobId,
          ownerId: input.ownerId,
          projectId: input.projectId,
          providerId: mockLocalProviderId,
          requestId: input.jobId,
          status: "generated_metadata_ready",
          workspaceId: input.workspaceId,
        }),
      );
      persistenceResults.push(
        await input.persistenceWriter.persistGeneratedArtifactRecord({
          artifactId: artifact.artifactId,
          contentType: artifact.contentType,
          createdAt: artifact.createdAt,
          jobId: artifact.jobId,
          ownerId: artifact.ownerId,
          providerId: artifact.providerId,
          sha256: artifact.sha256,
          sizeBytes: artifact.sizeBytes,
          status: artifact.status,
          storageRef,
          workspaceId: artifact.workspaceId,
        }),
      );
      persistenceResults.push(
        await input.persistenceWriter.persistImageGenerationHistory({
          artifactId: artifact.artifactId,
          contentType: artifact.contentType,
          createdAt: artifact.createdAt,
          jobId: artifact.jobId,
          ownerId: artifact.ownerId,
          projectId: input.projectId,
          providerId: artifact.providerId,
          requestId: input.jobId,
          sha256: artifact.sha256,
          sizeBytes: artifact.sizeBytes,
          status: "generated_metadata_ready",
          workspaceId: artifact.workspaceId,
        }),
      );
    }

    response.status(200).json({
      kind: "generation_job_metadata_ready",
      status: "generated_metadata_ready",
      message:
        "Mock local image generation produced verified production storage metadata; delivery remains backend-mediated only.",
      artifact: {
        artifactId: artifact.artifactId,
        providerId: artifact.providerId,
        contentType: artifact.contentType,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
        createdAt: artifact.createdAt,
        deliveryStatus: "unavailable",
      },
      ...(persistenceResults.length > 0
        ? { persistence: toPersistenceResponse(persistenceResults) }
        : {}),
      runtime: toRuntimeSnapshot(runtimeSummary, false),
      attemptedProviderIds: [mockLocalProviderId],
    });
    return;
  }

  if (input.productionStorage && !input.storage) {
    const failure = getGenerationFailureMapping("artifact_storage_unavailable");
    rejectGenerationJob(
      response,
      runtimeSummary,
      "artifact_storage_unavailable",
      failure.message,
      failure.httpStatus,
      [mockLocalProviderId],
      {
        diagnosticCode: "artifact_storage_write_failed",
        failureCategory: "artifact_storage",
      },
    );
    return;
  }

  const localStorage = input.storage;

  if (!localStorage) {
    const failure = getGenerationFailureMapping("artifact_storage_unavailable");
    rejectGenerationJob(
      response,
      runtimeSummary,
      "artifact_storage_unavailable",
      failure.message,
      failure.httpStatus,
      [mockLocalProviderId],
    );
    return;
  }

  const stored = await localStorage.store({
    artifactId: input.artifactId,
    jobId: input.jobId,
    ownerId: input.ownerId,
    providerId: mockLocalProviderId,
    verifiedImage: verified.image,
    workspaceId: input.workspaceId,
  });

  if (stored.kind !== "stored") {
    const failure = getGenerationFailureMapping("artifact_storage_unavailable");
    rejectGenerationJob(
      response,
      runtimeSummary,
      "artifact_storage_unavailable",
      failure.message,
      failure.httpStatus,
      [mockLocalProviderId],
      {
        diagnosticCode:
          stored.kind === "failed"
            ? "artifact_storage_write_failed"
            : "real_provider_storage_not_ready",
        failureCategory: "artifact_storage",
      },
    );
    return;
  }

  const { artifact } = stored;
  input.registry?.register({
    artifact,
    internalRef: stored.internalRef,
  });
  const persistenceResults: ProductionPersistenceWriteResult[] = [];

  if (input.persistenceWriter) {
    persistenceResults.push(
      await input.persistenceWriter.persistGenerationJobMetadata({
        generationKind: "image",
        jobId: input.jobId,
        ownerId: input.ownerId,
        projectId: input.projectId,
        providerId: mockLocalProviderId,
        requestId: input.jobId,
        status: "generated_metadata_ready",
        workspaceId: input.workspaceId,
      }),
    );
    persistenceResults.push(
      await input.persistenceWriter.persistGeneratedArtifactRecord({
        artifactId: artifact.artifactId,
        contentType: artifact.contentType,
        createdAt: artifact.createdAt,
        jobId: artifact.jobId,
        ownerId: artifact.ownerId,
        providerId: artifact.providerId,
        sha256: artifact.sha256,
        sizeBytes: artifact.sizeBytes,
        status: artifact.status,
        workspaceId: artifact.workspaceId,
      }),
    );
    persistenceResults.push(
      await input.persistenceWriter.persistImageGenerationHistory({
        artifactId: artifact.artifactId,
        contentType: artifact.contentType,
        createdAt: artifact.createdAt,
        jobId: artifact.jobId,
        ownerId: artifact.ownerId,
        projectId: input.projectId,
        providerId: artifact.providerId,
        requestId: input.jobId,
        sha256: artifact.sha256,
        sizeBytes: artifact.sizeBytes,
        status: "generated_metadata_ready",
        workspaceId: artifact.workspaceId,
      }),
    );
  }

  response.status(200).json({
    kind: "generation_job_metadata_ready",
    status: "generated_metadata_ready",
    message:
      "Mock local image generation produced verified local metadata for backend smoke only; delivery remains unavailable.",
    artifact: {
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      contentType: artifact.contentType,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      createdAt: artifact.createdAt,
      deliveryStatus: "unavailable",
    },
    ...(persistenceResults.length > 0
      ? { persistence: toPersistenceResponse(persistenceResults) }
      : {}),
    runtime: toRuntimeSnapshot(runtimeSummary, false),
    attemptedProviderIds: [mockLocalProviderId],
  });
};

const sendMockLocalVideoStorageUnavailableResult = (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
): void => {
  const failure = getGenerationFailureMapping("video_artifact_storage_unavailable");

  response.status(failure.httpStatus).json({
    kind: "generation_job_rejected",
    status: "video_artifact_storage_unavailable",
    message: failure.message,
    runtime: toRuntimeSnapshot(runtimeSummary, false),
    attemptedProviderIds: [mockLocalProviderId],
    generationKind: "video",
    lifecycle: "failed",
    lifecycleTrace: ["submitted", "processing", "failed"],
    diagnosticCode: "video_artifact_verification_unavailable",
    failureCategory: "artifact_storage",
  });
};

export const createGenerationRouter = (
  options: CreateGenerationRouterOptions,
): Router => {
  const router = Router();

  router.use("/generation", (_request, response, next) => {
    preventPrivateGenerationEtag(response);
    setPrivateGenerationResponseHeaders(response);
    next();
  });

  router.get(
    "/generation/providers/catalog",
    (_request, response: Response<BackendGenerationCatalogResponse>) => {
      response.status(200).json({
        kind: "generation_provider_catalog",
        message:
          "Backend generation runtime uses the same provider IDs as the Phase 3 provider catalog, but execution remains disabled by default.",
        providers: toRuntimeProviders(),
      });
    },
  );

  router.get(
    "/generation/runtime-status",
    (request, response: Response<BackendGenerationRuntimeStatusResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);

      if (requesterContext.kind === "authenticated") {
        response.status(200).json({
          kind: "generation_runtime_status",
          status: "authenticated",
          message:
            "Backend generation runtime boundaries are present, but live provider execution is disabled by default in this product phase.",
          activeWorkspaceId: requesterContext.workspaceId,
          runtime: createRuntimeSummary(),
        });
        return;
      }

      if (requesterContext.reason === "auth_not_configured") {
        const failure = getGenerationFailureMapping("auth_not_configured");
        response.status(failure.httpStatus).json({
          kind: "generation_runtime_unavailable",
          status: "auth_not_configured",
          message: failure.message,
        });
        return;
      }

      if (requesterContext.reason === "auth_provider_unavailable") {
        const failure = getGenerationFailureMapping("auth_provider_unavailable");
        response.status(failure.httpStatus).json({
          kind: "generation_runtime_unavailable",
          status: "auth_provider_unavailable",
          message: failure.message,
        });
        return;
      }

      if (options.runtimeConfig.kind === "auth_provider_not_configured") {
        const failure = getGenerationFailureMapping("auth_not_configured");
        response.status(failure.httpStatus).json({
          kind: "generation_runtime_unavailable",
          status: "auth_not_configured",
          message: failure.message,
        });
        return;
      }

      response.status(401).json({
        kind: "generation_runtime_sign_in_required",
        status: "unauthenticated",
        reason: requesterContext.reason,
        message:
          getGenerationFailureMapping("sign_in_required").message,
      });
    },
  );

  router.get(
    "/generation/history",
    async (request, response: Response<BackendGenerationHistoryResponse>) => {
      const projectId =
        typeof request.query.projectId === "string"
          ? request.query.projectId
          : undefined;

      if (!projectId || !safeProjectIdRegex.test(projectId)) {
        sendGenerationHistoryRejected(
          response,
          "invalid_project_id",
          "A valid project ID is required to load generated image history.",
          400,
        );
        return;
      }

      const requesterContext = options.routeAccessResolver
        ? await options.routeAccessResolver.resolve({ headers: request.headers })
        : getRequesterContextFromRequest(request);

      if (requesterContext.kind !== "authenticated") {
        sendGenerationHistoryRejected(
          response,
          requesterContext.reason === "auth_not_configured"
            ? "auth_not_configured"
            : requesterContext.reason === "auth_provider_unavailable"
              ? "auth_provider_unavailable"
              : "unauthenticated",
          "Authentication is required to load generated image history.",
          requesterContext.reason === "auth_not_configured" ||
            requesterContext.reason === "auth_provider_unavailable"
            ? 503
            : 401,
        );
        return;
      }

      if (!requesterContext.workspaceId || !options.projectRepository) {
        sendGenerationHistoryRejected(
          response,
          "persistence_unavailable",
          "Generated image history persistence is not configured.",
          503,
        );
        return;
      }

      if (options.productionAuthOwnershipPolicyEnabled) {
        if (!options.workspaceMembershipRepository) {
          sendGenerationHistoryRejected(
            response,
            "workspace_permission_not_verified",
            "Generated image history workspace permission is unavailable.",
            503,
          );
          return;
        }

        const membershipResult =
          await options.workspaceMembershipRepository.getMembership({
            userId: requesterContext.userId,
            workspaceId: requesterContext.workspaceId,
          });
        const ownershipFailure = getProductionOwnershipFailure(
          requesterContext,
          membershipResult,
          "generated_artifacts",
        );

        if (ownershipFailure) {
          sendGenerationHistoryRejected(
            response,
            ownershipFailure.reason === "workspace_owner_or_admin_required"
              ? "workspace_owner_or_admin_required"
              : "workspace_permission_not_verified",
            "Generated image history is not authorized for this workspace.",
            ownershipFailure.statusCode,
          );
          return;
        }
      }

      const project = await options.projectRepository.getProjectForWorkspace(
        requesterContext.workspaceId,
        projectId,
      );

      if (!project) {
        sendGenerationHistoryRejected(
          response,
          "workspace_permission_not_verified",
          "Generated image history is not available for this project.",
          404,
        );
        return;
      }

      if (!options.projectRepository.listImageGenerationHistoryForProject) {
        sendGenerationHistoryRejected(
          response,
          "persistence_unavailable",
          "Generated image history persistence is not configured.",
          503,
        );
        return;
      }

      let history;

      try {
        history =
          await options.projectRepository.listImageGenerationHistoryForProject(
            requesterContext.workspaceId,
            project.projectId,
          );
      } catch {
        sendGenerationHistoryRejected(
          response,
          "persistence_unavailable",
          "Generated image history is temporarily unavailable.",
          503,
        );
        return;
      }

      response.status(200).json({
        kind: "generation_history",
        status: "authenticated",
        projectId: project.projectId,
        message: "Generated image history is loaded for this verified project.",
        history: history.map((entry) => ({
          artifactId: entry.artifactId,
          contentType: entry.contentType,
          createdAt: entry.createdAt,
          deliveryStatus: entry.deliveryStatus,
          generationId: entry.generationId,
          previewPath: `/generation/jobs/${encodeURIComponent(entry.jobId)}/artifacts/${encodeURIComponent(entry.artifactId)}/preview?projectId=${encodeURIComponent(project.projectId)}`,
          ...(entry.promptSummary ? { promptSummary: entry.promptSummary } : {}),
          providerId: entry.providerId,
          projectId: entry.projectId,
          requestId: entry.requestId,
          sha256: entry.sha256,
          sizeBytes: entry.sizeBytes,
          status: entry.status,
        })),
      });
    },
  );

  router.get(
    "/generation/jobs/:jobId/artifacts/:artifactId/access",
    async (
      request,
      response: Response<BackendGeneratedArtifactAccessResponse>,
    ) => {
      const { artifactId, jobId } = request.params;

      if (
        !isSafeGeneratedArtifactSegment(jobId) ||
        !isSafeGeneratedArtifactSegment(artifactId)
      ) {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "invalid_artifact_identity",
          "Generated artifact access identity is invalid.",
          400,
        );
        return;
      }

      const requesterContext = options.routeAccessResolver
        ? await options.routeAccessResolver.resolve({ headers: request.headers })
        : getRequesterContextFromRequest(request);

      if (requesterContext.kind !== "authenticated") {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "unauthenticated",
          "Authentication is required to access generated artifact previews.",
          401,
        );
        return;
      }

      if (!requesterContext.workspaceId) {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "generated_artifact_access_unavailable",
          "Generated artifact access workspace identity is unavailable.",
          503,
        );
        return;
      }

      if (options.productionAuthOwnershipPolicyEnabled) {
        if (!options.workspaceMembershipRepository) {
          sendGeneratedArtifactAccessUnavailable(
            response,
            "generated_artifact_access_unavailable",
            "Generated artifact access ownership policy is unavailable.",
            503,
          );
          return;
        }

        const membershipResult =
          await options.workspaceMembershipRepository.getMembership({
            userId: requesterContext.userId,
            workspaceId: requesterContext.workspaceId,
          });
        const ownershipFailure = getProductionOwnershipFailure(
          requesterContext,
          membershipResult,
          "generated_artifacts",
        );

        if (ownershipFailure) {
          sendGeneratedArtifactAccessUnavailable(
            response,
            ownershipFailure.reason === "unauthenticated"
              ? "unauthenticated"
              : "generated_artifact_access_unavailable",
            "Generated artifact access is not authorized for this workspace.",
            ownershipFailure.statusCode,
          );
          return;
        }
      }

      const resolver =
        options.generatedImageArtifactAccessResolver ??
        createNotConfiguredGeneratedImageArtifactAccessResolver();
      const result = await resolver.resolveAccess({
        artifactId,
        jobId,
        requester: {
          userId: requesterContext.userId,
          workspaceId: requesterContext.workspaceId,
        },
      });

      response.status(result.kind === "generated_artifact_access_descriptor" ? 200 : 503).json(result);
    },
  );

  router.get(
    "/generation/jobs/:jobId/artifacts/:artifactId/preview",
    async (request, response) => {
      const { artifactId, jobId } = request.params;

      if (
        !isSafeGeneratedArtifactSegment(jobId) ||
        !isSafeGeneratedArtifactSegment(artifactId)
      ) {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "invalid_artifact_identity",
          "Generated artifact preview identity is invalid.",
          400,
        );
        return;
      }

      if (
        !options.generatedImageLocalPreviewEnabled &&
        !options.generatedImageProductionDeliveryEnabled
      ) {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "generated_artifact_access_unavailable",
          "Generated image local preview is not enabled.",
          503,
        );
        return;
      }

      const requesterContext = options.routeAccessResolver
        ? await options.routeAccessResolver.resolve({ headers: request.headers })
        : getRequesterContextFromRequest(request);

      if (requesterContext.kind !== "authenticated") {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "unauthenticated",
          "Authentication is required to preview generated artifacts.",
          401,
        );
        return;
      }

      if (!requesterContext.workspaceId) {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "generated_artifact_access_unavailable",
          "Generated artifact preview workspace identity is unavailable.",
          503,
        );
        return;
      }

      if (options.productionAuthOwnershipPolicyEnabled) {
        if (!options.workspaceMembershipRepository) {
          sendGeneratedArtifactAccessUnavailable(
            response,
            "generated_artifact_access_unavailable",
            "Generated artifact preview ownership policy is unavailable.",
            503,
          );
          return;
        }

        const membershipResult =
          await options.workspaceMembershipRepository.getMembership({
            userId: requesterContext.userId,
            workspaceId: requesterContext.workspaceId,
          });
        const ownershipFailure = getProductionOwnershipFailure(
          requesterContext,
          membershipResult,
          "generated_artifacts",
        );

        if (ownershipFailure) {
          sendGeneratedArtifactAccessUnavailable(
            response,
            ownershipFailure.reason === "unauthenticated"
              ? "unauthenticated"
              : "generated_artifact_access_unavailable",
            "Generated artifact preview is not authorized for this workspace.",
            ownershipFailure.statusCode,
          );
          return;
        }
      }

      if (
        options.generatedImageProductionDeliveryEnabled &&
        options.generatedImageProductionStorage
      ) {
        const previewProjectId =
          typeof request.query.projectId === "string"
            ? request.query.projectId
            : undefined;

        if (
          previewProjectId &&
          safeProjectIdRegex.test(previewProjectId) &&
          options.projectRepository?.listImageGenerationHistoryForProject
        ) {
          let project;
          let history;

          try {
            project = await options.projectRepository.getProjectForWorkspace(
              requesterContext.workspaceId,
              previewProjectId,
            );
            history = project
              ? await options.projectRepository.listImageGenerationHistoryForProject(
                  requesterContext.workspaceId,
                  project.projectId,
                )
              : [];
          } catch {
            sendGeneratedArtifactAccessUnavailable(
              response,
              "generated_artifact_access_unavailable",
              "Generated artifact preview is temporarily unavailable.",
              503,
            );
            return;
          }
          const matchesProjectHistory = history.some(
            (entry) => entry.jobId === jobId && entry.artifactId === artifactId,
          );

          if (!project || !matchesProjectHistory) {
            sendGeneratedArtifactAccessUnavailable(
              response,
              "generated_artifact_access_unavailable",
              "Generated image preview is unavailable.",
              404,
            );
            return;
          }
        }

        const record = await options.generatedImageProductionStorage.resolveRecord({
          artifactId,
          jobId,
          ownerId: requesterContext.userId,
          workspaceId: requesterContext.workspaceId,
        });

        if (record.kind !== "resolved") {
          sendGeneratedArtifactAccessUnavailable(
            response,
            "generated_artifact_access_unavailable",
            "Generated image preview is unavailable.",
            404,
          );
          return;
        }

        const read = await options.generatedImageProductionStorage.readObject(
          record.record.storageRef,
        );

        if (read.kind !== "read" || !isGeneratedPreviewContentType(read.contentType)) {
          sendGeneratedArtifactAccessUnavailable(
            response,
            "generated_artifact_access_unavailable",
            "Generated image preview is unavailable.",
            404,
          );
          return;
        }

        response.setHeader("Content-Type", read.contentType);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.end(Buffer.from(read.bytes));
        return;
      }

      const record = options.generatedImageArtifactRegistry?.get({
        artifactId,
        jobId,
      });

      if (
        !record ||
        record.artifact.ownerId !== requesterContext.userId ||
        record.artifact.workspaceId !== requesterContext.workspaceId ||
        record.artifact.status !== "available" ||
        !isGeneratedPreviewContentType(record.artifact.contentType)
      ) {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "generated_artifact_access_unavailable",
          "Generated image preview is unavailable.",
          404,
        );
        return;
      }

      let realRootPath: string;
      let realFilePath: string;

      try {
        realRootPath = await fs.realpath(record.internalRef.rootPath);
        realFilePath = await fs.realpath(record.internalRef.filePath);
      } catch {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "generated_artifact_access_unavailable",
          "Generated image preview is unavailable.",
          404,
        );
        return;
      }

      if (!isInsideGeneratedPreviewRoot(realRootPath, realFilePath)) {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "generated_artifact_access_unavailable",
          "Generated image preview is unavailable.",
          403,
        );
        return;
      }

      try {
        const stat = await fs.stat(realFilePath);

        if (!stat.isFile()) {
          sendGeneratedArtifactAccessUnavailable(
            response,
            "generated_artifact_access_unavailable",
            "Generated image preview is unavailable.",
            404,
          );
          return;
        }
      } catch {
        sendGeneratedArtifactAccessUnavailable(
          response,
          "generated_artifact_access_unavailable",
          "Generated image preview is unavailable.",
          404,
        );
        return;
      }

      response.setHeader("Content-Type", record.artifact.contentType);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.sendFile(realFilePath, (error) => {
        if (error && !response.headersSent) {
          sendGeneratedArtifactAccessUnavailable(
            response,
            "generated_artifact_access_unavailable",
            "Generated image preview is unavailable.",
            500,
          );
        }
      });
    },
  );

  router.post(
    "/generation/jobs",
    async (request, response: Response<BackendGenerationJobMutationResponse>) => {
      const runtimeSummary = createRuntimeSummary();
      const routeExecutionMode =
        options.generationRouteExecutionMode ??
        parseGenerationRouteExecutionMode();
      const mockExecutionAdapterSelection =
        options.generationMockExecutionAdapterSelection ??
        parseGenerationMockExecutionAdapterSelection();

      if (
        routeExecutionMode !== "preconditions_only" &&
        routeExecutionMode !== "adapter_mock_only" &&
        routeExecutionMode !== "mock_image_local_only" &&
        routeExecutionMode !== "mock_video_local_only" &&
        routeExecutionMode !== "openai_adapter_mock_only" &&
        routeExecutionMode !== "openai_adapter_mock_storage_only" &&
        routeExecutionMode !== "real_provider_local_only"
      ) {
        const requesterContext = getRequesterContextFromRequest(request);

        if (requesterContext.kind === "authenticated") {
          const failure = getGenerationFailureMapping("generation_runtime_disabled");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_runtime_disabled",
            failure.message,
            failure.httpStatus,
          );
          return;
        }

        const authUnavailableCode =
          requesterContext.reason === "auth_not_configured"
            ? "auth_not_configured"
            : resolveAuthUnavailableCode(options.runtimeConfig);

        if (
          requesterContext.reason === "auth_not_configured" ||
          options.runtimeConfig.kind === "auth_provider_not_configured"
        ) {
          const failure = getGenerationFailureMapping(authUnavailableCode);
          rejectGenerationJob(
            response,
            runtimeSummary,
            authUnavailableCode,
            failure.message,
            failure.httpStatus,
          );
          return;
        }

        const failure = getGenerationFailureMapping("sign_in_required");
        rejectGenerationJob(
          response,
          runtimeSummary,
          "unauthenticated",
          failure.message,
          failure.httpStatus,
        );
        return;
      }

      const projectScopedBody = extractProjectScopedGenerationBody(request.body);

      if (projectScopedBody.kind === "invalid") {
        const failure = getGenerationFailureMapping("unsupported_generation_request");
        rejectGenerationJob(
          response,
          runtimeSummary,
          "unsupported_generation_request",
          projectScopedBody.message,
          failure.httpStatus,
        );
        return;
      }

      const parsed = parseGenerationJobRequest(projectScopedBody.body);

      if (parsed.kind === "invalid") {
        const failureCode = mapParseErrorToFailureCode(parsed.code);
        const failure = getGenerationFailureMapping(failureCode);
        rejectGenerationJob(
          response,
          runtimeSummary,
          failureCode === "provider_not_supported"
            ? "invalid_provider"
            : failureCode,
          failure.message,
          failure.httpStatus,
        );
        return;
      }

      const requesterContext = options.routeAccessResolver
        ? await options.routeAccessResolver.resolve({ headers: request.headers })
        : getRequesterContextFromRequest(request);

      if (
        requesterContext.kind !== "authenticated" &&
        requesterContext.reason === "auth_not_configured"
      ) {
        const failure = getGenerationFailureMapping("auth_not_configured");
        rejectGenerationJob(
          response,
          runtimeSummary,
          "auth_not_configured",
          failure.message,
          failure.httpStatus,
        );
        return;
      }

      const authenticatedRequester =
        requesterContext.kind === "authenticated" ? requesterContext : undefined;
      const requesterPrecondition =
        evaluateGenerationRequesterPreconditions(authenticatedRequester);

      if (requesterPrecondition.kind === "blocked") {
        const status =
          requesterPrecondition.code === "sign_in_required"
            ? "unauthenticated"
            : requesterPrecondition.code;
        const failure = getGenerationFailureMapping(requesterPrecondition.code);
        rejectGenerationJob(
          response,
          runtimeSummary,
          status,
          failure.message,
          failure.httpStatus,
        );
        return;
      }

      if (!options.workspaceMembershipRepository) {
        const failure = getGenerationFailureMapping(
          "workspace_permission_not_verified",
        );
        rejectGenerationJob(
          response,
          runtimeSummary,
          "workspace_permission_not_verified",
          failure.message,
          failure.httpStatus,
        );
        return;
      }

      const membershipResult =
        await options.workspaceMembershipRepository["getMembership"]({
          userId: authenticatedRequester?.userId ?? "",
          workspaceId: authenticatedRequester?.workspaceId ?? "",
        });

      if (options.productionAuthOwnershipPolicyEnabled && authenticatedRequester) {
        const ownershipFailure = getProductionOwnershipFailure(
          authenticatedRequester,
          membershipResult,
          "generation_jobs",
        );

        if (ownershipFailure) {
          const failureCode =
            ownershipFailure.reason === "unauthenticated"
              ? "sign_in_required"
              : ownershipFailure.reason === "workspace_owner_or_admin_required"
                ? "workspace_owner_or_admin_required"
                : "workspace_permission_not_verified";
          const failure = getGenerationFailureMapping(failureCode);
          rejectGenerationJob(
            response,
            runtimeSummary,
            failureCode === "sign_in_required"
              ? "unauthenticated"
              : failureCode,
            failure.message,
            failure.httpStatus,
          );
          return;
        }
      }

      const rolePrecondition = evaluateGenerationRolePreconditions(
        membershipResult.kind === "member" &&
          (membershipResult.membership.role === "owner" ||
            membershipResult.membership.role === "admin" ||
            membershipResult.membership.role === "viewer")
          ? membershipResult.membership.role
          : undefined,
      );

      if (
        membershipResult.kind !== "member" ||
        membershipResult.membership.status !== "active" ||
        rolePrecondition.kind === "blocked"
      ) {
        const failure = getGenerationFailureMapping(
          rolePrecondition.kind === "blocked"
            ? rolePrecondition.code
            : "workspace_permission_not_verified",
        );
        rejectGenerationJob(
          response,
          runtimeSummary,
          rolePrecondition.kind === "blocked"
            ? preconditionCodeToResponseStatus(rolePrecondition.code)
            : "workspace_permission_not_verified",
          failure.message,
          failure.httpStatus,
        );
        return;
      }

      let validatedProjectId: string | undefined;

      if (parsed.request.generationKind === "image") {
        if (!projectScopedBody.projectId || !options.projectRepository) {
          const failure = getGenerationFailureMapping(
            "workspace_permission_not_verified",
          );
          rejectGenerationJob(
            response,
            runtimeSummary,
            "workspace_permission_not_verified",
            failure.message,
            failure.httpStatus,
          );
          return;
        }

        const project = await options.projectRepository.getProjectForWorkspace(
          authenticatedRequester?.workspaceId ?? "",
          projectScopedBody.projectId,
        );

        if (!project || project.status !== "active") {
          const failure = getGenerationFailureMapping(
            "workspace_permission_not_verified",
          );
          rejectGenerationJob(
            response,
            runtimeSummary,
            "workspace_permission_not_verified",
            "Generation requires a verified active project in this workspace.",
            failure.httpStatus,
          );
          return;
        }

        validatedProjectId = project.projectId;
      }

      const generationRuntimeConfig = options.generationRuntimeConfig ?? {
        kind: "generation_runtime_config" as const,
        allowRealProviderCalls: false,
        providerAdapter: "not_configured" as const,
        runtimeEnabled: false,
      };

      if (
        routeExecutionMode === "mock_image_local_only" ||
        routeExecutionMode === "mock_video_local_only"
      ) {
        if (!generationRuntimeConfig.runtimeEnabled) {
          const failure = getGenerationFailureMapping("generation_runtime_disabled");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_runtime_disabled",
            failure.message,
            failure.httpStatus,
          );
          return;
        }
      } else {
        const gatePrecondition =
          evaluateGenerationGatePreconditions(generationRuntimeConfig);

        if (gatePrecondition.kind === "blocked") {
          const failure = getGenerationFailureMapping(gatePrecondition.code);
          rejectGenerationJob(
            response,
            runtimeSummary,
            preconditionCodeToResponseStatus(gatePrecondition.code),
            failure.message,
            failure.httpStatus,
          );
          return;
        }
      }

      const controlsPrecondition = evaluateGenerationControlPreconditions(
        options.generationExecutionControlReadiness ??
          getGenerationExecutionControlReadiness(),
      );

      if (controlsPrecondition.kind === "blocked") {
        const failure = getGenerationFailureMapping(controlsPrecondition.code);
        rejectGenerationJob(
          response,
          runtimeSummary,
          preconditionCodeToResponseStatus(controlsPrecondition.code),
          failure.message,
          failure.httpStatus,
        );
        return;
      }

      if (parsed.request.generationKind === "video") {
        if (routeExecutionMode !== "mock_video_local_only") {
          const failure = getGenerationFailureMapping("generation_execution_blocked");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_execution_blocked",
            failure.message,
            failure.httpStatus,
            [mockLocalProviderId],
          );
          return;
        }

        sendMockLocalVideoStorageUnavailableResult(response, runtimeSummary);
        return;
      }

      if (routeExecutionMode === "mock_image_local_only") {
        await sendMockLocalImageStorageResult(response, runtimeSummary, {
          artifactId: `${parsed.request.requestId}_mock_image`,
          jobId: parsed.request.requestId,
          ownerId: authenticatedRequester?.userId ?? "",
          projectId: validatedProjectId,
          productionStorage: options.generatedImageProductionStorage,
          registry: options.generatedImageArtifactRegistry,
          storage: options.generatedImageArtifactStorage,
          persistenceWriter: options.productionPersistenceWriter,
          workspaceId: authenticatedRequester?.workspaceId ?? "",
        });
        return;
      }

      const platformPaidReadiness =
        parsed.request.executionBillingMode === "platform_paid"
          ? (() => {
              const readiness = options.creditService?.getReadiness();

              return readiness?.kind === "ready"
                ? ({
                    kind: "ready" as const,
                    status: "credit_readiness_available" as const,
                  })
                : ({
                    kind: "blocked" as const,
                    status: "platform_credits_not_configured" as const,
                    message:
                      readiness?.message ??
                      "Platform credits are not configured for platform-paid generation.",
                  });
            })()
          : undefined;
      const providerExecutionPolicyDecision = evaluateProviderExecutionPolicy({
        billingMode: parsed.request.executionBillingMode ?? "byok",
        generationKind: parsed.request.generationKind,
        platformPaidReadiness,
        providerId: parsed.request.providerId,
      });

      if (
        providerExecutionPolicyDecision.status !== "provider_execution_allowed"
      ) {
        rejectProviderExecutionPolicyDecision(
          response,
          runtimeSummary,
          providerExecutionPolicyDecision,
        );
        return;
      }

      if (providerExecutionPolicyDecision.kind === "platform_paid_provider") {
        const failure = getGenerationFailureMapping(
          "platform_paid_provider_not_configured",
        );
        rejectGenerationJobWithVendorState(
          response,
          runtimeSummary,
          "platform_paid_provider_not_configured",
          failure.message,
          failure.httpStatus,
          false,
          ["openai"],
          {
            diagnosticCode: "platform_paid_provider_not_configured",
            failureCategory: "provider_policy",
          },
        );
        return;
      }

      const activeKey =
        await options.providerKeyRepository?.[
          "getActiveValidatedProviderKeyForWorkspaceProvider"
        ]?.(authenticatedRequester?.workspaceId ?? "", parsed.request.providerId);

      if (!isActiveValidatedProviderKeyForGeneration(activeKey)) {
        const failure = getGenerationFailureMapping("provider_key_not_configured");
        rejectGenerationJob(
          response,
          runtimeSummary,
          "provider_key_not_configured",
          failure.message,
          failure.httpStatus,
        );
        return;
      }

      if (routeExecutionMode === "adapter_mock_only") {
        if (
          mockExecutionAdapterSelection !== "mock_local" ||
          !options.generationMockExecutor
        ) {
          const failure = getGenerationFailureMapping("generation_execution_blocked");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_execution_blocked",
            failure.message,
            failure.httpStatus,
          );
          return;
        }

        await options.generationMockExecutor({
          providerId: parsed.request.providerId,
          requestId: parsed.request.requestId,
        });
        rejectGenerationJob(
          response,
          runtimeSummary,
          "generation_mock_execution_blocked",
          "Mock generation execution completed for backend plumbing only; real provider execution remains disabled.",
          503,
          ["openai"],
        );
        return;
      }

      if (
        routeExecutionMode === "openai_adapter_mock_only" ||
        routeExecutionMode === "openai_adapter_mock_storage_only"
      ) {
        if (
          options.generationOpenAiAdapterFetchMode !== "mock_only" ||
          !options.generationByokDecryptForMockExecutionEnabled ||
          !options.openAiAdapterMockFetch ||
          !options.providerKeyRepository ||
          !options.providerSecretVault ||
          options.providerSecretVault.getVaultReadiness().kind !== "vault_ready"
        ) {
          const failure = getGenerationFailureMapping("generation_execution_blocked");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_execution_blocked",
            failure.message,
            failure.httpStatus,
          );
          return;
        }

        if (
          routeExecutionMode === "openai_adapter_mock_storage_only" &&
          !options.generatedImageArtifactStorage
        ) {
          const failure = getGenerationFailureMapping("artifact_storage_unavailable");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "artifact_storage_unavailable",
            failure.message,
            failure.httpStatus,
            ["openai"],
          );
          return;
        }

        const adapter = createOpenAiImageGenerationAdapter({
          fetchImpl: options.openAiAdapterMockFetch,
          ...(routeExecutionMode === "openai_adapter_mock_storage_only"
            ? {
                generatedImageArtifactStorage:
                  options.generatedImageArtifactStorage,
              }
            : {}),
          ...(typeof options.openAiAdapterMaxImageBytes === "number"
            ? {
                maxImageBytes: options.openAiAdapterMaxImageBytes,
              }
            : {}),
          providerKeyRepository: options.providerKeyRepository,
          providerSecretVault: options.providerSecretVault,
        });
        let adapterResult: Awaited<
          ReturnType<
            NonNullable<
              BackendGenerationProviderAdapter["generateImageFromStoredProviderKey"]
            >
          >
        > | undefined;

        try {
          adapterResult = await adapter.generateImageFromStoredProviderKey?.({
            generationKind: "image",
            prompt: parsed.request.prompt,
            providerId: parsed.request.providerId,
            providerKeyId: activeKey.providerKeyId,
            requestId: parsed.request.requestId,
            workspaceId: authenticatedRequester?.workspaceId ?? "",
          });
        } catch {
          sendOpenAiRealLocalProviderUnexpectedError(response, runtimeSummary);
          return;
        }

        if (!adapterResult) {
          const failure = getGenerationFailureMapping("generation_execution_blocked");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_execution_blocked",
            failure.message,
            failure.httpStatus,
          );
          return;
        }

        if (routeExecutionMode === "openai_adapter_mock_storage_only") {
          sendOpenAiAdapterMockStorageResult(response, runtimeSummary, adapterResult);
          return;
        }

        rejectOpenAiAdapterMockResult(response, runtimeSummary, adapterResult);
        return;
      }

      if (routeExecutionMode === "real_provider_local_only") {
        if (!options.generationOpenAiImageRealLocalSmokeEnabled) {
          const failure = getGenerationFailureMapping("generation_execution_blocked");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_execution_blocked",
            failure.message,
            failure.httpStatus,
            [],
            {
              diagnosticCode: "real_provider_gate_missing",
              failureCategory: "runtime_gate",
            },
          );
          return;
        }

        if (
          !options.openAiRealProviderFetch ||
          !options.providerKeyRepository ||
          !options.providerSecretVault
        ) {
          const failure = getGenerationFailureMapping("generation_execution_blocked");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_execution_blocked",
            failure.message,
            failure.httpStatus,
            [],
            {
              diagnosticCode: "real_provider_gate_missing",
              failureCategory: "runtime_gate",
            },
          );
          return;
        }

        if (
          options.generationOpenAiImageModelConfig?.kind ===
          "openai_image_model_invalid"
        ) {
          const failure = getGenerationFailureMapping("generation_execution_blocked");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_execution_blocked",
            failure.message,
            failure.httpStatus,
            [],
            {
              diagnosticCode: "real_provider_gate_missing",
              failureCategory: "runtime_gate",
            },
          );
          return;
        }

        const vaultReadiness = (() => {
          try {
            return options.providerSecretVault?.getVaultReadiness();
          } catch {
            return undefined;
          }
        })();

        if (vaultReadiness?.kind !== "vault_ready") {
          const failure = getGenerationFailureMapping("vault_decrypt_failed");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "vault_decrypt_failed",
            failure.message,
            failure.httpStatus,
            [],
            {
              diagnosticCode: "vault_not_ready",
              failureCategory: "vault",
            },
          );
          return;
        }

        if (!options.generatedImageArtifactStorage) {
          const failure = getGenerationFailureMapping("artifact_storage_unavailable");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "artifact_storage_unavailable",
            failure.message,
            failure.httpStatus,
            ["openai"],
            {
              diagnosticCode: "real_provider_storage_not_ready",
              failureCategory: "artifact_storage",
            },
          );
          return;
        }

        const adapter = createOpenAiImageGenerationAdapter({
          fetchImpl: options.openAiRealProviderFetch,
          generatedImageArtifactStorage: options.generatedImageArtifactStorage,
          ...(typeof options.openAiAdapterMaxImageBytes === "number"
            ? {
                maxImageBytes: options.openAiAdapterMaxImageBytes,
              }
            : {}),
          providerKeyRepository: options.providerKeyRepository,
          providerSecretVault: options.providerSecretVault,
          ...(options.generationOpenAiImageModelConfig?.kind ===
          "openai_image_model_configured"
            ? {
                model: options.generationOpenAiImageModelConfig.model,
              }
            : {}),
          providerImageFetchImpl: options.openAiRealProviderFetch,
          requestShape: "minimal",
        });
        let adapterResult: Awaited<
          ReturnType<
            NonNullable<
              BackendGenerationProviderAdapter["generateImageFromStoredProviderKey"]
            >
          >
        > | undefined;

        try {
          adapterResult = await adapter.generateImageFromStoredProviderKey?.({
            generationKind: "image",
            prompt: parsed.request.prompt,
            providerId: parsed.request.providerId,
            providerKeyId: activeKey.providerKeyId,
            requestId: parsed.request.requestId,
            workspaceId: authenticatedRequester?.workspaceId ?? "",
          });
        } catch {
          sendOpenAiRealLocalProviderUnexpectedError(response, runtimeSummary);
          return;
        }

        if (!adapterResult) {
          const failure = getGenerationFailureMapping("generation_execution_blocked");
          rejectGenerationJob(
            response,
            runtimeSummary,
            "generation_execution_blocked",
            failure.message,
            failure.httpStatus,
          );
          return;
        }

        sendOpenAiRealLocalProviderResult(response, runtimeSummary, adapterResult);
        return;
      }

      const failure = getGenerationFailureMapping("generation_execution_blocked");
      rejectGenerationJob(
        response,
        runtimeSummary,
        "generation_execution_blocked",
        failure.message,
        failure.httpStatus,
      );
    },
  );

  return router;
};
