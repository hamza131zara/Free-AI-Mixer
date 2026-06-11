import type {
  CreditPolicyResult,
  CreditsStatusResult,
} from "../types/credits";
import { fetchWithOptionalAccountBearer } from "./auth/authenticatedFetch";

interface BackendCreditPolicyDraftEstimate {
  id: CreditPolicyResult["policy"]["draftEstimates"][number]["id"];
  label: string;
  creditRangeLabel: string;
}

interface BackendCreditPolicyResponse {
  kind: "credits_policy";
  message?: string;
  policy: {
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
  };
}

interface BackendAuthenticatedCreditsStatusResponse {
  kind: "credits_status";
  status: "authenticated";
  message?: string;
    wallet: {
    state: "not_enabled_yet" | "platform_credits_not_configured" | "wallet_unavailable" | "available";
    scope: "workspace";
    liveBalanceAvailable: boolean;
    message: string;
    activeWorkspaceId?: string;
    balance?: number;
    currencyCode?: "platform_credits";
  };
}

interface BackendUnauthenticatedCreditsStatusResponse {
  kind: "credits_sign_in_required";
  status: "unauthenticated";
  reason: "missing_credentials" | "invalid_credentials";
  message?: string;
}

interface BackendUnavailableCreditsStatusResponse {
  kind: "credits_unavailable";
  status:
    | "auth_not_configured"
    | "auth_provider_unavailable"
    | "workspace_runtime_not_configured"
    | "platform_credits_not_configured"
    | "credit_tables_unavailable";
  message?: string;
}

interface BackendForbiddenCreditsStatusResponse {
  kind: "credits_access_required";
  status: "workspace_required";
  message?: string;
}

type BackendCreditsStatusResponse =
  | BackendAuthenticatedCreditsStatusResponse
  | BackendUnauthenticatedCreditsStatusResponse
  | BackendForbiddenCreditsStatusResponse
  | BackendUnavailableCreditsStatusResponse;

const creditsPolicyEndpoint = "/credits/policy";
const creditsStatusEndpoint = "/credits/status";

const parseJson = async <Payload>(response: Response): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as Payload;
  } catch {
    return undefined;
  }
};

const fallbackPolicyMessage =
  "Credit policy is currently unavailable because the backend boundary could not be reached.";

const toUnavailableStatus = (message: string): CreditsStatusResult => ({
  kind: "unavailable",
  status: "unavailable",
  code: "credits_service_unreachable",
  message,
});

export const getCreditPolicy = async (): Promise<CreditPolicyResult> => {
  try {
    const response = await fetch(creditsPolicyEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendCreditPolicyResponse>(response);

    if (!response.ok || !payload || payload.kind !== "credits_policy") {
      return {
        kind: "policy",
        message: fallbackPolicyMessage,
        policy: {
          freeByokDailyCreditsLater: 2500,
          providerCostOwner: "user_api_key",
          walletScope: "workspace",
          sharedWalletSurfaces: ["mixer", "templates", "exports", "downloads"],
          multipleApiKeysMultiplyCredits: false,
          multipleProvidersMultiplyCredits: false,
          creditsEnabled: false,
          billingEnabled: false,
          policyNotes: [fallbackPolicyMessage],
          draftEstimates: [],
        },
      };
    }

    return {
      kind: "policy",
      message: payload.message ?? "Credit policy is available in planned-state form only.",
      policy: payload.policy,
    };
  } catch {
    return {
      kind: "policy",
      message: fallbackPolicyMessage,
      policy: {
        freeByokDailyCreditsLater: 2500,
        providerCostOwner: "user_api_key",
        walletScope: "workspace",
        sharedWalletSurfaces: ["mixer", "templates", "exports", "downloads"],
        multipleApiKeysMultiplyCredits: false,
        multipleProvidersMultiplyCredits: false,
        creditsEnabled: false,
        billingEnabled: false,
        policyNotes: [fallbackPolicyMessage],
        draftEstimates: [],
      },
    };
  }
};

export const getCreditsStatus = async (): Promise<CreditsStatusResult> => {
  try {
    const response = await fetchWithOptionalAccountBearer(creditsStatusEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendCreditsStatusResponse>(response);

    if (!payload) {
      return toUnavailableStatus("Credits status returned an empty response.");
    }

    if (payload.kind === "credits_status") {
      return {
        kind: "authenticated",
        status: "authenticated",
        message:
          payload.message ??
          "Credits policy is visible for this verified session, but wallet mutation is not enabled yet.",
        wallet: payload.wallet,
      };
    }

    if (payload.kind === "credits_sign_in_required") {
      return {
        kind: "unauthenticated",
        status: "unauthenticated",
        reason: payload.reason,
        message:
          payload.message ??
          "Sign in is required before workspace-owned credit status can be checked.",
      };
    }

    if (payload.kind === "credits_access_required") {
      return {
        kind: "forbidden",
        status: "forbidden",
        code: "workspace_required",
        message:
          payload.message ??
          "A verified workspace is required before workspace-owned credit status can be checked.",
      };
    }

    return {
      kind: "unavailable",
      status: "unavailable",
      code: payload.status,
      message:
        payload.message ??
        (payload.status === "auth_not_configured"
          ? "Authentication is not configured on this backend yet."
          : payload.status === "workspace_runtime_not_configured"
            ? "Workspace authority is not configured on this backend yet."
          : "Credits status is configured behind auth, but not available in this product phase."),
    };
  } catch {
    return toUnavailableStatus(
      "Credits status is currently unavailable because the backend credits boundary could not be reached.",
    );
  }
};
