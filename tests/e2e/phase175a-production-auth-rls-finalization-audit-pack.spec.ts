import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase175a production auth rls finalization audit pack", () => {
  test("export routes still avoid trusted header auth shortcuts and keep authorization boundaries", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const trustedAuthSource = readIfExists("backend/auth/trustedAuthMiddleware.ts");
    const exportAuthorizationSource = readIfExists("backend/auth/exportAuthorization.ts");
    const routeGuardSource = readIfExists("backend/auth/exportAuthorizationRouteGuard.ts");

    const combinedAuthSource =
      routeSource +
      "\n" +
      trustedAuthSource +
      "\n" +
      exportAuthorizationSource +
      "\n" +
      routeGuardSource;

    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");
    expect(routeSource).toContain("sendExportRouteAuthorizationFailure");
    expect(routeSource).toContain("authorizationMode");
    expect(routeSource).toContain("ownerId");
    expect(routeSource).toContain("workspaceId");

    expect(combinedAuthSource).not.toContain('req.headers["x-user-id"]');
    expect(combinedAuthSource).not.toContain('req.headers["x-workspace-id"]');
    expect(combinedAuthSource).not.toContain("fakeSession");
    expect(combinedAuthSource).not.toContain("mockAuthenticatedUser");
    expect(combinedAuthSource).not.toContain("trustUserHeader");
    expect(combinedAuthSource).not.toContain("trustWorkspaceHeader");
  });

  test("workspace rls readiness remains explicit and blocks unsafe delivery readiness", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const workspaceMembershipSource =
      readIfExists("backend/auth/workspaceMembership.ts") +
      "\n" +
      readIfExists("backend/auth/workspaceMembershipRepository.ts") +
      "\n" +
      readIfExists("backend/auth/workspaceMembershipEnforcement.ts");
    const rlsSource =
      readIfExists("backend/auth/supabaseRlsVerification.ts") +
      "\n" +
      readIfExists("docs/security/phase140-supabase-rls-policy-draft.sql");

    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");
    expect(routeSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain("workspace_or_rls_not_ready");

    const normalizedWorkspaceRlsSource =
      (workspaceMembershipSource + rlsSource).toLowerCase();

    expect(normalizedWorkspaceRlsSource).toContain("workspace");
    expect(normalizedWorkspaceRlsSource).toContain("rls");

    expect(routeSource.indexOf("workspaceMembershipOrRlsReady: false")).toBeLessThan(
      routeSource.indexOf("generateSignedUrl"),
    );
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: true");
    expect(routeSource.indexOf("workspaceMembershipOrRlsReady: true")).toBeGreaterThan(
      routeSource.indexOf('readyPreconditionsDecision.kind !== "ready"'),
    );
    expect(routeSource).not.toContain("production_ready_public_delivery");
    expect(routeSource).not.toContain("public_launch_enabled");
  });

  test("frontend remains backend mediated with no direct supabase storage auth or service role behavior", async () => {
    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    const backendRouteSource = readSource("backend/routes/exports.ts");

    expect(frontendSource).toContain("artifact_delivery_ready");
    expect(frontendSource).toContain("backend_signed_url");
    expect(frontendSource).toContain("navigateToArtifactDownloadDescriptor");

    expect(backendRouteSource).toContain("signedUrlDeliveryProvider");
    expect(backendRouteSource).toContain("resolveProductionStorageReadiness");
    expect(backendRouteSource).toContain("getExportRouteAuthorizationFailure");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE");
    expect(frontendSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE");
  });
});



