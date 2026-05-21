import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createAuthNotConfiguredRequesterContextResolver,
  resolveRequesterContext,
} from "../../backend/auth/requesterContextResolver";

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

test.describe("phase81 requester context resolver boundary pack", () => {
  test("resolver returns explicit unauthenticated state without fabricating identity", async () => {
    const resolver = createAuthNotConfiguredRequesterContextResolver();

    expect(resolver.resolve()).toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });

    expect(
      resolveRequesterContext({
        headers: {
          authorization: "Bearer fake-token",
          "x-user-id": "fake-user",
          "x-workspace-id": "fake-workspace",
        },
      }),
    ).toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });
  });

  test("source keeps requester resolver as boundary only with no route enforcement or fake auth", async () => {
    const requesterContextSource = readSource("backend/auth/requesterContext.ts");
    const resolverSource = readSource("backend/auth/requesterContextResolver.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");
    const serverSource = readSource("backend/server.ts");

    expect(requesterContextSource).toContain("BackendRequesterContext");
    expect(resolverSource).toContain("createAuthNotConfiguredRequesterContextResolver");
    expect(resolverSource).toContain("resolveRequesterContext");
    expect(resolverSource).toContain("auth_not_configured");

    expect(resolverSource).not.toContain("fakeSession");
    expect(resolverSource).not.toContain("mockAuthenticatedUser");
    expect(resolverSource).not.toContain("localStorage");
    expect(resolverSource).not.toContain("service_role");
    expect(resolverSource).not.toContain("SERVICE_ROLE");
    expect(resolverSource).not.toContain("createClient(");

    // Route/app/server enforcement remains deferred.
    expect(routeSource).not.toContain("resolveRequesterContext");
    expect(routeSource).not.toContain("createAuthNotConfiguredRequesterContextResolver");
    expect(appSource).not.toContain("resolveRequesterContext");
    expect(serverSource).not.toContain("resolveRequesterContext");
  });

  test("artifact delivery remains backend mediated and blocked for production auth gaps", async () => {
    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactSource = readTree("backend/artifacts");
    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).toContain("local_dev_stream");
    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});
