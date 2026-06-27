import { getSupabaseAuthClient } from "./supabaseAuthClient";

const allowedAuthenticatedPaths = new Set([
  "/project-library/projects",
  "/project-library/history",
  "/provider-settings/status",
  "/provider-settings/connections",
  "/generation/jobs",
  "/generation/history",
  "/credits/status",
]);

const isSameOriginRelativePath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//");

const toRelativePathname = (value: string): string => {
  try {
    return new URL(value, "https://free-ai-mixer.local").pathname;
  } catch {
    return value;
  }
};

const providerConnectionMutationPathPattern =
  /^\/provider-settings\/connections\/(openai|runway|luma|google|stability|replicate)(\/test)?$/;
const projectLibraryProjectRecordPathPattern =
  /^\/project-library\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const generatedImagePreviewPathPattern =
  /^\/generation\/jobs\/[A-Za-z0-9_-]{1,120}\/artifacts\/[A-Za-z0-9_-]{1,120}\/preview$/;
const activeProjectPreferencePath = "/project-library/active-project";

const isAllowedAuthenticatedRequest = (
  value: string,
  method: string | undefined,
): boolean =>
  (value === activeProjectPreferencePath
    ? method === "PUT" || method === "DELETE"
    : allowedAuthenticatedPaths.has(value)) ||
  providerConnectionMutationPathPattern.test(value) ||
  projectLibraryProjectRecordPathPattern.test(value) ||
  generatedImagePreviewPathPattern.test(value);

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

    if (
      !isAllowedAuthenticatedRequest(
        toRelativePathname(input),
        init?.method?.toUpperCase(),
      )
    ) {
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
