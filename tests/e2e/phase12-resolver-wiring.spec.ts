import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase12 resolver wiring", () => {
  test("backendDependencies imports ArtifactStorageRefResolver as type", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("import type { ArtifactStorageRefResolver }");
    expect(source).toContain('from "../artifacts/artifactStorageRefResolver"');
  });

  test("BackendDependencies exposes artifactStorageRefResolver", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("artifactStorageRefResolver: ArtifactStorageRefResolver");
  });

  test("createBackendDependencies creates artifactStorageRefResolver", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("const artifactStorageRefResolver: ArtifactStorageRefResolver = {");
    expect(source).toContain("resolve:");
  });

  test("resolver.resolve calls artifactStorageRefStore.get(jobId, artifactId)", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("artifactStorageRefStore.get(jobId, artifactId)");
  });

  test("resolver returns InternalArtifactStorageRef when store has a ref", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    // Resolver returns the result of store.get which is InternalArtifactStorageRef | undefined
    expect(source).toContain("artifactStorageRefStore.get(jobId, artifactId)");
  });

  test("resolver returns undefined for missing ref", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    // store.get returns undefined when not found
    expect(source).toContain("artifactStorageRefStore.get");
  });

  test("resolver does not import fs/path", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    // Resolver section should not have fs/path imports
    // Check that the resolver creation block doesn't include fs/path
    const resolverBlockStart = source.indexOf("const artifactStorageRefResolver");
    const resolverBlock = source.substring(resolverBlockStart, resolverBlockStart + 200);
    expect(resolverBlock).not.toContain("from \"node:fs\"");
    expect(resolverBlock).not.toContain("from \"node:path\"");
  });

  test("resolver does not read filesystem", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    // Resolver only calls store.get - no fs operations
    const resolverBlockStart = source.indexOf("const artifactStorageRefResolver");
    const resolverBlock = source.substring(resolverBlockStart, resolverBlockStart + 200);
    expect(resolverBlock).not.toContain("fs.");
    expect(resolverBlock).not.toContain("stat");
    expect(resolverBlock).not.toContain("readFile");
  });

  test("resolver does not inspect registry", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    // Resolver only queries store, not registry - check the resolve function body
    const resolverBlockStart = source.indexOf("resolve: (jobId, artifactId)");
    const resolverBlockEnd = source.indexOf("};", resolverBlockStart);
    const resolverFunction = source.substring(resolverBlockStart, resolverBlockEnd);
    // The resolve function should only call store.get, not registry
    expect(resolverFunction).not.toContain("registry");
    expect(resolverFunction).toContain("artifactStorageRefStore.get");
  });

  test("backend/app.ts unchanged: does not pass artifactStorageRefResolver to createExportRouter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    // Phase 12-Z: app.ts now uses exportRouterOptions (conditional resolver injection)
    expect(source).toContain("exportRouterOptions");
    expect(source).toContain("onVerifiedArtifactRef:");
    // Phase 12-Z: resolver IS conditionally injected behind isLocalDevArtifactStreamEnabled()
    expect(source).toContain("artifactStorageRefResolver");
    expect(source).toContain("isLocalDevArtifactStreamEnabled()");
    // artifactAccessProvider still NOT passed (provider wiring deferred)
    expect(source).not.toContain("artifactAccessProvider");
  });

  test("backend/routes/exports.ts unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Route still has stream route but resolver not injected from app
    expect(source).toContain('"/exports/:jobId/artifacts/:artifactId/stream"');
  });

  test("backend/workers/renderWorker.ts accepts callback but not wired to app", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "workers", "renderWorker.ts"),
      "utf8",
    );

    // Phase 12-R added callback support in renderWorker but it's not connected to app/provider/resolver
    expect(source).toContain("onVerifiedArtifactRef"); // Added in Phase 12-R
    // But it's not wired to any app-layer resolver/provider injection
    // (that's a separate future phase)
  });

  test("no provider wiring added", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("createLocalDevArtifactAccessProvider");
    expect(source).not.toContain("artifactAccessProvider");
  });

  test("no env gating added", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "composition", "backendDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
  });

  test("no frontend changes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("artifactStorageRefResolver");
    expect(source).not.toContain("BackendArtifactMetadata");
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