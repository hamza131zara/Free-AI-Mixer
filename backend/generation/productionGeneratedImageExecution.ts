import type { BackendGenerationProviderExecutionResult } from "./generationProviderAdapter";
import type {
  GeneratedImageProductionStorage,
  GeneratedImageProductionStorageResult,
} from "./supabaseGeneratedImageProductionStorage";
import type {
  ProductionGeneratedImageBundleWriteResult,
  ProductionSupabasePersistenceWriter,
} from "../persistence/productionSupabasePersistenceBoundary";

export type ProductionGeneratedImageExecutionResult =
  | {
      kind: "completed";
      artifact: Extract<GeneratedImageProductionStorageResult, { kind: "stored" }>[
        "artifact"
      ];
      persistence: Extract<
        ProductionGeneratedImageBundleWriteResult,
        { kind: "persisted" }
      >;
      providerMetadata: {
        model: string;
        providerId: "openai";
      };
    }
  | {
      kind: "provider_failed";
      providerResult: Exclude<
        BackendGenerationProviderExecutionResult,
        { kind: "verified_image" }
      >;
    }
  | {
      kind: "storage_unavailable";
      message: string;
    }
  | {
      kind: "persistence_unavailable";
      message: string;
    };

export interface ProductionGeneratedImageExecutionInput {
  executeProvider(): Promise<BackendGenerationProviderExecutionResult>;
  ownerId: string;
  persistenceWriter: ProductionSupabasePersistenceWriter;
  projectId: string;
  prompt: string;
  providerId: "openai";
  requestId: string;
  storage: GeneratedImageProductionStorage;
  workspaceId: string;
}

const activeFlights = new Map<
  string,
  Promise<ProductionGeneratedImageExecutionResult>
>();

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toPromptSummary = (prompt: string): string =>
  prompt.trim().replace(/\s+/g, " ").slice(0, 240);

const toFlightKey = (input: ProductionGeneratedImageExecutionInput): string =>
  JSON.stringify([
    input.ownerId,
    input.workspaceId,
    input.projectId,
    input.providerId,
    input.requestId,
  ]);

const persistenceResultIsValid = (
  result: ProductionGeneratedImageBundleWriteResult,
  artifactId: string,
): result is Extract<
  ProductionGeneratedImageBundleWriteResult,
  { kind: "persisted" }
> => {
  if (result.kind !== "persisted") {
    return false;
  }

  const expectedCreated = result.outcome === "created";
  return (
    (result.outcome === "created" || result.outcome === "replayed") &&
    result.artifactId === artifactId &&
    uuidRegex.test(result.generationJobId) &&
    uuidRegex.test(result.historyId) &&
    result.generationJobCreated === expectedCreated &&
    result.artifactCreated === expectedCreated &&
    result.historyCreated === expectedCreated
  );
};

const executeFlight = async (
  input: ProductionGeneratedImageExecutionInput,
): Promise<ProductionGeneratedImageExecutionResult> => {
  const storageReadiness = (() => {
    try {
      return input.storage.getReadiness();
    } catch {
      return undefined;
    }
  })();

  if (storageReadiness?.kind !== "ready") {
    return {
      kind: "storage_unavailable",
      message: "Generated image private storage is temporarily unavailable.",
    };
  }

  const persistenceReadiness = (() => {
    try {
      return input.persistenceWriter.getReadiness();
    } catch {
      return undefined;
    }
  })();

  if (persistenceReadiness?.kind !== "ready") {
    return {
      kind: "persistence_unavailable",
      message: "Generated image persistence is temporarily unavailable.",
    };
  }

  const providerResult = await (async () => {
    try {
      return await input.executeProvider();
    } catch {
      return undefined;
    }
  })();

  if (!providerResult) {
    return {
      kind: "provider_failed",
      providerResult: {
        kind: "generation_failed",
        status: "generation_failed",
        errorCode: "generation_failed",
        message: "OpenAI image generation failed safely.",
      },
    };
  }

  if (providerResult.kind !== "verified_image") {
    return {
      kind: "provider_failed",
      providerResult,
    };
  }

  const artifactId = `${input.requestId}_openai_image`;
  const jobId = input.requestId;
  const stored = await (async () => {
    try {
      return await input.storage.store({
        artifactId,
        jobId,
        ownerId: input.ownerId,
        projectId: input.projectId,
        providerId: input.providerId,
        verifiedImage: providerResult.verifiedImage,
        workspaceId: input.workspaceId,
      });
    } catch {
      return undefined;
    }
  })();

  if (!stored || stored.kind !== "stored") {
    return {
      kind: "storage_unavailable",
      message: "Generated image private storage is temporarily unavailable.",
    };
  }

  if (
    stored.artifact.artifactId !== artifactId ||
    stored.artifact.jobId !== jobId ||
    stored.artifact.ownerId !== input.ownerId ||
    stored.artifact.workspaceId !== input.workspaceId ||
    stored.artifact.providerId !== input.providerId ||
    stored.artifact.contentType !== providerResult.verifiedImage.contentType ||
    stored.artifact.sizeBytes !== providerResult.verifiedImage.sizeBytes ||
    stored.artifact.sha256 !== providerResult.verifiedImage.sha256
  ) {
    try {
      await input.storage.deleteObject(stored.storageRef);
    } catch {
      // Storage identity failures remain redacted even when cleanup fails.
    }

    return {
      kind: "storage_unavailable",
      message: "Generated image private storage is temporarily unavailable.",
    };
  }

  const persistence = await (async () => {
    try {
      return await input.persistenceWriter.persistGeneratedImageBundle({
        artifactId,
        contentType: stored.artifact.contentType,
        createdAt: stored.artifact.createdAt,
        jobId,
        ownerId: input.ownerId,
        projectId: input.projectId,
        promptSummary: toPromptSummary(input.prompt),
        providerId: input.providerId,
        requestId: input.requestId,
        sha256: stored.artifact.sha256,
        sizeBytes: stored.artifact.sizeBytes,
        storageRef: stored.storageRef,
        workspaceId: input.workspaceId,
      });
    } catch {
      return undefined;
    }
  })();

  if (!persistence || !persistenceResultIsValid(persistence, artifactId)) {
    try {
      await input.storage.deleteObject(stored.storageRef);
    } catch {
      // The public failure stays redacted even when compensating cleanup fails.
    }

    return {
      kind: "persistence_unavailable",
      message: "Generated image persistence is temporarily unavailable.",
    };
  }

  return {
    kind: "completed",
    artifact: stored.artifact,
    persistence,
    providerMetadata: providerResult.providerMetadata,
  };
};

export const executeProductionGeneratedImage = (
  input: ProductionGeneratedImageExecutionInput,
): Promise<ProductionGeneratedImageExecutionResult> => {
  const flightKey = toFlightKey(input);
  const existing = activeFlights.get(flightKey);

  if (existing) {
    return existing;
  }

  const flight = executeFlight(input);
  activeFlights.set(flightKey, flight);
  const clearFlight = (): void => {
    if (activeFlights.get(flightKey) === flight) {
      activeFlights.delete(flightKey);
    }
  };
  void flight.then(clearFlight, clearFlight);

  return flight;
};
