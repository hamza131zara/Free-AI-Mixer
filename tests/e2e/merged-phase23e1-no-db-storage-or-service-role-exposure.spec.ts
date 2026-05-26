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

test.describe("merged phase 23E-1 no db storage or service role exposure", () => {
  test("frontend source forbids direct supabase db storage and service role env usage", () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain(".from(");
    expect(frontendSource).not.toContain(".storage");
    expect(frontendSource).not.toContain(
      "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(frontendSource).not.toContain("FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY");
    expect(frontendSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
    expect(frontendSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
