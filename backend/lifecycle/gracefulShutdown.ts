export interface GracefulShutdownStatus {
  shuttingDown: boolean;
  lifecycleStopped: boolean;
  serverClosed: boolean;
  shutdownCalled: boolean;
}

export interface GracefulShutdownLifecycle {
  shutdown(): void;
  isRunning(): boolean;
  getStatus(): unknown;
}

export interface GracefulShutdownServerLike {
  close(callback?: (err?: Error) => void): void | Promise<void>;
}

export interface GracefulShutdownOptions {
  server?: GracefulShutdownServerLike | null;
  lifecycle: GracefulShutdownLifecycle;
}

export interface GracefulShutdownController {
  shutdown(): void;
  isShuttingDown(): boolean;
  getStatus(): GracefulShutdownStatus;
}

export const createGracefulShutdown = (
  options: GracefulShutdownOptions,
): GracefulShutdownController => {
  const { server, lifecycle } = options;

  let shuttingDown = false;
  let lifecycleStopped = false;
  let serverClosed = false;
  let shutdownCalled = false;

  const getStatus = (): GracefulShutdownStatus => ({
    shuttingDown,
    lifecycleStopped,
    serverClosed,
    shutdownCalled,
  });

  return {
    shutdown: () => {
      if (shutdownCalled) {
        // Idempotent - do nothing if already called
        return;
      }

      shutdownCalled = true;
      shuttingDown = true;

      // Stop the worker lifecycle
      if (lifecycle) {
        lifecycle.shutdown();
        lifecycleStopped = true;
      }

      // Close the server if provided
      if (server) {
        server.close((err?: Error) => {
          if (err) {
            // Log but don't throw - shutdown should not fail
            console.error("Server close error during shutdown:", err.message);
          }
          serverClosed = true;
        });
        // Mark as closed immediately for sync callers
        // The callback will update it when it completes
        serverClosed = true;
      }
    },

    isShuttingDown: () => shuttingDown,

    getStatus,
  };
};