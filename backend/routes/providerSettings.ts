import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type {
  BackendAuthenticatedRequesterContext,
  BackendRequesterContext,
} from "../auth/requesterContext";
import type { AsyncBackendRequesterContextResolver } from "../auth/requesterContextResolver";
import {
  createWorkspaceMembershipNotConfiguredRepository,
  decideWorkspaceMembershipAccess,
  type WorkspaceMembershipRepository,
} from "../auth/workspaceMembership";
import { decideRequesterContext } from "../auth/requesterContextDecision";
import { resolveSelectedRouteAccess } from "../auth/protectedRouteGuards";
import {
  decideProviderKeyAuthorization,
  type ProviderKeyAction,
} from "../authorization/providerKeyAuthorization";
import type {
  BackendProviderCatalogResponse,
  BackendProviderConnectionCreateRequest,
  BackendProviderConnectionMutationResponse,
  BackendProviderConnectionReplaceRequest,
  BackendProviderConnectionsResponse,
  BackendRedactedProviderConnectionSummary,
  BackendProviderRoutingPreferences,
  BackendProviderRoutingPolicyResponse,
  BackendProviderSettingsStatusResponse,
  BackendSupportedProviderId,
} from "../contracts/providerSettingsHttpTypes";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import { createNotConfiguredProviderSecretVault } from "../providers/notConfiguredProviderSecretVault";
import { getProviderCatalog } from "../providers/providerCatalog";
import type {
  ProviderSecretVault,
  ProviderSecretVaultOperationResult,
  ProviderSecretVaultSecretHandle,
} from "../providers/providerSecretVault";
import { createNotConfiguredProviderValidationAdapter } from "../providers/notConfiguredProviderValidationAdapter";
import {
  mapProviderValidationResultToStateInput as toProviderValidationStateInput,
  type ProviderValidationAdapter,
  type ProviderValidationResult,
  type ProviderValidationSafeDiagnostic,
} from "../providers/providerValidationAdapter";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyValidationStateResult,
  BackendProviderKeyStorageResult,
} from "../repositories/repositoryContracts";

export interface CreateProviderSettingsRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  workspaceMembershipRepository?: WorkspaceMembershipRepository;
  providerSecretVault?: ProviderSecretVault;
  providerKeyRepository?: BackendProviderKeyRepository;
  providerKeysRuntimeEnabled?: boolean;
  providerValidationAdapter?: ProviderValidationAdapter;
  providerValidationRuntimeEnabled?: boolean;
  routeAccessResolver?: AsyncBackendRequesterContextResolver;
}

type ProviderMutationBoundaryDecision =
  | {
      kind: "sign_in_required";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "mutation_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "provider_key_repository_unavailable"
        | "validation_unavailable"
        | "secure_provider_key_storage_not_enabled"
        | "workspace_permission_not_verified";
      message: string;
    }
  | {
      kind: "forbidden";
      status: "workspace_owner_or_admin_required";
      message: string;
    };

type ProviderMutationAuthContext = {
  requesterUserId: string;
  workspaceId: string;
};

type ProviderMutationResolvedRequester = {
  authContext: ProviderMutationAuthContext;
  requesterContext: BackendAuthenticatedRequesterContext & {
    workspaceId: string;
  };
};

type ProviderMutationLiveDependencies = {
  providerKeyRepository: BackendProviderKeyRepository;
  providerSecretVault: ProviderSecretVault;
};

type ProviderMutationExecutionResult =
  | {
      kind: "response";
      statusCode: number;
      body: BackendProviderConnectionMutationResponse;
    }
  | {
      kind: "boundary";
      decision: ProviderMutationBoundaryDecision;
    };

const defaultRoutingPreferences: BackendProviderRoutingPreferences = {
  mode: "auto",
  recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
  recommendedImagePriority: ["openai", "stability", "google", "replicate"],
  fallback: {
    enabled: false,
    orderedProviderIds: [],
    requiresExplicitOptIn: true,
  },
};

const buildConnectionSummaries = () =>
  getProviderCatalog().map((provider) => ({
    providerId: provider.id,
    status: "not_connected" as const,
    maskedKeySummary: "Secure provider key storage is not enabled yet.",
    lastValidationStatus: "not_enabled_yet" as const,
    verificationStatus: "not_enabled_yet" as const,
    needsReverification: false,
    canManage: false,
    unavailableReason: "secure_provider_key_storage_not_enabled" as const,
  }));

const mergeRedactedConnectionSummaries = (
  redactedSummaries: BackendRedactedProviderConnectionSummary[],
): BackendRedactedProviderConnectionSummary[] => {
  const redactedByProviderId = new Map(
    redactedSummaries
      .filter((summary) => isSupportedProviderId(summary.providerId))
      .map((summary) => [summary.providerId, summary]),
  );

  return buildConnectionSummaries().map(
    (summary) => redactedByProviderId.get(summary.providerId) ?? summary,
  );
};

const hasActiveRedactedConnectionSummary = (
  summary: BackendRedactedProviderConnectionSummary,
): boolean =>
  summary.canManage === true &&
  Boolean(summary.maskedFingerprint || summary.keyFingerprintSuffix);

