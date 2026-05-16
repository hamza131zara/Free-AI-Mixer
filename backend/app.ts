import express, { type Express } from "express";
import { exportErrorHandler } from "./errors/exportErrors";
import { createExportRouter } from "./routes/exports";
import { createBackendDependencies } from "./composition/backendDependencies";
import { createRenderWorkerLifecycle } from "./workers/renderWorkerLifecycle";

export const createApp = (): Express => {
  const app = express();
  const backendDeps = createBackendDependencies();

  const lifecycle = createRenderWorkerLifecycle(
    backendDeps.registry,
    backendDeps.rendererAdapter,
    backendDeps.pathPolicy,
    backendDeps.onVerifiedArtifactRef,
  );
  lifecycle.init();
  app.locals.renderWorkerLifecycle = lifecycle;

  app.use(express.json());
  app.use(createExportRouter(backendDeps.registry));
  app.use(exportErrorHandler);

  return app;
};
