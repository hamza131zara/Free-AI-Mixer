import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

import {
  readFrontendSupabaseAuthReadiness,
  type FrontendSupabaseAuthReadiness,
  type FrontendSupabaseAuthReadinessEnv,
} from "./supabaseAuthReadiness";

type SupabaseAuthClientDisabledReason =
  | Exclude<
      FrontendSupabaseAuthReadiness,
      { kind: "supabase_auth_configured" }
    >["reason"]
  | "invalid_supabase_url";

export type SupabaseAuthClientStatus =
  | {
      kind: "supabase_auth_client_disabled";
      reason: SupabaseAuthClientDisabledReason;
      forbiddenEnvKey?: string;
    }
  | {
      kind: "supabase_auth_client_ready";
    };

export interface SupabaseAuthPasswordCredentials {
  email: string;
  password: string;
}

export interface SupabaseAuthSignupCredentials
  extends SupabaseAuthPasswordCredentials {
  emailRedirectTo?: string;
}

export interface SupabaseAuthPasswordResetInput {
  email: string;
  redirectTo?: string;
}

export interface SupabaseAuthSessionSnapshot {
  accessToken?: string;
  email?: string;
  expiresAt?: number;
  hasSession: boolean;
  userId?: string;
}

export interface SupabaseAuthSuccessResult<T> {
  data: T;
  ok: true;
}

export interface SupabaseAuthFailureResult {
  errorMessage: string;
  ok: false;
}

export type SupabaseAuthMethodResult<T> =
  | SupabaseAuthSuccessResult<T>
  | SupabaseAuthFailureResult;

export interface SupabaseAuthClientHandle {
  getAccessToken(): Promise<SupabaseAuthMethodResult<string | undefined>>;
  getSession(): Promise<SupabaseAuthMethodResult<SupabaseAuthSessionSnapshot>>;
  onAuthStateChange(
    callback: (
      event: AuthChangeEvent,
      session: SupabaseAuthSessionSnapshot,
    ) => void,
  ): { unsubscribe(): void };
  signInWithPassword(
    credentials: SupabaseAuthPasswordCredentials,
  ): Promise<SupabaseAuthMethodResult<SupabaseAuthSessionSnapshot>>;
  signOut(): Promise<SupabaseAuthMethodResult<undefined>>;
  signUp(
    credentials: SupabaseAuthSignupCredentials,
  ): Promise<SupabaseAuthMethodResult<SupabaseAuthSessionSnapshot>>;
  requestPasswordReset(
    input: SupabaseAuthPasswordResetInput,
  ): Promise<SupabaseAuthMethodResult<undefined>>;
  updatePassword(newPassword: string): Promise<SupabaseAuthMethodResult<undefined>>;
}

export type SupabaseAuthClientResult =
  | SupabaseAuthClientStatus
  | {
      auth: SupabaseAuthClientHandle;
      kind: "supabase_auth_client_ready";
    };

let cachedHandle: SupabaseAuthClientHandle | null = null;
let cachedHandleKey: string | null = null;

const DEFAULT_SIGN_IN_ERROR =
  "Supabase Auth sign-in could not be completed safely.";
const DEFAULT_SIGN_UP_ERROR =
  "Supabase Auth sign-up could not be completed safely.";
const DEFAULT_SIGN_OUT_ERROR =
  "Supabase Auth sign-out could not be completed safely.";
const DEFAULT_PASSWORD_RESET_ERROR =
  "Supabase Auth password reset request could not be completed safely.";
const DEFAULT_PASSWORD_UPDATE_ERROR =
  "Supabase Auth password update could not be completed safely.";
const DEFAULT_GET_SESSION_ERROR =
  "Supabase Auth session lookup could not be completed safely.";
const DEFAULT_GET_ACCESS_TOKEN_ERROR =
  "Supabase Auth access token lookup could not be completed safely.";

const getDefaultFrontendEnv = (): FrontendSupabaseAuthReadinessEnv =>
  ((import.meta as { env?: FrontendSupabaseAuthReadinessEnv }).env ?? {});

const normalizeErrorMessage = (
  error: { message?: string } | null | undefined,
  fallback: string,
): string =>
  typeof error?.message === "string" && error.message.trim().length > 0
    ? error.message.trim()
    : fallback;

const normalizeSessionSnapshot = (
  session: Session | null,
): SupabaseAuthSessionSnapshot => ({
  accessToken: session?.access_token,
  email:
    typeof session?.user?.email === "string" ? session.user.email : undefined,
  expiresAt: session?.expires_at,
  hasSession: session !== null,
  userId: session?.user?.id,
});

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const resolveSupabaseAuthClientConfiguration = (
  env: FrontendSupabaseAuthReadinessEnv,
):
  | {
      anonKey: string;
      kind: "supabase_auth_client_ready";
      projectUrl: string;
    }
  | {
      forbiddenEnvKey?: string;
      kind: "supabase_auth_client_disabled";
      reason: SupabaseAuthClientDisabledReason;
    } => {
  const readiness = readFrontendSupabaseAuthReadiness(env);

  if (readiness.kind === "supabase_auth_not_configured") {
    return {
      forbiddenEnvKey: readiness.forbiddenEnvKey,
      kind: "supabase_auth_client_disabled",
      reason: readiness.reason,
    };
  }

  if (!isValidHttpUrl(readiness.projectUrl)) {
    return {
      kind: "supabase_auth_client_disabled",
      reason: "invalid_supabase_url",
    };
  }

  return {
    anonKey: readiness.anonKey,
    kind: "supabase_auth_client_ready",
    projectUrl: readiness.projectUrl,
  };
};

