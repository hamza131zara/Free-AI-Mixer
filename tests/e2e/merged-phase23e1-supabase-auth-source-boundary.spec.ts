import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const listFrontendSourceFiles = (directory: string): string[] => {
  const fullPath = path.join(projectRoot, directory);
  const entries = readdirSync(fullPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFrontendSourceFiles(relativePath);
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return [relativePath];
    }

    return [];
  });
};

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-1 supabase auth source boundary", () => {
  test("frontend source keeps supabase auth inactive and uninitialized", () => {
    const sourceFiles = listFrontendSourceFiles("src");
    const frontendSource = sourceFiles
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(sourceFiles).not.toContain(
      path.join("src", "services", "auth", "supabaseAuthClient.ts"),
    );
    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".auth.signInWithPassword");
    expect(frontendSource).not.toContain(".auth.signUp");
    expect(frontendSource).not.toContain(".auth.signOut");
    expect(frontendSource).not.toContain(".auth.getSession");
    expect(frontendSource).not.toContain(".auth.onAuthStateChange");
  });
});
