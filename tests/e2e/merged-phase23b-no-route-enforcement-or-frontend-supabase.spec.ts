import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23B no route enforcement or frontend supabase", () => {
  test("bridge remains backend-only and route enforcement stays deferred", () => {
    const untouchedRouteSources = [
      readSource("backend/routes/providerSettings.ts"),
      readSource("backend/routes/projectHistory.ts"),
      readSource("backend/routes/credits.ts"),
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/billing.ts"),
    ].join("\n");
    const authBoundarySources = [
      readSource("backend/app.ts"),
      readSource("backend/routes/auth.ts"),
      readSource("backend/auth/requesterContextResolver.ts"),
      readSource("backend/auth/requesterContext.ts"),
      readSource("backend/auth/workspaceMembershipLookup.ts"),
    ].join("\n");
    const frontendSources = [
      readSource("src/services/authService.ts"),
      readSource("src/store/authStore.ts"),
      readSource("src/App.tsx"),
      readSource("src/main.tsx"),
      readSource("src/pages/DashboardPage.tsx"),
      readSource("src/pages/AdminPage.tsx"),
    ].join("\n");
    const persistenceSources = [
      readSource("backend/composition/backendDependencies.ts"),
      readSource("backend/routes/admin.ts"),
    ].join("\n");

    expect(authBoundarySources).toContain(
      "createRepositoryBackedRequesterContextResolver",
    );
    expect(authBoundarySources).not.toContain("listRolesForUser");
    expect(untouchedRouteSources).not.toContain(
      "createRepositoryBackedRequesterContextResolver",
    );
    expect(untouchedRouteSources).not.toContain("requesterContextResolver:");
    expect(untouchedRouteSources).not.toContain("workspaceAuthority");
    expect(untouchedRouteSources).not.toContain("throw new ExportApiError(401");
    expect(untouchedRouteSources).not.toContain("throw new ExportApiError(403");

    expect(frontendSources).not.toContain("@supabase/supabase-js");
    expect(frontendSources).not.toContain("createClient(");
    expect(frontendSources).not.toContain(".storage.from(");
    expect(frontendSources).not.toContain("service_role");
    expect(frontendSources).not.toContain("fakeSession");
    expect(frontendSources).not.toContain("fakeWorkspace");

    expect(persistenceSources).not.toContain("appendEvent(");
    expect(persistenceSources).not.toContain("appendAuditRecord(");
    expect(persistenceSources).not.toContain("analyticsEventRepository");
    expect(persistenceSources).not.toContain("auditLogRepository");
    expect(persistenceSources).toContain("admin_analytics_unavailable");
  });
});
