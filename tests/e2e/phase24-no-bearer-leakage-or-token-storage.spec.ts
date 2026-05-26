import { expect, test } from "@playwright/test";
import { createAuthenticatedFetch } from "../../src/services/auth/authenticatedFetch";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase24 no bearer leakage or token storage", () => {
  test("authenticated fetch rejects external urls and auth runtime sources do not store tokens", async () => {
    const authenticatedFetch = createAuthenticatedFetch({
      fetch: async () =>
        new Response("{}", {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      getSupabaseAuthClient: () => ({
        kind: "supabase_auth_client_disabled",
        reason: "missing_supabase_url",
      }),
    });

    await expect(
      authenticatedFetch("https://example.com/should-not-work", { method: "GET" }),
    ).rejects.toThrow(
      "Authenticated account requests must use same-origin relative backend paths.",
    );

    const frontendSource = [
      readSource("src/services/auth/authRuntimeService.ts"),
      readSource("src/services/auth/authenticatedFetch.ts"),
      readSource("src/store/authStore.ts"),
      readSource("src/pages/LoginPage.tsx"),
      readSource("src/pages/SignupPage.tsx"),
    ].join("\n");

    expect(frontendSource).not.toContain("localStorage.setItem");
    expect(frontendSource).not.toContain("sessionStorage.setItem");
    expect(frontendSource).not.toContain("persist(");
    expect(frontendSource).not.toContain("createJSONStorage(");
    expect(frontendSource).not.toContain("refresh_token");
    expect(frontendSource).not.toContain("rawUser");
    expect(frontendSource).not.toContain("user_metadata");
    expect(frontendSource).not.toContain("app_metadata");
  });
});
