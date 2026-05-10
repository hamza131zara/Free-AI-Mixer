import type { ExportRenderSettings } from "../../src/types/exportJob";
import type {
  BackendExportJobRecord,
  BackendExportInFlightStatus,
} from "../contracts/exportHttpTypes";

export interface CreateExportJobInput {
  requestId: string;
  timelineId: string;
  renderSettings: ExportRenderSettings;
}

export interface ExportJobRegistry {
  create(input: CreateExportJobInput): BackendExportJobRecord;
  getById(jobId: string): BackendExportJobRecord | undefined;
  getByRequestId(requestId: string): BackendExportJobRecord | undefined;
}

export class InMemoryExportJobRegistry implements ExportJobRegistry {
  private readonly jobsById = new Map<string, BackendExportJobRecord>();
  private readonly jobIdByRequestId = new Map<string, string>();

  create(input: CreateExportJobInput): BackendExportJobRecord {
    const now = new Date().toISOString();
    const jobId = createJobId();
    const status: BackendExportInFlightStatus = "submitted";

    const record: BackendExportJobRecord = {
      jobId,
      requestId: input.requestId,
      timelineId: input.timelineId,
      status,
      createdAt: now,
      updatedAt: now,
      renderSettings: input.renderSettings,
    };

    this.jobsById.set(jobId, record);
    this.jobIdByRequestId.set(record.requestId, record.jobId);
    return record;
  }

  getById(jobId: string): BackendExportJobRecord | undefined {
    return this.jobsById.get(jobId);
  }

  getByRequestId(requestId: string): BackendExportJobRecord | undefined {
    const existingJobId = this.jobIdByRequestId.get(requestId);
    if (!existingJobId) {
      return undefined;
    }

    return this.jobsById.get(existingJobId);
  }
}

const createJobId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
