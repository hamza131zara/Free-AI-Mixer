import { getSupabaseAuthClient } from "./supabaseAuthClient";

const allowedAuthenticatedPaths = new Set([
  "/project-library/projects",
  "/project-library/history",
  "/provider-settings/status",
  "/provider-settings/connections",
  "/credits/status",
]);

const isSameOriginRelativePath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//");

const providerConnectionMutationPathPattern =
  /^\/provider-settings\/connections\/(openai|runway|luma|google|stability|replicate)$/;

const isAllowedAuthenticatedPath = (value: string): boolean =>
  allowedAuthenticatedPaths.has(value) ||
  providerConnectionMutationPathPattern.test(value);

interface AuthenticatedFetchDependencies {
  fetch: typeof globalThis.fetch;
  getSupabaseAuthClient: typeof getSupabaseAuthClient;
}

const defaultDependencies: AuthenticatedFetchDependencies = {
  fetch: globalThis.fetch.bind(globalThis),
  getSupabaseAuthClient,
};

export const createAuthenticatedFetch = (
  dependencies: AuthenticatedFetchDependencies = defaultDependencies,
) => {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    if (!isSameOriginRelativePath(input)) {
      throw new Error(
        "Authenticated account requests must use same-origin relative backend paths.",
      );
    }

    if (!isAllowedAuthenticatedPath(input)) {
      return dependencies.fetch(input, init);
    }

    const authClient = dependencies.getSupabaseAuthClient();

    if (
      authClient.kind === "supabase_auth_client_disabled" ||
      !("auth" in authClient)
    ) {
      return dependencies.fetch(input, init);
    }

    const accessTokenResult = await authClient.auth.getAccessToken();

    if (!accessTokenResult.ok || !accessTokenResult.data) {
      return dependencies.fetch(input, init);
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessTokenResult.data}`);

    return dependencies.fetch(input, {
      ...init,
      headers,
    });
  };
};

export const fetchWithOptionalAccountBearer = createAuthenticatedFetch();
