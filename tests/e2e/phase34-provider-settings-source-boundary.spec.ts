import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

test.describe("phase34 provider settings source boundary", () => {
  test("ProviderSettingsPage has no raw API key input fields or fake connected state", async () => {
    const source = await readSource("src/pages/ProviderSettingsPage.tsx");

    expect(source).not.toContain('type="password"');
    expect(source).not.toContain('name="apiKey"');
    expect(source).not.toContain('name="providerKey"');
    expect(source).not.toContain("placeholder=\"API key");
    expect(source).not.toContain("onChange={(event) =>");
    expect(source).not.toContain("setApiKey");
    expect(source).not.toContain("setProviderKey");
    expect(source).not.toContain("localStorage.setItem");
    expect(source).not.toContain("localStorage.getItem");
    expect(source).not.toContain("localStorage.removeItem");
    expect(source).not.toContain("sessionStorage.setItem");
    expect(source).not.toContain("sessionStorage.getItem");
    expect(source).not.toContain("sessionStorage.removeItem");
    expect(source).not.toContain("window.localStorage");
    expect(source).not.toContain("window.sessionStorage");
    expect(source).toContain("disabled");
    expect(source).toContain("not_connected");
    expect(source).toContain("not_enabled_yet");
    expect(source).not.toContain("connected_success");
    expect(source).not.toContain("verification_success");
    expect(source).not.toContain("fake_success");
  });

  test("providerSettingsStore has no raw key state or browser persistence", async () => {
    const source = await readSource("src/store/providerSettingsStore.ts");

    expect(source).not.toContain("apiKey");
    expect(source).not.toContain("providerKey");
    expect(source).not.toContain("plaintextKey");
    expect(source).not.toContain("replacementPlaintextKey");
    expect(source).not.toContain("secretRef");
    expect(source).not.toContain("localStorage.setItem");
    expect(source).not.toContain("localStorage.getItem");
    expect(source).not.toContain("localStorage.removeItem");
    expect(source).not.toContain("sessionStorage.setItem");
    expect(source).not.toContain("sessionStorage.getItem");
    expect(source).not.toContain("sessionStorage.removeItem");
    expect(source).not.toContain("window.localStorage");
    expect(source).not.toContain("window.sessionStorage");
    expect(source).not.toContain("persist(");
  });

  test("providerSettingsService does not send provider keys or call providers directly", async () => {
    const source = await readSource("src/services/providerSettingsService.ts");

    expect(source).not.toContain("apiKey:");
    expect(source).not.toContain("providerKey:");
    expect(source).not.toContain("plaintextKey");
    expect(source).not.toContain("replacementPlaintextKey");
    expect(source).not.toContain("secretRef");
    expect(source).not.toContain("api.openai.com");
    expect(source).not.toContain("replicate.com");
    expect(source).not.toContain("runwayml");
    expect(source).not.toContain("api.runway");
    expect(source).not.toContain("lumalabs.ai");
    expect(source).not.toContain("api.luma");
    expect(source).not.toContain("generativelanguage.googleapis.com");
    expect(source).not.toContain("@openai/");
    expect(source).not.toContain("openai.chat");
    expect(source).not.toContain("@replicate/");
    expect(source).not.toContain("new Replicate");
    expect(source).not.toContain("@runway");
    expect(source).not.toContain("@luma");
    expect(source).not.toContain('fetch("https://');
    expect(source).not.toContain("fetch(`https://");
    expect(source).not.toContain(".storage.from(");
    expect(source).not.toContain(".from(");
    expect(source).not.toContain("localStorage.setItem");
    expect(source).not.toContain("localStorage.getItem");
    expect(source).not.toContain("localStorage.removeItem");
    expect(source).not.toContain("sessionStorage.setItem");
    expect(source).not.toContain("sessionStorage.getItem");
    expect(source).not.toContain("sessionStorage.removeItem");
    expect(source).not.toContain("window.localStorage");
    expect(source).not.toContain("window.sessionStorage");
  });

  test("authenticatedFetch does not expand bearer attachment to provider settings mutation routes", async () => {
    const source = await readSource("src/services/auth/authenticatedFetch.ts");

    expect(source).toContain('"/provider-settings/status"');
    expect(source).not.toContain('"/provider-settings/connections"');
    expect(source).not.toContain('"/provider-settings/connections/');
    expect(source).not.toContain('"/provider-settings/routing-policy"');
    expect(source).toContain("allowedAuthenticatedPaths");
    expect(source).toContain("isSameOriginRelativePath");
  });

  test("frontend provider settings boundary has no Supabase DB storage provider SDK or fake success expansion", async () => {
    const combinedSource = [
      await readSource("src/pages/ProviderSettingsPage.tsx"),
      await readSource("src/services/providerSettingsService.ts"),
      await readSource("src/store/providerSettingsStore.ts"),
      await readSource("src/services/auth/authenticatedFetch.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain(".storage.from(");
    expect(combinedSource).not.toContain(".from(");
    expect(combinedSource).not.toContain("createClient(");
    expect(combinedSource).not.toContain("@supabase/");
    expect(combinedSource).not.toContain("@aws-sdk/");
    expect(combinedSource).not.toContain("@google-cloud/storage");
    expect(combinedSource).not.toContain("@azure/storage");
    expect(combinedSource).not.toContain("api.openai.com");
    expect(combinedSource).not.toContain("replicate.com");
    expect(combinedSource).not.toContain("runwayml");
    expect(combinedSource).not.toContain("api.runway");
    expect(combinedSource).not.toContain("lumalabs.ai");
    expect(combinedSource).not.toContain("api.luma");
    expect(combinedSource).not.toContain("generativelanguage.googleapis.com");
    expect(combinedSource).not.toContain("@openai/");
    expect(combinedSource).not.toContain("@replicate/");
    expect(combinedSource).not.toContain("@runway");
    expect(combinedSource).not.toContain("@luma");
    expect(combinedSource).not.toContain('fetch("https://');
    expect(combinedSource).not.toContain("fetch(`https://");
    expect(combinedSource).not.toContain("connected_success");
    expect(combinedSource).not.toContain("verification_success");
    expect(combinedSource).not.toContain("fake_success");
  });
});
