import { Router } from "express";
import type { Response } from "express";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import type { AsyncBackendRequesterContextResolver } from "../auth/requesterContextResolver";
import type { WorkspaceMembershipRepository } from "../auth/workspaceMembership";
import type {
  BackendGenerationCatalogResponse,
  BackendGenerationJobMutationResponse,
  BackendGenerationRuntimeStatusResponse,
} from "../contracts/generationRuntimeHttpTypes";
import type { ProviderSecretVault } from "../providers/providerSecretVault";
import type { BackendProviderKeyRepository } from "../repositories/repositoryContracts";
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
import { verifyGeneratedImageArtifactBytes } from "../generation/generatedImageArtifactVerification";
import { createOpenAiImageGenerationAdapter } from "../generation/openAiImageGenerationAdapter";
import {
  defaultGenerationRetryPolicy,
  defaultGenerationRoutingPreferences,
} from "../generation/generationProviderTypes";
import { chooseGenerationProvider } from "../generation/generationRouting";

export interface CreateGenerationRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  generationRuntimeConfig?: BackendGenerationRuntimeConfig;
  generationRuntimeReadiness?: BackendGenerationRuntimeCompositionReadiness;
  providerKeyRepository?: BackendProviderKeyRepository;
  providerSecretVault?: ProviderSecretVault;
  workspaceMembershipRepository?: WorkspaceMembershipRepository;
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

const sendMockLocalImageStorageResult = async (
  response: Response<BackendGenerationJobMutationResponse>,
  runtimeSummary: ReturnType<typeof createRuntimeSummary>,
  input: {
    artifactId: string;
    jobId: string;
    ownerId: string;
    storage?: GeneratedImageArtifactStorage;
    workspaceId: string;
  },
): Promise<void> => {
  if (!input.storage) {
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

  const stored = await input.storage.store({
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
    runtime: toRuntimeSnapshot(runtimeSummary, false),
    attemptedProviderIds: [mockLocalProviderId],
  });
};

export const createGenerationRouter = (
  options: CreateGenerationRouterOptions,
): Router => {
  const router = Router();

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

      const parsed = parseGenerationJobRequest(request.body);

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

      const generationRuntimeConfig = options.generationRuntimeConfig ?? {
        kind: "generation_runtime_config" as const,
        allowRealProviderCalls: false,
        providerAdapter: "not_configured" as const,
        runtimeEnabled: false,
      };

      if (routeExecutionMode === "mock_image_local_only") {
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

      if (routeExecutionMode === "mock_image_local_only") {
        await sendMockLocalImageStorageResult(response, runtimeSummary, {
          artifactId: `${parsed.request.requestId}_mock_image`,
          jobId: parsed.request.requestId,
          ownerId: authenticatedRequester?.userId ?? "",
          storage: options.generatedImageArtifactStorage,
          workspaceId: authenticatedRequester?.workspaceId ?? "",
        });
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
