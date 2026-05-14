import { createApp } from "./app";
import { createGracefulShutdown, type GracefulShutdownController } from "./lifecycle/gracefulShutdown";

export interface StartServerOptions {
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
  const { port = Number(process.env.PORT ?? "8787"), registerSignals = true } = options;

  const app = createApp();

  const server = app.listen(port, () => {
    console.log(`Free AI Mixer export backend scaffold listening on :${port}`);
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

