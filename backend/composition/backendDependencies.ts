import path from "node:path";
import { InMemoryExportJobRegistry } from "../registry/inMemoryExportJobRegistry";
import { JsonFileExportJobRegistry } from "../registry/jsonFileExportJobRegistry";
import { SupabaseExportJobRegistry } from "../registry/supabaseExportJobRegistry";
import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import { createRemotionRendererAdapter } from "../renderer/remotionRendererAdapter";
import type { RendererAdapter, VerifiedArtifactRefPayload } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";
import { createInMemoryArtifactStorageRefStore, type ArtifactStorageRefStore } from "../artifacts/inMemoryArtifactStorageRefStore";
import type { ArtifactStorageRefResolver } from "../artifacts/artifactStorageRefResolver";
import { readSupabaseConfigFromEnv } from "../config/supabaseConfig";
import { createSupabaseClientFactory } from "../db/supabaseClientFactory";
import {
  createRepositoryComposition,
  type BackendRepositoryComposition,
} from "./repositoryComposition";

export interface BackendDependencies {
  registry: ExportJobRegistry;
  rendererAdapter: RendererAdapter;
  pathPolicy: RenderOutputPathPolicy;
  /** Internal artifact storage ref store (process-memory only) */
  artifactStorageRefStore: ArtifactStorageRefStore;
  /** Callback to register verified artifact refs after successful render */
  onVerifiedArtifactRef: (payload: VerifiedArtifactRefPayload) => void;
  /** Resolver to query artifact storage refs from store */
  artifactStorageRefResolver: ArtifactStorageRefResolver;
  /** Internal DB-backed repository composition boundary. Unwired by default. */
  repositoryComposition: BackendRepositoryComposition;
}

const getDefaultRoots = (): { temp: string; output: string } => {
  const baseDir = process.cwd();
  return {
    temp: path.join(baseDir, ".free-ai-mixer-temp"),
    output: path.join(baseDir, ".free-ai-mixer-output"),
  };
};

export const createBackendDependencies = (): BackendDependencies => {
  const roots = getDefaultRoots();
  const supabaseConfig = readSupabaseConfigFromEnv();
  const repositoryComposition = createRepositoryComposition(
    supabaseConfig,
    createSupabaseClientFactory(supabaseConfig),
  );

  const pathPolicy: RenderOutputPathPolicy = {
    roots,
  };

  const rendererAdapter = createRemotionRendererAdapter({
    runtime: undefined,
  });

  const usePersistence = process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED === "true";
  const registry: ExportJobRegistry =
    repositoryComposition.kind === "repository_composition_available"
      ? new SupabaseExportJobRegistry({
          dependencies: {
            jobsRepository:
              repositoryComposition.createRepositories().exportJobsRepository,
          },
        })
      : usePersistence
        ? new JsonFileExportJobRegistry({
            filePath: process.env.FREE_AI_MIXER_PERSISTENCE_FILE_PATH,
          })
        : new InMemoryExportJobRegistry();

  // Create internal artifact storage ref store (process-memory only)
  const artifactStorageRefStore = createInMemoryArtifactStorageRefStore();

  // Callback to register refs in store after successful artifact verification
  // Best-effort: failures do not block render success
  const onVerifiedArtifactRef = ({ jobId, artifactId, storageRef }: VerifiedArtifactRefPayload): void => {
    try {
      artifactStorageRefStore.set(jobId, artifactId, storageRef);
    } catch {
      // Non-blocking - registration failure does not fail render
    }
  };

  // Resolver to query artifact storage refs from store
  const artifactStorageRefResolver: ArtifactStorageRefResolver = {
    resolve: (jobId, artifactId) => artifactStorageRefStore.get(jobId, artifactId),
  };

  return {
    registry,
    rendererAdapter,
    pathPolicy,
    artifactStorageRefStore,
    onVerifiedArtifactRef,
    artifactStorageRefResolver,
    repositoryComposition,
  };
};
