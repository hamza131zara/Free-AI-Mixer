export interface BackendCreditPolicyDraftEstimate {
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

export interface BackendCreditPolicySummary {
  freeByokDailyCreditsLater: number;
  providerCostOwner: "user_api_key";
  walletScope: "workspace";
  sharedWalletSurfaces: Array<"mixer" | "templates" | "exports" | "downloads">;
  multipleApiKeysMultiplyCredits: false;
  multipleProvidersMultiplyCredits: false;
  creditsEnabled: false;
  billingEnabled: false;
  policyNotes: string[];
  draftEstimates: BackendCreditPolicyDraftEstimate[];
}

export interface BackendWalletSummary {
  state: "not_enabled_yet" | "platform_credits_not_configured" | "wallet_unavailable" | "available";
  scope: "workspace";
  liveBalanceAvailable: boolean;
  message: string;
  activeWorkspaceId?: string;
  balance?: number;
  currencyCode?: "platform_credits";
}

export interface BackendCreditsPolicyResponse {
  kind: "credits_policy";
  message: string;
  policy: BackendCreditPolicySummary;
}

export type BackendCreditsStatusResponse =
  | {
      kind: "credits_status";
      status: "authenticated";
      message: string;
      wallet: BackendWalletSummary;
    }
  | {
      kind: "credits_sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "credits_access_required";
      status: "workspace_required";
      message: string;
    }
  | {
      kind: "credits_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "workspace_runtime_not_configured"
        | "platform_credits_not_configured"
        | "credit_tables_unavailable";
      message: string;
    };
