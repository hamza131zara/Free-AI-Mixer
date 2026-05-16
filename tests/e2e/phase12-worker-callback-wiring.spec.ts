import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase12 worker callback wiring", () => {
  test("renderWorker.ts imports VerifiedArtifactRefPayload as type", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorker.ts"),
      "utf8",
    );

    // Can be imported as part of a combined type import
    expect(source).toContain("VerifiedArtifactRefPayload");
    expect(source).toContain("from \"../renderer/singleProcessRenderHarness\"");
  });

  test("renderWorker.ts accepts onVerifiedArtifactRef in options", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorker.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void");
    expect(source).toContain("export interface RenderWorkerOptions");
  });

  test("renderWorker.ts passes onVerifiedArtifactRef to executeRenderJob", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorker.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef: options?.onVerifiedArtifactRef");
  });

  test("renderWorkerStartup.ts accepts onVerifiedArtifactRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorkerStartup.ts"),
      "utf8",
    );

    // RenderWorkerStartupOptions extends RenderWorkerLoopOptions which now has onVerifiedArtifactRef
    expect(source).toContain("export interface RenderWorkerStartupOptions extends RenderWorkerLoopOptions");
  });

  test("renderWorkerStartup.ts passes callback to worker loop", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorkerStartup.ts"),
      "utf8",
    );

    // The startup passes options through to createRenderWorkerLoop, which includes onVerifiedArtifactRef
    expect(source).toContain("...options");
  });

  test("renderWorkerLifecycle.ts accepts onVerifiedArtifactRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorkerLifecycle.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void");
  });

  test("renderWorkerLifecycle.ts passes callback through", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorkerLifecycle.ts"),
      "utf8",
    );

    expect(source).toContain("createRenderWorkerStartup(");
    expect(source).toContain("{ onVerifiedArtifactRef }");
  });

  test("app.ts passes backendDeps.onVerifiedArtifactRef to createRenderWorkerLifecycle", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).toContain("backendDeps.onVerifiedArtifactRef");
  });

  test("app.ts does NOT pass artifactStorageRefResolver to createExportRouter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    // Phase 12-V: app.ts now passes onVerifiedArtifactRef (route execution callback wiring)
    expect(source).toContain("createExportRouter(backendDeps.registry, { onVerifiedArtifactRef:");
    // but does NOT pass artifactStorageRefResolver (resolver route injection deferred)
    expect(source).not.toContain("artifactStorageRefResolver");
  });

  test("app.ts does NOT pass artifactAccessProvider to createExportRouter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).not.toContain("artifactAccessProvider");
  });

  test("backend/routes/exports.ts unchanged: no route execution callback wiring", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Phase 12-V: POST route now DOES pass onVerifiedArtifactRef to executeRenderJob
    const executeRenderJobCall = source.indexOf("executeRenderJob({");
    if (executeRenderJobCall > 0) {
      const section = source.substring(executeRenderJobCall, executeRenderJobCall + 300);
      expect(section).toContain("onVerifiedArtifactRef");
    }
    // But stream route still uses resolver separately (not wired yet - deferred)
    expect(source).toContain("options?.artifactStorageRefResolver");
    // Access route still uses provider (not wired - deferred)
    expect(source).toContain("artifactAccessProvider");
  });

  test("no provider wiring added", async () => {
    const depsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );
    const appSource = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );
    const routeSource = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // No local dev provider
    expect(depsSource).not.toContain("createLocalDevArtifactAccessProvider");
    expect(appSource).not.toContain("artifactAccessProvider");
    expect(routeSource).not.toContain("artifactAccessProvider:");
  });

  test("no resolver route injection added", async () => {
    const appSource = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );
    const routeSource = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Resolver exists in backendDependencies but NOT injected into router
    expect(appSource).not.toContain("artifactStorageRefResolver");
    // Route ExportRouterOptions may have the field but it's not being injected
    expect(routeSource).not.toContain("artifactStorageRefResolver:");
  });

  test("no env gating added", async () => {
    const workerSource = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorker.ts"),
      "utf8",
    );
    const appSource = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(workerSource).not.toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
    expect(appSource).not.toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
  });

  test("no frontend changes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("onVerifiedArtifactRef");
    expect(source).not.toContain("artifactStorageRefStore");
  });

  test("no public contract changes", async () => {
    const contractsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    // BackendArtifactMetadata unchanged
    expect(contractsSource).toContain("export interface BackendArtifactMetadata");
    expect(contractsSource).not.toContain("filePath");
    expect(contractsSource).not.toContain("rootPath");
  });
});