import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { decideExportOwnerScopeAccess } from "../../backend/auth/exportAuthorization";
import { mapExportAuthorizationDecisionToRouteGuard } from "../../backend/auth/exportAuthorizationRouteGuard";
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

test.describe("phase86 export authorization route guard boundary pack", () => {
  test("route guard maps authorization decisions to future safe 401 and 403 outcomes", async () => {
    const localDevDecision = decideExportOwnerScopeAccess(
      createLocalDevFallbackExportRequesterContext(),
      {
        ownerId: "local-dev-owner",
        workspaceId: "local-dev-workspace",
      },
    );

    expect(mapExportAuthorizationDecisionToRouteGuard(localDevDecision)).toEqual({
      kind: "blocked",
      statusCode: 401,
      code: "auth_required",
      reason: "local_dev_fallback_not_production_auth",
    });

    const authorizedDecision = decideExportOwnerScopeAccess(
      createAuthenticatedSessionExportRequesterContext({
        ownerId: "owner-a",
        workspaceId: "workspace-a",
      }),
      {
        ownerId: "owner-a",
        workspaceId: "workspace-a",
      },
    );

    expect(mapExportAuthorizationDecisionToRouteGuard(authorizedDecision)).toEqual({
      kind: "allowed",
      ownerId: "owner-a",
      workspaceId: "workspace-a",
    });

    const ownerMismatchDecision = decideExportOwnerScopeAccess(
      createAuthenticatedTokenExportRequesterContext({
        ownerId: "owner-a",
        workspaceId: "workspace-a",
      }),
      {
        ownerId: "owner-b",
        workspaceId: "workspace-a",
      },
    );

    expect(mapExportAuthorizationDecisionToRouteGuard(ownerMismatchDecision)).toEqual({
      kind: "blocked",
      statusCode: 403,
      code: "forbidden",
      reason: "owner_mismatch",
    });

    const workspaceMismatchDecision = decideExportOwnerScopeAccess(
      createAuthenticatedTokenExportRequesterContext({
        ownerId: "owner-a",
        workspaceId: "workspace-a",
      }),
      {
        ownerId: "owner-a",
        workspaceId: "workspace-b",
      },
    );

    expect(mapExportAuthorizationDecisionToRouteGuard(workspaceMismatchDecision)).toEqual({
      kind: "blocked",
      statusCode: 403,
      code: "forbidden",
      reason: "workspace_mismatch",
    });
  });

  test("route guard remains pure and is not wired into export routes yet", async () => {
    const routeGuardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(routeGuardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeGuardSource).toContain("statusCode: 401");
    expect(routeGuardSource).toContain("statusCode: 403");
    expect(routeGuardSource).toContain("auth_required");
    expect(routeGuardSource).toContain("forbidden");

    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");

    // Phase 86 adds route-safe mapping only. Route enforcement remains deferred.
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    expect(routeGuardSource).not.toContain("fakeSession");
    expect(routeGuardSource).not.toContain("mockAuthenticatedUser");
    expect(routeGuardSource).not.toContain("service_role");
    expect(routeGuardSource).not.toContain("SERVICE_ROLE");
    expect(routeGuardSource).not.toContain("createSignedUrl");
    expect(routeGuardSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked from route authorization bypasses", async () => {
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
