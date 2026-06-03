import { createHash } from "node:crypto";

export type GeneratedImageArtifactFormat = "png" | "jpeg" | "webp";
export type GeneratedImageArtifactContentType =
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export type GeneratedImageArtifactVerificationFailureCode =
  | "generated_image_empty"
  | "generated_image_invalid_base64"
  | "generated_image_invalid_bytes"
  | "generated_image_invalid_format"
  | "generated_image_mime_mismatch"
  | "generated_image_oversized";

export interface GeneratedImageArtifactVerificationInput {
  bytes?: Uint8Array;
  base64?: string;
  contentType: GeneratedImageArtifactContentType;
  format: GeneratedImageArtifactFormat;
  maxBytes: number;
}

export interface VerifiedGeneratedImageArtifactBytes {
  bytes: Buffer;
  contentType: GeneratedImageArtifactContentType;
  format: GeneratedImageArtifactFormat;
  sha256: string;
  sizeBytes: number;
}

export type GeneratedImageArtifactVerificationResult =
  | {
      kind: "verified";
      image: VerifiedGeneratedImageArtifactBytes;
    }
  | {
      kind: "failed";
      code: GeneratedImageArtifactVerificationFailureCode;
      message: string;
    };

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const webpRiffSignature = "RIFF";
const webpFormatSignature = "WEBP";

const formatContentTypes: Record<
  GeneratedImageArtifactFormat,
  GeneratedImageArtifactContentType
> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const failure = (
  code: GeneratedImageArtifactVerificationFailureCode,
  message: string,
): GeneratedImageArtifactVerificationResult => ({
  kind: "failed",
  code,
  message,
});

const decodeBase64 = (value: string): Buffer | undefined => {
  try {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    const decoded = Buffer.from(normalized, "base64");
    const reencoded = decoded.toString("base64").replace(/=+$/, "");
    return reencoded === normalized.replace(/=+$/, "") ? decoded : undefined;
  } catch {
    return undefined;
  }
};

const hasPngSignature = (bytes: Buffer): boolean =>
  bytes.length >= pngSignature.length &&
  pngSignature.every((byte, index) => bytes[index] === byte);

const hasJpegSignature = (bytes: Buffer): boolean =>
  bytes.length >= 4 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[bytes.length - 2] === 0xff &&
  bytes[bytes.length - 1] === 0xd9;

const hasWebpSignature = (bytes: Buffer): boolean =>
  bytes.length >= 12 &&
  bytes.subarray(0, 4).toString("ascii") === webpRiffSignature &&
  bytes.subarray(8, 12).toString("ascii") === webpFormatSignature;

const bytesMatchFormat = (
  bytes: Buffer,
  format: GeneratedImageArtifactFormat,
): boolean => {
  if (format === "png") {
    return hasPngSignature(bytes);
  }

  if (format === "jpeg") {
    return hasJpegSignature(bytes);
  }

  return hasWebpSignature(bytes);
};

export const verifyGeneratedImageArtifactBytes = ({
  base64,
  bytes,
  contentType,
  format,
  maxBytes,
}: GeneratedImageArtifactVerificationInput): GeneratedImageArtifactVerificationResult => {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return failure(
      "generated_image_oversized",
      "Generated image max byte limit is invalid.",
    );
  }

  if (formatContentTypes[format] !== contentType) {
    return failure(
      "generated_image_mime_mismatch",
      "Generated image format and content type do not match.",
    );
  }

  const decoded = bytes
    ? Buffer.from(bytes)
    : typeof base64 === "string"
      ? decodeBase64(base64)
      : undefined;

  if (!decoded) {
    return failure(
      typeof base64 === "string"
        ? "generated_image_invalid_base64"
        : "generated_image_invalid_bytes",
      "Generated image bytes could not be decoded safely.",
    );
  }

  if (decoded.byteLength <= 0) {
    return failure("generated_image_empty", "Generated image bytes are empty.");
  }

  if (decoded.byteLength > maxBytes) {
    return failure(
      "generated_image_oversized",
      "Generated image bytes exceed the configured maximum size.",
    );
  }

  if (!bytesMatchFormat(decoded, format)) {
    return failure(
      "generated_image_invalid_format",
      "Generated image bytes do not match the expected image format.",
    );
  }

  return {
    kind: "verified",
    image: {
      bytes: decoded,
      contentType,
      format,
      sha256: createHash("sha256").update(decoded).digest("hex"),
      sizeBytes: decoded.byteLength,
    },
  };
};
