import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  adaptAuthenticatedRequesterToExportRequesterContext,
  toExportOwnerScopeFromAuthenticatedRequester,
} from "../../backend/auth/exportRequesterContextAdapter";
import { createUnauthenticatedRequesterContext } from "../../backend/auth/requesterContext";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase88 authenticated requester export scope adapter boundary pack", () => {
  test("adapter converts only authenticated requester context into export requester context", async () => {
    expect(
      toExportOwnerScopeFromAuthenticatedRequester({
        kind: "authenticated",
        userId: "user-phase88",
        workspaceId: "workspace-phase88",
        authProvider: "future-provider",
        authSubject: "future-subject",
      }),
    ).toEqual({
      ownerId: "user-phase88",
      workspaceId: "workspace-phase88",
    });

    expect(
      adaptAuthenticatedRequesterToExportRequesterContext(
        {
          kind: "authenticated",
          userId: "user-phase88",
          workspaceId: "workspace-phase88",
        },
        "authenticated_session",
      ),
    ).toEqual({
      kind: "adapted",
      requesterContext: {
        ownerId: "user-phase88",
        workspaceId: "workspace-phase88",
        authMode: "authenticated_session",
      },
    });

    expect(
      adaptAuthenticatedRequesterToExportRequesterContext(
        {
          kind: "authenticated",
          userId: "user-phase88-token",
          workspaceId: "workspace-phase88-token",
        },
        "authenticated_token",
      ),
    ).toEqual({
      kind: "adapted",
      requesterContext: {
        ownerId: "user-phase88-token",
        workspaceId: "workspace-phase88-token",
        authMode: "authenticated_token",
      },
    });

    expect(
      adaptAuthenticatedRequesterToExportRequesterContext(
        createUnauthenticatedRequesterContext("auth_not_configured"),
        "authenticated_session",
      ),
    ).toEqual({
      kind: "not_authenticated",
      reason: "auth_not_configured",
    });
  });

  test("adapter remains pure and is not wired into routes yet", async () => {
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const requesterContextSource = readSource("backend/auth/requesterContext.ts");
    const exportRequesterSource = readSource("backend/requester/exportRequesterContext.ts");

    expect(adapterSource).toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(adapterSource).toContain("toExportOwnerScopeFromAuthenticatedRequester");
    expect(adapterSource).toContain("isAuthenticatedRequesterContext");
    expect(adapterSource).toContain("createAuthenticatedSessionExportRequesterContext");
    expect(adapterSource).toContain("createAuthenticatedTokenExportRequesterContext");

    expect(requesterContextSource).toContain("BackendRequesterContext");
    expect(exportRequesterSource).toContain("AuthenticatedSessionExportRequesterContext");
    expect(exportRequesterSource).toContain("AuthenticatedTokenExportRequesterContext");

    // Phase 88 adds adapter boundary only. Route wiring/enforcement remains deferred.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("toExportOwnerScopeFromAuthenticatedRequester");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");

    expect(adapterSource).not.toContain("fakeSession");
    expect(adapterSource).not.toContain("mockAuthenticatedUser");
    expect(adapterSource).not.toContain("localStorage");
    expect(adapterSource).not.toContain("service_role");
    expect(adapterSource).not.toContain("SERVICE_ROLE");
    expect(adapterSource).not.toContain("createSignedUrl");
    expect(adapterSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked from auth bypasses", async () => {
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
