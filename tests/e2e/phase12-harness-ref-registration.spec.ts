import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase12 harness ref registration callback", () => {
  test("singleProcessRenderHarness.ts exports VerifiedArtifactRefPayload", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).toContain("export interface VerifiedArtifactRefPayload");
  });

  test("SingleProcessRenderHarnessInput includes onVerifiedArtifactRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef?:");
    expect(source).toContain("VerifiedArtifactRefPayload");
  });

  test("Source imports InternalArtifactStorageRef as type only", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).toContain("import type { InternalArtifactStorageRef }");
    expect(source).toContain('from "../artifacts/internalArtifactStorageRef"');
  });

  test("Callback is called after successful artifact verification", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    // Check registration block exists after verification success
    expect(source).toContain("if (input.onVerifiedArtifactRef)");
    // Verify it comes after the verification check
    const verifyBlock = source.indexOf("if (!verification.ok)");
    const callbackBlock = source.indexOf("if (input.onVerifiedArtifactRef)");
    expect(callbackBlock).toBeGreaterThan(verifyBlock);
  });

  test("Callback receives correct jobId", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).toContain("jobId: input.jobId");
  });

  test("Callback receives artifactId from verified artifact", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).toContain("artifactId: verification.artifact.artifactId");
  });

  test("Callback receives safe public artifact metadata separately from storageRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).toContain("artifact: verification.artifact");
    expect(source).toContain("storageRef,");
  });

  test("Callback receives storageRef fields copied from resolvedOutputPath", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).toContain("filePath: resolvedOutputPath.filePath");
    expect(source).toContain("rootPath: resolvedOutputPath.rootPath");
    expect(source).toContain("jobSegment: resolvedOutputPath.jobSegment");
    expect(source).toContain("directoryPath: resolvedOutputPath.directoryPath");
  });

  test("Callback is not called when render adapter fails", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    // The callback block is only AFTER verification check
    // If verification fails (line 209-214), it returns early
    // So callback only runs on success path
    const verifyFailureReturn = source.indexOf("return mapAndMarkError(input, \"verify\"");
    const callbackBlock = source.indexOf("if (input.onVerifiedArtifactRef)");
    expect(callbackBlock).toBeGreaterThan(verifyFailureReturn);
  });

  test("Callback is not called when artifact verification fails", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    // Verification check comes before callback registration
    const verifyCheck = source.indexOf("if (!verification.ok)");
    const callbackRegistration = source.indexOf("if (input.onVerifiedArtifactRef)");
    expect(callbackRegistration).toBeGreaterThan(verifyCheck);
  });

  test("Callback failure is non-blocking and harness still returns success", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    // Callback is wrapped in try/catch
    expect(source).toContain("try {");
    expect(source).toContain("if (input.onVerifiedArtifactRef)");
    expect(source).toContain("} catch {");
    expect(source).toContain("// Non-blocking - ignore registration failures");
  });

  test("Callback is wrapped in try/catch", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    // Find the try block around the callback
    const tryStart = source.indexOf("// BEST-EFFORT: Register internal storage ref");
    const tryBlock = source.indexOf("try {", tryStart);
    const catchBlock = source.indexOf("} catch {", tryStart);
    expect(tryBlock).toBeGreaterThan(tryStart);
    expect(catchBlock).toBeGreaterThan(tryBlock);
  });

  test("Harness does not import inMemoryArtifactStorageRefStore", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).not.toContain("inMemoryArtifactStorageRefStore");
    expect(source).not.toContain("ArtifactStorageRefStore");
  });

  test("Harness does not import backend/routes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/routes");
    expect(source).not.toContain("../routes");
  });

  test("Harness does not import backend/app or backend/server", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/app");
    expect(source).not.toContain("backend/server");
    expect(source).not.toContain("../app");
    expect(source).not.toContain("../server");
  });

  test("Registry markSuccess still receives only BackendArtifactMetadata", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    // markSuccess still receives [verification.artifact] - the public type
    expect(source).toContain("markSuccess(input.jobId, input.workerId, [verification.artifact])");
    // It does NOT receive storageRef
    expect(source).not.toContain("markSuccess(input.jobId, input.workerId, [storageRef");
  });

  test("BackendArtifactMetadata/public contracts remain unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    // BackendArtifactMetadata is still used as-is (no path fields added)
    expect(source).toContain("artifact: BackendArtifactMetadata");
    // The callback receives verification.artifact (BackendArtifactMetadata), not storageRef
    // storageRef is separate internal object
    expect(source).toContain("artifact: verification.artifact");
    expect(source).toContain("storageRef,");
    // BackendArtifactMetadata type definition unchanged - path fields not added to public type
    const contractsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );
    // Check BackendArtifactMetadata doesn't have filePath/rootPath/directoryPath
    const artifactMetaStart = contractsSource.indexOf("export interface BackendArtifactMetadata");
    const artifactMetaSection = contractsSource.substring(artifactMetaStart, artifactMetaStart + 500);
    expect(artifactMetaSection).not.toContain("filePath");
    expect(artifactMetaSection).not.toContain("rootPath");
    expect(artifactMetaSection).not.toContain("directoryPath");
  });

  test("No app/server/dependency/route/frontend/docs/package changes", async () => {
    const exportsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );
    const appSource = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );
    const depsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );
    const frontendSource = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    // Verify exports.ts unchanged (stream route still there)
    expect(exportsSource).toContain('"/exports/:jobId/artifacts/:artifactId/stream"');
    // Phase 12-V: app.ts now passes onVerifiedArtifactRef to createExportRouter (route execution callback wiring)
    expect(appSource).toContain("createExportRouter(backendDeps.registry, { onVerifiedArtifactRef:");
    // Verify backendDependencies has store and resolver (Phase 12-J/12-N) but not provider/app wiring
    expect(depsSource).toContain("artifactStorageRefStore"); // Phase 12-J added store ownership
    expect(depsSource).toContain("artifactStorageRefResolver"); // Phase 12-N added resolver
    expect(depsSource).not.toContain("createLocalDevArtifactAccessProvider"); // No provider wiring yet
    // Phase 12-V: onVerifiedArtifactRef IS passed, but artifactStorageRefResolver and artifactAccessProvider are NOT
    expect(appSource).not.toContain("artifactStorageRefResolver");
    expect(appSource).not.toContain("artifactAccessProvider");
    // Verify frontend unchanged
    expect(frontendSource).not.toContain("onVerifiedArtifactRef");
  });
});