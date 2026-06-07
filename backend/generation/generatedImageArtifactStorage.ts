import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendGenerationArtifactProviderId } from "./generationProviderTypes";
import type { InternalArtifactStorageRef } from "../artifacts/internalArtifactStorageRef";
import type {
  GeneratedImageArtifactContentType,
  GeneratedImageArtifactFormat,
  VerifiedGeneratedImageArtifactBytes,
} from "./generatedImageArtifactVerification";

export type GeneratedImageArtifactStatus =
  | "available"
  | "failed"
  | "pending_verification";

export interface GeneratedImageArtifactMetadata {
  artifactId: string;
  jobId: string;
  workspaceId: string;
  ownerId: string;
  providerId: BackendGenerationArtifactProviderId;
  kind: "generated_image";
  format: GeneratedImageArtifactFormat;
  contentType: GeneratedImageArtifactContentType;
  sizeBytes: number;
  sha256: string;
  status: GeneratedImageArtifactStatus;
  createdAt: string;
}

export interface GeneratedImageArtifactStoreInput {
  artifactId: string;
  jobId: string;
  workspaceId: string;
  ownerId: string;
  providerId: BackendGenerationArtifactProviderId;
  verifiedImage: VerifiedGeneratedImageArtifactBytes;
  createdAt?: string;
}

export type GeneratedImageArtifactStorageResult =
  | {
      kind: "stored";
      artifact: GeneratedImageArtifactMetadata;
      internalRef: InternalArtifactStorageRef;
    }
  | {
      kind: "unavailable";
      code: "storage_not_configured";
      message: string;
    }
  | {
      kind: "failed";
      code:
        | "invalid_artifact_identity"
        | "root_containment_failed"
        | "write_failed"
        | "cleanup_failed";
      message: string;
    };

export interface GeneratedImageArtifactStorage {
  store(
    input: GeneratedImageArtifactStoreInput,
  ): Promise<GeneratedImageArtifactStorageResult>;
  cleanup(input: {
    artifactId?: string;
    jobId: string;
  }): Promise<GeneratedImageArtifactStorageResult | { kind: "cleaned" }>;
}

export interface LocalGeneratedImageArtifactStorageOptions {
  rootPath: string;
  now?: () => string;
}

const defaultNow = (): string => new Date().toISOString();
const safeSegmentRegex = /^[A-Za-z0-9_-]{1,80}$/;

const extensionByFormat: Record<GeneratedImageArtifactFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

const unavailable = (): GeneratedImageArtifactStorageResult => ({
  kind: "unavailable",
  code: "storage_not_configured",
  message: "Generated image artifact storage is not configured.",
});

const failed = (
  code: Exclude<GeneratedImageArtifactStorageResult, { kind: "stored" | "unavailable" }>["code"],
  message: string,
): GeneratedImageArtifactStorageResult => ({
  kind: "failed",
  code,
  message,
});

const isSafeSegment = (value: string): boolean => safeSegmentRegex.test(value);

