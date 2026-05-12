import {
  executeSingleProcessRender,
  type RendererAdapter,
  type SingleProcessRenderHarnessResult,
} from "./singleProcessRenderHarness";
import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import type { RenderOutputPathPolicy } from "./outputPathPolicy";

export interface ExecuteRenderJobInput {
  registry: ExportJobRegistry;
  rendererAdapter: RendererAdapter;
  pathPolicy: RenderOutputPathPolicy;
  workerId: string;
  jobId: string;
  snapshotInput: unknown;
  artifactId?: string;
  artifactKind?: string;
  abortSignal?: AbortSignal;
}

export const executeRenderJob = async (
  input: ExecuteRenderJobInput,
): Promise<SingleProcessRenderHarnessResult> => {
  return executeSingleProcessRender({
    registry: input.registry,
    rendererAdapter: input.rendererAdapter,
    pathPolicy: input.pathPolicy,
    workerId: input.workerId,
    jobId: input.jobId,
    snapshotInput: input.snapshotInput,
    artifactId: input.artifactId,
    artifactKind: input.artifactKind,
    abortSignal: input.abortSignal,
  });
};
