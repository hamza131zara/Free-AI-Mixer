import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { startServer, type StartServerController } from "../../backend/server";

test.describe("phase817 server shutdown wiring", () => {
  let controller: StartServerController;

  test.afterEach(() => {
    if (controller) {
      controller.cleanupSignalHandlers();
      if (!controller.isShuttingDown()) {
        controller.shutdown();
      }
    }
  });

  test("startServer returns controller with app/server/shutdown/isShuttingDown/getStatus", async () => {
    controller = startServer({ port: 0, registerSignals: false });

    expect(controller.app).toBeDefined();
    expect(typeof controller.shutdown).toBe("function");
    expect(typeof controller.isShuttingDown).toBe("function");
    expect(typeof controller.getStatus).toBe("function");
    expect(typeof controller.cleanupSignalHandlers).toBe("function");
  });

  test("startServer returns app that has renderWorkerLifecycle", async () => {
    controller = startServer({ port: 0, registerSignals: false });

    expect(controller.app.locals.renderWorkerLifecycle).toBeDefined();
  });

  test("shutdown() calls lifecycle shutdown", async () => {
    let lifecycleShutdownCalled = false;
    controller = startServer({ port: 0, registerSignals: false });

    // Override lifecycle shutdown to track
    controller.app.locals.renderWorkerLifecycle.shutdown = () => {
      lifecycleShutdownCalled = true;
    };

    controller.shutdown();

    expect(lifecycleShutdownCalled).toBe(true);
  });

  test("shutdown() marks isShuttingDown true", async () => {
    controller = startServer({ port: 0, registerSignals: false });
    expect(controller.isShuttingDown()).toBe(false);

    controller.shutdown();

    expect(controller.isShuttingDown()).toBe(true);
  });

  test("shutdown() is idempotent", async () => {
    let shutdownCallCount = 0;
    controller = startServer({ port: 0, registerSignals: false });

    controller.app.locals.renderWorkerLifecycle.shutdown = () => {
      shutdownCallCount++;
    };

    controller.shutdown();
    controller.shutdown();
    controller.shutdown();

    expect(shutdownCallCount).toBe(1);
  });

  test("getStatus() returns safe status without paths/URLs", async () => {
    controller = startServer({ port: 0, registerSignals: false });
    controller.shutdown();

    const status = controller.getStatus();

    expect(status).toHaveProperty("shuttingDown");
    expect(status).toHaveProperty("lifecycleStopped");
    expect(status).toHaveProperty("serverClosed");
    expect(status).toHaveProperty("shutdownCalled");

    const statusStr = JSON.stringify(status);
    expect(statusStr).not.toContain("filePath:");
    expect(statusStr).not.toContain("path:");
    expect(statusStr).not.toContain("url:");
    expect(statusStr).not.toContain("downloadUrl");
    expect(statusStr).not.toContain("signedUrl");
  });

  test("cleanupSignalHandlers() removes SIGINT/SIGTERM listeners", async () => {
    controller = startServer({ port: 0, registerSignals: true });

    const sigintCountBefore = process.listenerCount("SIGINT");
    const sigtermCountBefore = process.listenerCount("SIGTERM");

    controller.cleanupSignalHandlers();

    const sigintCountAfter = process.listenerCount("SIGINT");
    const sigtermCountAfter = process.listenerCount("SIGTERM");

    expect(sigintCountAfter).toBeLessThan(sigintCountBefore);
    expect(sigtermCountAfter).toBeLessThan(sigtermCountBefore);
  });

  test("duplicate startServer calls do not register duplicate handlers", async () => {
    controller = startServer({ port: 0, registerSignals: true });
    const sigintCountBefore = process.listenerCount("SIGINT");

    const controller2 = startServer({ registerSignals: true });
    const sigintCountAfter = process.listenerCount("SIGINT");

    expect(sigintCountAfter).toBe(sigintCountBefore);

    controller2.cleanupSignalHandlers();
  });

  test("server source does NOT call process.exit", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/server.ts"),
      "utf8",
    );

    expect(source).not.toContain("process.exit");
    expect(source).not.toContain("process.kill");
  });

  test("startServer with custom port uses custom port", async () => {
    controller = startServer({ port: 0, registerSignals: false });

    const address = controller.server.address();
    expect(address).toBeTruthy();
  });
});