import type {
  BackendGenerationProviderId,
  BackendGenerationRoutingMode,
} from "./generationProviderTypes";

export type BackendGenerationAttemptState =
  | "not_started"
  | "selected"
  | "blocked"
  | "submitted"
  | "polling"
  | "succeeded"
  | "failed";

export interface BackendGenerationAttemptMetadata {
  providerId: BackendGenerationProviderId;
  attemptNumber: number;
  routingMode: BackendGenerationRoutingMode;
  fallbackEnabled: boolean;
  fallbackSequenceIndex?: number;
  state: BackendGenerationAttemptState;
  selectedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  remoteJobId?: string;
  remoteRequestId?: string;
  estimatedProviderCostUsd?: number;
  actualProviderResult?: "not_executed" | "submitted" | "success" | "failure";
  failureCode?: string;
}
