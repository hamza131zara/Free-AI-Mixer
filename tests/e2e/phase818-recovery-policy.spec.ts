import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  recoverExportJobRecord,
  recoverExportJobRecords,
  getRecoverableRecords,
  getTerminalRecords,
  type RecoveredExportJobRecord,
} from "../../backend/registry/exportJobRecoveryPolicy";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";

const makeRecord = (overrides: Partial<BackendExportJobRecord> = {}): BackendExportJobRecord => ({
  jobId: "test-job-123",
  requestId: "test-request-456",
  timelineId: "timeline-789",
  status: "submitted",
  attemptCount: 1,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
  ...overrides,
});

test.describe("phase818 recovery policy", () => {
  test("submitted recovers as submitted", () => {
    const record = makeRecord({ status: "submitted" });
    const result = recoverExportJobRecord(record);

    expect(result.record.status).toBe("submitted");
    expect(result.recovered).toBe(false);
    expect(result.reason).toContain("already in recoverable state");
  });

  test("rendering recovers as submitted", () => {
    const record = makeRecord({
      status: "rendering",
      claimedByWorkerId: "worker-1",
      claimExpiresAt: "2025-01-01T01:00:00.000Z",
    });
    const result = recoverExportJobRecord(record);

    expect(result.record.status).toBe("submitted");
    expect(result.recovered).toBe(true);
    expect(result.reason).toContain("rendering -> submitted");
    expect(result.record.claimedByWorkerId).toBeUndefined();
    expect(result.record.claimExpiresAt).toBeUndefined();
  });

  test("finalizing recovers as submitted", () => {
    const record = makeRecord({
      status: "finalizing",
      claimedByWorkerId: "worker-1",
      claimExpiresAt: "2025-01-01T01:00:00.000Z",
    });
    const result = recoverExportJobRecord(record);

    expect(result.record.status).toBe("submitted");
    expect(result.recovered).toBe(true);
    expect(result.reason).toContain("finalizing -> submitted");
    expect(result.record.claimedByWorkerId).toBeUndefined();
    expect(result.record.claimExpiresAt).toBeUndefined();
  });

  test("success remains success", () => {
    const record = makeRecord({ status: "success" });
    const result = recoverExportJobRecord(record);

    expect(result.record.status).toBe("success");
    expect(result.recovered).toBe(false);
  });

  test("error remains error", () => {
    const record = makeRecord({
      status: "error",
      failure: { message: "test error", code: "TEST_ERROR" },
    });
    const result = recoverExportJobRecord(record);

    expect(result.record.status).toBe("error");
    expect(result.recovered).toBe(false);
  });

  test("expired remains expired", () => {
    const record = makeRecord({ status: "expired" });
    const result = recoverExportJobRecord(record);

    expect(result.record.status).toBe("expired");
    expect(result.recovered).toBe(false);
  });

  test("recovered rendering/finalizing records clear claimedByWorkerId and claimExpiresAt", () => {
    const renderingRecord = makeRecord({
      status: "rendering",
      claimedByWorkerId: "worker-1",
      claimExpiresAt: "2025-01-01T01:00:00.000Z",
    });
    const finalizingRecord = makeRecord({
      status: "finalizing",
      claimedByWorkerId: "worker-2",
      claimExpiresAt: "2025-01-01T02:00:00.000Z",
    });

    const renderingResult = recoverExportJobRecord(renderingRecord);
    const finalizingResult = recoverExportJobRecord(finalizingRecord);

    expect(renderingResult.record.claimedByWorkerId).toBeUndefined();
    expect(renderingResult.record.claimExpiresAt).toBeUndefined();
    expect(finalizingResult.record.claimedByWorkerId).toBeUndefined();
    expect(finalizingResult.record.claimExpiresAt).toBeUndefined();
  });

  test("attemptCount is preserved", () => {
    const record = makeRecord({ status: "rendering", attemptCount: 5 });
    const result = recoverExportJobRecord(record);

    expect(result.record.attemptCount).toBe(5);
  });

  test("requestId/jobId/timelineId/renderSettings are preserved", () => {
    const record = makeRecord({
      status: "rendering",
      requestId: "my-request-id",
      jobId: "my-job-id",
      timelineId: "my-timeline-id",
      renderSettings: { width: 3840, height: 2160, fps: 60, format: "webm" },
    });
    const result = recoverExportJobRecord(record);

    expect(result.record.requestId).toBe("my-request-id");
    expect(result.record.jobId).toBe("my-job-id");
    expect(result.record.timelineId).toBe("my-timeline-id");
    expect(result.record.renderSettings).toEqual({ width: 3840, height: 2160, fps: 60, format: "webm" });
  });

  test("artifact metadata remains safe - no path/filePath/url/downloadUrl/signedUrl", () => {
    const record = makeRecord({
      status: "success",
      artifacts: [
        {
          artifactId: "art-123",
          jobId: "test-job-123",
          kind: "render_output",
          format: "mp4",
          status: "available",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
    const result = recoverExportJobRecord(record);

    expect(result.record.artifacts).toBeDefined();
    expect(result.record.artifacts?.length).toBe(1);
    expect(result.record.artifacts?.[0]).not.toHaveProperty("path");
    expect(result.record.artifacts?.[0]).not.toHaveProperty("filePath");
    expect(result.record.artifacts?.[0]).not.toHaveProperty("url");
    expect(result.record.artifacts?.[0]).not.toHaveProperty("downloadUrl");
    expect(result.record.artifacts?.[0]).not.toHaveProperty("signedUrl");
  });

  test("failure.details is not introduced or exposed by recovery policy", () => {
    // Error record without details
    const record = makeRecord({
      status: "error",
      failure: { message: "test error", code: "TEST_ERROR" },
    });
    const result = recoverExportJobRecord(record);

    expect(result.record.failure).toBeDefined();
    expect(result.record.failure?.message).toBe("test error");
    expect(result.record.failure?.code).toBe("TEST_ERROR");
    expect(result.record.failure).not.toHaveProperty("details");
  });

  test("recovery policy does not write files or import fs", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/registry/exportJobRecoveryPolicy.ts"),
      "utf8",
    );

    expect(source).not.toContain("import \"fs\"");
    expect(source).not.toContain("from \"fs\"");
    expect(source).not.toContain("promises");
    expect(source).not.toContain("writeFile");
    expect(source).not.toContain("writeFileSync");
  });

  test("recovery policy does not import routes/workers/app/server", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/registry/exportJobRecoveryPolicy.ts"),
      "utf8",
    );

    expect(source).not.toContain("routes/");
    expect(source).not.toContain("workers/");
    expect(source).not.toContain("app.ts");
    expect(source).not.toContain("server.ts");
  });

  test("recovery policy does not call registry lifecycle mutation methods", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/registry/exportJobRecoveryPolicy.ts"),
      "utf8",
    );

    expect(source).not.toContain("claim(");
    expect(source).not.toContain("markRendering");
    expect(source).not.toContain("markFinalizing");
    expect(source).not.toContain("markSuccess");
    expect(source).not.toContain("markError");
    expect(source).not.toContain("transition(");
  });

  test("original record objects are not mutated", () => {
    const originalRecord = makeRecord({
      status: "rendering",
      claimedByWorkerId: "worker-1",
      claimExpiresAt: "2025-01-01T01:00:00.000Z",
    });
    const originalStatus = originalRecord.status;
    const originalClaimedBy = originalRecord.claimedByWorkerId;
    const originalClaimExpires = originalRecord.claimExpiresAt;

    const result = recoverExportJobRecord(originalRecord);

    // Original should be unchanged
    expect(originalRecord.status).toBe(originalStatus);
    expect(originalRecord.claimedByWorkerId).toBe(originalClaimedBy);
    expect(originalRecord.claimExpiresAt).toBe(originalClaimExpires);

    // Result should be a new object
    expect(result.record.status).toBe("submitted");
    expect(result.record.claimedByWorkerId).toBeUndefined();
  });

  test("recoverExportJobRecords handles empty array", () => {
    const result = recoverExportJobRecords([]);
    expect(result).toEqual([]);
  });

  test("getRecoverableRecords filters correctly", () => {
    const records = [
      makeRecord({ status: "submitted" }),
      makeRecord({ status: "rendering" }),
      makeRecord({ status: "success" }),
      makeRecord({ status: "error" }),
      makeRecord({ status: "finalizing" }),
    ];

    const recoverable = getRecoverableRecords(records);
    expect(recoverable.length).toBe(3);
    expect(recoverable.every(r => ["submitted", "rendering", "finalizing"].includes(r.status))).toBe(true);
  });

  test("getTerminalRecords filters correctly", () => {
    const records = [
      makeRecord({ status: "submitted" }),
      makeRecord({ status: "rendering" }),
      makeRecord({ status: "success" }),
      makeRecord({ status: "error" }),
      makeRecord({ status: "expired" }),
    ];

    const terminal = getTerminalRecords(records);
    expect(terminal.length).toBe(3);
    expect(terminal.every(r => ["success", "error", "expired"].includes(r.status))).toBe(true);
  });
});