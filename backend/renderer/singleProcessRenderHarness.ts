import type { ExportFailure } from "../../src/types/exportJob";
import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import {
  createRenderInputSnapshot,
  type RenderInputSnapshot,
} from "../contracts/renderInputSnapshot";
import {
  resolveRenderOutputPath,
  type RenderOutputPathPolicy,
} from "./outputPathPolicy";
import { verifyRenderedArtifact } from "./artifactVerification";
import {
  mapRendererFailure,
  toPublicSafeRendererFailure,
  type RendererMappedFailure,
} from "./rendererFailureMapping";
import type { BackendArtifactMetadata } from "../contracts/exportHttpTypes";

export interface RendererAdapterInput {
  snapshot: RenderInputSnapshot;
  resolvedOutputPath: ReturnType<typeof resolveRenderOutputPath>;
  abortSignal?: AbortSignal;
}

export type RendererAdapterResult =
  | { ok: true; diagnostics?: Record<string, unknown> }
  | {
      ok: false;
      error?: unknown;
      transient?: boolean;
      diagnostics?: Record<string, unknown>;
    };

export type RendererAdapter = (
  input: RendererAdapterInput,
) => Promise<RendererAdapterResult>;

export interface SingleProcessRenderHarnessInput {
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

export type SingleProcessRenderHarnessResult =
  | {
      ok: true;
      jobId: string;
      artifact: BackendArtifactMetadata;
      status: "success";
    }
  | {
      ok: false;
      jobId: string;
      status: "error";
      failure: RendererMappedFailure;
    };

const asExportFailure = (failure: RendererMappedFailure): ExportFailure => ({
  code: failure.code,
  message: failure.message,
  details: {
    stage: failure.stage,
    retryable: failure.retryable,
    causeCategory: failure.causeCategory,
    ...(failure.details ? { details: failure.details } : {}),
  },
});

const createArtifactId = (jobId: string): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `${jobId}_${crypto.randomUUID()}`
    : `${jobId}_${Date.now().toString(36)}`;

const mapAndMarkError = (
  input: SingleProcessRenderHarnessInput,
  stage:
    | "snapshot"
    | "path"
    | "render"
    | "verify"
    | "finalize",
  error: unknown,
  transient?: boolean,
  details?: Record<string, unknown>,
): SingleProcessRenderHarnessResult => {
  const mapped = mapRendererFailure({
    error,
    stage,
    transient,
    details: {
      jobId: input.jobId,
      workerId: input.workerId,
      ...(details ?? {}),
    },
  });
  const safeFailure = toPublicSafeRendererFailure(mapped);

  try {
    input.registry.markError(input.jobId, input.workerId, asExportFailure(mapped));
  } catch {
    // Preserve mapped failure output even when markError cannot be applied
    // (for example claim ownership failures).
  }

  return {
    ok: false,
    jobId: input.jobId,
    status: "error",
    failure: safeFailure,
  };
};

export const executeSingleProcessRender = async (
  input: SingleProcessRenderHarnessInput,
): Promise<SingleProcessRenderHarnessResult> => {
  try {
    input.registry.claim(input.jobId, input.workerId);
  } catch (error) {
    return mapAndMarkError(input, "render", error, false, {
      summary: "Failed to claim export job.",
    });
  }

  let snapshot: RenderInputSnapshot;
  try {
    snapshot = createRenderInputSnapshot(input.snapshotInput);
  } catch (error) {
    return mapAndMarkError(input, "snapshot", error, false, {
      summary: "Invalid render input snapshot.",
    });
  }

  let resolvedOutputPath: ReturnType<typeof resolveRenderOutputPath>;
  try {
    resolvedOutputPath = resolveRenderOutputPath(input.pathPolicy, {
      rootKey: "output",
      jobId: snapshot.outputTarget.jobFolderKey,
      baseName: snapshot.outputTarget.artifactBaseName,
      extension: snapshot.outputTarget.format,
    });
  } catch (error) {
    return mapAndMarkError(input, "path", error, false, {
      summary: "Failed to resolve output path.",
    });
  }

  try {
    input.registry.markRendering(input.jobId, input.workerId);
  } catch (error) {
    return mapAndMarkError(input, "render", error, false, {
      summary: "Failed to transition job to rendering.",
    });
  }

  let adapterResult: RendererAdapterResult;
  try {
    adapterResult = await input.rendererAdapter({
      snapshot,
      resolvedOutputPath,
      abortSignal: input.abortSignal,
    });
  } catch (error) {
    return mapAndMarkError(input, "render", error, true, {
      summary: "Renderer adapter threw unexpectedly.",
    });
  }

  if (!adapterResult.ok) {
    return mapAndMarkError(
      input,
      "render",
      adapterResult.error ?? new Error("Renderer adapter returned failure."),
      adapterResult.transient,
      {
        summary: "Renderer adapter reported failure.",
        ...(adapterResult.diagnostics ? { adapter: adapterResult.diagnostics } : {}),
      },
    );
  }

  const verification = await verifyRenderedArtifact({
    artifactId: input.artifactId ?? createArtifactId(input.jobId),
    jobId: input.jobId,
    kind: input.artifactKind ?? "render_output",
    expectedFormat: snapshot.outputTarget.format,
    resolvedOutputPath,
  });

  if (!verification.ok) {
    return mapAndMarkError(input, "verify", {
      code: verification.error.code,
      message: verification.error.message,
    });
  }

  try {
    input.registry.markFinalizing(input.jobId, input.workerId);
  } catch (error) {
    return mapAndMarkError(input, "finalize", error, false, {
      summary: "Failed to transition job to finalizing.",
    });
  }

  try {
    input.registry.markSuccess(input.jobId, input.workerId, [verification.artifact]);
  } catch (error) {
    return mapAndMarkError(input, "finalize", error, false, {
      summary: "Failed to transition job to success.",
    });
  }

  return {
    ok: true,
    jobId: input.jobId,
    status: "success",
    artifact: verification.artifact,
  };
};
