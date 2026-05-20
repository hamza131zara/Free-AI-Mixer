import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  InMemoryExportJobRegistry,
  type ExportJobClaimOptions,
} from "../../backend/registry/exportJobRegistry";
import type {
  BackendArtifactMetadata,
  BackendExportJobRecord,
} from "../../backend/contracts/exportHttpTypes";
import {
  executeSingleProcessRender,
  type RendererAdapterInput,
  type RendererAdapterResult,
} from "../../backend/renderer/singleProcessRenderHarness";
import type { RenderInputSnapshot } from "../../backend/contracts/renderInputSnapshot";

class TrackingRegistry extends InMemoryExportJobRegistry {
  public readonly calls: string[] = [];

  override async claim(
    jobId: string,
    workerId: string,
    options?: ExportJobClaimOptions,
  ): Promise<BackendExportJobRecord> {
    const result = await super.claim(jobId, workerId, options);
    this.calls.push("claim");
    return result;
  }

  override async markRendering(jobId: string, workerId: string): Promise<BackendExportJobRecord> {
    const result = await super.markRendering(jobId, workerId);
    this.calls.push("markRendering");
    return result;
  }

  override async markFinalizing(jobId: string, workerId: string): Promise<BackendExportJobRecord> {
    const result = await super.markFinalizing(jobId, workerId);
    this.calls.push("markFinalizing");
    return result;
  }

  override async markSuccess(
    jobId: string,
    workerId: string,
    artifacts: unknown[],
  ): Promise<BackendExportJobRecord> {
    const result = await super.markSuccess(jobId, workerId, artifacts);
    this.calls.push("markSuccess");
    return result;
  }

  override async markError(
    jobId: string,
    workerId: string,
    failure: { message: string; code?: string; details?: unknown },
  ): Promise<BackendExportJobRecord> {
    const result = await super.markError(jobId, workerId, failure);
    this.calls.push("markError");
    return result;
  }
}

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase74-harness-"));

const cleanupTempRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { recursive: true, force: true });
};

const createJob = async (registry: InMemoryExportJobRegistry, requestId: string) =>
  registry.create({
    requestId,
    timelineId: "timeline-phase74",
    renderSettings: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      quality: "standard",
    },
  });

const createSnapshotInput = (jobId: string): RenderInputSnapshot => ({
  jobId,
  timelineId: "timeline-phase74",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  timelineSnapshot: {
    timelineId: "timeline-phase74",
    clips: [
      {
        clipId: "clip-1",
        sceneRefId: "scene-1",
        startMs: 0,
        durationMs: 1000,
        order: 0,
      },
    ],
  },
  sceneRefs: [{ sceneId: "scene-1", role: "primary" }],
  mediaRefs: [],
  outputTarget: {
    jobFolderKey: jobId,
    artifactBaseName: "final",
    format: "mp4",
  },
});

const createFileWritingAdapter = (
  tempRoot: string,
  registry?: InMemoryExportJobRegistry,
  jobId?: string,
): ((input: RendererAdapterInput) => Promise<RendererAdapterResult>) => {
  const outputRoot = path.join(tempRoot, "output");
  return async (input: RendererAdapterInput) => {
    if (registry && jobId) {
      expect((await registry.getById(jobId))?.status).toBe("rendering");
    }

    await fs.mkdir(outputRoot, { recursive: true });
    await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
    await fs.writeFile(input.resolvedOutputPath.filePath, Buffer.from("video-bytes"));
    return { ok: true };
  };
};

