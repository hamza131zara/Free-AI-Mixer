import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";

test.describe("phase812 backend dependencies", () => {
  test("createBackendDependencies() returns registry, rendererAdapter, and pathPolicy", () => {
    const deps = createBackendDependencies();

    expect(deps.registry).toBeDefined();
    expect(deps.rendererAdapter).toBeDefined();
    expect(deps.pathPolicy).toBeDefined();
    expect(deps.pathPolicy.roots).toBeDefined();
    expect(deps.pathPolicy.roots.temp).toBeDefined();
    expect(deps.pathPolicy.roots.output).toBeDefined();
  });

  test("createBackendDependencies() does not start worker lifecycle", async () => {
    const deps = createBackendDependencies();

    expect(deps.registry.getByStatus("submitted").length).toBe(0);
    expect(deps.registry.getByStatus("rendering").length).toBe(0);
    expect(deps.registry.getByStatus("finalizing").length).toBe(0);
  });

  test("createBackendDependencies() does not call createRenderWorkerStartup/createRenderWorkerLoop/drainRenderWorkerOnce", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/composition/backendDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("createRenderWorkerStartup");
    expect(source).not.toContain("createRenderWorkerLoop");
    expect(source).not.toContain("drainRenderWorkerOnce");
  });

  test("createBackendDependencies() does not directly call executeRenderJob or executeSingleProcessRender", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/composition/backendDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("executeRenderJob");
    expect(source).not.toContain("executeSingleProcessRender");
  });

  test("createBackendDependencies() does not directly call registry lifecycle mutation methods", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/composition/backendDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("registry.claim(");
    expect(source).not.toContain("registry.markRendering(");
    expect(source).not.toContain("registry.markFinalizing(");
    expect(source).not.toContain("registry.markSuccess(");
    expect(source).not.toContain("registry.markError(");
  });

  test("pathPolicy exists and uses safe backend-local roots", () => {
    const deps = createBackendDependencies();

    expect(typeof deps.pathPolicy.roots.temp).toBe("string");
    expect(typeof deps.pathPolicy.roots.output).toBe("string");
    expect(deps.pathPolicy.roots.temp).toContain(".free-ai-mixer-temp");
    expect(deps.pathPolicy.roots.output).toContain(".free-ai-mixer-output");
  });

  test("dependency module source/status does not expose local path, filePath, path, url, artifactUrl, downloadUrl, or signedUrl in public route responses", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/composition/backendDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("filePath:");
    expect(source).not.toContain("path:");
    expect(source).not.toContain("url:");
    expect(source).not.toContain("downloadUrl");
    expect(source).not.toContain("signedUrl");
    expect(source).not.toContain("artifactUrl");
  });

  test("app.ts uses createBackendDependencies() for registry creation", async () => {
    const appSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/app.ts"),
      "utf8",
    );

    expect(appSource).toContain("createBackendDependencies");
  });

  test("app.ts does NOT pass rendererAdapter/pathPolicy into createExportRouter yet", async () => {
    const appSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/app.ts"),
      "utf8",
    );

    const routerCallMatch = appSource.match(/createExportRouter\([^)]+\)/);
    expect(routerCallMatch).toBeTruthy();
    const callContent = routerCallMatch![0];
    expect(callContent).not.toContain("rendererAdapter");
    expect(callContent).not.toContain("pathPolicy");
  });

  test("app.ts does not start worker lifecycle", async () => {
    const appSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/app.ts"),
      "utf8",
    );

    expect(appSource).not.toContain("createRenderWorkerStartup");
    expect(appSource).not.toContain("createRenderWorkerLoop");
    expect(appSource).not.toContain("drainRenderWorkerOnce");
    expect(appSource).not.toContain("worker");
    expect(appSource).not.toContain("start()");
  });
});