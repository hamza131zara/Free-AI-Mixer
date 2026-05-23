export type CreditLedgerEntryKind =
  | "grant"
  | "purchase"
  | "reservation"
  | "settlement"
  | "release"
  | "refund"
  | "adjustment"
  | "expiry";

export type CreditReservationState =
  | "planned"
  | "reserved"
  | "settled"
  | "released"
  | "refunded"
  | "expired";

export interface CreditPolicyDraftEstimate {
  id:
    | "simple_image_scene"
    | "image_template_transformation"
    | "short_video_scene"
    | "medium_video_scene"
    | "final_render_export"
    | "storage_download_orchestration"
    | "full_short_video_flow"
    | "full_medium_video_flow";
  label: string;
  creditRangeLabel: string;
}

export interface CreditPolicySummary {
  freeByokDailyCreditsLater: number;
  providerCostOwner: "user_api_key";
  walletScope: "workspace";
  sharedWalletSurfaces: Array<"mixer" | "templates" | "exports" | "downloads">;
  multipleApiKeysMultiplyCredits: false;
  multipleProvidersMultiplyCredits: false;
  creditsEnabled: false;
  billingEnabled: false;
  policyNotes: string[];
  draftEstimates: CreditPolicyDraftEstimate[];
}

export interface WalletSummary {
  state: "not_enabled_yet";
  scope: "workspace";
  liveBalanceAvailable: false;
  message: string;
  activeWorkspaceId?: string;
}

export interface CreditLedgerEntrySummary {
  ledgerEntryId: string;
  kind: CreditLedgerEntryKind;
  amountDelta: number;
  reasonCode: string;
  createdAt: string;
  jobId?: string;
  reservationId?: string;
  idempotencyKey?: string;
}

export interface CreditReservationContractSummary {
  reservationId: string;
  state: CreditReservationState;
  requestedAmount: number;
  jobId?: string;
  idempotencyKey: string;
}

export interface CreditSettlementContractSummary {
  reservationId: string;
  settlementKind: "settlement" | "release" | "refund";
  amountDelta: number;
  reasonCode: string;
  jobId?: string;
}

export interface CreditPolicyResult {
  kind: "policy";
  message: string;
  policy: CreditPolicySummary;
}

export type CreditsStatusResult =
  | {
      kind: "authenticated";
      status: "authenticated";
      message: string;
      wallet: WalletSummary;
    }
  | {
      kind: "unauthenticated";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "unavailable";
      status: "unavailable";
      code:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "credits_service_unreachable";
      message: string;
    };