const isInsideRoot = (rootPath: string, targetPath: string): boolean => {
  const relative = path.relative(rootPath, targetPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
};

const resolveSafePaths = (
  rootPath: string,
  jobId: string,
  artifactId: string,
  format: GeneratedImageArtifactFormat,
):
  | {
      directoryPath: string;
      filePath: string;
      fileName: string;
      jobSegment: string;
      rootPath: string;
      tempFilePath: string;
    }
  | undefined => {
  if (!isSafeSegment(jobId) || !isSafeSegment(artifactId)) {
    return undefined;
  }

  const normalizedRoot = path.resolve(rootPath);
  const jobSegment = jobId;
  const fileName = `${artifactId}.${extensionByFormat[format]}`;
  const tempFileName = `${artifactId}.tmp`;
  const directoryPath = path.resolve(normalizedRoot, jobSegment);
  const filePath = path.resolve(directoryPath, fileName);
  const tempFilePath = path.resolve(directoryPath, tempFileName);

  if (
    !isInsideRoot(normalizedRoot, directoryPath) ||
    !isInsideRoot(normalizedRoot, filePath) ||
    !isInsideRoot(normalizedRoot, tempFilePath)
  ) {
    return undefined;
  }

  return {
    directoryPath,
    filePath,
    fileName,
    jobSegment,
    rootPath: normalizedRoot,
    tempFilePath,
  };
};

export const createNotConfiguredGeneratedImageArtifactStorage =
  (): GeneratedImageArtifactStorage => ({
    store: async () => unavailable(),
    cleanup: async () => unavailable(),
  });

export const createLocalGeneratedImageArtifactStorage = ({
  now = defaultNow,
  rootPath,
}: LocalGeneratedImageArtifactStorageOptions): GeneratedImageArtifactStorage => ({
  async store(input) {
    const resolved = resolveSafePaths(
      rootPath,
      input.jobId,
      input.artifactId,
      input.verifiedImage.format,
    );

    if (!resolved) {
      return failed(
        "invalid_artifact_identity",
        "Generated image artifact identity could not be resolved safely.",
      );
    }

    try {
      await fs.mkdir(resolved.directoryPath, { recursive: true });
      await fs.writeFile(resolved.tempFilePath, input.verifiedImage.bytes, {
        flag: "wx",
      });
      await fs.rename(resolved.tempFilePath, resolved.filePath);
      const realRootPath = await fs.realpath(resolved.rootPath);
      const realFilePath = await fs.realpath(resolved.filePath);

      if (!isInsideRoot(realRootPath, realFilePath)) {
        return failed(
          "root_containment_failed",
          "Generated image artifact path escaped the configured root.",
        );
      }

      return {
        kind: "stored",
        artifact: {
          artifactId: input.artifactId,
          jobId: input.jobId,
          workspaceId: input.workspaceId,
          ownerId: input.ownerId,
          providerId: input.providerId,
          kind: "generated_image",
          format: input.verifiedImage.format,
          contentType: input.verifiedImage.contentType,
          sizeBytes: input.verifiedImage.sizeBytes,
          sha256: input.verifiedImage.sha256,
          status: "available",
          createdAt: input.createdAt ?? now(),
        },
        internalRef: {
          filePath: realFilePath,
          rootPath: realRootPath,
          jobSegment: resolved.jobSegment,
          directoryPath: path.dirname(realFilePath),
        },
      };
    } catch {
      return failed("write_failed", "Generated image artifact write failed.");
    }
  },

  async cleanup({ artifactId, jobId }) {
    if (!isSafeSegment(jobId) || (artifactId !== undefined && !isSafeSegment(artifactId))) {
      return failed(
        "invalid_artifact_identity",
        "Generated image artifact cleanup identity is unsafe.",
      );
    }

    const normalizedRoot = path.resolve(rootPath);
    const directoryPath = path.resolve(normalizedRoot, jobId);

    if (!isInsideRoot(normalizedRoot, directoryPath)) {
      return failed(
        "root_containment_failed",
        "Generated image artifact cleanup path escaped the configured root.",
      );
    }

    try {
      const realRootPath = await fs.realpath(normalizedRoot);
      const realTargetPath = await fs.realpath(directoryPath);

      if (!isInsideRoot(realRootPath, realTargetPath)) {
        return failed(
          "root_containment_failed",
          "Generated image artifact cleanup target escaped the configured root.",
        );
      }

      if (artifactId) {
        const files = await fs.readdir(realTargetPath);
        await Promise.all(
          files
            .filter((fileName) => fileName.startsWith(`${artifactId}.`))
            .map((fileName) => fs.unlink(path.join(realTargetPath, fileName))),
        );
      } else {
        await fs.rm(realTargetPath, { force: true, recursive: true });
      }

      return { kind: "cleaned" };
    } catch {
      return failed("cleanup_failed", "Generated image artifact cleanup failed.");
    }
  },
});
