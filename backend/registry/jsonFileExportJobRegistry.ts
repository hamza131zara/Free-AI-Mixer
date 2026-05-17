import * as fs from "node:fs";
import path from "node:path";
import { InMemoryExportJobRegistry, type InMemoryExportJobRegistrySeed } from "./inMemoryExportJobRegistry";
import type {
  ExportJobRegistry,
  CreateExportJobInput,
  ExportJobClaimOptions,
  ExportJobTransitionOptions,
} from "./exportJobRegistry";
import { recoverExportJobRecords } from "./exportJobRecoveryPolicy";
import type {
  BackendArtifactMetadata,
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
  BackendExportJobOwnerScope,
} from "../contracts/exportHttpTypes";
import type { ExportFailure } from "../../src/types/exportJob";

interface PersistedJobsData {
  version: 1;
  jobs: BackendExportJobRecord[];
  requestIdToJobId: Record<string, string>;
  updatedAt: string;
}

const SCHEMA_VERSION = 1;
const PERSISTENCE_FILE_DEFAULT = ".free-ai-mixer-jobs.json";
const PERSISTENCE_TEMP_SUFFIX = ".tmp";

// Type-safe sanitization helpers

const sanitizeFailureForPersistence = (failure: ExportFailure): ExportFailure => {
  const sanitized: ExportFailure = { message: failure.message };
  if (failure.code) {
    sanitized.code = failure.code;
  }
  return sanitized;
};

const sanitizeArtifactForPersistence = (artifact: BackendArtifactMetadata): BackendArtifactMetadata => {
  const safe: BackendArtifactMetadata = {
    artifactId: artifact.artifactId,
    jobId: artifact.jobId,
    kind: artifact.kind,
    format: artifact.format,
    status: artifact.status,
    createdAt: artifact.createdAt,
  };
  if (artifact.sizeBytes !== undefined) {
    safe.sizeBytes = artifact.sizeBytes;
  }
  if (artifact.durationMs !== undefined) {
    safe.durationMs = artifact.durationMs;
  }
  return safe;
};

export interface JsonFileExportJobRegistryOptions {
  filePath?: string;
}

/**
 * JSON file persistence adapter for ExportJobRegistry.
 *
 * This adapter wraps InMemoryExportJobRegistry to provide persistence:
 * - On init: loads JSON file, applies recovery policy, seeds inner registry
 * - On mutations: delegates to inner registry, then persists snapshot
 * - Atomic writes: write to temp file, then rename
 *
 * All lifecycle/state machine logic is delegated to InMemoryExportJobRegistry.
 */
export class JsonFileExportJobRegistry implements ExportJobRegistry {
  private readonly filePath: string;
  private readonly innerRegistry: InMemoryExportJobRegistry;

  constructor(options?: JsonFileExportJobRegistryOptions) {
    this.filePath = options?.filePath ?? path.join(process.cwd(), PERSISTENCE_FILE_DEFAULT);

    // Load and recover persisted data
    const seed = this.load();

    // Create inner registry with recovered data
    this.innerRegistry = new InMemoryExportJobRegistry({ seed });
  }

  private load(): InMemoryExportJobRegistrySeed {
    try {
      const data = fs.readFileSync(this.filePath, "utf8");
      const parsed: PersistedJobsData = JSON.parse(data);

      if (parsed.version !== SCHEMA_VERSION) {
        console.warn(`Persistence file version ${parsed.version} != ${SCHEMA_VERSION}, starting fresh`);
        return {};
      }

      // Apply recovery policy to persisted records
      const recoveredRecords = recoverExportJobRecords(parsed.jobs);
      const jobs = recoveredRecords.map((r) => r.record);

      console.log(`Loaded ${jobs.length} jobs from persistence file`);
      return { jobs, requestIdToJobId: parsed.requestIdToJobId };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist yet - starting fresh
        console.log("No persistence file found, starting with empty registry");
        return {};
      }
      // File exists but can't be read - log and start fresh
      console.error(`Failed to load persistence file: ${(err as Error).message}, starting fresh`);
      return {};
    }
  }

  private persist(): void {
    const snapshot = this.innerRegistry.toSnapshot();

    // Sanitize jobs before persisting - remove unsafe fields
    const sanitizedJobs = snapshot.jobs.map((job) => {
      const sanitized: BackendExportJobRecord = { ...job };

      // Sanitize failure - only message and code, never details/stack
      if (sanitized.failure) {
        sanitized.failure = sanitizeFailureForPersistence(sanitized.failure);
      }

      // Sanitize artifacts - remove any path/URL fields
      if (sanitized.artifacts) {
        sanitized.artifacts = sanitized.artifacts.map(sanitizeArtifactForPersistence);
      }

      return sanitized;
    });

    const data: PersistedJobsData = {
      version: SCHEMA_VERSION,
      jobs: sanitizedJobs,
      requestIdToJobId: snapshot.requestIdToJobId,
      updatedAt: new Date().toISOString(),
    };

    const tempPath = this.filePath + PERSISTENCE_TEMP_SUFFIX;
    const jsonStr = JSON.stringify(data, null, 2);

    // Atomic write: write to temp file, then rename
    fs.writeFileSync(tempPath, jsonStr, "utf8");
    fs.renameSync(tempPath, this.filePath);
  }

  // Delegated ExportJobRegistry methods

  create(input: CreateExportJobInput): BackendExportJobRecord {
    const record = this.innerRegistry.create(input);
    this.persist();
    return record;
  }

  getById(jobId: string): BackendExportJobRecord | undefined {
    return this.innerRegistry.getById(jobId);
  }

  getByIdForOwner(
    jobId: string,
    ownerScope: BackendExportJobOwnerScope,
  ): BackendExportJobRecord | undefined {
    return this.innerRegistry.getByIdForOwner(jobId, ownerScope);
  }

  getByRequestId(
    requestId: string,
    ownerScope?: BackendExportJobOwnerScope,
  ): BackendExportJobRecord | undefined {
    return this.innerRegistry.getByRequestId(requestId, ownerScope);
  }

  getByStatus(status: BackendExportLifecycleStatus): BackendExportJobRecord[] {
    return this.innerRegistry.getByStatus(status);
  }

  claim(jobId: string, workerId: string, options?: ExportJobClaimOptions): BackendExportJobRecord {
    const record = this.innerRegistry.claim(jobId, workerId, options);
    this.persist();
    return record;
  }

  markRendering(jobId: string, workerId: string): BackendExportJobRecord {
    const record = this.innerRegistry.markRendering(jobId, workerId);
    this.persist();
    return record;
  }

  markFinalizing(jobId: string, workerId: string): BackendExportJobRecord {
    const record = this.innerRegistry.markFinalizing(jobId, workerId);
    this.persist();
    return record;
  }

  markSuccess(jobId: string, workerId: string, artifacts: unknown[]): BackendExportJobRecord {
    const record = this.innerRegistry.markSuccess(jobId, workerId, artifacts);
    this.persist();
    return record;
  }

  markError(jobId: string, workerId: string, failure: ExportFailure): BackendExportJobRecord {
    const record = this.innerRegistry.markError(jobId, workerId, failure);
    this.persist();
    return record;
  }

  transition(jobId: string, nextStatus: BackendExportLifecycleStatus, options?: ExportJobTransitionOptions): BackendExportJobRecord {
    const record = this.innerRegistry.transition(jobId, nextStatus, options);
    this.persist();
    return record;
  }
}
