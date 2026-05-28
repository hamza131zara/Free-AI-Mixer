import {
  bootstrapAccount,
  getAuthSession,
  logoutFromBackendAuth,
  type BackendAccountBootstrapResponse,
} from "../authService";
import {
  getSupabaseAuthClient,
  type SupabaseAuthPasswordCredentials,
  type SupabaseAuthPasswordResetInput,
  type SupabaseAuthSignupCredentials,
} from "./supabaseAuthClient";
import type { AuthMutationResult, AuthSessionResult } from "../../types/auth";

const supabaseNotConfiguredMessage =
  "Supabase Auth is not configured for this frontend yet.";

const mapBootstrapResponseToAuthResult = (
  result: BackendAccountBootstrapResponse | undefined,
): AuthSessionResult | AuthMutationResult => {
  if (!result) {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "account_bootstrap_unavailable",
      message: "Free AI Mixer account setup could not be completed safely.",
    };
  }

  if (result.kind === "account_bootstrap_complete") {
    return {
      kind: "authenticated",
      status: "authenticated",
      identity: result.identity,
      message: result.message ?? "Free AI Mixer account setup is complete.",
    };
  }

  if (result.kind === "email_verification_required") {
    return {
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: "email_verification_required",
      message:
        result.message ??
        "Check your email to verify your account before Free AI Mixer account setup can continue.",
    };
  }

  if (result.kind === "workspace_bootstrap_blocked") {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "workspace_bootstrap_blocked",
      message:
        result.message ??
        "Your sign-in succeeded with the auth provider, but Free AI Mixer setup is not complete yet.",
    };
  }

  if (result.kind === "invalid_credentials") {
    return {
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: result.reason,
      message:
        result.message ??
        "The supplied authentication credentials could not be verified safely.",
    };
  }

  return {
    kind: "unavailable",
    status: "unavailable",
    code:
      result.status === "bootstrap_unavailable"
        ? "account_bootstrap_unavailable"
        : result.status,
    message:
      result.message ?? "Free AI Mixer account setup is not available on this backend yet.",
  };
};

const neutralPasswordResetMessage =
  "If an account exists, reset instructions have been sent.";

interface AuthRuntimeDependencies {
  bootstrapAccount: typeof bootstrapAccount;
  getAuthSession: typeof getAuthSession;
  getSupabaseAuthClient: typeof getSupabaseAuthClient;
  logoutFromBackendAuth: typeof logoutFromBackendAuth;
}

const defaultDependencies: AuthRuntimeDependencies = {
  bootstrapAccount,
  getAuthSession,
  getSupabaseAuthClient,
  logoutFromBackendAuth,
};

