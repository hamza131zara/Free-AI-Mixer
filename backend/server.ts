import { pathToFileURL } from "node:url";
import { createApp } from "./app";
import { createGracefulShutdown, type GracefulShutdownController } from "./lifecycle/gracefulShutdown";

export interface StartServerOptions {
  host?: string;
  port?: number;
  registerSignals?: boolean;
}

type AppServer = ReturnType<ReturnType<typeof createApp>["listen"]>;

export interface StartServerController extends GracefulShutdownController {
  app: ReturnType<typeof createApp>;
  server: AppServer;
  cleanupSignalHandlers(): void;
}

const registeredSignals = new Set<string>();

export const startServer = (options: StartServerOptions = {}): StartServerController => {
  const {
    host = "0.0.0.0",
    port = Number(process.env.PORT ?? "8787"),
    registerSignals = true,
  } = options;

  const app = createApp();

  const server = app.listen(port, host, () => {
    console.log(
      `Free AI Mixer export backend scaffold listening on ${host}:${port}`,
    );
  });

  const gracefulShutdown = createGracefulShutdown({
    lifecycle: app.locals.renderWorkerLifecycle,
    server: server as unknown as import("./lifecycle/gracefulShutdown").GracefulShutdownServerLike,
  });

  const cleanupSignalHandlers = (): void => {
    if (process.listenerCount("SIGINT") > 0) {
      process.removeAllListeners("SIGINT");
      registeredSignals.delete("SIGINT");
    }
    if (process.listenerCount("SIGTERM") > 0) {
      process.removeAllListeners("SIGTERM");
      registeredSignals.delete("SIGTERM");
    }
  };

  if (registerSignals) {
    const handleSignal = (signal: NodeJS.Signals): void => {
      console.log(`\nReceived ${signal}, initiating graceful shutdown...`);
      gracefulShutdown.shutdown();
    };

    if (!registeredSignals.has("SIGINT")) {
      process.on("SIGINT", handleSignal);
      registeredSignals.add("SIGINT");
    }

    if (!registeredSignals.has("SIGTERM")) {
      process.on("SIGTERM", handleSignal);
      registeredSignals.add("SIGTERM");
    }
  }

  return {
    app,
    server,
    ...gracefulShutdown,
    cleanupSignalHandlers,
  };
};

// Direct-run guard: start server when executed directly (e.g., tsx backend/server.ts)
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  startServer();
}
