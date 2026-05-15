/**
 * Internal artifact storage reference for local dev file access.
 *
 * IMPORTANT SAFETY RULES - INTERNAL ONLY:
 * - This type is internal-only.
 * - It must NEVER be exported from backend/contracts/exportHttpTypes.ts.
 * - It must NEVER be returned to frontend.
 * - It must NEVER be stored in BackendArtifactMetadata.
 * - It must NEVER be persisted in JSON registry unless a later audited phase explicitly defines safe internal persistence.
 * - Future local dev stream provider may use it only after path-root validation.
 * - Do not expose filePath/localPath/outputPath/rootPath in any API response.
 *
 * This type holds the internal file location information that the renderer harness
 * creates during execution. It is used only in-memory within the backend and is NOT
 * part of the public contract.
 */
export interface InternalArtifactStorageRef {
  /** Absolute file path to the artifact file. */
  filePath: string;
  /** Root path that the file is contained within (for security validation). */
  rootPath: string;
  /** Job segment identifier used in directory structure. */
  jobSegment: string;
  /** Directory path containing the artifact file. */
  directoryPath: string;
}