const buildProviderSettingsStatusMessage = (
  connections: BackendRedactedProviderConnectionSummary[],
): string =>
  connections.some(hasActiveRedactedConnectionSummary)
    ? "Provider settings are available with redacted backend-stored key summaries. Provider validation remains backend-gated and routing execution is not enabled yet."
    : "Provider settings foundation is available, but secure API key connection, real validation, and routing execution are not enabled yet.";

const buildProviderSettingsConnectionsMessage = (
  connections: BackendRedactedProviderConnectionSummary[],
): string =>
  connections.some(hasActiveRedactedConnectionSummary)
    ? "Connection summaries include active backend-stored key metadata only; key material is never returned to the browser."
    : "Connection summaries are metadata-only until secure backend provider key storage and verification are implemented.";

const respondMutationBoundaryDecision = (
  response: Response<BackendProviderConnectionMutationResponse>,
  decision: ProviderMutationBoundaryDecision,
): void => {
  if (decision.kind === "sign_in_required") {
    response.status(401).json({
      kind: "provider_settings_sign_in_required",
      status: "unauthenticated",
      reason: decision.reason,
      message: decision.message,
    });
    return;
  }

  if (decision.kind === "forbidden") {
    response.status(403).json({
      kind: "provider_settings_forbidden",
      status: decision.status,
      message: decision.message,
    });
    return;
  }

  response.status(503).json({
    kind: "provider_settings_mutation_unavailable",
    status: decision.status,
    message: decision.message,
  });
};

const respondMutationExecutionResult = (
  response: Response<BackendProviderConnectionMutationResponse>,
  result: ProviderMutationExecutionResult,
): void => {
  if (result.kind === "boundary") {
    respondMutationBoundaryDecision(response, result.decision);
    return;
  }

  response.status(result.statusCode).json(result.body);
};

const supportedProviderIds = new Set<BackendSupportedProviderId>(
  getProviderCatalog().map((provider) => provider.id),
);

const isSupportedProviderId = (
  providerId: string,
): providerId is BackendSupportedProviderId =>
  supportedProviderIds.has(providerId as BackendSupportedProviderId);

const getProviderIdFromRouteParam = (
  providerId: unknown,
): BackendSupportedProviderId | undefined =>
  typeof providerId === "string" && isSupportedProviderId(providerId)
    ? providerId
    : undefined;

const normalizeApiKeyFromBody = (
  body: unknown,
): string | undefined => {
  const apiKey =
    body && typeof body === "object" && "apiKey" in body
      ? (body as BackendProviderConnectionCreateRequest | BackendProviderConnectionReplaceRequest).apiKey
      : undefined;

  if (typeof apiKey !== "string") {
    return undefined;
  }

  const trimmed = apiKey.trim();

  if (trimmed.length === 0 || trimmed.length > 4096) {
    return undefined;
  }

  return trimmed;
};

const storageHandleToRepositoryInput = (
  secretHandle: ProviderSecretVaultSecretHandle,
):
  | { encryptedSecret: { encryptedPayload: string; keyVersion: string; algorithm: string } }
  | { secretRef: string } => {
  if (secretHandle.kind === "encrypted_secret") {
    return {
      encryptedSecret: {
        algorithm: secretHandle.algorithm,
        encryptedPayload: secretHandle.encryptedPayload,
        keyVersion: secretHandle.keyVersion,
      },
    };
  }

  return {
    secretRef: secretHandle.secretRef,
  };
};

const getVaultUnavailableDecision = (): ProviderMutationBoundaryDecision => ({
  kind: "mutation_unavailable",
  status: "secure_provider_key_storage_not_enabled",
  message: "Secure provider key storage is not enabled yet.",
});

const getRepositoryUnavailableDecision = (): ProviderMutationBoundaryDecision => ({
  kind: "mutation_unavailable",
  status: "provider_key_repository_unavailable",
  message:
    "Provider key repository storage is not configured on this backend yet.",
});

const getLiveDependencies = (
  providerKeysRuntimeEnabled: boolean,
  providerKeyRepository: BackendProviderKeyRepository | undefined,
  providerSecretVault: ProviderSecretVault,
): ProviderMutationExecutionResult | ProviderMutationLiveDependencies => {
  if (!providerKeysRuntimeEnabled) {
    return {
      kind: "boundary",
      decision: getVaultUnavailableDecision(),
    };
  }

  if (!providerKeyRepository) {
    return {
      kind: "boundary",
      decision: getRepositoryUnavailableDecision(),
    };
  }

  const vaultReadiness = providerSecretVault.getVaultReadiness();

  if (vaultReadiness.kind !== "vault_ready") {
    return {
      kind: "boundary",
      decision: {
        kind: "mutation_unavailable",
        status: "secure_provider_key_storage_not_enabled",
        message: vaultReadiness.message,
      },
    };
  }

  return {
    providerKeyRepository,
    providerSecretVault,
  };
};

