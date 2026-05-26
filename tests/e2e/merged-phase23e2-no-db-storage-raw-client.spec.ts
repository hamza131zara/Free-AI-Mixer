import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-2 no db storage or raw client exposure", () => {
  test("wrapper stays auth-only and does not export raw supabase access", () => {
    const wrapperSource = readSource("src/services/auth/supabaseAuthClient.ts");
    const frontendSource = readSource("src/services/auth/supabaseAuthClient.ts");

    expect(wrapperSource).not.toContain(".from(");
    expect(wrapperSource).not.toContain(".storage");
    expect(wrapperSource).not.toContain(".channel(");
    expect(wrapperSource).not.toContain(".functions.");
    expect(wrapperSource).not.toContain("export const supabaseClient");
    expect(wrapperSource).not.toContain("return client;");
    expect(frontendSource).toContain("signInWithPassword");
    expect(frontendSource).toContain("signUp");
    expect(frontendSource).toContain("signOut");
    expect(frontendSource).toContain("getSession");
    expect(frontendSource).toContain("onAuthStateChange");
  });
});
