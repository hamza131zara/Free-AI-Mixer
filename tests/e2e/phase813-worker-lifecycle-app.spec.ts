import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createRenderWorkerLifecycle } from "../../backend/workers/renderWorkerLifecycle";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";

test.describe("phase813 worker lifecycle app wiring", () => {
  test("createRenderWorkerLifecycle returns controller with init/shutdown/isRunning/getStatus", () => {
    const deps = createBackendDependencies();
    const lifecycle = createRenderWorkerLifecycle(
      deps.registry,
      deps.rendererAdapter,
      deps.pathPolicy,
    );

    expect(typeof lifecycle.init).toBe("function");
    expect(typeof lifecycle.shutdown).toBe("function");
    expect(typeof lifecycle.isRunning).toBe("function");
    expect(typeof lifecycle.getStatus).toBe("function");
  });

  test("lifecycle does not auto-start before init()", () => {
    const deps = createBackendDependencies();
    const lifecycle = createRenderWorkerLifecycle(
      deps.registry,
      deps.rendererAdapter,
      deps.pathPolicy,
    );

    expect(lifecycle.isRunning()).toBe(false);
  });

  test("init() does not start worker when env flags are missing", () => {
    const originalStartup = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    const originalLoop = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;

    const deps = createBackendDependencies();
    const lifecycle = createRenderWorkerLifecycle(
      deps.registry,
      deps.rendererAdapter,
      deps.pathPolicy,
    );

    lifecycle.init();

    try {
      expect(lifecycle.isRunning()).toBe(false);
      expect(lifecycle.getStatus().startupStatus.startupEnabled).toBe(false);
    } finally {
      if (originalStartup !== undefined) {
        process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalStartup;
      }
      if (originalLoop !== undefined) {
        process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoop;
      }
      lifecycle.shutdown();
    }
  });

  test("init() starts worker only when FREE_AI_MIXER_ENABLE_WORKER_STARTUP=1 and FREE_AI_MIXER_ENABLE_WORKER_LOOP=1", () => {
    const originalStartup = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    const originalLoop = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = "1";
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const deps = createBackendDependencies();
    const lifecycle = createRenderWorkerLifecycle(
      deps.registry,
      deps.rendererAdapter,
      deps.pathPolicy,
    );

    lifecycle.init();

    try {
      expect(lifecycle.isRunning()).toBe(true);
      expect(lifecycle.getStatus().startupStatus.startupEnabled).toBe(true);
    } finally {
      process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalStartup ?? "";
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoop ?? "";
      lifecycle.shutdown();
    }
  });

  test("shutdown() stops worker and is idempotent", () => {
    const originalStartup = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    const originalLoop = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = "1";
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const deps = createBackendDependencies();
    const lifecycle = createRenderWorkerLifecycle(
      deps.registry,
      deps.rendererAdapter,
      deps.pathPolicy,
    );

    lifecycle.init();
    expect(lifecycle.isRunning()).toBe(true);

    lifecycle.shutdown();
    expect(lifecycle.isRunning()).toBe(false);

    lifecycle.shutdown();
    expect(lifecycle.isRunning()).toBe(false);

    process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalStartup ?? "";
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoop ?? "";
  });

  test("init() is idempotent and does not duplicate worker loops", () => {
    const originalStartup = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    const originalLoop = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = "1";
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const deps = createBackendDependencies();
    const lifecycle = createRenderWorkerLifecycle(
      deps.registry,
      deps.rendererAdapter,
      deps.pathPolicy,
    );

    lifecycle.init();
    lifecycle.init();
    lifecycle.init();

    expect(lifecycle.isRunning()).toBe(true);
    expect(lifecycle.getStatus().startupStatus.loopRunning).toBe(true);

    process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalStartup ?? "";
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoop ?? "";
    lifecycle.shutdown();
  });

  test("lifecycle uses createRenderWorkerStartup and does not duplicate startup/loop logic", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorkerLifecycle.ts"),
      "utf8",
    );

    expect(source).toContain("createRenderWorkerStartup");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("drainRenderWorkerOnce");
  });

  test("lifecycle source does not directly call executeRenderJob, executeSingleProcessRender, or registry mutation methods", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorkerLifecycle.ts"),
      "utf8",
    );

    expect(source).not.toContain("executeRenderJob");
    expect(source).not.toContain("executeSingleProcessRender");
    expect(source).not.toContain("registry.claim(");
    expect(source).not.toContain("registry.markRendering(");
    expect(source).not.toContain("registry.markFinalizing(");
    expect(source).not.toContain("registry.markSuccess(");
    expect(source).not.toContain("registry.markError(");
  });

  test("app.ts wires lifecycle using backendDeps.registry, backendDeps.rendererAdapter, backendDeps.pathPolicy", async () => {
    const appSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/app.ts"),
      "utf8",
    );

    expect(appSource).toContain("createRenderWorkerLifecycle");
    expect(appSource).toContain("backendDeps.registry");
    expect(appSource).toContain("backendDeps.rendererAdapter");
    expect(appSource).toContain("backendDeps.pathPolicy");
  });

  test("app.ts attaches lifecycle only to app.locals.renderWorkerLifecycle", async () => {
    const appSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/app.ts"),
      "utf8",
    );

    expect(appSource).toContain("app.locals.renderWorkerLifecycle");
  });

  test("app.ts does NOT pass rendererAdapter/pathPolicy into createExportRouter", async () => {
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

  test("app.ts does NOT expose lifecycle through public routes", async () => {
    const appSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/app.ts"),
      "utf8",
    );

    expect(appSource).not.toContain("router.get");
    expect(appSource).not.toContain("router.post");
    expect(appSource).not.toContain("app.get");
    expect(appSource).not.toContain("app.post");
  });

  test("lifecycle/app status does not expose local path, filePath, path, url, artifactUrl, downloadUrl, or signedUrl", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorkerLifecycle.ts"),
      "utf8",
    );

    expect(source).not.toContain("filePath:");
    expect(source).not.toContain("path:");
    expect(source).not.toContain("url:");
    expect(source).not.toContain("downloadUrl");
    expect(source).not.toContain("signedUrl");
    expect(source).not.toContain("artifactUrl");
  });
});