const getActiveProviderKeyRecord = async (
  providerKeyRepository: BackendProviderKeyRepository,
  workspaceId: string,
  providerId: BackendSupportedProviderId,
): Promise<BackendProviderKeyRecord | undefined> => {
  const records = await providerKeyRepository.listForWorkspace(workspaceId);

  return records.find(
    (record) =>
      record.status === "active" &&
      record.deletedAt === undefined &&
      record.providerName === providerId,
  );
};

const mapStorageResultToMutationResponse = (
  result: BackendProviderKeyStorageResult,
): ProviderMutationExecutionResult => {
  if (result.kind === "stored") {
    return {
      kind: "response",
      statusCode: 201,
      body: {
        kind: "provider_settings_connection_stored",
        status: "stored",
        message: "Provider key was stored server-side.",
        connection: result.connection,
      },
    };
  }

  if (result.kind === "replaced") {
    return {
      kind: "response",
      statusCode: 200,
      body: {
        kind: "provider_settings_connection_replaced",
        status: "replaced",
        message: "Provider key was replaced server-side.",
        connection: result.connection,
      },
    };
  }

  if (result.kind === "revoked") {
    return {
      kind: "response",
      statusCode: 200,
      body: {
        kind: "provider_settings_connection_revoked",
        status: "revoked",
        message: "Provider key was revoked server-side.",
        connection: result.connection,
      },
    };
  }

  if (result.kind === "conflict") {
    return {
      kind: "response",
      statusCode: 409,
      body: {
        kind: "provider_settings_mutation_conflict",
        status: "conflict",
        message: result.message,
      },
    };
  }

  if (result.kind === "invalid_provider") {
    return {
      kind: "response",
      statusCode: 400,
      body: {
        kind: "provider_settings_invalid_provider",
        status: "invalid_provider",
        message: result.message,
      },
    };
  }

  if (result.kind === "unauthorized") {
    return {
      kind: "boundary",
      decision:
        result.code === "workspace_owner_or_admin_required"
          ? {
              kind: "forbidden",
              status: "workspace_owner_or_admin_required",
              message: result.message,
            }
          : {
              kind: "mutation_unavailable",
              status: "workspace_permission_not_verified",
              message: result.message,
            },
    };
  }

  return {
    kind: "boundary",
    decision:
      result.kind === "unavailable" && result.code === "repository_unavailable"
        ? getRepositoryUnavailableDecision()
        : {
            kind: "mutation_unavailable",
            status: "secure_provider_key_storage_not_enabled",
            message: result.message,
          },
  };
};

const mapVaultResultToUnavailableResponse = (
  result: ProviderSecretVaultOperationResult,
): ProviderMutationExecutionResult => {
  if (result.kind === "vault_invalid_provider") {
    return {
      kind: "response",
      statusCode: 400,
      body: {
        kind: "provider_settings_invalid_provider",
        status: "invalid_provider",
        message: result.message,
      },
    };
  }

  return {
    kind: "boundary",
    decision: {
      kind: "mutation_unavailable",
      status: "secure_provider_key_storage_not_enabled",
      message:
        result.kind === "vault_operation_unavailable"
          ? result.message
          : "Secure provider key storage is not available.",
    },
  };
};

const getInvalidRequestResponse = (
  message: string,
): ProviderMutationExecutionResult => ({
  kind: "response",
  statusCode: 400,
  body: {
    kind: "provider_settings_invalid_request",
    status: "invalid_request",
    message,
  },
});

const createProviderKey = async (
  request: Request,
  authContext: ProviderMutationAuthContext,
  dependencies: ProviderMutationLiveDependencies,
): Promise<ProviderMutationExecutionResult> => {
  const providerId =
    request.body &&
    typeof request.body === "object" &&
    "providerId" in request.body &&
    typeof request.body.providerId === "string" &&
    isSupportedProviderId(request.body.providerId)
      ? request.body.providerId
      : undefined;

  if (!providerId) {
    return {
      kind: "response",
      statusCode: 400,
      body: {
        kind: "provider_settings_invalid_provider",
        status: "invalid_provider",
        message: "Unsupported provider.",
      },
    };
  }

  const plaintextKey = normalizeApiKeyFromBody(request.body);

  if (!plaintextKey) {
    return getInvalidRequestResponse("A provider API key is required.");
  }

  const vaultResult = await dependencies.providerSecretVault.storeProviderKey({
    plaintextKey,
    providerId,
    requesterUserId: authContext.requesterUserId,
    workspaceId: authContext.workspaceId,
  });

  if (vaultResult.kind !== "vault_provider_key_stored") {
    return mapVaultResultToUnavailableResponse(vaultResult);
  }

  return mapStorageResultToMutationResponse(
    await dependencies.providerKeyRepository.createProviderKey({
      createdByUserId: authContext.requesterUserId,
      ...storageHandleToRepositoryInput(vaultResult.secretHandle),
      keyFingerprintSuffix: vaultResult.keyFingerprintSuffix,
      maskedFingerprint: vaultResult.maskedFingerprint,
      ownerId: authContext.requesterUserId,
      providerId,
      workspaceId: authContext.workspaceId,
    }),
  );
};

