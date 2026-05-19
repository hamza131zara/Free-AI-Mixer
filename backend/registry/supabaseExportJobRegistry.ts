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

  create(_input: CreateExportJobInput): BackendExportJobRecord {
    throw this.createNotWiredError("create");
  }

  getById(jobId: string): BackendExportJobRecord | undefined {
    const jobsRepository = this.getJobsRepository();
    return this.readRequiredSync(
      jobsRepository.getByJobId(jobId),
      "getById",
    );
  }

  getByIdForOwner(
    jobId: string,
    ownerScope: BackendExportJobOwnerScope,
  ): BackendExportJobRecord | undefined {
    const record = this.getById(jobId);
    if (!record) {
      return undefined;
    }

    return record.ownerId === ownerScope.ownerId &&
        record.workspaceId === ownerScope.workspaceId
      ? record
      : undefined;
  }

  getByRequestId(
    requestId: string,
    ownerScope?: BackendExportJobOwnerScope,
  ): BackendExportJobRecord | undefined {
    if (!ownerScope) {
      throw this.createNotWiredError(
        "getByRequestId requires ownerScope until local default-scope semantics are safely mirrored.",
      );
    }

    const jobsRepository = this.getJobsRepository();
    return this.readRequiredSync(
      jobsRepository.getByIdempotencyScope({
        ownerId: ownerScope.ownerId,
        workspaceId: ownerScope.workspaceId,
        requestId,
      }),
      "getByRequestId",
    );
  }

  getByStatus(_status: BackendExportLifecycleStatus): BackendExportJobRecord[] {
    throw this.createNotWiredError("getByStatus");
  }

  claim(
    _jobId: string,
    _workerId: string,
    _options?: ExportJobClaimOptions,
  ): BackendExportJobRecord {
    throw this.createNotWiredError("claim");
  }

  markRendering(_jobId: string, _workerId: string): BackendExportJobRecord {
    throw this.createNotWiredError("markRendering");
  }

  markFinalizing(_jobId: string, _workerId: string): BackendExportJobRecord {
    throw this.createNotWiredError("markFinalizing");
  }

  markSuccess(
    _jobId: string,
    _workerId: string,
    _artifacts: unknown[],
  ): BackendExportJobRecord {
    throw this.createNotWiredError("markSuccess");
  }

  markError(
    _jobId: string,
    _workerId: string,
    _failure: ExportJobFailureInput,
  ): BackendExportJobRecord {
    throw this.createNotWiredError("markError");
  }

  transition(
    _jobId: string,
    _nextStatus: BackendExportLifecycleStatus,
    _options?: ExportJobTransitionOptions,
  ): BackendExportJobRecord {
    throw this.createNotWiredError("transition");
  }

  private createNotWiredError(methodName: string): Error {
    return new Error(
      `${SUPABASE_EXPORT_JOB_REGISTRY_NOT_WIRED_MESSAGE} Required behavior remains deferred: lifecycle/state-machine preservation, owner/workspace/requestId idempotency, worker claim/TTL semantics, conditional transitions, artifact sanitization, and failure sanitization. Method: ${methodName}.`,
    );
  }

  private readRequiredSync<T>(
    result: MaybePromise<T>,
    methodName: string,
  ): T {
    if (result && typeof result === "object" && "then" in result) {
      throw this.createNotWiredError(
        `${methodName} received an async repository dependency. The current ExportJobRegistry contract is synchronous, so async-backed runtime DB reads remain deferred.`,
      );
    }

    return result;
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
