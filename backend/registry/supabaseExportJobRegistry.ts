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

export interface SupabaseExportJobRegistryDependencies {
  jobsRepository?: unknown;
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

  create(_input: CreateExportJobInput): BackendExportJobRecord {
    throw this.createNotWiredError("create");
  }

  getById(_jobId: string): BackendExportJobRecord | undefined {
    throw this.createNotWiredError("getById");
  }

  getByIdForOwner(
    _jobId: string,
    _ownerScope: BackendExportJobOwnerScope,
  ): BackendExportJobRecord | undefined {
    throw this.createNotWiredError("getByIdForOwner");
  }

  getByRequestId(
    _requestId: string,
    _ownerScope?: BackendExportJobOwnerScope,
  ): BackendExportJobRecord | undefined {
    throw this.createNotWiredError("getByRequestId");
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
}

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
