import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { decideExportOwnerScopeAccess } from "../../backend/auth/exportAuthorization";
import {
  createAuthenticatedSessionExportRequesterContext,
  createAuthenticatedTokenExportRequesterContext,
  createLocalDevFallbackExportRequesterContext,
} from "../../backend/requester/exportRequesterContext";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase85 export authorization decision boundary pack", () => {
  test("authorization helper makes owner and workspace decisions without route enforcement", async () => {
    expect(
      decideExportOwnerScopeAccess(
        createLocalDevFallbackExportRequesterContext(),
        {
          ownerId: "local-dev-owner",
          workspaceId: "local-dev-workspace",
        },
      ),
    ).toEqual({
      kind: "unauthorized",
      reason: "local_dev_fallback_not_production_auth",
    });

    expect(
      decideExportOwnerScopeAccess(
        createAuthenticatedSessionExportRequesterContext({
          ownerId: "owner-a",
          workspaceId: "workspace-a",
        }),
        {
          ownerId: "owner-a",
          workspaceId: "workspace-a",
        },
      ),
    ).toEqual({
      kind: "authorized",
      ownerId: "owner-a",
      workspaceId: "workspace-a",
    });

    expect(
      decideExportOwnerScopeAccess(
        createAuthenticatedTokenExportRequesterContext({
          ownerId: "owner-a",
          workspaceId: "workspace-a",
        }),
        {
          ownerId: "owner-b",
          workspaceId: "workspace-a",
        },
      ),
    ).toEqual({
      kind: "forbidden",
      reason: "owner_mismatch",
    });

    expect(
      decideExportOwnerScopeAccess(
        createAuthenticatedTokenExportRequesterContext({
          ownerId: "owner-a",
          workspaceId: "workspace-a",
        }),
        {
          ownerId: "owner-a",
          workspaceId: "workspace-b",
        },
      ),
    ).toEqual({
      kind: "forbidden",
      reason: "workspace_mismatch",
    });
  });

  test("authorization helper remains pure and is not wired into routes yet", async () => {
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const requesterSource = readSource("backend/requester/exportRequesterContext.ts");

    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(authorizationSource).toContain("local_dev_fallback_not_production_auth");
    expect(authorizationSource).toContain("owner_mismatch");
    expect(authorizationSource).toContain("workspace_mismatch");

    expect(requesterSource).toContain("createAuthenticatedSessionExportRequesterContext");
    expect(requesterSource).toContain("createAuthenticatedTokenExportRequesterContext");
    expect(requesterSource).toContain("createLocalDevFallbackExportRequesterContext");

    // Phase 85 adds a pure helper only. Route enforcement remains deferred.
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    expect(authorizationSource).not.toContain("fakeSession");
    expect(authorizationSource).not.toContain("mockAuthenticatedUser");
    expect(authorizationSource).not.toContain("service_role");
    expect(authorizationSource).not.toContain("SERVICE_ROLE");
    expect(authorizationSource).not.toContain("createSignedUrl");
    expect(authorizationSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked from authorization bypasses", async () => {
    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});
