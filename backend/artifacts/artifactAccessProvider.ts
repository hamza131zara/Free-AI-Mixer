import type {
  BackendArtifactAccessResponse,
  BackendArtifactMetadata,
} from "../contracts/exportHttpTypes";

/**
 * Request input for artifact access.
 *
 * IMPORTANT SAFETY RULES:
 * - Must not contain local filesystem paths.
 * - Must not contain storage credentials.
 * - jobId and artifactId are safe identifiers only.
 * - artifact field carries verified metadata from registry, not user input.
 */
export interface ArtifactAccessRequest {
  jobId: string;
  artifactId: string;
  /** Verified artifact metadata from registry, not user input. */
  artifact?: BackendArtifactMetadata;
}

/**
 * Provider interface for artifact access.
 *
 * IMPORTANT SAFETY RULES:
 * - Must not mutate job lifecycle.
 * - Must not call renderer/runtime/harness.
 * - Must not fabricate artifacts.
 * - Any url in response must be backend-issued only through BackendArtifactAccessResponse.
 * - Local dev stream and expiring URL implementations are deferred to later phases.
 *
 * Responsibilities:
 * - Validate job exists and is in terminal success state.
 * - Validate artifact exists for job.
 * - Return appropriate access descriptor based on provider configuration.
 * - Never expose local filesystem paths in responses.
 */
export interface ArtifactAccessProvider {
  getArtifactAccess(
    request: ArtifactAccessRequest,
  ): Promise<BackendArtifactAccessResponse>;
}