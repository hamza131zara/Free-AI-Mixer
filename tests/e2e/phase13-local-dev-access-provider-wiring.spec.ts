import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase13 local-dev access provider wiring", () => {
  test("backend/app.ts imports createLocalDevArtifactAccessProvider", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("import { createLocalDevArtifactAccessProvider }");
    expect(source).toContain('from "./artifacts/localDevArtifactAccessProvider"');
  });

  test("app.ts keeps isLocalDevArtifactStreamEnabled helper", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("const isLocalDevArtifactStreamEnabled = (): boolean =>");
  });

  test('app.ts uses FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1"', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("process.env.FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
    expect(source).toContain('=== "1"');
  });

  test("app.ts keeps onVerifiedArtifactRef always passed", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef: backendDeps.onVerifiedArtifactRef");
  });

  test("app.ts conditionally passes artifactStorageRefResolver only when env gate is true", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("...(isLocalDevArtifactStreamEnabled()");
    expect(source).toContain("artifactStorageRefResolver: backendDeps.artifactStorageRefResolver");
  });

  test("app.ts conditionally passes artifactAccessProvider only when env gate is true", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("...(isLocalDevArtifactStreamEnabled()");
    expect(source).toContain("artifactAccessProvider: createLocalDevArtifactAccessProvider({");
  });

  test("app.ts does NOT pass artifactAccessProvider unconditionally", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    const conditionalIndex = source.indexOf("...(isLocalDevArtifactStreamEnabled()");
    const providerIndex = source.indexOf("artifactAccessProvider: createLocalDevArtifactAccessProvider({");

    expect(conditionalIndex).toBeGreaterThanOrEqual(0);
    expect(providerIndex).toBeGreaterThan(conditionalIndex);
  });

  test("app.ts uses createLocalDevArtifactAccessProvider", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("createLocalDevArtifactAccessProvider({");
  });

  test("provider resolveArtifactStorageRef uses backendDeps.artifactStorageRefResolver.resolve(request.jobId, request.artifactId)", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("resolveArtifactStorageRef: (request) =>");
    expect(source).toContain("backendDeps.artifactStorageRefResolver.resolve(");
    expect(source).toContain("request.jobId");
    expect(source).toContain("request.artifactId");
  });

  test("streamUrlForArtifact returns /exports/:jobId/artifacts/:artifactId/stream", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain('/exports/${encodeURIComponent(request.jobId)}/artifacts/${encodeURIComponent(request.artifactId)}/stream');
  });

  test("streamUrlForArtifact uses encodeURIComponent for jobId and artifactId", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("encodeURIComponent(request.jobId)");
    expect(source).toContain("encodeURIComponent(request.artifactId)");
  });

  test("provider isPathWithinRoot is present and does not expose local paths", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("isPathWithinRoot: (ref) =>");
    expect(source).toContain("path.relative(normalizedRoot, normalizedFile)");
    expect(source).toContain("path.relative(normalizedRoot, normalizedDirectory)");
    expect(source).not.toContain("return ref.filePath");
    expect(source).not.toContain("return ref.rootPath");
    expect(source).not.toContain("return ref.directoryPath");
  });

  test("backend/routes/exports.ts remains unchanged for access route validation", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("if (record.status !== \"success\")");
    expect(source).toContain("artifact_access_unavailable");
    expect(source).toContain("artifactAccessProvider.getArtifactAccess");
  });

  test("notConfiguredArtifactAccessProvider remains default when no provider is passed", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain(
      "options?.artifactAccessProvider ?? createNotConfiguredArtifactAccessProvider()",
    );
  });

  test("localDevArtifactAccessProvider still rejects unsafe URLs", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "localDevArtifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).toContain("if (!isSafeBackendRouteUrl(streamUrl))");
    expect(source).toContain("Artifact stream URL is not safe.");
  });

  test("no frontend changes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("local_dev_stream");
    expect(source).not.toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
  });

  test("no public contract changes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).not.toContain("filePath");
    expect(source).not.toContain("rootPath");
    expect(source).toContain("local_dev_stream");
  });

  test("no signed URL generation", async () => {
    const routeSource = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );
    const appSource = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(routeSource).not.toContain("signed");
    expect(routeSource).not.toContain("presigned");
    expect(appSource).not.toContain("signed");
    expect(appSource).not.toContain("presigned");
  });

  test("no production storage provider", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).not.toContain("s3");
    expect(source).not.toContain("gcs");
    expect(source).not.toContain("azure");
    expect(source).not.toContain("blob");
  });

  test("no auth implementation", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).not.toContain("Authorization");
    expect(source).not.toContain("Bearer ");
    expect(source).not.toContain("authenticate");
  });
});