const replaceProviderKey = async (
  request: Request,
  authContext: ProviderMutationAuthContext,
  dependencies: ProviderMutationLiveDependencies,
): Promise<ProviderMutationExecutionResult> => {
  const providerId = getProviderIdFromRouteParam(request.params.providerId);

  if (!providerId) {
    return {
      kind: "response",
      statusCode: 400,
      body: {
        kind: "provider_settings_invalid_provider",
        status: "invalid_provider",
        message: "Unsupported provider.",
      },
    };
  }

  const replacementPlaintextKey = normalizeApiKeyFromBody(request.body);

  if (!replacementPlaintextKey) {
    return getInvalidRequestResponse("A replacement provider API key is required.");
  }

  const activeRecord = await getActiveProviderKeyRecord(
    dependencies.providerKeyRepository,
    authContext.workspaceId,
    providerId,
  );

  if (!activeRecord) {
    return {
      kind: "response",
      statusCode: 404,
      body: {
        kind: "provider_settings_connection_not_found",
        status: "not_found",
        message: "Active provider key was not found for this workspace/provider.",
      },
    };
  }

  const vaultResult = await dependencies.providerSecretVault.rotateProviderKey({
    providerId,
    providerKeyId: activeRecord.providerKeyId,
    replacementPlaintextKey,
    requesterUserId: authContext.requesterUserId,
    workspaceId: authContext.workspaceId,
  });

  if (vaultResult.kind !== "vault_provider_key_rotated") {
    return mapVaultResultToUnavailableResponse(vaultResult);
  }

  return mapStorageResultToMutationResponse(
    await dependencies.providerKeyRepository.replaceProviderKey({
      providerId,
      providerKeyId: activeRecord.providerKeyId,
      requesterUserId: authContext.requesterUserId,
      ...storageHandleToRepositoryInput(vaultResult.secretHandle),
      keyFingerprintSuffix: vaultResult.keyFingerprintSuffix,
      maskedFingerprint: vaultResult.maskedFingerprint,
      workspaceId: authContext.workspaceId,
    }),
  );
};

const revokeProviderKey = async (
  request: Request,
  authContext: ProviderMutationAuthContext,
  dependencies: ProviderMutationLiveDependencies,
): Promise<ProviderMutationExecutionResult> => {
  const providerId = getProviderIdFromRouteParam(request.params.providerId);

  if (!providerId) {
    return {
      kind: "response",
      statusCode: 400,
      body: {
        kind: "provider_settings_invalid_provider",
        status: "invalid_provider",
        message: "Unsupported provider.",
      },
    };
  }

  const activeRecord = await getActiveProviderKeyRecord(
    dependencies.providerKeyRepository,
    authContext.workspaceId,
    providerId,
  );

  if (!activeRecord) {
    return {
      kind: "response",
      statusCode: 404,
      body: {
        kind: "provider_settings_connection_not_found",
        status: "not_found",
        message: "Active provider key was not found for this workspace/provider.",
      },
    };
  }

  const vaultResult = await dependencies.providerSecretVault.revokeProviderKey({
    providerKeyId: activeRecord.providerKeyId,
    requesterUserId: authContext.requesterUserId,
    workspaceId: authContext.workspaceId,
  });

  if (vaultResult.kind !== "vault_provider_key_revoked") {
    return mapVaultResultToUnavailableResponse(vaultResult);
  }

  return mapStorageResultToMutationResponse(
    await dependencies.providerKeyRepository.revokeProviderKey({
      providerKeyId: activeRecord.providerKeyId,
      requesterUserId: authContext.requesterUserId,
      workspaceId: authContext.workspaceId,
    }),
  );
};

const getValidationUnavailableResponse = (
  message = "Provider validation is not enabled yet.",
  diagnostic: ProviderValidationSafeDiagnostic = {
    diagnosticCode: "validation_adapter_not_ready",
    failureCategory: "runtime_gate",
  },
): ProviderMutationExecutionResult => ({
  kind: "response",
  statusCode: 503,
  body: {
    kind: "provider_settings_connection_validation_result",
    status: "validation_unavailable",
    ...diagnostic,
    message,
  },
});

const getValidationDiagnostic = (
  result: ProviderValidationResult,
): ProviderValidationSafeDiagnostic | undefined =>
  result.kind !== "validated" &&
  result.diagnosticCode &&
  result.failureCategory
    ? {
        diagnosticCode: result.diagnosticCode,
        failureCategory: result.failureCategory,
      }
    : undefined;

const mapValidationStateResultToResponse = (
  validationResult: ProviderValidationResult,
  stateResult: BackendProviderKeyValidationStateResult,
): ProviderMutationExecutionResult => {
  if (stateResult.kind === "validation_state_unavailable") {
    return {
      kind: "boundary",
      decision:
        stateResult.code === "repository_unavailable"
          ? getRepositoryUnavailableDecision()
          : getVaultUnavailableDecision(),
    };
  }

  if (stateResult.kind === "validation_state_not_found") {
    return {
      kind: "response",
      statusCode: 404,
      body: {
        kind: "provider_settings_connection_not_found",
        status: "not_found",
        message: stateResult.message,
      },
    };
  }

  return {
    kind: "response",
    statusCode: 200,
    body: {
      kind: "provider_settings_connection_validation_result",
      status:
        validationResult.kind === "validated"
          ? "validated"
          : validationResult.kind === "validation_failed"
            ? "validation_failed"
            : "validation_unavailable",
      ...getValidationDiagnostic(validationResult),
      message: validationResult.message,
      connection: stateResult.connection,
    },
  };
};

