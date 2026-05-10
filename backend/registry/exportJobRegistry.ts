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
}

export class InMemoryExportJobRegistry implements ExportJobRegistry {
  private readonly jobsById = new Map<string, BackendExportJobRecord>();

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
    return record;
  }

  getById(jobId: string): BackendExportJobRecord | undefined {
    return this.jobsById.get(jobId);
  }
}

const createJobId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
