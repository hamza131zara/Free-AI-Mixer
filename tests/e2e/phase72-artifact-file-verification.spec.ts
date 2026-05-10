import test, { expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  verifyRenderedArtifact,
  buildVerifiedArtifactMetadata,
} from "../../backend/renderer/artifactVerification";
import {
  createRenderOutputTarget,
  resolveRenderOutputPath,
  type RenderOutputPathPolicy,
  type ResolvedRenderOutputPath,
} from "../../backend/renderer/outputPathPolicy";

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase72-artifact-verify-"));

const cleanupTempRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { recursive: true, force: true });
};

const createTestPolicy = (
  tempRoot: string,
  outputRoot: string,
): RenderOutputPathPolicy => ({
  roots: {
    temp: tempRoot,
    output: outputRoot,
  },
});

const resolveTestOutputPath = (
  policy: RenderOutputPathPolicy,
  jobId: string,
  baseName: string,
  extension: "mp4" | "webm" = "mp4",
): ResolvedRenderOutputPath =>
  resolveRenderOutputPath(
    policy,
    createRenderOutputTarget("output", jobId, baseName, extension),
  );

test.describe("phase72 real file verification helper", () => {
  test("verifies a valid non-empty file under output root and returns safe metadata", async () => {
    const tempRoot = await createTempRoot();
    const outputRoot = path.join(tempRoot, "output");
    const tempDir = path.join(tempRoot, "temp");

    try {
      await fs.mkdir(outputRoot, { recursive: true });
      await fs.mkdir(tempDir, { recursive: true });

      const resolved = resolveTestOutputPath(
        createTestPolicy(tempDir, outputRoot),
        "job_001",
        "render",
        "mp4",
      );

      await fs.mkdir(resolved.directoryPath, { recursive: true });
      await fs.writeFile(resolved.filePath, Buffer.from("video-bytes"));

      const before = await fs.stat(resolved.filePath);
      const result = await verifyRenderedArtifact({
        artifactId: "artifact-1",
        jobId: "job_001",
        kind: "video",
        expectedFormat: "mp4",
        resolvedOutputPath: resolved,
      });
      const after = await fs.stat(resolved.filePath);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("expected verified artifact");
      }

      expect(result.artifact).toMatchObject({
        artifactId: "artifact-1",
        jobId: "job_001",
        kind: "video",
        format: "mp4",
        status: "available",
      });
      expect(typeof result.artifact.createdAt).toBe("string");
      expect(result.artifact.sizeBytes).toBeGreaterThan(0);
      expect(result.artifact).not.toHaveProperty("path");
      expect(result.artifact).not.toHaveProperty("filePath");
      expect(result.artifact).not.toHaveProperty("localPath");
      expect(result.artifact).not.toHaveProperty("url");
      expect(result.artifact).not.toHaveProperty("downloadUrl");
      expect(result.artifact).not.toHaveProperty("publicUrl");
      expect(result.artifact).not.toHaveProperty("signedUrl");

      expect(after.mtimeMs).toBe(before.mtimeMs);
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("rejects missing file", async () => {
    const tempRoot = await createTempRoot();
    const outputRoot = path.join(tempRoot, "output");
    const tempDir = path.join(tempRoot, "temp");

    try {
      await fs.mkdir(outputRoot, { recursive: true });
      await fs.mkdir(tempDir, { recursive: true });

      const resolved = resolveTestOutputPath(
        createTestPolicy(tempDir, outputRoot),
        "job_002",
        "missing",
        "mp4",
      );

      const result = await verifyRenderedArtifact({
        artifactId: "artifact-2",
        jobId: "job_002",
        kind: "video",
        expectedFormat: "mp4",
        resolvedOutputPath: resolved,
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "artifact_file_missing",
          message: "Rendered artifact file was not found.",
        },
      });
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("rejects empty file", async () => {
    const tempRoot = await createTempRoot();
    const outputRoot = path.join(tempRoot, "output");
    const tempDir = path.join(tempRoot, "temp");

    try {
      await fs.mkdir(outputRoot, { recursive: true });
      await fs.mkdir(tempDir, { recursive: true });

      const resolved = resolveTestOutputPath(
        createTestPolicy(tempDir, outputRoot),
        "job_003",
        "empty",
        "mp4",
      );

      await fs.mkdir(resolved.directoryPath, { recursive: true });
      await fs.writeFile(resolved.filePath, Buffer.from(""));

      const result = await verifyRenderedArtifact({
        artifactId: "artifact-3",
        jobId: "job_003",
        kind: "video",
        expectedFormat: "mp4",
        resolvedOutputPath: resolved,
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "artifact_file_empty",
          message: "Rendered artifact file is empty.",
        },
      });
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("rejects directory path target", async () => {
    const tempRoot = await createTempRoot();
    const outputRoot = path.join(tempRoot, "output");
    const tempDir = path.join(tempRoot, "temp");

    try {
      await fs.mkdir(outputRoot, { recursive: true });
      await fs.mkdir(tempDir, { recursive: true });

      const resolved = resolveTestOutputPath(
        createTestPolicy(tempDir, outputRoot),
        "job_004",
        "folder",
        "mp4",
      );

      await fs.mkdir(resolved.filePath, { recursive: true });

      const result = await verifyRenderedArtifact({
        artifactId: "artifact-4",
        jobId: "job_004",
        kind: "video",
        expectedFormat: "mp4",
        resolvedOutputPath: resolved,
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "artifact_verification_failed",
          message: "Verified output target is not a regular file.",
        },
      });
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("rejects format mismatch", async () => {
    const tempRoot = await createTempRoot();
    const outputRoot = path.join(tempRoot, "output");
    const tempDir = path.join(tempRoot, "temp");

    try {
      await fs.mkdir(outputRoot, { recursive: true });
      await fs.mkdir(tempDir, { recursive: true });

      const resolved = resolveTestOutputPath(
        createTestPolicy(tempDir, outputRoot),
        "job_005",
        "clip",
        "webm",
      );

      await fs.mkdir(resolved.directoryPath, { recursive: true });
      await fs.writeFile(resolved.filePath, Buffer.from("video-bytes"));

      const result = await verifyRenderedArtifact({
        artifactId: "artifact-5",
        jobId: "job_005",
        kind: "video",
        expectedFormat: "mp4",
        resolvedOutputPath: resolved,
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "artifact_format_mismatch",
          message: "Rendered artifact file format does not match expected output format.",
        },
      });
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("rejects output path outside configured root before trusting filesystem", async () => {
    const tempRoot = await createTempRoot();
    const outsideRoot = await createTempRoot();
    const outputRoot = path.join(tempRoot, "output");
    const tempDir = path.join(tempRoot, "temp");

    try {
      await fs.mkdir(outputRoot, { recursive: true });
      await fs.mkdir(tempDir, { recursive: true });

      const outsideFile = path.join(outsideRoot, "outside.mp4");
      await fs.writeFile(outsideFile, Buffer.from("video-bytes"));

      const result = await verifyRenderedArtifact({
        artifactId: "artifact-6",
        jobId: "job_006",
        kind: "video",
        expectedFormat: "mp4",
        resolvedOutputPath: {
          rootKey: "output",
          rootPath: outputRoot,
          jobSegment: "job_006",
          directoryPath: path.join(outputRoot, "job_006"),
          fileName: "outside.mp4",
          filePath: outsideFile,
        },
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "artifact_verification_failed",
          message: "Resolved output file path must remain within the configured output root.",
        },
      });
    } finally {
      await cleanupTempRoot(tempRoot);
      await cleanupTempRoot(outsideRoot);
    }
  });

  test("buildVerifiedArtifactMetadata only returns safe metadata fields", () => {
    const artifact = buildVerifiedArtifactMetadata({
      artifactId: "artifact-7",
      jobId: "job_007",
      kind: "video",
      expectedFormat: "mp4",
      sizeBytes: 1024,
    });

    expect(artifact).toEqual({
      artifactId: "artifact-7",
      jobId: "job_007",
      kind: "video",
      format: "mp4",
      status: "available",
      createdAt: artifact.createdAt,
      sizeBytes: 1024,
    });
    expect(artifact).not.toHaveProperty("path");
    expect(artifact).not.toHaveProperty("filePath");
    expect(artifact).not.toHaveProperty("localPath");
    expect(artifact).not.toHaveProperty("url");
    expect(artifact).not.toHaveProperty("downloadUrl");
    expect(artifact).not.toHaveProperty("publicUrl");
    expect(artifact).not.toHaveProperty("signedUrl");
  });
});