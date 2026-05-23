import type { BackendGenerationAttemptMetadata } from "./generationAttemptMetadata";
import type { BackendGenerationFailureCode } from "./generationFailureMapping";
import type { BackendGenerationProviderId } from "./generationProviderTypes";

export interface BackendGenerationSubmitRequest {
  sceneId: string;
  prompt: string;
  style?: string;
  durationSeconds?: number;
  workspaceId?: string;
  userId: string;
  signal?: AbortSignal;
}

export interface BackendGenerationPollRequest {
  providerId: BackendGenerationProviderId;
  remoteJobId: string;
  workspaceId?: string;
  userId: string;
  signal?: AbortSignal;
}

export type BackendGenerationProviderSubmitResult =
  | {
      kind: "submitted";
      remoteJobId: string;
      metadata: BackendGenerationAttemptMetadata;
    }
  | {
      kind: "failure";
      failureCode: BackendGenerationFailureCode;
      metadata: BackendGenerationAttemptMetadata;
    };

export type BackendGenerationProviderPollResult =
  | {
      kind: "pending";
      metadata: BackendGenerationAttemptMetadata;
    }
  | {
      kind: "success";
      metadata: BackendGenerationAttemptMetadata;
    }
  | {
      kind: "failure";
      failureCode: BackendGenerationFailureCode;
      metadata: BackendGenerationAttemptMetadata;
    };

export interface BackendGenerationProviderAdapter {
  readonly providerId: BackendGenerationProviderId;
  submit(
    request: BackendGenerationSubmitRequest,
  ): Promise<BackendGenerationProviderSubmitResult>;
  poll(
    request: BackendGenerationPollRequest,
  ): Promise<BackendGenerationProviderPollResult>;
}

export interface BackendGenerationProviderAdapterRegistry {
  get(
    providerId: BackendGenerationProviderId,
  ): BackendGenerationProviderAdapter | undefined;
  list(): BackendGenerationProviderAdapter[];
}
