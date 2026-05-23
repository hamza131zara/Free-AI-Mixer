import type {
  BackendArtifactStorageRefRecord,
  BackendArtifactStorageRefRepository,
} from "../repositories/repositoryContracts";
import type { ProductionArtifactStorageReference } from "./productionStorageProvider";

export interface ProductionArtifactStorageRefLookupInput {
  workspaceId: string;
  jobId: string;
  artifactId: string;
}

export interface ProductionArtifactStorageRefResolver {
  resolveStorageRef(
    input: ProductionArtifactStorageRefLookupInput,
  ): Promise<ProductionArtifactStorageReference | undefined>;
}

const toProductionArtifactStorageReference = (
  record: BackendArtifactStorageRefRecord | undefined,
): ProductionArtifactStorageReference | undefined => {
  if (!record) {
    return undefined;
  }

  if (record.storageProvider === "local_dev") {
    return undefined;
  }

  return {
    provider: record.storageProvider,
    bucket: record.bucketName ?? "",
    objectKey: record.objectKey,
    ...(record.contentType ? { contentType: record.contentType } : {}),
    ...(record.byteLength !== undefined ? { sizeBytes: record.byteLength } : {}),
  };
};

export const createNotConfiguredProductionArtifactStorageRefResolver =
  (): ProductionArtifactStorageRefResolver => ({
    resolveStorageRef: async () => undefined,
  });

export const createRepositoryBackedProductionArtifactStorageRefResolver = (
  repository: BackendArtifactStorageRefRepository,
): ProductionArtifactStorageRefResolver => ({
  resolveStorageRef: async ({ workspaceId, jobId, artifactId }) =>
    toProductionArtifactStorageReference(
      await repository.getStorageRef(workspaceId, jobId, artifactId),
    ),
});
