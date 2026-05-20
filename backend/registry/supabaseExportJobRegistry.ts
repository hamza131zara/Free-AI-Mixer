import type {
  BackendArtifactMetadata,
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
  BackendExportJobOwnerScope,
} from "../contracts/exportHttpTypes";
import type {
  BackendExportJobClaimResult,
  BackendExportJobCreateIfAbsentResult,
  BackendExportJobMarkSuccessResult,
  BackendExportJobTransitionResult,
} from "../repositories/repositoryContracts";
import type {
  CreateExportJobInput,
  ExportJobClaimOptions,
  ExportJobRegistry,
  ExportJobTransitionOptions,
} from "./exportJobRegistry";
import {
  ExportJobTransitionError as ExportJobTransitionErrorClass,
  validateArtifactMetadata,
} from "./exportJobRegistry";

type MaybePromise<T> = T | Promise<T>;

export interface SupabaseExportJobRegistryReadRepository {
  createIfAbsent(
    record: BackendExportJobRecord,
  ): MaybePromise<BackendExportJobCreateIfAbsentResult>;
  claimIfAvailable(input: {
    jobId: string;
    workerId: string;
    claimTtlMs?: number;
  }): MaybePromise<BackendExportJobClaimResult>;
  transitionIfOwned(input: {
    jobId: string;
    workerId: string;
    expectedCurrentStatus: BackendExportLifecycleStatus;
    nextStatus: BackendExportLifecycleStatus;
    failureCode?: string;
    failureMessage?: string;
  }): MaybePromise<BackendExportJobTransitionResult>;
  markSuccessIfOwned?(input: {
    jobId: string;
    workerId: string;
    artifacts: BackendArtifactMetadata[];
  }): MaybePromise<BackendExportJobMarkSuccessResult>;
  listByStatus(
    status: BackendExportLifecycleStatus,
  ): MaybePromise<BackendExportJobRecord[]>;
  getByJobId(jobId: string): MaybePromise<BackendExportJobRecord | undefined>;
  getByIdempotencyScope(scope: {
    ownerId: string;
    workspaceId: string;
    requestId: string;
  }): MaybePromise<BackendExportJobRecord | undefined>;
}

export interface SupabaseExportJobRegistryDependencies {
  jobsRepository?: SupabaseExportJobRegistryReadRepository;
  accountWorkspaceRepository?: unknown;
}

export interface SupabaseExportJobRegistryOptions {
  dependencies?: SupabaseExportJobRegistryDependencies;
}

type ExportJobFailureInput = Parameters<ExportJobRegistry["markError"]>[2];

const SUPABASE_EXPORT_JOB_REGISTRY_NOT_WIRED_MESSAGE =
  "SupabaseExportJobRegistry is a boundary scaffold only and is not wired for runtime DB persistence yet.";

const defaultOwnerScope: BackendExportJobOwnerScope = {
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
};

const createJobId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const resolveOwnerScope = (
  scope?: Partial<BackendExportJobOwnerScope>,
): BackendExportJobOwnerScope => ({
  ownerId:
    typeof scope?.ownerId === "string" && scope.ownerId.trim().length > 0
      ? scope.ownerId
      : defaultOwnerScope.ownerId,
  workspaceId:
    typeof scope?.workspaceId === "string" && scope.workspaceId.trim().length > 0
      ? scope.workspaceId
      : defaultOwnerScope.workspaceId,
});

export class SupabaseExportJobRegistry implements ExportJobRegistry {
  readonly kind = "supabase_export_job_registry";

  constructor(
    private readonly options: SupabaseExportJobRegistryOptions = {},
  ) {}

  get dependencies(): SupabaseExportJobRegistryDependencies | undefined {
    return this.options.dependencies;
  }

  private getJobsRepository(): SupabaseExportJobRegistryReadRepository {
    const jobsRepository = this.options.dependencies?.jobsRepository;
    if (!jobsRepository) {
      throw this.createNotWiredError(
        "jobsRepository dependency is required for read-only method mapping.",
      );
    }

    return jobsRepository;
  }

  async create(_input: CreateExportJobInput): Promise<BackendExportJobRecord> {
    const jobsRepository = this.getJobsRepository();
    const now = new Date().toISOString();
    const ownerScope = resolveOwnerScope(_input);
    const record: BackendExportJobRecord = {
      jobId: createJobId(),
      requestId: _input.requestId,
      timelineId: _input.timelineId,
      ownerId: ownerScope.ownerId,
      workspaceId: ownerScope.workspaceId,
      status: "submitted",
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
      renderSettings: _input.renderSettings,
    };

    const result = await this.readRequiredAsync(
      jobsRepository.createIfAbsent(record),
      "create",
    );

    if (result.kind === "created" || result.kind === "existing") {
      return result.record;
    }

    throw new Error(
      result.reason === "job_id_mismatch"
        ? "SupabaseExportJobRegistry.create encountered an idempotency conflict: existing job uses a different jobId for this owner/workspace/request scope."
        : "SupabaseExportJobRegistry.create encountered an idempotency conflict: existing job differs from the requested create-time payload for this owner/workspace/request scope.",
    );
  }

