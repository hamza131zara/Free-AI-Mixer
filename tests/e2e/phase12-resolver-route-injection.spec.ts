import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase12 resolver route injection", () => {
  test("backend/app.ts defines isLocalDevArtifactStreamEnabled", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("isLocalDevArtifactStreamEnabled");
    expect(source).toContain("(): boolean");
  });

  test("Helper checks FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("process.env.FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
  });

  test("Helper requires exact value 1", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain('=== "1"');
  });

  test("app.ts keeps onVerifiedArtifactRef passed to createExportRouter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef:");
    expect(source).toContain("backendDeps.onVerifiedArtifactRef");
  });

  test("app.ts does NOT pass artifactStorageRefResolver unconditionally", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    // Should use conditional spread pattern
    expect(source).toContain("...(isLocalDevArtifactStreamEnabled()");
    expect(source).toContain("?: typeof backendDeps.artifactStorageRefResolver");
  });

  test("app.ts conditionally passes backendDeps.artifactStorageRefResolver when env helper is true", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("isLocalDevArtifactStreamEnabled()");
    expect(source).toContain("artifactStorageRefResolver: backendDeps.artifactStorageRefResolver");
  });

  test("app.ts only passes artifactAccessProvider inside the local-dev env gate", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    const conditionalIndex = source.indexOf("...(isLocalDevArtifactStreamEnabled()");
    const providerAssignmentIndex = source.indexOf(
      "artifactAccessProvider: createLocalDevArtifactAccessProvider({",
    );

    expect(conditionalIndex).toBeGreaterThanOrEqual(0);
    expect(providerAssignmentIndex).toBeGreaterThan(conditionalIndex);
  });

  test("backend/routes/exports.ts remains unchanged for stream validation behavior", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Stream route still checks resolver
    expect(source).toContain("if (!options?.artifactStorageRefResolver)");
    // Still returns 501 when not configured
    expect(source).toContain("stream_not_configured");
  });

  test("stream route still has stream_not_configured path when resolver missing", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("response.status(501).json(");
    expect(source).toContain("stream_not_configured");
  });

  test("stream route still uses artifactStorageRefResolver.resolve(jobId, artifactId)", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("options.artifactStorageRefResolver.resolve(jobId, artifactId)");
  });

  test("stream route still performs fs.realpath on rootPath and filePath", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("await fs.realpath(storageRef.rootPath)");
    expect(source).toContain("await fs.realpath(storageRef.filePath)");
  });

  test("stream route still performs root containment validation", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("path.relative(normalizedRoot, normalizedFile)");
    expect(source).toContain("!relative.startsWith(\"..\")");
    expect(source).toContain("isInsideRoot");
  });

  test("stream route still performs stat.isFile validation", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("await fs.stat(realFilePath)");
    expect(source).toContain("stat.isFile()");
  });

  test("no local path fields are returned in stream error responses", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Error responses should not contain filePath/rootPath in the JSON
    // Check the error responses are generic
    const errorResponses = source.match(/code: "[^"]+",[\s\S]*?message: "[^"]+"/g) || [];
    const hasPathLeaks = errorResponses.some(
      (r) => r.includes("filePath") || r.includes("rootPath") || r.includes("directoryPath") || r.includes("jobSegment")
    );
    expect(hasPathLeaks).toBe(false);
  });

  test("access route remains not-configured/default behavior", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Access route still uses provider
    expect(source).toContain("artifactAccessProvider.getArtifactAccess");
    // Still returns artifact_access_unavailable when not configured
    expect(source).toContain("artifact_access_unavailable");
  });

  test("no frontend changes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("artifactStorageRefResolver");
    expect(source).not.toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
  });

  test("no public contract changes", async () => {
    const contractsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(contractsSource).toContain("export interface BackendArtifactMetadata");
    expect(contractsSource).not.toContain("filePath");
    expect(contractsSource).not.toContain("rootPath");
  });

  test("no signed URL generation", async () => {
    const exportsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(exportsSource).not.toContain("signed");
    expect(exportsSource).not.toContain("presigned");
  });
});
