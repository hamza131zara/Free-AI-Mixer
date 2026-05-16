import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { InternalArtifactStorageRef } from "../../backend/artifacts/internalArtifactStorageRef";
import { createLocalDevArtifactAccessProvider, type LocalDevProviderOptions } from "../../backend/artifacts/localDevArtifactAccessProvider";

test.describe("phase11 local dev stream provider", () => {
  test("localDevArtifactAccessProvider.ts exists", async () => {
    await fs.access(
      path.join(process.cwd(), "backend", "artifacts", "localDevArtifactAccessProvider.ts"),
    );
  });

  test("createLocalDevArtifactAccessProvider is exported", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "localDevArtifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).toContain("export const createLocalDevArtifactAccessProvider");
  });

  test("factory returns object with getArtifactAccess", async () => {
    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => undefined,
      streamUrlForArtifact: () => "/exports/test/artifacts/test/stream",
      isPathWithinRoot: () => false,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    expect(typeof provider.getArtifactAccess).toBe("function");
  });

  test("provider returns artifact_access_ready when ref exists, path is safe, and URL is safe", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/safe/root/job-segment/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/safe/root/job-segment",
    };

    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
      sizeBytes: 1024,
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "/exports/job-1/artifacts/artifact-1/stream",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    expect(result.kind).toBe("artifact_access_ready");
  });

  test("ready response uses access.kind local_dev_stream", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/safe/root/job-segment/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/safe/root/job-segment",
    };

    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "/exports/job-1/artifacts/artifact-1/stream",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    expect(result.kind).toBe("artifact_access_ready");
    expect((result as any).access.kind).toBe("local_dev_stream");
  });

  test("ready response url is backend route URL, not local file path", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/safe/root/job-segment/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/safe/root/job-segment",
    };

    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "/exports/job-1/artifacts/artifact-1/stream",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    const access = (result as any).access;
    expect(access.url).toBe("/exports/job-1/artifacts/artifact-1/stream");
    expect(access.url).not.toContain("file:");
    expect(access.url).not.toContain("C:");
    expect(access.url).not.toContain("\\");
    expect(access.url).not.toContain("..");
  });

  test("ready response does not contain filePath/rootPath/directoryPath/storageKey", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/safe/root/job-segment/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/safe/root/job-segment",
    };

    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "/exports/job-1/artifacts/artifact-1/stream",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("filePath");
    expect(resultStr).not.toContain("rootPath");
    expect(resultStr).not.toContain("directoryPath");
    expect(resultStr).not.toContain("storageKey");
  });

  test("provider returns artifact_not_found when ref is missing", async () => {
    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => undefined,
      streamUrlForArtifact: () => "/exports/job-1/artifacts/artifact-1/stream",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    expect(result.kind).toBe("artifact_access_unavailable");
    expect((result as any).reason).toBe("artifact_not_found");
  });

  test("provider returns artifact_not_ready when path is outside allowed root", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/unsafe/path/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/unsafe/path",
    };

    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "/exports/job-1/artifacts/artifact-1/stream",
      isPathWithinRoot: () => false,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    expect(result.kind).toBe("artifact_access_unavailable");
    expect((result as any).reason).toBe("artifact_not_ready");
  });

  test("provider returns artifact_not_found when request.artifact is missing", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/safe/root/job-segment/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/safe/root/job-segment",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "/exports/job-1/artifacts/artifact-1/stream",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: undefined,
    });

    expect(result.kind).toBe("artifact_access_unavailable");
    expect((result as any).reason).toBe("artifact_not_found");
  });

  test("provider rejects file:// stream URL", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/safe/root/job-segment/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/safe/root/job-segment",
    };

    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "file:///safe/root/job-segment/output.mp4",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    expect(result.kind).toBe("artifact_access_unavailable");
    expect((result as any).reason).toBe("artifact_not_ready");
  });

  test("provider rejects Windows path-like stream URL", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/safe/root/job-segment/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/safe/root/job-segment",
    };

    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "C:\\temp\\output.mp4",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    expect(result.kind).toBe("artifact_access_unavailable");
    expect((result as any).reason).toBe("artifact_not_ready");
  });

  test("provider rejects URL containing ..", async () => {
    const mockRef: InternalArtifactStorageRef = {
      filePath: "/safe/root/job-segment/output.mp4",
      rootPath: "/safe/root",
      jobSegment: "job-segment",
      directoryPath: "/safe/root/job-segment",
    };

    const mockArtifact = {
      artifactId: "artifact-1",
      jobId: "job-1",
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: "2026-01-01T00:00:00Z",
    };

    const mockOptions: LocalDevProviderOptions = {
      resolveArtifactStorageRef: () => mockRef,
      streamUrlForArtifact: () => "/exports/../etc/passwd",
      isPathWithinRoot: () => true,
    };

    const provider = createLocalDevArtifactAccessProvider(mockOptions);
    const result = await provider.getArtifactAccess({
      jobId: "job-1",
      artifactId: "artifact-1",
      artifact: mockArtifact as any,
    });

    expect(result.kind).toBe("artifact_access_unavailable");
    expect((result as any).reason).toBe("artifact_not_ready");
  });

  test("source does not import backend/routes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "localDevArtifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/routes");
    expect(source).not.toContain("../routes");
  });

  test("source does not import backend/registry", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "localDevArtifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/registry");
    expect(source).not.toContain("../registry");
  });

  test("source does not import backend/renderer", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "localDevArtifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/renderer");
    expect(source).not.toContain("../renderer");
  });

  test("source does not import fs or path", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "localDevArtifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("from \"node:fs\"");
    expect(source).not.toContain("from \"node:path\"");
  });

  test("backend/routes/exports.ts unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).not.toContain("localDevArtifactAccessProvider");
    expect(source).not.toContain("createLocalDevArtifactAccessProvider");
  });

  test("frontend files unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("localDevArtifactAccessProvider");
  });

  test("stream route exists after Phase 11-M while provider remains route-neutral", async () => {
  const providerSource = await fs.readFile(
    path.join(
      process.cwd(),
      "backend",
      "artifacts",
      "localDevArtifactAccessProvider.ts",
    ),
    "utf8",
  );

  const routeSource = await fs.readFile(
    path.join(process.cwd(), "backend", "routes", "exports.ts"),
    "utf8",
  );

  // Phase 11-M intentionally added the stream route.
  expect(routeSource).toContain("/exports/:jobId/artifacts/:artifactId/stream");
  expect(routeSource).toContain("artifactStorageRefResolver");

  // Provider must remain route-neutral.
  expect(providerSource).not.toContain("../routes");
  expect(providerSource).not.toContain("backend/routes");
  expect(providerSource).not.toContain("createExportRouter");

  // Stream route must remain safe: no static directory serving or signed URL generation.
  expect(routeSource).not.toContain("express.static");
  expect(routeSource).not.toContain("getSignedUrl");
  expect(routeSource).not.toContain("createSigned");
  expect(routeSource).not.toContain("presign");
});
});