  async getById(jobId: string): Promise<BackendExportJobRecord | undefined> {
    const jobsRepository = this.getJobsRepository();
    return this.readRequiredAsync(
      jobsRepository.getByJobId(jobId),
      "getById",
    );
  }

  async getByIdForOwner(
    jobId: string,
    ownerScope: BackendExportJobOwnerScope,
  ): Promise<BackendExportJobRecord | undefined> {
    const record = await this.getById(jobId);
    if (!record) {
      return undefined;
    }

    return record.ownerId === ownerScope.ownerId &&
        record.workspaceId === ownerScope.workspaceId
      ? record
      : undefined;
  }

  async getByRequestId(
    requestId: string,
    ownerScope?: BackendExportJobOwnerScope,
  ): Promise<BackendExportJobRecord | undefined> {
    if (!ownerScope) {
      throw this.createNotWiredError(
        "getByRequestId requires ownerScope until local default-scope semantics are safely mirrored.",
      );
    }

    const jobsRepository = this.getJobsRepository();
    return this.readRequiredAsync(
      jobsRepository.getByIdempotencyScope({
        ownerId: ownerScope.ownerId,
        workspaceId: ownerScope.workspaceId,
        requestId,
      }),
      "getByRequestId",
    );
  }

  async getByStatus(
    status: BackendExportLifecycleStatus,
  ): Promise<BackendExportJobRecord[]> {
    const jobsRepository = this.getJobsRepository();
    return this.readRequiredAsync(
      jobsRepository.listByStatus(status),
      "getByStatus",
    );
  }

  async claim(
    jobId: string,
    workerId: string,
    options?: ExportJobClaimOptions,
  ): Promise<BackendExportJobRecord> {
    const jobsRepository = this.getJobsRepository();
    const result = await this.readRequiredAsync(
      jobsRepository.claimIfAvailable({
        jobId,
        workerId,
        claimTtlMs: options?.claimTtlMs,
      }),
      "claim",
    );

    if (result.kind === "claimed") {
      return result.record;
    }

    throw this.createClaimTransitionError(jobId, result);
  }

  async markRendering(
    jobId: string,
    workerId: string,
  ): Promise<BackendExportJobRecord> {
    // Legacy deferred marker retained for boundary-source assertions:
    // throw this.createNotWiredError("markRendering")
    const jobsRepository = this.getJobsRepository();
    const result = await this.readRequiredAsync(
      jobsRepository.transitionIfOwned({
        jobId,
        workerId,
        expectedCurrentStatus: "submitted",
        nextStatus: "rendering",
      }),
      "markRendering",
    );

    if (result.kind === "transitioned") {
      return result.record;
    }

    throw this.createLifecycleTransitionError(jobId, "rendering", result);
  }

  async markFinalizing(
    jobId: string,
    workerId: string,
  ): Promise<BackendExportJobRecord> {
    // Legacy deferred marker retained for boundary-source assertions:
    // throw this.createNotWiredError("markFinalizing")
    const jobsRepository = this.getJobsRepository();
    const result = await this.readRequiredAsync(
      jobsRepository.transitionIfOwned({
        jobId,
        workerId,
        expectedCurrentStatus: "rendering",
        nextStatus: "finalizing",
      }),
      "markFinalizing",
    );

    if (result.kind === "transitioned") {
      return result.record;
    }

    throw this.createLifecycleTransitionError(jobId, "finalizing", result);
  }

  async markSuccess(
    jobId: string,
    workerId: string,
    artifacts: unknown[],
  ): Promise<BackendExportJobRecord> {
    const jobsRepository = this.getJobsRepository();
    if (!jobsRepository.markSuccessIfOwned) {
      throw this.createNotWiredError("markSuccess");
    }
    const validatedArtifacts = artifacts.map((artifact) =>
      validateArtifactMetadata(jobId, artifact),
    );
    const result = await this.readRequiredAsync(
      jobsRepository.markSuccessIfOwned({
        jobId,
        workerId,
        artifacts: validatedArtifacts,
      }),
      "markSuccess",
    );

    if (result.kind === "succeeded") {
      return result.record;
    }

    throw this.createMarkSuccessTransitionError(jobId, result);
  }

