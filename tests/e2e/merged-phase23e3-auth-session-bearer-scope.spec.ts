import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getAuthSession } from "../../src/services/authService";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-3 auth session bearer scope", () => {
  test("auth service attaches bearer only for backend session requests", async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ headers?: HeadersInit; url: string }> = [];

    globalThis.fetch = async (input, init) => {
      fetchCalls.push({
        headers: init?.headers,
        url: String(input),
      });

      return new Response(
        JSON.stringify({
          kind: "unauthenticated_session",
          status: "unauthenticated",
          reason: "invalid_credentials",
          message: "Sign in is required for this route.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    };

    try {
      await getAuthSession("phase23e3-token");
      await getAuthSession();
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchCalls).toEqual([
      {
        headers: {
          Authorization: "Bearer phase23e3-token",
        },
        url: "/auth/session",
      },
      {
        headers: undefined,
        url: "/auth/session",
      },
    ]);
  });

  test("protected services remain free of bearer attachment", () => {
    const protectedServiceSource = [
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/services/creditsService.ts"),
      readSource("src/services/exportHistoryService.ts"),
    ].join("\n");

    expect(protectedServiceSource).not.toContain("Authorization");
    expect(protectedServiceSource).not.toContain("Bearer ");
  });
});
