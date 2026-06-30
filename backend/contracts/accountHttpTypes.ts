import type { BackendVerifiedSessionIdentity } from "./authHttpTypes";

export type AccountBootstrapUnavailableStatus =
  | "auth_not_configured"
  | "auth_provider_unavailable"
  | "bootstrap_unavailable";

export type AccountBootstrapBlockedReason =
  | "multiple_active_memberships"
  | "workspace_selection_required"
  | "inactive_membership_exists";

export type BackendAccountBootstrapResponse =
  | {
      kind: "account_bootstrap_complete";
      status: "authenticated";
      message: string;
      identity: BackendVerifiedSessionIdentity;
      bootstrap: {
        appUserCreated: boolean;
        workspaceCreated: boolean;
        membershipCreated: boolean;
      };
    }
  | {
      kind: "email_verification_required";
      status: "verification_required";
      message: string;
    }
  | {
      kind: "workspace_bootstrap_blocked";
      status: "workspace_selection_required";
      reason: Exclude<
        AccountBootstrapBlockedReason,
        "inactive_membership_exists"
      >;
      message: string;
      identity: BackendVerifiedSessionIdentity;
    }
  | {
      kind: "workspace_bootstrap_blocked";
      status: "workspace_bootstrap_blocked";
      reason: "inactive_membership_exists";
      message: string;
    }
  | {
      kind: "invalid_credentials";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "bootstrap_unavailable";
      status: AccountBootstrapUnavailableStatus;
      message: string;
    };