const mapValidationResultToResponse = (
  result: ProviderValidationResult,
): ProviderMutationExecutionResult => {
  if (result.kind === "invalid_provider") {
    return {
      kind: "response",
      statusCode: 400,
      body: {
        kind: "provider_settings_invalid_provider",
        status: "invalid_provider",
        ...getValidationDiagnostic(result),
        message: result.message,
      },
    };
  }

  if (result.kind === "key_not_found") {
    return {
      kind: "response",
      statusCode: 404,
      body: {
        kind: "provider_settings_connection_not_found",
        status: "not_found",
        ...getValidationDiagnostic(result),
        message: result.message,
      },
    };
  }

  if (result.kind === "vault_decrypt_failed") {
    return {
      kind: "response",
      statusCode: 503,
      body: {
        kind: "provider_settings_connection_validation_result",
        status: "vault_decrypt_failed",
        ...getValidationDiagnostic(result),
        message: result.message,
      },
    };
  }

  if (result.kind === "timeout") {
    return {
      kind: "response",
      statusCode: 504,
      body: {
        kind: "provider_settings_connection_validation_result",
        status: "timeout",
        ...getValidationDiagnostic(result),
        message: result.message,
      },
    };
  }

  if (result.kind === "rate_limited") {
    return {
      kind: "response",
      statusCode: 429,
      body: {
        kind: "provider_settings_connection_validation_result",
        status: "rate_limited",
        ...getValidationDiagnostic(result),
        message: result.message,
      },
    };
  }

  if (result.kind === "provider_unavailable") {
    return {
      kind: "response",
      statusCode: 503,
      body: {
        kind: "provider_settings_connection_validation_result",
        status: "provider_unavailable",
        ...getValidationDiagnostic(result),
        message: result.message,
      },
    };
  }

  return getValidationUnavailableResponse(
    result.message,
    getValidationDiagnostic(result),
  );
};

const validateProviderConnection = async (
  request: Request,
  authContext: ProviderMutationAuthContext,
  dependencies: ProviderMutationLiveDependencies,
  options: {
    providerValidationAdapter: ProviderValidationAdapter;
    providerValidationRuntimeEnabled: boolean;
  },
): Promise<ProviderMutationExecutionResult> => {
  if (!options.providerValidationRuntimeEnabled) {
    return getValidationUnavailableResponse();
  }

  const providerId = getProviderIdFromRouteParam(request.params.providerId);

  if (!providerId) {
    return {
      kind: "response",
      statusCode: 400,
      body: {
        kind: "provider_settings_invalid_provider",
        status: "invalid_provider",
        message: "Unsupported provider.",
      },
    };
  }

  const validationReadiness = options.providerValidationAdapter.getReadiness();

  if (validationReadiness.kind !== "validation_ready") {
    return getValidationUnavailableResponse(validationReadiness.message, {
      diagnosticCode: "validation_adapter_not_ready",
      failureCategory: "runtime_gate",
    });
  }

  if (!dependencies.providerKeyRepository.updateProviderKeyValidationState) {
    return {
      kind: "boundary",
      decision: getRepositoryUnavailableDecision(),
    };
  }

  const activeRecord = await getActiveProviderKeyRecord(
    dependencies.providerKeyRepository,
    authContext.workspaceId,
    providerId,
  );

  if (!activeRecord) {
    return {
      kind: "response",
      statusCode: 404,
      body: {
        kind: "provider_settings_connection_not_found",
        status: "not_found",
        diagnosticCode: "validation_key_not_found",
        failureCategory: "stored_key",
        message: "Active provider key was not found for this workspace/provider.",
      },
    };
  }

  const validateStoredKey =
    options.providerValidationAdapter.validateStoredProviderKey.bind(
      options.providerValidationAdapter,
    );
  const validationResult = await validateStoredKey({
    providerId,
    providerKeyId: activeRecord.providerKeyId,
    requesterUserId: authContext.requesterUserId,
    workspaceId: authContext.workspaceId,
  });

  if (
    validationResult.kind !== "validated" &&
    validationResult.kind !== "validation_failed"
  ) {
    return mapValidationResultToResponse(validationResult);
  }

  return mapValidationStateResultToResponse(
    validationResult,
    await dependencies.providerKeyRepository.updateProviderKeyValidationState(
      toProviderValidationStateInput(validationResult, {
        providerKeyId: activeRecord.providerKeyId,
        requesterUserId: authContext.requesterUserId,
        workspaceId: authContext.workspaceId,
      }),
    ),
  );
};

