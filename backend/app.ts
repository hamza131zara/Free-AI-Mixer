import { readTrustedAuthProviderRuntimeConfig } from "./auth/trustedAuthProviderRuntimeConfig";
import { createRepositoryBackedRequesterContextResolver } from "./auth/requesterContextResolver";
import { createTrustedAuthMiddleware } from "./auth/trustedAuthMiddleware";
import express, { type Express } from "express";
import path from "node:path";
import { exportErrorHandler } from "./errors/exportErrors";
import { createAuthRouter } from "./routes/auth";
import { createAccountRouter } from "./routes/account";
import { createGenerationRouter } from "./routes/generation";
import { createProviderSettingsRouter } from "./routes/providerSettings";
import { createProjectHistoryRouter } from "./routes/projectHistory";
import { createCreditsRouter } from "./routes/credits";
import { createBillingRouter } from "./routes/billing";
import { createTemplatesRouter } from "./routes/templates";
import { createCardsRouter } from "./routes/cards";
import { createAiToolsRouter } from "./routes/aiTools";
import { createAiNewsRouter } from "./routes/aiNews";
import { createAdminRouter } from "./routes/admin";
import { createMonitoringRouter } from "./routes/monitoring";
import { createExportRouter } from "./routes/exports";
import { createBackendDependencies } from "./composition/backendDependencies";
import type { BackendDatabaseRepositories } from "./composition/repositoryComposition";
import { createLocalGeneratedImageArtifactStorage } from "./generation/generatedImageArtifactStorage";
import {
  createProductionGeneratedImageArtifactAccessResolver,
  createRegistryBackedGeneratedImageArtifactAccessResolver,
} from "./generation/generatedImageArtifactAccess";
import { createInMemoryGeneratedImageArtifactRegistry } from "./generation/generatedImageArtifactRegistry";
import { createRenderWorkerLifecycle } from "./workers/renderWorkerLifecycle";
import { createLocalDevArtifactAccessProvider } from "./artifacts/localDevArtifactAccessProvider";
import { readSupabaseConfigFromEnv } from "./config/supabaseConfig";
import { createSupabaseClientFactory } from "./db/supabaseClientFactory";
import type { WorkspaceMembershipRepository } from "./auth/workspaceMembership";
import { createProductionCorsMiddleware } from "./config/productionCorsPolicy";

const isLocalDevArtifactStreamEnabled = (): boolean =>
  process.env.FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1";

const isGeneratedImageLocalPreviewEnabled = (): boolean =>
  process.env.FREE_AI_MIXER_GENERATION_ENABLE_LOCAL_IMAGE_PREVIEW === "1";

const createMockOpenAiImageGenerationFetch = (): typeof fetch =>
  (async () =>
    new Response(
      JSON.stringify({
        data: [
          {
            b64_json: "iVBORw0KGgo=",
          },
        ],
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      },
    )) as typeof fetch;

const createProviderSettingsMembershipRepository = (
  repositories: BackendDatabaseRepositories,
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    const membership =
      await repositories.workspaceMembershipRepository.getMembership(
        workspaceId,
        userId,
      );

    if (!membership) {
      return {
        kind: "not_member",
        reason: "not_found",
      };
    }

    if (membership.status !== "active") {
      return {
        kind: "not_member",
        reason: "inactive",
      };
    }

    return {
      kind: "member",
      membership: {
        role: membership.role === "editor" ? "member" : membership.role,
        source: "workspace_memberships",
        status: "active",
        userId: membership.userId,
        workspaceId: membership.workspaceId,
      },
    };
  },
});

