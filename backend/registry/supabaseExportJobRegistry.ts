import type {
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
  BackendExportJobOwnerScope,
} from "../contracts/exportHttpTypes";
import type {
  CreateExportJobInput,
  ExportJobClaimOptions,
  ExportJobRegistry,
  ExportJobTransitionOptions,
} from "./exportJobRegistry";

type MaybePromise<T> = T | Promise<T>;

export interface SupabaseExportJobRegistryReadRepository {
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
    throw this.createNotWiredError("create");
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
    _status: BackendExportLifecycleStatus,
  ): Promise<BackendExportJobRecord[]> {
    throw this.createNotWiredError("getByStatus");
  }

  async claim(
    _jobId: string,
    _workerId: string,
    _options?: ExportJobClaimOptions,
  ): Promise<BackendExportJobRecord> {
    throw this.createNotWiredError("claim");
  }

  async markRendering(
    _jobId: string,
    _workerId: string,
  ): Promise<BackendExportJobRecord> {
    throw this.createNotWiredError("markRendering");
  }

  async markFinalizing(
    _jobId: string,
    _workerId: string,
  ): Promise<BackendExportJobRecord> {
    throw this.createNotWiredError("markFinalizing");
  }

  async markSuccess(
    _jobId: string,
    _workerId: string,
    _artifacts: unknown[],
  ): Promise<BackendExportJobRecord> {
    throw this.createNotWiredError("markSuccess");
  }

  async markError(
    _jobId: string,
    _workerId: string,
    _failure: ExportJobFailureInput,
  ): Promise<BackendExportJobRecord> {
    throw this.createNotWiredError("markError");
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
