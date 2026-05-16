import path from "node:path";
import { InMemoryExportJobRegistry } from "../registry/inMemoryExportJobRegistry";
import { JsonFileExportJobRegistry } from "../registry/jsonFileExportJobRegistry";
import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import { createRemotionRendererAdapter } from "../renderer/remotionRendererAdapter";
import type { RendererAdapter, VerifiedArtifactRefPayload } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";
import { createInMemoryArtifactStorageRefStore, type ArtifactStorageRefStore } from "../artifacts/inMemoryArtifactStorageRefStore";

export interface BackendDependencies {
  registry: ExportJobRegistry;
  rendererAdapter: RendererAdapter;
  pathPolicy: RenderOutputPathPolicy;
  /** Internal artifact storage ref store (process-memory only) */
  artifactStorageRefStore: ArtifactStorageRefStore;
  /** Callback to register verified artifact refs after successful render */
  onVerifiedArtifactRef: (payload: VerifiedArtifactRefPayload) => void;
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

  const pathPolicy: RenderOutputPathPolicy = {
    roots,
  };

  const rendererAdapter = createRemotionRendererAdapter({
    runtime: undefined,
  });

  // Use JSON file persistence when env flag is set, otherwise use in-memory
  const usePersistence = process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED === "true";
  const registry: ExportJobRegistry = usePersistence
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

  return {
    registry,
    rendererAdapter,
    pathPolicy,
    artifactStorageRefStore,
    onVerifiedArtifactRef,
  };
};