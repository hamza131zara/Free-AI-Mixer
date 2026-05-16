import express, { type Express } from "express";
import { exportErrorHandler } from "./errors/exportErrors";
import { createExportRouter } from "./routes/exports";
import { createBackendDependencies } from "./composition/backendDependencies";
import { createRenderWorkerLifecycle } from "./workers/renderWorkerLifecycle";

const isLocalDevArtifactStreamEnabled = (): boolean =>
  process.env.FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1";

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

  const exportRouterOptions: {
    onVerifiedArtifactRef: typeof backendDeps.onVerifiedArtifactRef;
    artifactStorageRefResolver?: typeof backendDeps.artifactStorageRefResolver;
  } = {
    onVerifiedArtifactRef: backendDeps.onVerifiedArtifactRef,
    ...(isLocalDevArtifactStreamEnabled()
      ? { artifactStorageRefResolver: backendDeps.artifactStorageRefResolver }
      : {}),
  };

  app.use(express.json());
  app.use(createExportRouter(backendDeps.registry, exportRouterOptions));
  app.use(exportErrorHandler);

  return app;
};