export const createAuthRuntimeService = (
  dependencies: AuthRuntimeDependencies = defaultDependencies,
) => {
  const getLiveAuthClient = () => {
    const client = dependencies.getSupabaseAuthClient();

    if (client.kind === "supabase_auth_client_disabled" || !("auth" in client)) {
      return {
        kind: "disabled" as const,
        result: {
          kind: "unavailable" as const,
          status: "unavailable" as const,
          code: "supabase_auth_not_configured" as const,
          message: supabaseNotConfiguredMessage,
        },
      };
    }

    return {
      kind: "ready" as const,
      auth: client.auth,
    };
  };

  const refreshSessionAfterProviderAuth = async (
    accessToken?: string,
  ): Promise<AuthSessionResult> => dependencies.getAuthSession(accessToken);

  return {
    async loginWithSupabaseRuntime(
      credentials: SupabaseAuthPasswordCredentials,
    ): Promise<AuthSessionResult | AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "disabled") {
        return client.result;
      }

      const signInResult = await client.auth.signInWithPassword(credentials);

      if (!signInResult.ok) {
        return {
          kind: "unauthenticated",
          status: "unauthenticated",
          reason: "invalid_credentials",
          message: signInResult.errorMessage,
        };
      }

      const accessToken = signInResult.data.accessToken;
      const sessionResult = await refreshSessionAfterProviderAuth(accessToken);

      if (sessionResult.kind === "authenticated") {
        return sessionResult;
      }

      const bootstrapResult = await dependencies.bootstrapAccount(accessToken ?? "");
      const mappedBootstrapResult = mapBootstrapResponseToAuthResult(bootstrapResult);

      if (
        mappedBootstrapResult.kind === "authenticated" ||
        bootstrapResult?.kind === "workspace_bootstrap_blocked"
      ) {
        return refreshSessionAfterProviderAuth(accessToken);
      }

      return mappedBootstrapResult;
    },

    async signUpWithSupabaseRuntime(
      credentials: SupabaseAuthSignupCredentials,
    ): Promise<AuthSessionResult | AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "disabled") {
        return client.result;
      }

      const signUpResult = await client.auth.signUp(credentials);

      if (!signUpResult.ok) {
        return {
          kind: "unauthenticated",
          status: "unauthenticated",
          reason: "invalid_credentials",
          message: signUpResult.errorMessage,
        };
      }

      return {
        kind: "unauthenticated",
        status: "unauthenticated",
        reason: "email_verification_required",
        message:
          "Check your email to verify your account before Free AI Mixer account setup can continue.",
      };
    },

    async requestPasswordResetWithSupabaseRuntime(
      input: SupabaseAuthPasswordResetInput,
    ): Promise<AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "disabled") {
        return client.result;
      }

      const resetResult = await client.auth.requestPasswordReset(input);

      if (!resetResult.ok) {
        return {
          kind: "unavailable",
          status: "unavailable",
          code: "auth_service_unreachable",
          message: resetResult.errorMessage,
        };
      }

      return {
        kind: "logged_out",
        status: "unauthenticated",
        message: neutralPasswordResetMessage,
      };
    },

    async updatePasswordWithSupabaseRuntime(
      newPassword: string,
    ): Promise<AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "disabled") {
        return client.result;
      }

      const updateResult = await client.auth.updatePassword(newPassword);

      if (!updateResult.ok) {
        return {
          kind: "unavailable",
          status: "unavailable",
          code: "auth_service_unreachable",
          message: updateResult.errorMessage,
        };
      }

      const signOutResult = await client.auth.signOut();

      if (!signOutResult.ok) {
        return {
          kind: "unavailable",
          status: "unavailable",
          code: "auth_service_unreachable",
          message: signOutResult.errorMessage,
        };
      }

      await dependencies.logoutFromBackendAuth();

      return {
        kind: "logged_out",
        status: "unauthenticated",
        message: "Password updated. Sign in again to continue.",
      };
    },

    async retryAccountBootstrapWithSupabaseRuntime(): Promise<AuthSessionResult | AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "disabled") {
        return client.result;
      }

      const accessTokenResult = await client.auth.getAccessToken();

      if (!accessTokenResult.ok || !accessTokenResult.data) {
        return {
          kind: "unauthenticated",
          status: "unauthenticated",
          reason: "missing_credentials",
          message: "Sign in is required before account setup can be retried.",
        };
      }

      const bootstrapResult = await dependencies.bootstrapAccount(
        accessTokenResult.data,
      );
      const mappedBootstrapResult = mapBootstrapResponseToAuthResult(bootstrapResult);

      if (
        mappedBootstrapResult.kind === "authenticated" ||
        bootstrapResult?.kind === "workspace_bootstrap_blocked"
      ) {
        return refreshSessionAfterProviderAuth(accessTokenResult.data);
      }

      return mappedBootstrapResult;
    },

    async logoutFromAuthRuntime(): Promise<AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "ready") {
        const signOutResult = await client.auth.signOut();

        if (!signOutResult.ok) {
          return {
            kind: "unavailable",
            status: "unavailable",
            code: "auth_service_unreachable",
            message: signOutResult.errorMessage,
          };
        }
      }

      return dependencies.logoutFromBackendAuth();
    },
  };
};

const defaultAuthRuntimeService = createAuthRuntimeService();

export const loginWithSupabaseRuntime =
  defaultAuthRuntimeService.loginWithSupabaseRuntime;
export const signUpWithSupabaseRuntime =
  defaultAuthRuntimeService.signUpWithSupabaseRuntime;
export const requestPasswordResetWithSupabaseRuntime =
  defaultAuthRuntimeService.requestPasswordResetWithSupabaseRuntime;
export const updatePasswordWithSupabaseRuntime =
  defaultAuthRuntimeService.updatePasswordWithSupabaseRuntime;
export const retryAccountBootstrapWithSupabaseRuntime =
  defaultAuthRuntimeService.retryAccountBootstrapWithSupabaseRuntime;
export const logoutFromAuthRuntime =
  defaultAuthRuntimeService.logoutFromAuthRuntime;