const mapSelectedRouteDeniedDecisionToMutationBoundary = (
  accessDecision: Awaited<ReturnType<typeof resolveSelectedRouteAccess>>,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): ProviderMutationBoundaryDecision => {
  if (accessDecision.kind === "allowed") {
    return {
      kind: "mutation_unavailable",
      status: "workspace_permission_not_verified",
      message:
        "Workspace permission verification is not configured yet, so provider key management remains unavailable in this phase.",
    };
  }

  if (accessDecision.code === "auth_required") {
    return {
      kind: "sign_in_required",
      reason: "invalid_credentials",
      message: "Sign in is required before provider settings can be managed.",
    };
  }

  if (
    accessDecision.code === "auth_not_configured" ||
    runtimeConfig.kind === "auth_provider_not_configured"
  ) {
    return {
      kind: "mutation_unavailable",
      status: "auth_not_configured",
      message: "Authentication is not configured on this backend yet.",
    };
  }

  if (accessDecision.code === "auth_unavailable") {
    return {
      kind: "mutation_unavailable",
      status: "auth_provider_unavailable",
      message:
        "Authentication is configured but not available for provider key management yet.",
    };
  }

  return {
    kind: "mutation_unavailable",
    status: "workspace_permission_not_verified",
    message:
      accessDecision.code === "workspace_runtime_not_configured"
        ? accessDecision.message
        : "Workspace permission verification is not configured yet, so provider key management remains unavailable in this phase.",
  };
};

const getRequesterUserIdForMutation = (
  requesterContext: BackendAuthenticatedRequesterContext,
): string => requesterContext.appUserId ?? requesterContext.userId;