export const createApp = (): Express => {
  const app = express();
  const backendDeps = createBackendDependencies();
  const repositories =
    backendDeps.repositoryComposition.kind === "repository_composition_available"
      ? backendDeps.repositoryComposition.createRepositories()
      : undefined;
  const authRuntimeConfig = readTrustedAuthProviderRuntimeConfig();
  const supabaseClientFactory = createSupabaseClientFactory(
    readSupabaseConfigFromEnv(),
  );
  const routeAccessResolver =
    repositories
      ? createRepositoryBackedRequesterContextResolver({
          repositories,
        })
      : undefined;
  const generatedImageArtifactStorage =
    backendDeps.generationGeneratedImageStorageMode === "local_staging" &&
    backendDeps.generationGeneratedImageStorageRoot
      ? createLocalGeneratedImageArtifactStorage({
          rootPath: backendDeps.generationGeneratedImageStorageRoot,
        })
      : undefined;
  const generatedImageArtifactRegistry =
    createInMemoryGeneratedImageArtifactRegistry();
  const accountBootstrapDependencies =
    repositories && supabaseClientFactory.kind === "supabase_client_factory"
      ? (() => {
          const adminHandle = supabaseClientFactory.createAdminClientHandle();

          return {
            userAccountRepository: repositories.userAccountRepository,
            workspaceRepository: repositories.workspaceRepository,
            workspaceMembershipRepository: repositories.workspaceMembershipRepository,
            getVerifiedAuthUserProfile: async (userId: string) => {
              const result = await adminHandle.client.auth.admin.getUserById(userId);

              if (result.error) {
                throw new Error(result.error.message);
              }

              const user = result.data.user;

              return {
                email: user.email,
                emailVerified:
                  typeof user.email_confirmed_at === "string" &&
                  user.email_confirmed_at.trim().length > 0,
              };
            },
          };
        })()
      : undefined;

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

              return normalizedDirectory === path.resolve(normalizedRoot, ref.jobSegment);
            },
          }),
        }
      : {}),
  };

  app.use(express.json());
  app.use(createProductionCorsMiddleware());

  app.use(createTrustedAuthMiddleware({ runtimeConfig: authRuntimeConfig }));
  app.use(
    createAuthRouter({
      runtimeConfig: authRuntimeConfig,
      ...(routeAccessResolver
        ? {
            requesterContextResolver: routeAccessResolver,
          }
        : {}),
    }),
  );
  app.use(
    createAccountRouter({
      runtimeConfig: authRuntimeConfig,
      ...(accountBootstrapDependencies
        ? {
            dependencies: accountBootstrapDependencies,
          }
        : {}),
    }),
  );
  app.use(
    createGenerationRouter({
      runtimeConfig: authRuntimeConfig,
      generationExecutionControlReadiness:
        backendDeps.generationExecutionControlReadiness,
      generationMockExecutionAdapterSelection:
        backendDeps.generationMockExecutionAdapterSelection,
      generationByokDecryptForMockExecutionEnabled:
        backendDeps.generationByokDecryptForMockExecutionEnabled,
      ...(backendDeps.generationMockExecutionAdapterSelection === "mock_local"
        ? {
            generationMockExecutor: async () => ({
              kind: "mock_execution_blocked" as const,
            }),
          }
        : {}),
      generationOpenAiAdapterFetchMode:
        backendDeps.generationOpenAiAdapterFetchMode,
      ...(backendDeps.generationOpenAiAdapterFetchMode === "mock_only"
        ? {
            openAiAdapterMockFetch: createMockOpenAiImageGenerationFetch(),
          }
        : {}),
      ...(backendDeps.generationOpenAiAdapterFetchMode === "mock_only" ||
      backendDeps.generationOpenAiImageRealLocalSmokeEnabled
        ? {
            providerSecretVault: backendDeps.providerSecretVault,
          }
        : {}),
      ...(generatedImageArtifactStorage
        ? {
            generatedImageArtifactStorage,
            generatedImageArtifactAccessResolver:
              createRegistryBackedGeneratedImageArtifactAccessResolver({
                registry: generatedImageArtifactRegistry,
              }),
            generatedImageArtifactRegistry,
            generatedImageLocalPreviewEnabled:
              isGeneratedImageLocalPreviewEnabled(),
          }
        : {}),
      ...(backendDeps.productionArtifactDeliveryMode ===
      "backend_mediated_stream"
        ? {
            generatedImageArtifactAccessResolver:
              createProductionGeneratedImageArtifactAccessResolver({
                productionStorage:
                  backendDeps.generatedImageProductionStorage,
              }),
            generatedImageProductionDeliveryEnabled: true,
            generatedImageProductionStorage:
              backendDeps.generatedImageProductionStorage,
          }
        : {}),
      ...(backendDeps.generationOpenAiImageRealLocalSmokeEnabled
        ? {
            openAiRealProviderFetch: globalThis.fetch,
          }
        : {}),
      generationOpenAiImageRealLocalSmokeEnabled:
        backendDeps.generationOpenAiImageRealLocalSmokeEnabled,
      generationOpenAiImageModelConfig:
        backendDeps.generationOpenAiImageModelConfig,
      generationRuntimeConfig: backendDeps.generationRuntimeConfig,
      generationRuntimeReadiness: backendDeps.generationRuntimeReadiness,
      productionPersistenceWriter: backendDeps.productionPersistenceWriter,
      creditService: backendDeps.creditService,
      ...(routeAccessResolver ? { routeAccessResolver } : {}),
      ...(repositories
        ? {
            providerKeyRepository: repositories.providerKeyRepository,
            productionAuthOwnershipPolicyEnabled: true,
            workspaceMembershipRepository:
              createProviderSettingsMembershipRepository(repositories),
          }
        : {}),
    }),
  );
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authRuntimeConfig,
      providerSecretVault: backendDeps.providerSecretVault,
      providerKeysRuntimeEnabled: backendDeps.byokProviderKeysRuntimeGate.enabled,
      providerValidationAdapter: backendDeps.providerValidationAdapter,
      providerValidationRuntimeEnabled:
        backendDeps.byokProviderValidationRuntimeGate.enabled,
      ...(routeAccessResolver ? { routeAccessResolver } : {}),
      ...(repositories
        ? {
            providerKeyRepository: repositories.providerKeyRepository,
            workspaceMembershipRepository:
              createProviderSettingsMembershipRepository(repositories),
          }
        : {}),
    }),
  );
  app.use(
    createProjectHistoryRouter({
      ...(repositories
        ? {
            projectRepository: repositories.projectRepository,
          }
        : {}),
      runtimeConfig: authRuntimeConfig,
      productionPersistenceWriter: backendDeps.productionPersistenceWriter,
      ...(routeAccessResolver ? { routeAccessResolver } : {}),
    }),
  );
  app.use(
    createCreditsRouter({
      runtimeConfig: authRuntimeConfig,
      creditService: backendDeps.creditService,
      ...(routeAccessResolver ? { routeAccessResolver } : {}),
    }),
  );
  app.use(createBillingRouter());
  app.use(createTemplatesRouter());
  app.use(createCardsRouter());
  app.use(createAiToolsRouter());
  app.use(createAiNewsRouter());
  app.use(createAdminRouter({ runtimeConfig: authRuntimeConfig }));
  app.use(createMonitoringRouter());
  app.use(createExportRouter(backendDeps.registry, exportRouterOptions));
  app.use(exportErrorHandler);

  return app;
};
