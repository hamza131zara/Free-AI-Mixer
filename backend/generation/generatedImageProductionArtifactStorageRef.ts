import type { BackendGenerationArtifactProviderId } from "./generationProviderTypes";
import type {
  GeneratedImageArtifactContentType,
  GeneratedImageArtifactFormat,
} from "./generatedImageArtifactVerification";

export type GeneratedImageProductionStorageProvider = "supabase_storage";

export interface GeneratedImageProductionStorageRef {
  provider: GeneratedImageProductionStorageProvider;
  bucket: string;
  objectKey: string;
  contentType: GeneratedImageArtifactContentType;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface GeneratedImageProductionArtifactRecord {
  artifactId: string;
  jobId: string;
  workspaceId: string;
  ownerId: string;
  providerId: BackendGenerationArtifactProviderId;
  format: GeneratedImageArtifactFormat;
  contentType: GeneratedImageArtifactContentType;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  storageRef: GeneratedImageProductionStorageRef;
}

const safeArtifactSegmentRegex = /^[A-Za-z0-9_-]{1,120}$/;
const safeObjectKeyRegex = /^[A-Za-z0-9/_\-.]{1,512}$/;

export const isSafeGeneratedImageProductionArtifactSegment = (
  value: string,
): boolean => safeArtifactSegmentRegex.test(value);

export const isSafeGeneratedImageProductionStorageRef = (
  storageRef: GeneratedImageProductionStorageRef,
): boolean => {
  if (
    storageRef.provider !== "supabase_storage" ||
    !storageRef.bucket.trim() ||
    !storageRef.objectKey.trim() ||
    !safeObjectKeyRegex.test(storageRef.objectKey)
  ) {
    return false;
  }

  const unsafeFragments = [
    "..",
    "\\",
    "file://",
    "C:",
    "/Users/",
    "/home/",
    "/tmp/",
    "rootPath",
    "directoryPath",
    "filePath",
    "localPath",
    "internalRef",
    "storageRef",
  ];

  return !unsafeFragments.some((fragment) =>
    storageRef.objectKey.includes(fragment),
  );
};

export const buildGeneratedImageProductionObjectKey = ({
  artifactId,
  format,
  jobId,
  workspaceId,
}: {
  artifactId: string;
  format: GeneratedImageArtifactFormat;
  jobId: string;
  workspaceId: string;
}): string | undefined => {
  if (
    !isSafeGeneratedImageProductionArtifactSegment(workspaceId) ||
    !isSafeGeneratedImageProductionArtifactSegment(jobId) ||
    !isSafeGeneratedImageProductionArtifactSegment(artifactId)
  ) {
    return undefined;
  }

  const extensionByFormat: Record<GeneratedImageArtifactFormat, string> = {
    jpeg: "jpg",
    png: "png",
    webp: "webp",
  };

  return [
    "generated-images",
    encodeURIComponent(workspaceId),
    encodeURIComponent(jobId),
    `${encodeURIComponent(artifactId)}.${extensionByFormat[format]}`,
  ].join("/");
};
