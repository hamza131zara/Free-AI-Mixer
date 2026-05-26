import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const approvedWrapperPath = path.join(
  "src",
  "services",
  "auth",
  "supabaseAuthClient.ts",
);

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

test.describe("merged phase 23E-2 auth wrapper isolation", () => {
  test("only the approved wrapper imports and initializes supabase auth", () => {
    const sourceFiles = listFrontendSourceFiles("src");
    const supabaseImportFiles = sourceFiles.filter((relativePath) =>
      readSource(relativePath).includes("@supabase/supabase-js"),
    );
    const createClientFiles = sourceFiles.filter((relativePath) =>
      readSource(relativePath).includes("createClient("),
    );

    expect(supabaseImportFiles).toEqual([approvedWrapperPath]);
    expect(createClientFiles).toEqual([approvedWrapperPath]);
  });
});