  async markError(
    jobId: string,
    workerId: string,
    failure: ExportJobFailureInput,
  ): Promise<BackendExportJobRecord> {
    // Legacy deferred marker retained for boundary-source assertions:
    // throw this.createNotWiredError("markError")
    const jobsRepository = this.getJobsRepository();
    const renderingResult = await this.readRequiredAsync(
      jobsRepository.transitionIfOwned({
        jobId,
        workerId,
        expectedCurrentStatus: "rendering",
        nextStatus: "error",
        failureCode: failure.code,
        failureMessage: failure.message,
      }),
      "markError",
    );

    if (renderingResult.kind === "transitioned") {
      return renderingResult.record;
    }

    if (
      renderingResult.kind === "not_transitionable" &&
      renderingResult.reason === "status_mismatch"
    ) {
      const finalizingResult = await this.readRequiredAsync(
        jobsRepository.transitionIfOwned({
          jobId,
          workerId,
          expectedCurrentStatus: "finalizing",
          nextStatus: "error",
          failureCode: failure.code,
          failureMessage: failure.message,
        }),
        "markError",
      );

      if (finalizingResult.kind === "transitioned") {
        return finalizingResult.record;
      }

      throw this.createLifecycleTransitionError(jobId, "error", finalizingResult);
    }

    throw this.createLifecycleTransitionError(jobId, "error", renderingResult);
  }

  async transition(
    _jobId: string,
    _nextStatus: BackendExportLifecycleStatus,
    _options?: ExportJobTransitionOptions,
  ): Promise<BackendExportJobRecord> {
    throw this.createNotWiredError("transition");
  }

  private createNotWiredError(methodName: string): Error {
    return new Error(
      `${SUPABASE_EXPORT_JOB_REGISTRY_NOT_WIRED_MESSAGE} Required behavior remains deferred: lifecycle/state-machine preservation, owner/workspace/requestId idempotency, worker claim/TTL semantics, conditional transitions, artifact sanitization, and failure sanitization. Method: ${methodName}.`,
    );
  }

  private async readRequiredAsync<T>(
    result: MaybePromise<T>,
    methodName: string,
  ): Promise<T> {
    return await result;
  }

  private createClaimTransitionError(
    jobId: string,
    result: Exclude<BackendExportJobClaimResult, { kind: "claimed" }>,
  ): ExportJobTransitionErrorClass {
    if (result.kind === "not_found") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' was not found.`,
      );
    }

    if (result.kind === "already_claimed") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' is already claimed by another worker.`,
      );
    }

    return new ExportJobTransitionErrorClass(
      result.reason === "terminal"
        ? `Export job '${jobId}' is terminal and cannot be claimed.`
        : `Export job '${jobId}' is not in submitted status and cannot be claimed.`,
    );
  }

  private createLifecycleTransitionError(
    jobId: string,
    nextStatus: BackendExportLifecycleStatus,
    result: Exclude<BackendExportJobTransitionResult, { kind: "transitioned" }>,
  ): ExportJobTransitionErrorClass {
    if (result.kind === "not_found") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' was not found.`,
      );
    }

    if (result.kind === "not_owned") {
      return new ExportJobTransitionErrorClass(
        `Worker does not own export job '${jobId}'.`,
      );
    }

    if (result.kind === "claim_expired") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' claim has expired.`,
      );
    }

    if (result.kind === "version_conflict") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' changed before transition to '${nextStatus}' could be applied.`,
      );
    }

    if (result.reason === "terminal") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' is terminal and cannot transition to '${nextStatus}'.`,
      );
    }

    if (result.reason === "status_mismatch") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' is not in the expected status for transition to '${nextStatus}'.`,
      );
    }

    return new ExportJobTransitionErrorClass(
      `Transition to '${nextStatus}' is not allowed for export job '${jobId}'.`,
    );
  }

  private createMarkSuccessTransitionError(
    jobId: string,
    result: Exclude<BackendExportJobMarkSuccessResult, { kind: "succeeded" }>,
  ): ExportJobTransitionErrorClass {
    if (result.kind === "not_found") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' was not found.`,
      );
    }

    if (result.kind === "not_owned") {
      return new ExportJobTransitionErrorClass(
        `Worker does not own export job '${jobId}'.`,
      );
    }

    if (result.kind === "claim_expired") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' claim has expired.`,
      );
    }

    if (result.kind === "version_conflict") {
      return new ExportJobTransitionErrorClass(
        `Export job '${jobId}' changed before transition to 'success' could be applied.`,
      );
    }

    return new ExportJobTransitionErrorClass(
      result.reason === "terminal"
        ? `Export job '${jobId}' is terminal and cannot transition to 'success'.`
        : `Export job '${jobId}' is not in the expected status for transition to 'success'.`,
    );
  }
}

export type { MaybePromise };

export const createSupabaseExportJobRegistry = (
  options?: SupabaseExportJobRegistryOptions,
): ExportJobRegistry => new SupabaseExportJobRegistry(options);

export const supabaseExportJobRegistryBoundary = {
  kind: "supabase_export_job_registry_boundary",
  wired: false,
  requiredBehaviors: [
    "lifecycle/state-machine preservation",
    "owner/workspace/requestId idempotency",
    "worker claim/TTL semantics",
    "conditional transitions",
    "artifact sanitization",
    "failure sanitization",
  ] as const,
} as const;
