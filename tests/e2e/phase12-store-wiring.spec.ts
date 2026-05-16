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

  test("backend/app.ts does not pass artifactAccessProvider/artifactStorageRefResolver to createExportRouter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    // Phase 12-V: app.ts now passes onVerifiedArtifactRef to createExportRouter
    expect(source).toContain("createExportRouter(backendDeps.registry, { onVerifiedArtifactRef:");
    // but does NOT pass artifactAccessProvider or artifactStorageRefResolver (deferred)
    expect(source).not.toContain("artifactAccessProvider");
    expect(source).not.toContain("artifactStorageRefResolver");
  });

  test("backend/routes/exports.ts unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Still has stream route (not wired to store - resolver injection deferred)
    expect(source).toContain('"/exports/:jobId/artifacts/:artifactId/stream"');
    // Phase 12-V: POST route now uses callback for ref registration
    expect(source).toContain("onVerifiedArtifactRef: options?.onVerifiedArtifactRef");
    // Access route still returns artifact_access_unavailable
    expect(source).toContain('"/exports/:jobId/artifacts/:artifactId/access"');
  });

  test("backend/workers/renderWorker.ts accepts onVerifiedArtifactRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorker.ts"),
      "utf8",
    );

    // Phase 12-R: renderWorker now accepts callback in options
    expect(source).toContain("onVerifiedArtifactRef?:");
    expect(source).toContain("VerifiedArtifactRefPayload");
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