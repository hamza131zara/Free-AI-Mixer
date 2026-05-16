import type { InternalArtifactStorageRef } from "./internalArtifactStorageRef";

/**
 * In-memory store for internal artifact storage references.
 *
 * IMPORTANT SAFETY RULES - INTERNAL ONLY:
 * - This store is internal-only.
 * - This store must NEVER be exported from public contracts.
 * - This store must NEVER be persisted to JSON registry.
 * - This store must NEVER be returned to frontend.
 * - This store uses process-memory only (Map-based).
 * - This store does not validate paths or check file existence.
 * - Future stream route remains responsible for realpath/root/stat validation.
 * - On process restart, store is cleared (acceptable - jobs become unavailable).
 */
export interface ArtifactStorageRefStore {
  /**
   * Store an internal storage reference for a job/artifact combination.
   */
  set(
    jobId: string,
    artifactId: string,
    ref: InternalArtifactStorageRef,
  ): void;

  /**
   * Get an internal storage reference for a job/artifact combination.
   */
  get(
    jobId: string,
    artifactId: string,
  ): InternalArtifactStorageRef | undefined;

  /**
   * Check if an internal storage reference exists for a job/artifact combination.
   */
  has(
    jobId: string,
    artifactId: string,
  ): boolean;

  /**
   * Delete internal storage reference(s).
   * If artifactId is provided, deletes only that artifact's ref.
   * If artifactId is omitted, deletes all refs for that job.
   */
  delete(
    jobId: string,
    artifactId?: string,
  ): void;

  /**
   * Clear all storage references.
   */
  clear(): void;
}

export const createInMemoryArtifactStorageRefStore =
  (): ArtifactStorageRefStore => {
    // Private storage: Map<jobId, Map<artifactId, InternalArtifactStorageRef>>
    const store = new Map<string, Map<string, InternalArtifactStorageRef>>();

    return {
      set(jobId: string, artifactId: string, ref: InternalArtifactStorageRef): void {
        let artifactMap = store.get(jobId);
        if (!artifactMap) {
          artifactMap = new Map<string, InternalArtifactStorageRef>();
          store.set(jobId, artifactMap);
        }
        artifactMap.set(artifactId, ref);
      },

      get(jobId: string, artifactId: string): InternalArtifactStorageRef | undefined {
        const artifactMap = store.get(jobId);
        if (!artifactMap) {
          return undefined;
        }
        return artifactMap.get(artifactId);
      },

      has(jobId: string, artifactId: string): boolean {
        const artifactMap = store.get(jobId);
        if (!artifactMap) {
          return false;
        }
        return artifactMap.has(artifactId);
      },

      delete(jobId: string, artifactId?: string): void {
        if (artifactId !== undefined) {
          // Delete specific artifact
          const artifactMap = store.get(jobId);
          if (artifactMap) {
            artifactMap.delete(artifactId);
            // Clean up empty job entry
            if (artifactMap.size === 0) {
              store.delete(jobId);
            }
          }
        } else {
          // Delete all artifacts for job
          store.delete(jobId);
        }
      },

      clear(): void {
        store.clear();
      },
    };
  };