import type { InternalArtifactStorageRef } from "./internalArtifactStorageRef";

/**
 * Resolver for internal artifact storage references.
 *
 * IMPORTANT SAFETY RULES - INTERNAL ONLY:
 * - Resolver is internal-only.
 * - Resolver must NEVER return data to frontend directly.
 * - Resolver must NEVER be exported from public contracts.
 * - Resolver must NEVER accept user-provided file paths.
 * - Resolver maps backend-controlled jobId/artifactId to InternalArtifactStorageRef.
 * - Future stream route must still validate path-root containment and file existence at stream time.
 *
 * This interface allows the stream route to safely look up internal storage references
 * by job and artifact IDs. The resolver implementation is provided at runtime.
 */
export interface ArtifactStorageRefResolver {
  /**
   * Resolve an internal storage reference for a job/artifact combination.
   *
   * @param jobId - The job ID (backend-controlled, not user input)
   * @param artifactId - The artifact ID (backend-controlled, not user input)
   * @returns The internal storage reference, or undefined if not found
   */
  resolve(
    jobId: string,
    artifactId: string,
  ): InternalArtifactStorageRef | undefined;
}