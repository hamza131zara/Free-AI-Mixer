import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase12 store wiring", () => {
  test("backendDependencies imports createInMemoryArtifactStorageRefStore", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("createInMemoryArtifactStorageRefStore");
    expect(source).toContain('from "../artifacts/inMemoryArtifactStorageRefStore"');
  });

  test("BackendDependencies exposes artifactStorageRefStore", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("artifactStorageRefStore: ArtifactStorageRefStore");
  });

  test("BackendDependencies exposes onVerifiedArtifactRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef:");
    expect(source).toContain("VerifiedArtifactRefPayload");
  });

  test("createBackendDependencies creates an in-memory store instance", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("createInMemoryArtifactStorageRefStore()");
    expect(source).toContain("const artifactStorageRefStore = createInMemoryArtifactStorageRefStore()");
  });

  test("onVerifiedArtifactRef stores payload.storageRef by jobId/artifactId", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("artifactStorageRefStore.set(jobId, artifactId, storageRef)");
  });

  test("onVerifiedArtifactRef is best-effort and wraps store.set in try/catch", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("try {");
    expect(source).toContain("artifactStorageRefStore.set");
    expect(source).toContain("} catch {");
    expect(source).toContain("// Non-blocking");
  });

  test("executeRenderJob input includes optional onVerifiedArtifactRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "executeRenderJob.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef?:");
    expect(source).toContain("VerifiedArtifactRefPayload");
  });

  test("executeRenderJob passes onVerifiedArtifactRef to executeSingleProcessRender", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "executeRenderJob.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef: input.onVerifiedArtifactRef");
  });

  test("executeRenderJob does not import inMemoryArtifactStorageRefStore", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "executeRenderJob.ts"),
      "utf8",
    );

    expect(source).not.toContain("inMemoryArtifactStorageRefStore");
    expect(source).not.toContain("ArtifactStorageRefStore");
  });

  test("singleProcessRenderHarness does not import inMemoryArtifactStorageRefStore", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "renderer", "singleProcessRenderHarness.ts"),
      "utf8",
    );

    expect(source).not.toContain("inMemoryArtifactStorageRefStore");
    expect(source).not.toContain("ArtifactStorageRefStore");
  });

  test("backend/app.ts unchanged: does not pass artifactAccessProvider/artifactStorageRefResolver/onVerifiedArtifactRef into createExportRouter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    // createExportRouter should still be called with just registry
    expect(source).toContain("createExportRouter(backendDeps.registry)");
    expect(source).not.toContain("artifactAccessProvider");
    expect(source).not.toContain("artifactStorageRefResolver");
    expect(source).not.toContain("onVerifiedArtifactRef");
  });

  test("backend/routes/exports.ts unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Still has stream route but not wired to store
    expect(source).toContain('"/exports/:jobId/artifacts/:artifactId/stream"');
    // Does not use the callback
    expect(source).not.toContain("onVerifiedArtifactRef");
  });

  test("backend/workers/renderWorker.ts unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorker.ts"),
      "utf8",
    );

    // renderWorker does not pass onVerifiedArtifactRef to executeRenderJob
    expect(source).not.toContain("onVerifiedArtifactRef");
  });

  test("no provider/app/route wiring added", async () => {
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

    // No local dev provider (Phase 12-N adds resolver to deps, not to app/route/provider)
    expect(depsSource).not.toContain("createLocalDevArtifactAccessProvider");
    // Resolver is in backendDependencies (Phase 12-N) but NOT wired to app/route
    // So app should not pass resolver to router
    expect(appSource).not.toContain("artifactAccessProvider");
    expect(appSource).not.toContain("artifactStorageRefResolver");
    // Route options should not have provider/resolver
    expect(routeSource).not.toContain("artifactAccessProvider:");
    expect(routeSource).not.toContain("artifactStorageRefResolver:");
  });

  test("no env gating added", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    // No FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM logic
    expect(source).not.toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
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

  test("no frontend changes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("artifactStorageRefStore");
    expect(source).not.toContain("onVerifiedArtifactRef");
    expect(source).not.toContain("BackendArtifactMetadata");
  });
});