import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const readTree = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);

  if (!existsSync(fullPath)) {
    return "";
  }

  const sources: string[] = [];

  const visit = (currentPath: string): void => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (/\.(ts|tsx|sql|md)$/.test(entry.name)) {
        sources.push(readFileSync(entryPath, "utf8"));
      }
    }
  };

  visit(fullPath);

  return sources.join("\n");
};

test.describe("phase80 requester context boundary pack", () => {
  test("requester context boundary exists without fake auth or broad route enforcement", async () => {
    const requesterContextSource = readSource("backend/auth/requesterContext.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const exportContractsSource = readSource("backend/contracts/exportHttpTypes.ts");

    expect(requesterContextSource).toContain("BackendRequesterContext");
    expect(requesterContextSource).toContain("unauthenticated");
    expect(requesterContextSource).toContain("authenticated");
    expect(requesterContextSource).toContain("auth_not_configured");
    expect(requesterContextSource).toContain("missing_credentials");
    expect(requesterContextSource).toContain("invalid_credentials");
    expect(requesterContextSource).toContain("createUnauthenticatedRequesterContext");
    expect(requesterContextSource).toContain("isAuthenticatedRequesterContext");

    expect(requesterContextSource).not.toContain("fakeSession");
    expect(requesterContextSource).not.toContain("mockAuthenticatedUser");
    expect(requesterContextSource).not.toContain("localStorage");
    expect(requesterContextSource).not.toContain("service_role");
    expect(requesterContextSource).not.toContain("SERVICE_ROLE");

    expect(exportContractsSource).toContain("ownerId");
    expect(exportContractsSource).toContain("workspaceId");

    // Phase 80 adds a contract boundary only; route enforcement remains deferred.
    expect(routeSource).not.toContain("createUnauthenticatedRequesterContext");
    expect(routeSource).not.toContain("isAuthenticatedRequesterContext");
  });

  test("frontend remains backend mediated with no direct supabase storage access", async () => {
    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
  });

  test("public artifact delivery remains blocked until auth rls and ownership enforcement", async () => {
    const requesterContextSource = readSource("backend/auth/requesterContext.ts");
    const artifactSource = readTree("backend/artifacts");
    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(requesterContextSource).toContain("BackendRequesterContext");

    expect(artifactSource).toContain("local_dev_stream");
    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});