const getResolvedRequesterFromContext = (
  requesterContext: BackendRequesterContext,
): ProviderMutationResolvedRequester | ProviderMutationBoundaryDecision => {
  const requesterDecision = decideRequesterContext(requesterContext);

  if (requesterDecision.kind !== "verified_authenticated") {
    return requesterDecision.kind === "auth_not_configured"
      ? {
          kind: "mutation_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        }
      : {
          kind: "sign_in_required",
          reason:
            requesterDecision.kind === "invalid_credentials"
              ? "invalid_credentials"
              : "missing_credentials",
          message: "Sign in is required before provider settings can be managed.",
        };
  }

  if (requesterContext.kind !== "authenticated" || !requesterContext.workspaceId) {
    return {
      kind: "mutation_unavailable",
      status: "workspace_permission_not_verified",
      message:
        "Workspace permission verification is not configured yet, so provider key management remains unavailable in this phase.",
    };
  }

  return {
    authContext: {
      requesterUserId: getRequesterUserIdForMutation(requesterContext),
      workspaceId: requesterContext.workspaceId,
    },
    requesterContext: {
      ...requesterContext,
      workspaceId: requesterContext.workspaceId,
    },
  };
};

const resolveProviderMutationRequester = async (
  request: Request,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  routeAccessResolver?: AsyncBackendRequesterContextResolver,
): Promise<ProviderMutationResolvedRequester | ProviderMutationBoundaryDecision> => {
  if (routeAccessResolver) {
    const accessDecision = await resolveSelectedRouteAccess({
      headers: request.headers,
      runtimeConfig,
      requesterResolver: routeAccessResolver,
    });

    if (accessDecision.kind === "denied") {
      return mapSelectedRouteDeniedDecisionToMutationBoundary(
        accessDecision,
        runtimeConfig,
      );
    }

    return {
      authContext: {
        requesterUserId: accessDecision.requester.appUserId,
        workspaceId: accessDecision.requester.workspaceId,
      },
      requesterContext: accessDecision.requester,
    };
  }

  return getResolvedRequesterFromContext(getRequesterContextFromRequest(request));
};

const authorizeMutationForWorkspace = async (
  requesterContext: BackendAuthenticatedRequesterContext & {
    workspaceId: string;
  },
  action: ProviderKeyAction,
  workspaceMembershipRepository: WorkspaceMembershipRepository,
): Promise<ProviderMutationBoundaryDecision | undefined> => {
  const membershipAccess = decideWorkspaceMembershipAccess(
    await workspaceMembershipRepository.getMembership({
      userId: getRequesterUserIdForMutation(requesterContext),
      workspaceId: requesterContext.workspaceId,
    }),
  );

  if (membershipAccess.kind === "denied") {
    return {
      kind: "mutation_unavailable",
      status: "workspace_permission_not_verified",
      message:
        membershipAccess.reason === "membership_not_configured"
          ? "Workspace permission verification is not configured yet, so provider key management remains unavailable in this phase."
          : "Workspace membership could not be verified for provider key management in this phase.",
    };
  }

  const roleDecision = decideProviderKeyAuthorization({
    action,
    requesterContext,
    actorRole: membershipAccess.role,
  });

  if (roleDecision.kind === "allowed") {
    return undefined;
  }

  if (
    roleDecision.reason === "workspace_member_forbidden" ||
    roleDecision.reason === "workspace_viewer_forbidden"
  ) {
    return {
      kind: "forbidden",
      status: "workspace_owner_or_admin_required",
      message:
        "Workspace owner or workspace admin permission is required before provider keys can be managed.",
    };
  }

  return {
    kind: "mutation_unavailable",
    status: "workspace_permission_not_verified",
    message:
      "Workspace permission verification is not configured yet, so provider key management remains unavailable in this phase.",
  };
};

const getRedactedConnectionSummariesForRequester = async (
  resolvedRequester: ProviderMutationResolvedRequester,
  options: {
    providerKeyRepository?: BackendProviderKeyRepository;
    providerKeysRuntimeEnabled: boolean;
    providerSecretVault: ProviderSecretVault;
    workspaceMembershipRepository: WorkspaceMembershipRepository;
  },
): Promise<BackendRedactedProviderConnectionSummary[]> => {
  const workspaceBoundary = await authorizeMutationForWorkspace(
    resolvedRequester.requesterContext,
    "view_masked_key_fingerprint",
    options.workspaceMembershipRepository,
  );

  if (workspaceBoundary) {
    return buildConnectionSummaries();
  }

  if (
    !options.providerKeysRuntimeEnabled ||
    !options.providerKeyRepository?.listRedactedConnectionSummariesForWorkspace ||
    options.providerSecretVault.getVaultReadiness().kind !== "vault_ready"
  ) {
    return buildConnectionSummaries();
  }

  const activeSummaries =
    await options.providerKeyRepository.listRedactedConnectionSummariesForWorkspace(
      resolvedRequester.authContext.workspaceId,
    );

  return mergeRedactedConnectionSummaries(activeSummaries);
};

const createMutationHandler = (
  action: ProviderKeyAction,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  workspaceMembershipRepository: WorkspaceMembershipRepository,
  providerSecretVault: ProviderSecretVault,
  options: {
    executeLiveMutation?: (
      request: Request,
      authContext: ProviderMutationAuthContext,
      dependencies: ProviderMutationLiveDependencies,
    ) => Promise<ProviderMutationExecutionResult>;
    providerKeyRepository?: BackendProviderKeyRepository;
    providerKeysRuntimeEnabled: boolean;
    routeAccessResolver?: AsyncBackendRequesterContextResolver;
  },
) => {
  return (
    request: Request,
    response: Response<BackendProviderConnectionMutationResponse>,
    next: NextFunction,
  ): void => {
    void (async () => {
      const resolvedRequester = await resolveProviderMutationRequester(
        request,
        runtimeConfig,
        options.routeAccessResolver,
      );

      if ("kind" in resolvedRequester) {
        respondMutationBoundaryDecision(response, resolvedRequester);
        return;
      }

      const workspaceBoundary = await authorizeMutationForWorkspace(
        resolvedRequester.requesterContext,
        action,
        workspaceMembershipRepository,
      );

      if (workspaceBoundary) {
        respondMutationBoundaryDecision(response, workspaceBoundary);
        return;
      }

      if (!options.executeLiveMutation) {
        const vaultReadiness = providerSecretVault.getVaultReadiness();

        respondMutationBoundaryDecision(response, {
          kind: "mutation_unavailable",
          status: "secure_provider_key_storage_not_enabled",
          message:
            vaultReadiness.kind === "vault_unavailable"
              ? vaultReadiness.message
              : "Secure provider key storage is not enabled yet.",
        });
        return;
      }

      const liveDependencies = getLiveDependencies(
        options.providerKeysRuntimeEnabled,
        options.providerKeyRepository,
        providerSecretVault,
      );

      if ("kind" in liveDependencies) {
        respondMutationExecutionResult(response, liveDependencies);
        return;
      }

      respondMutationExecutionResult(
        response,
        await options.executeLiveMutation(
          request,
          resolvedRequester.authContext,
          liveDependencies,
        ),
      );
    })().catch(next);
  };
};

export const createProviderSettingsRouter = (
  options: CreateProviderSettingsRouterOptions,
): Router => {
  const router = Router();
  const workspaceMembershipRepository =
    options.workspaceMembershipRepository ??
    createWorkspaceMembershipNotConfiguredRepository();
  const providerSecretVault =
    options.providerSecretVault ?? createNotConfiguredProviderSecretVault();
  const providerKeysRuntimeEnabled = options.providerKeysRuntimeEnabled === true;
  const providerValidationAdapter =
    options.providerValidationAdapter ??
    createNotConfiguredProviderValidationAdapter();
  const providerValidationRuntimeEnabled =
    options.providerValidationRuntimeEnabled === true;

  router.get(
    "/provider-settings/catalog",
    (_request, response: Response<BackendProviderCatalogResponse>) => {
      response.status(200).json({
        kind: "provider_catalog",
        message:
          "Supported BYOK providers are listed for future routing and capability planning. Provider balances remain separate from Free AI Mixer platform credits.",
        providers: getProviderCatalog(),
      });
    },
  );

  router.get(
    "/provider-settings/status",
    (request, response: Response<BackendProviderSettingsStatusResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind === "allowed") {
          const resolvedRequester: ProviderMutationResolvedRequester = {
            authContext: {
              requesterUserId: accessDecision.requester.appUserId,
              workspaceId: accessDecision.requester.workspaceId,
            },
            requesterContext: accessDecision.requester,
          };
          const connections = await getRedactedConnectionSummariesForRequester(
            resolvedRequester,
            {
              providerKeyRepository: options.providerKeyRepository,
              providerKeysRuntimeEnabled,
              providerSecretVault,
              workspaceMembershipRepository,
            },
          );

          response.status(200).json({
            kind: "provider_settings_status",
            status: "authenticated",
            message: buildProviderSettingsStatusMessage(connections),
            activeWorkspaceId: accessDecision.requester.workspaceId,
            routingPreferences: defaultRoutingPreferences,
            connections,
          });
          return;
        }

        if (accessDecision.code === "workspace_required") {
          response.status(403).json({
            kind: "provider_settings_access_required",
            status: "workspace_required",
            message: accessDecision.message,
          });
          return;
        }

        if (accessDecision.code === "auth_required") {
          response.status(401).json({
            kind: "provider_settings_sign_in_required",
            status: "unauthenticated",
            reason: "invalid_credentials",
            message: "Sign in is required before provider settings can be managed.",
          });
          return;
        }

        response.status(503).json({
          kind: "provider_settings_unavailable",
          status:
            accessDecision.code === "workspace_runtime_not_configured"
              ? "workspace_runtime_not_configured"
              : options.runtimeConfig.kind === "auth_provider_not_configured"
                ? "auth_not_configured"
                : "auth_provider_unavailable",
          message:
            accessDecision.code === "workspace_runtime_not_configured"
              ? accessDecision.message
              : options.runtimeConfig.kind === "auth_provider_not_configured"
                ? "Authentication is not configured on this backend yet."
                : "Authentication is configured but not available for this protected route yet.",
        });
      })().catch(next);
    },
  );

  router.get(
    "/provider-settings/connections",
    (request, response: Response<BackendProviderConnectionsResponse>, next) => {
      void (async () => {
        const resolvedRequester = await resolveProviderMutationRequester(
          request,
          options.runtimeConfig,
          options.routeAccessResolver,
        );

        if (!("kind" in resolvedRequester)) {
          const connections = await getRedactedConnectionSummariesForRequester(
            resolvedRequester,
            {
              providerKeyRepository: options.providerKeyRepository,
              providerKeysRuntimeEnabled,
              providerSecretVault,
              workspaceMembershipRepository,
            },
          );

          response.status(200).json({
            kind: "provider_settings_connections",
            message: buildProviderSettingsConnectionsMessage(connections),
            connections,
          });
          return;
        }

        response.status(200).json({
          kind: "provider_settings_connections",
          message:
            "Connection summaries remain read-only and not_connected until verified auth and secure provider key storage are implemented.",
          connections: buildConnectionSummaries(),
        });
      })().catch(next);
    },
  );

  router.get(
    "/provider-settings/routing-policy",
    (_request, response: Response<BackendProviderRoutingPolicyResponse>) => {
      response.status(200).json({
        kind: "provider_settings_routing_policy",
        message:
          "Routing policy remains metadata-only in this phase. Auto, manual, and priority routing stay single-provider-per-attempt, and fallback remains explicit opt-in only.",
        routingPreferences: defaultRoutingPreferences,
      });
    },
  );

  router.post(
    "/provider-settings/connections",
    createMutationHandler(
      "add_provider_key",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
      {
        executeLiveMutation: createProviderKey,
        providerKeyRepository: options.providerKeyRepository,
        providerKeysRuntimeEnabled,
        routeAccessResolver: options.routeAccessResolver,
      },
    ),
  );

  router.delete(
    "/provider-settings/connections/:providerId",
    createMutationHandler(
      "remove_provider_key",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
      {
        executeLiveMutation: revokeProviderKey,
        providerKeyRepository: options.providerKeyRepository,
        providerKeysRuntimeEnabled,
        routeAccessResolver: options.routeAccessResolver,
      },
    ),
  );

  router.put(
    "/provider-settings/connections/:providerId",
    createMutationHandler(
      "replace_provider_key",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
      {
        executeLiveMutation: replaceProviderKey,
        providerKeyRepository: options.providerKeyRepository,
        providerKeysRuntimeEnabled,
        routeAccessResolver: options.routeAccessResolver,
      },
    ),
  );

  router.post(
    "/provider-settings/connections/:providerId/test",
    createMutationHandler(
      "test_provider_connection",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
      {
        executeLiveMutation: (request, authContext, dependencies) =>
          validateProviderConnection(request, authContext, dependencies, {
            providerValidationAdapter,
            providerValidationRuntimeEnabled,
          }),
        providerKeyRepository: options.providerKeyRepository,
        providerKeysRuntimeEnabled,
        routeAccessResolver: options.routeAccessResolver,
      },
    ),
  );

  router.put(
    "/provider-settings/routing-policy",
    createMutationHandler(
      "update_provider_routing_policy",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
      {
        providerKeyRepository: options.providerKeyRepository,
        providerKeysRuntimeEnabled,
        routeAccessResolver: options.routeAccessResolver,
      },
    ),
  );

  return router;
};
