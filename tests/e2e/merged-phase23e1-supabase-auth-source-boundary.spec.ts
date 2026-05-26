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
  test("frontend source keeps supabase auth isolated to the approved wrapper path", () => {
    const sourceFiles = listFrontendSourceFiles("src");
    const supabaseImportFiles = sourceFiles.filter((relativePath) =>
      readSource(relativePath).includes("@supabase/supabase-js"),
    );
    const createClientFiles = sourceFiles.filter((relativePath) =>
      readSource(relativePath).includes("createClient("),
    );
    const nonWrapperSource = sourceFiles
      .filter(
        (relativePath) =>
          relativePath !==
            path.join("src", "services", "auth", "supabaseAuthClient.ts") &&
          relativePath !==
            path.join("src", "services", "auth", "authRuntimeService.ts") &&
          relativePath !==
            path.join("src", "services", "auth", "supabaseAuthSessionBridge.ts"),
      )
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(sourceFiles).toContain(
      path.join("src", "services", "auth", "supabaseAuthClient.ts"),
    );
    expect(supabaseImportFiles).toEqual([
      path.join("src", "services", "auth", "supabaseAuthClient.ts"),
    ]);
    expect(createClientFiles).toEqual([
      path.join("src", "services", "auth", "supabaseAuthClient.ts"),
    ]);
    expect(nonWrapperSource).not.toContain("@supabase/supabase-js");
    expect(nonWrapperSource).not.toContain("createClient(");
  });
});