const createSupabaseAuthHandle = (
  client: SupabaseClient,
): SupabaseAuthClientHandle => ({
  async getAccessToken() {
    const result = await client.auth.getSession();

    if (result.error) {
      return {
        errorMessage: normalizeErrorMessage(
          result.error,
          DEFAULT_GET_ACCESS_TOKEN_ERROR,
        ),
        ok: false,
      };
    }

    return {
      data: result.data.session?.access_token,
      ok: true,
    };
  },

  async getSession() {
    const result = await client.auth.getSession();

    if (result.error) {
      return {
        errorMessage: normalizeErrorMessage(
          result.error,
          DEFAULT_GET_SESSION_ERROR,
        ),
        ok: false,
      };
    }

    return {
      data: normalizeSessionSnapshot(result.data.session),
      ok: true,
    };
  },

  onAuthStateChange(callback) {
    const subscription = client.auth.onAuthStateChange((event, session) => {
      callback(event, normalizeSessionSnapshot(session));
    });

    return {
      unsubscribe() {
        subscription.data.subscription.unsubscribe();
      },
    };
  },

  async signInWithPassword(credentials) {
    const result = await client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (result.error) {
      return {
        errorMessage: normalizeErrorMessage(result.error, DEFAULT_SIGN_IN_ERROR),
        ok: false,
      };
    }

    return {
      data: normalizeSessionSnapshot(result.data.session),
      ok: true,
    };
  },

  async signOut() {
    const result = await client.auth.signOut();

    if (result.error) {
      return {
        errorMessage: normalizeErrorMessage(
          result.error,
          DEFAULT_SIGN_OUT_ERROR,
        ),
        ok: false,
      };
    }

    return {
      data: undefined,
      ok: true,
    };
  },

  async signUp(credentials) {
    const result = await client.auth.signUp({
      email: credentials.email,
      options: credentials.emailRedirectTo
        ? {
            emailRedirectTo: credentials.emailRedirectTo,
          }
        : undefined,
      password: credentials.password,
    });

    if (result.error) {
      return {
        errorMessage: normalizeErrorMessage(result.error, DEFAULT_SIGN_UP_ERROR),
        ok: false,
      };
    }

    return {
      data: normalizeSessionSnapshot(result.data.session),
      ok: true,
    };
  },

  async requestPasswordReset(input) {
    const result = await client.auth.resetPasswordForEmail(input.email, {
      redirectTo: input.redirectTo,
    });

    if (result.error) {
      return {
        errorMessage: normalizeErrorMessage(
          result.error,
          DEFAULT_PASSWORD_RESET_ERROR,
        ),
        ok: false,
      };
    }

    return {
      data: undefined,
      ok: true,
    };
  },

  async updatePassword(newPassword) {
    const result = await client.auth.updateUser({
      password: newPassword,
    });

    if (result.error) {
      return {
        errorMessage: normalizeErrorMessage(
          result.error,
          DEFAULT_PASSWORD_UPDATE_ERROR,
        ),
        ok: false,
      };
    }

    return {
      data: undefined,
      ok: true,
    };
  },
});

const getOrCreateSupabaseAuthHandle = (
  projectUrl: string,
  anonKey: string,
): SupabaseAuthClientHandle => {
  const cacheKey = `${projectUrl}::${anonKey}`;

  if (cachedHandle && cachedHandleKey === cacheKey) {
    return cachedHandle;
  }

  const client = createClient(projectUrl, anonKey);
  cachedHandle = createSupabaseAuthHandle(client);
  cachedHandleKey = cacheKey;
  return cachedHandle;
};

export const getSupabaseAuthClientStatus = (
  env: FrontendSupabaseAuthReadinessEnv = getDefaultFrontendEnv(),
): SupabaseAuthClientStatus => {
  const configuration = resolveSupabaseAuthClientConfiguration(env);

  if (configuration.kind === "supabase_auth_client_disabled") {
    return configuration;
  }

  return {
    kind: "supabase_auth_client_ready",
  };
};

export const getSupabaseAuthClient = (
  env: FrontendSupabaseAuthReadinessEnv = getDefaultFrontendEnv(),
): SupabaseAuthClientResult => {
  const configuration = resolveSupabaseAuthClientConfiguration(env);

  if (configuration.kind === "supabase_auth_client_disabled") {
    return configuration;
  }

  return {
    auth: getOrCreateSupabaseAuthHandle(
      configuration.projectUrl,
      configuration.anonKey,
    ),
    kind: "supabase_auth_client_ready",
  };
};
