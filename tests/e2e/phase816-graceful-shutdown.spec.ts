import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createGracefulShutdown, type GracefulShutdownController } from "../../backend/lifecycle/gracefulShutdown";

test.describe("phase816 graceful shutdown helper", () => {
  test("createGracefulShutdown returns shutdown/isShuttingDown/getStatus", () => {
    const lifecycle = {
      shutdown: () => {},
      isRunning: () => false,
      getStatus: () => ({}),
    };

    const shutdownHelper = createGracefulShutdown({ lifecycle });

    expect(typeof shutdownHelper.shutdown).toBe("function");
    expect(typeof shutdownHelper.isShuttingDown).toBe("function");
    expect(typeof shutdownHelper.getStatus).toBe("function");
  });

  test("shutdown() calls lifecycle.shutdown()", () => {
    let lifecycleShutdownCalled = false;

    const lifecycle = {
      shutdown: () => {
        lifecycleShutdownCalled = true;
      },
      isRunning: () => true,
      getStatus: () => ({}),
    };

    const shutdownHelper = createGracefulShutdown({ lifecycle });
    shutdownHelper.shutdown();

    expect(lifecycleShutdownCalled).toBe(true);
  });

  test("shutdown() calls server.close()", () => {
    let serverCloseCalled = false;

    const lifecycle = {
      shutdown: () => {},
      isRunning: () => false,
      getStatus: () => ({}),
    };

    const server = {
      close: () => {
        serverCloseCalled = true;
      },
    };

    const shutdownHelper = createGracefulShutdown({ lifecycle, server });
    shutdownHelper.shutdown();

    expect(serverCloseCalled).toBe(true);
  });

  test("shutdown() is idempotent and does not call lifecycle.shutdown/server.close more than once", () => {
    let lifecycleShutdownCount = 0;
    let serverCloseCount = 0;

    const lifecycle = {
      shutdown: () => {
        lifecycleShutdownCount++;
      },
      isRunning: () => false,
      getStatus: () => ({}),
    };

    const server = {
      close: () => {
        serverCloseCount++;
      },
    };

    const shutdownHelper = createGracefulShutdown({ lifecycle, server });

    // Call shutdown multiple times
    shutdownHelper.shutdown();
    shutdownHelper.shutdown();
    shutdownHelper.shutdown();

    // Should only have been called once
    expect(lifecycleShutdownCount).toBe(1);
    expect(serverCloseCount).toBe(1);
  });

  test("shutdown() works when lifecycle was never running", () => {
    const lifecycle = {
      shutdown: () => {},
      isRunning: () => false,
      getStatus: () => ({}),
    };

    const shutdownHelper = createGracefulShutdown({ lifecycle });

    // Should not throw
    expect(() => shutdownHelper.shutdown()).not.toThrow();
    expect(shutdownHelper.isShuttingDown()).toBe(true);
  });

  test("shutdown() works when server.close uses callback style", async () => {
    let callbackInvoked = false;

    const lifecycle = {
      shutdown: () => {},
      isRunning: () => false,
      getStatus: () => ({}),
    };

    const server = {
      close: (cb?: (err?: Error) => void) => {
        if (cb) {
          // Simulate async close
          setTimeout(() => {
            callbackInvoked = true;
            cb();
          }, 10);
        }
      },
    };

    const shutdownHelper = createGracefulShutdown({ lifecycle, server });
    shutdownHelper.shutdown();

    // Wait for async callback
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callbackInvoked).toBe(true);
  });

  test("shutdown() reports safe status without local paths/URLs/download/signed URLs", () => {
    const lifecycle = {
      shutdown: () => {},
      isRunning: () => false,
      getStatus: () => ({}),
    };

    const shutdownHelper = createGracefulShutdown({ lifecycle });
    shutdownHelper.shutdown();

    const status = shutdownHelper.getStatus();

    expect(status).toHaveProperty("shuttingDown");
    expect(status).toHaveProperty("lifecycleStopped");
    expect(status).toHaveProperty("serverClosed");
    expect(status).toHaveProperty("shutdownCalled");

    // No path/URL leakage
    const statusStr = JSON.stringify(status);
    expect(statusStr).not.toContain("filePath:");
    expect(statusStr).not.toContain("path:");
    expect(statusStr).not.toContain("url:");
    expect(statusStr).not.toContain("downloadUrl");
    expect(statusStr).not.toContain("signedUrl");
    expect(statusStr).not.toContain("artifactUrl");
  });

  test("shutdown helper source does NOT call process.on", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/lifecycle/gracefulShutdown.ts"),
      "utf8",
    );

    expect(source).not.toContain("process.on(");
    expect(source).not.toContain("process.once(");
    expect(source).not.toContain("process.addListener(");
  });

  test("shutdown helper source does NOT call process.exit", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/lifecycle/gracefulShutdown.ts"),
      "utf8",
    );

    expect(source).not.toContain("process.exit");
    expect(source).not.toContain("process.kill");
  });

  test("shutdown helper source does NOT mutate job registry state", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/lifecycle/gracefulShutdown.ts"),
      "utf8",
    );

    // Should not call registry mutation methods
    expect(source).not.toContain("markError");
    expect(source).not.toContain("markSuccess");
    expect(source).not.toContain("markExpired");
    expect(source).not.toContain("transition");
    expect(source).not.toContain("claim");
    expect(source).not.toContain("cancel");
  });

  test("shutdown helper does not import or change routes/workers/app/server", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/lifecycle/gracefulShutdown.ts"),
      "utf8",
    );

    expect(source).not.toContain("routes/");
    expect(source).not.toContain("workers/");
    expect(source).not.toContain("app.ts");
    expect(source).not.toContain("server.ts");
  });

  test("shutdown helper works when no server provided", () => {
    let lifecycleShutdownCalled = false;

    const lifecycle = {
      shutdown: () => {
        lifecycleShutdownCalled = true;
      },
      isRunning: () => false,
      getStatus: () => ({}),
    };

    // No server provided
    const shutdownHelper = createGracefulShutdown({ lifecycle });
    shutdownHelper.shutdown();

    expect(lifecycleShutdownCalled).toBe(true);
    expect(shutdownHelper.getStatus().serverClosed).toBe(false);
  });
});