test.describe("phase74 single-process render harness", () => {
  test("claims before rendering and successful path finalizes before success with verified metadata", async () => {
    const tempRoot = await createTempRoot();
    const registry = new TrackingRegistry();
    const job = await createJob(registry, "phase74-success");

    try {
      const result = await executeSingleProcessRender({
        registry,
        rendererAdapter: createFileWritingAdapter(tempRoot, registry, job.jobId),
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            output: path.join(tempRoot, "output"),
          },
        },
        workerId: "worker-phase74",
        jobId: job.jobId,
        snapshotInput: createSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("expected success result");
      }

      expect(registry.calls).toEqual([
        "claim",
        "markRendering",
        "markFinalizing",
        "markSuccess",
      ]);

      const artifact = result.artifact as BackendArtifactMetadata &
        Record<string, unknown>;
      expect(artifact.status).toBe("available");
      expect(artifact.sizeBytes).toBeGreaterThan(0);
      expect(artifact.path).toBeUndefined();
      expect(artifact.localPath).toBeUndefined();
      expect(artifact.filePath).toBeUndefined();
      expect(artifact.url).toBeUndefined();
      expect(artifact.downloadUrl).toBeUndefined();
      expect(artifact.publicUrl).toBeUndefined();
      expect(artifact.signedUrl).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).progress).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).downloadUrl).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).publicUrl).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).signedUrl).toBeUndefined();
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("adapter failure maps to markError", async () => {
    const tempRoot = await createTempRoot();
    const registry = new TrackingRegistry();
    const job = await createJob(registry, "phase74-adapter-fail");

    try {
      const result = await executeSingleProcessRender({
        registry,
        rendererAdapter: async () => ({
          ok: false,
          error: new Error("adapter failed"),
          transient: true,
        }),
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            output: path.join(tempRoot, "output"),
          },
        },
        workerId: "worker-phase74",
        jobId: job.jobId,
        snapshotInput: createSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected failure result");
      }
      expect(result.failure.code).toBe("renderer_execution_failed");
      expect(registry.calls).toContain("markError");
      expect((await registry.getById(job.jobId))?.status).toBe("error");
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("verification failure maps to markError with artifact code", async () => {
    const tempRoot = await createTempRoot();
    const registry = new TrackingRegistry();
    const job = await createJob(registry, "phase74-verify-fail");

    try {
      const result = await executeSingleProcessRender({
        registry,
        rendererAdapter: async () => ({ ok: true }),
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            output: path.join(tempRoot, "output"),
          },
        },
        workerId: "worker-phase74",
        jobId: job.jobId,
        snapshotInput: createSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected failure result");
      }
      expect(result.failure.code).toBe("artifact_file_missing");
      expect(registry.calls).toContain("markError");
      expect((await registry.getById(job.jobId))?.status).toBe("error");
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("snapshot failure maps to markError", async () => {
    const tempRoot = await createTempRoot();
    const registry = new TrackingRegistry();
    const job = await createJob(registry, "phase74-snapshot-fail");

    try {
      const result = await executeSingleProcessRender({
        registry,
        rendererAdapter: async () => ({ ok: true }),
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            output: path.join(tempRoot, "output"),
          },
        },
        workerId: "worker-phase74",
        jobId: job.jobId,
        snapshotInput: { invalid: true },
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected failure result");
      }
      expect(result.failure.code).toBe("input_snapshot_invalid");
      expect(registry.calls).toContain("markError");
      expect((await registry.getById(job.jobId))?.status).toBe("error");
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("path resolution failure maps to markError", async () => {
    const tempRoot = await createTempRoot();
    const registry = new TrackingRegistry();
    const job = await createJob(registry, "phase74-path-fail");

    try {
      const result = await executeSingleProcessRender({
        registry,
        rendererAdapter: async () => ({ ok: true }),
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            // Deliberately invalid/missing output root to force path-stage failure
            output: "",
          },
        },
        workerId: "worker-phase74",
        jobId: job.jobId,
        snapshotInput: createSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected failure result");
      }
      expect(result.failure.code).toBe("output_path_invalid");
      expect(registry.calls).toContain("markError");
      expect((await registry.getById(job.jobId))?.status).toBe("error");
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("non-owner worker cannot mutate lifecycle", async () => {
    const tempRoot = await createTempRoot();
    const registry = new TrackingRegistry();
    const job = await createJob(registry, "phase74-non-owner");
    await registry.claim(job.jobId, "worker-owner");

    try {
      const result = await executeSingleProcessRender({
        registry,
        rendererAdapter: async () => ({ ok: true }),
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            output: path.join(tempRoot, "output"),
          },
        },
        workerId: "worker-other",
        jobId: job.jobId,
        snapshotInput: createSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected failure");
      }
      expect((await registry.getById(job.jobId))?.claimedByWorkerId).toBe("worker-owner");
      expect((await registry.getById(job.jobId))?.status).toBe("submitted");
      expect(registry.calls.filter((call) => call === "markError").length).toBe(0);
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("adapter cannot mutate lifecycle through harness adapter input", async () => {
    const tempRoot = await createTempRoot();
    const registry = new TrackingRegistry();
    const job = await createJob(registry, "phase74-adapter-boundary");

    try {
      const result = await executeSingleProcessRender({
        registry,
        rendererAdapter: async (adapterInput) => {
          const inputRecord = adapterInput as unknown as Record<string, unknown>;
          expect(inputRecord.registry).toBeUndefined();
          expect(inputRecord.markSuccess).toBeUndefined();
          expect(inputRecord.markError).toBeUndefined();
          return { ok: false, error: new Error("test fail") };
        },
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            output: path.join(tempRoot, "output"),
          },
        },
        workerId: "worker-phase74",
        jobId: job.jobId,
        snapshotInput: createSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(false);
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("routes remain unchanged and exports POST does not auto-run harness", async () => {
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    // Check for actual usage (instantiation or call), not type-only imports
    // Type imports are safe - they don't execute anything
    expect(routeSource.includes("executeSingleProcessRender")).toBe(false);
    expect(routeSource.includes("new SingleProcessRenderHarness")).toBe(false);
    expect(routeSource.includes("singleProcessRenderHarness(")).toBe(false);
  });
});
