import { readTrustedAuthProviderRuntimeConfig } from "./auth/trustedAuthProviderRuntimeConfig";
import { createTrustedAuthMiddleware } from "./auth/trustedAuthMiddleware";
import express, { type Express } from "express";
import path from "node:path";
import { exportErrorHandler } from "./errors/exportErrors";
import { createAuthRouter } from "./routes/auth";
import { createGenerationRouter } from "./routes/generation";
import { createProviderSettingsRouter } from "./routes/providerSettings";
import { createProjectHistoryRouter } from "./routes/projectHistory";
import { createCreditsRouter } from "./routes/credits";
import { createBillingRouter } from "./routes/billing";
import { createExportRouter } from "./routes/exports";
import { createBackendDependencies } from "./composition/backendDependencies";
import { createRenderWorkerLifecycle } from "./workers/renderWorkerLifecycle";
import { createLocalDevArtifactAccessProvider } from "./artifacts/localDevArtifactAccessProvider";

const isLocalDevArtifactStreamEnabled = (): boolean =>
  process.env.FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1";

export const createApp = (): Express => {
  const app = express();
  const backendDeps = createBackendDependencies();
  const authRuntimeConfig = readTrustedAuthProviderRuntimeConfig();

  const lifecycle = createRenderWorkerLifecycle(
    backendDeps.registry,
    backendDeps.rendererAdapter,
    backendDeps.pathPolicy,
    backendDeps.onVerifiedArtifactRef,
    backendDeps.renderInputSnapshotStore,
  );
  lifecycle.init();
  app.locals.renderWorkerLifecycle = lifecycle;

  const exportRouterOptions: {
    onVerifiedArtifactRef: typeof backendDeps.onVerifiedArtifactRef;
    renderInputSnapshotStore: typeof backendDeps.renderInputSnapshotStore;
    artifactStorageRefResolver?: typeof backendDeps.artifactStorageRefResolver;
    artifactAccessProvider?: ReturnType<typeof createLocalDevArtifactAccessProvider>;
  } = {
    onVerifiedArtifactRef: backendDeps.onVerifiedArtifactRef,
    renderInputSnapshotStore: backendDeps.renderInputSnapshotStore,
    ...(isLocalDevArtifactStreamEnabled()
      ? {
        artifactStorageRefResolver: backendDeps.artifactStorageRefResolver,
        artifactAccessProvider: createLocalDevArtifactAccessProvider({
          resolveArtifactStorageRef: (request) =>
            backendDeps.artifactStorageRefResolver.resolve(
              request.jobId,
              request.artifactId,
            ),
          streamUrlForArtifact: (request) =>
            `/exports/${encodeURIComponent(request.jobId)}/artifacts/${encodeURIComponent(request.artifactId)}/stream`,
          isPathWithinRoot: (ref) => {
            const normalizedRoot = path.resolve(ref.rootPath);
            const normalizedFile = path.resolve(ref.filePath);
            const normalizedDirectory = path.resolve(ref.directoryPath);
            const fileRelative = path.relative(normalizedRoot, normalizedFile);
            const directoryRelative = path.relative(normalizedRoot, normalizedDirectory);

            if (
              fileRelative.length === 0 ||
              fileRelative.startsWith("..") ||
              path.isAbsolute(fileRelative)
            ) {
              return false;
            }

            if (
              directoryRelative.length === 0 ||
              directoryRelative.startsWith("..") ||
              path.isAbsolute(directoryRelative)
            ) {
              return false;
            }

            return normalizedDirectory
              === path.resolve(normalizedRoot, ref.jobSegment);
          },
        }),
      }
      : {}),
  };

  app.use(express.json());

  app.use(createTrustedAuthMiddleware({ runtimeConfig: authRuntimeConfig }));
  app.use(createAuthRouter({ runtimeConfig: authRuntimeConfig }));
  app.use(createGenerationRouter({ runtimeConfig: authRuntimeConfig }));
  app.use(createProviderSettingsRouter({ runtimeConfig: authRuntimeConfig }));
  app.use(createProjectHistoryRouter({ runtimeConfig: authRuntimeConfig }));
  app.use(createCreditsRouter({ runtimeConfig: authRuntimeConfig }));
  app.use(createBillingRouter());
  app.use(createExportRouter(backendDeps.registry, exportRouterOptions));
  app.use(exportErrorHandler);

  return app;
};




