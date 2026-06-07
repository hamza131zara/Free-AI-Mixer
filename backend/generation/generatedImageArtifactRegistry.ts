import type { InternalArtifactStorageRef } from "../artifacts/internalArtifactStorageRef";
import type { GeneratedImageArtifactMetadata } from "./generatedImageArtifactStorage";

export interface GeneratedImageArtifactRegistryRecord {
  artifact: GeneratedImageArtifactMetadata;
  internalRef: InternalArtifactStorageRef;
}

export interface GeneratedImageArtifactRegistry {
  get(input: {
    artifactId: string;
    jobId: string;
  }): GeneratedImageArtifactRegistryRecord | undefined;
  register(record: GeneratedImageArtifactRegistryRecord): void;
}

export const createInMemoryGeneratedImageArtifactRegistry =
  (): GeneratedImageArtifactRegistry => {
    const records = new Map<string, GeneratedImageArtifactRegistryRecord>();

    const keyFor = (jobId: string, artifactId: string): string =>
      `${jobId}:${artifactId}`;

    return {
      get({ artifactId, jobId }) {
        return records.get(keyFor(jobId, artifactId));
      },
      register(record) {
        records.set(
          keyFor(record.artifact.jobId, record.artifact.artifactId),
          record,
        );
      },
    };
  };
