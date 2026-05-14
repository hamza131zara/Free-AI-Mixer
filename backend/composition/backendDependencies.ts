import path from "node:path";
import { InMemoryExportJobRegistry } from "../registry/exportJobRegistry";
import { createRemotionRendererAdapter } from "../renderer/remotionRendererAdapter";
import type { RendererAdapter } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";

export interface BackendDependencies {
  registry: InMemoryExportJobRegistry;
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

  const registry = new InMemoryExportJobRegistry();

  return {
    registry,
    rendererAdapter,
    pathPolicy,
  };
};