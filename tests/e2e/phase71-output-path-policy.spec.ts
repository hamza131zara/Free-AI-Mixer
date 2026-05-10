import { expect, test } from "@playwright/test";
import fs from "node:fs";
import {
  RenderOutputPathError,
  createRenderOutputTarget,
  resolveRenderOutputPath,
  sanitizePathSegment,
  validateSafePathSegment,
} from "../../backend/renderer/outputPathPolicy";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";

const policy = {
  roots: {
    temp: "C:\\renderer-temp-root",
    output: "C:\\renderer-output-root",
  },
  maxSegmentLength: 64,
} as const;

test.describe("Phase 7.1 output path policy", () => {
  test("safe per-job temp path is derived under temp root", () => {
    const resolved = resolveRenderOutputPath(
      policy,
      createRenderOutputTarget("temp", "job_123", "timeline_main", "mp4"),
    );
    expect(resolved.rootKey).toBe("temp");
    expect(resolved.directoryPath.startsWith(resolved.rootPath)).toBe(true);
    expect(resolved.fileName).toBe("timeline_main.mp4");
  });

  test("safe per-job output path is derived under output root", () => {
    const resolved = resolveRenderOutputPath(
      policy,
      createRenderOutputTarget("output", "job_abc", "final_cut", "webm"),
    );
    expect(resolved.rootKey).toBe("output");
    expect(resolved.directoryPath.startsWith(resolved.rootPath)).toBe(true);
    expect(resolved.fileName).toBe("final_cut.webm");
  });

  test("unsafe jobId/path segment with '..' is rejected", () => {
    expect(() => validateSafePathSegment("..")).toThrow(RenderOutputPathError);
    expect(() =>
      resolveRenderOutputPath(policy, {
        rootKey: "temp",
        jobId: "..",
        baseName: "x",
        extension: "mp4",
      }),
    ).toThrow(RenderOutputPathError);
  });

  test("Windows-style traversal is rejected", () => {
    expect(() => validateSafePathSegment("..\\evil")).toThrow(RenderOutputPathError);
  });

  test("absolute path injection is rejected", () => {
    expect(() => validateSafePathSegment("/etc/passwd")).toThrow(RenderOutputPathError);
  });

  test("Windows drive-letter injection is rejected", () => {
    expect(() => validateSafePathSegment("C:\\evil")).toThrow(RenderOutputPathError);
  });

  test("UNC-style path injection is rejected", () => {
    expect(() => validateSafePathSegment("\\\\server\\share")).toThrow(
      RenderOutputPathError,
    );
  });

  test("URL-like values are rejected", () => {
    expect(() => validateSafePathSegment("https://example.com")).toThrow(
      RenderOutputPathError,
    );
  });

  test("reserved Windows names are rejected where practical", () => {
    expect(() => validateSafePathSegment("CON")).toThrow(RenderOutputPathError);
    expect(() => validateSafePathSegment("LPT1")).toThrow(RenderOutputPathError);
  });

  test("trailing spaces/dots are rejected where practical", () => {
    expect(() => validateSafePathSegment("name ")).toThrow(RenderOutputPathError);
    expect(() => validateSafePathSegment("name.")).toThrow(RenderOutputPathError);
  });

  test("resolved path must stay under selected root", () => {
    expect(() =>
      resolveRenderOutputPath(policy, {
        rootKey: "output",
        jobId: "..\\x",
        baseName: "safe",
        extension: "mp4",
      }),
    ).toThrow(RenderOutputPathError);
  });

  test("helper does not create files", () => {
    const originalWriteFileSync = fs.writeFileSync;
    let writeCalled = false;
    (fs as unknown as { writeFileSync: typeof fs.writeFileSync }).writeFileSync = (() => {
      writeCalled = true;
      throw new Error("writeFileSync should not be called");
    }) as typeof fs.writeFileSync;

    try {
      resolveRenderOutputPath(
        policy,
        createRenderOutputTarget("temp", "job_no_write", "artifact", "mp4"),
      );
      expect(writeCalled).toBe(false);
    } finally {
      (fs as unknown as { writeFileSync: typeof fs.writeFileSync }).writeFileSync =
        originalWriteFileSync;
    }
  });

  test("helper does not create directories", () => {
    const originalMkdirSync = fs.mkdirSync;
    let mkdirCalled = false;
    (fs as unknown as { mkdirSync: typeof fs.mkdirSync }).mkdirSync = (() => {
      mkdirCalled = true;
      throw new Error("mkdirSync should not be called");
    }) as typeof fs.mkdirSync;

    try {
      resolveRenderOutputPath(
        policy,
        createRenderOutputTarget("output", "job_no_mkdir", "artifact", "mp4"),
      );
      expect(mkdirCalled).toBe(false);
    } finally {
      (fs as unknown as { mkdirSync: typeof fs.mkdirSync }).mkdirSync = originalMkdirSync;
    }
  });

  test("helper does not create artifact metadata", () => {
    const resolved = resolveRenderOutputPath(
      policy,
      createRenderOutputTarget("output", "job_no_artifacts", "artifact", "mp4"),
    ) as unknown as Record<string, unknown>;
    expect(resolved.artifacts).toBeUndefined();
  });

  test("helper does not create URL/downloadUrl", () => {
    const resolved = resolveRenderOutputPath(
      policy,
      createRenderOutputTarget("output", "job_no_urls", "artifact", "mp4"),
    ) as unknown as Record<string, unknown>;
    expect(resolved.url).toBeUndefined();
    expect(resolved.downloadUrl).toBeUndefined();
  });

  test("helper does not trigger lifecycle transitions", () => {
    const registry = new InMemoryExportJobRegistry();
    const job = registry.create({
      requestId: "phase71-lifecycle",
      timelineId: "timeline-phase71",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    resolveRenderOutputPath(
      policy,
      createRenderOutputTarget("temp", sanitizePathSegment(job.jobId), "artifact", "mp4"),
    );
    expect(registry.getById(job.jobId)?.status).toBe("submitted");
  });
});
