import { expect, test } from "@playwright/test";
import {
  ExportJobTransitionError,
  InMemoryExportJobRegistry,
  validateArtifactMetadata,
} from "../../backend/registry/exportJobRegistry";

const createRegistry = () => new InMemoryExportJobRegistry();

const createJob = (registry: InMemoryExportJobRegistry, requestId: string) =>
  registry.create({
    requestId,
    timelineId: "timeline-phase67",
    renderSettings: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      quality: "standard",
    },
  });

const validArtifact = (jobId: string) => ({
  artifactId: "artifact-phase67",
  jobId,
  kind: "video",
  format: "mp4",
  status: "available" as const,
  createdAt: "2026-05-10T00:00:00.000Z",
  sizeBytes: 1234,
  durationMs: 2000,
});

test.describe("Phase 6.7 backend artifact metadata contract", () => {
  test("valid artifact metadata shape is accepted structurally", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-valid");
    const parsed = validateArtifactMetadata(job.jobId, validArtifact(job.jobId));
    expect(parsed.artifactId).toBe("artifact-phase67");
    expect(parsed.kind).toBe("video");
  });

  test("missing artifactId is rejected", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-missing-artifactId");
    const { artifactId: _removed, ...missing } = validArtifact(job.jobId);
    expect(() => validateArtifactMetadata(job.jobId, missing)).toThrow(
      ExportJobTransitionError,
    );
  });

  test("missing jobId is rejected", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-missing-jobId");
    const { jobId: _removed, ...missing } = validArtifact(job.jobId);
    expect(() => validateArtifactMetadata(job.jobId, missing)).toThrow(
      ExportJobTransitionError,
    );
  });

  test("missing kind/format/status/createdAt is rejected", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-missing-required");
    const requiredFields = ["kind", "format", "status", "createdAt"] as const;

    for (const field of requiredFields) {
      const artifact = { ...validArtifact(job.jobId) } as Record<string, unknown>;
      delete artifact[field];
      expect(() => validateArtifactMetadata(job.jobId, artifact)).toThrow(
        ExportJobTransitionError,
      );
    }
  });

  test("invalid artifact status is rejected", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-invalid-status");
    expect(() =>
      validateArtifactMetadata(job.jobId, {
        ...validArtifact(job.jobId),
        status: "not-a-status",
      }),
    ).toThrow(ExportJobTransitionError);
  });

  test("negative sizeBytes is rejected", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-negative-size");
    expect(() =>
      validateArtifactMetadata(job.jobId, {
        ...validArtifact(job.jobId),
        sizeBytes: -1,
      }),
    ).toThrow(ExportJobTransitionError);
  });

  test("negative durationMs is rejected", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-negative-duration");
    expect(() =>
      validateArtifactMetadata(job.jobId, {
        ...validArtifact(job.jobId),
        durationMs: -1,
      }),
    ).toThrow(ExportJobTransitionError);
  });

  test("local-path-like fields are rejected", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-local-path-fields");
    const blocked = ["path", "filePath", "localPath"] as const;

    for (const field of blocked) {
      expect(() =>
        validateArtifactMetadata(job.jobId, {
          ...validArtifact(job.jobId),
          [field]: "C:\\temp\\artifact.mp4",
        }),
      ).toThrow(ExportJobTransitionError);
    }
  });

  test("url/downloadUrl fields are rejected in this phase", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-url-fields");

    expect(() =>
      validateArtifactMetadata(job.jobId, {
        ...validArtifact(job.jobId),
        url: "https://example.com/video.mp4",
      }),
    ).toThrow(ExportJobTransitionError);

    expect(() =>
      validateArtifactMetadata(job.jobId, {
        ...validArtifact(job.jobId),
        downloadUrl: "https://example.com/video.mp4",
      }),
    ).toThrow(ExportJobTransitionError);
  });

  test("markSuccess remains blocked without valid artifact metadata", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-success-blocked");
    registry.transition(job.jobId, "rendering");
    registry.transition(job.jobId, "finalizing");

    expect(() => registry.transition(job.jobId, "success")).toThrow(
      ExportJobTransitionError,
    );
  });

  test("markSuccess from finalizing with valid artifact metadata is allowed", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-success-valid");
    registry.transition(job.jobId, "rendering");
    registry.transition(job.jobId, "finalizing");

    const success = registry.transition(job.jobId, "success", {
      artifacts: [validArtifact(job.jobId)],
    });

    expect(success.status).toBe("success");
    expect(success.artifacts?.[0].artifactId).toBe("artifact-phase67");
  });

  test("no fake progress percent or fake download output is added", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase67-no-fake-output");
    registry.transition(job.jobId, "rendering");
    registry.transition(job.jobId, "finalizing");
    const success = registry.transition(job.jobId, "success", {
      artifacts: [validArtifact(job.jobId)],
    });

    const successRecord = success as unknown as Record<string, unknown>;
    expect(successRecord.progress).toBeUndefined();
    expect(successRecord.percent).toBeUndefined();
    const artifactRecord = success.artifacts?.[0] as unknown as Record<string, unknown>;
    expect(artifactRecord.url).toBeUndefined();
    expect(artifactRecord.downloadUrl).toBeUndefined();
  });
});
