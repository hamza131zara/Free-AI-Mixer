import path from "node:path";
import { InMemoryExportJobRegistry } from "../registry/inMemoryExportJobRegistry";
import { JsonFileExportJobRegistry } from "../registry/jsonFileExportJobRegistry";
import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import { createRemotionRendererAdapter } from "../renderer/remotionRendererAdapter";
import type { RendererAdapter } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";

export interface BackendDependencies {
  registry: ExportJobRegistry;
  rendererAdapter: RendererAdapter;
  pathPolicy: RenderOutputPathPolicy;
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

  return {
    registry,
    rendererAdapter,
    pathPolicy,
  };
};