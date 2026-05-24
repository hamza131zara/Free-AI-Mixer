import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23C-1 no frontend or runtime expansion", () => {
  test("frontend remains unchanged and no event persistence or admin analytics wiring is added", () => {
    const frontendSources = [
      readSource("src/services/authService.ts"),
      readSource("src/store/authStore.ts"),
      readSource("src/App.tsx"),
      readSource("src/main.tsx"),
      readSource("src/pages/DashboardPage.tsx"),
      readSource("src/pages/ProviderSettingsPage.tsx"),
      readSource("src/pages/ProjectsPage.tsx"),
      readSource("src/pages/ExportHistoryPage.tsx"),
    ].join("\n");
    const backendBoundarySources = [
      readSource("backend/composition/backendDependencies.ts"),
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
    ].join("\n");

    expect(frontendSources).not.toContain("@supabase/supabase-js");
    expect(frontendSources).not.toContain("createClient(");
    expect(frontendSources).not.toContain(".storage.from(");
    expect(frontendSources).not.toContain("localStorage.setItem");
    expect(frontendSources).not.toContain("sessionStorage.setItem");
    expect(frontendSources).not.toContain("fakeSession");
    expect(frontendSources).not.toContain("fakeWorkspace");
    expect(frontendSources).not.toContain("service_role");

    expect(backendBoundarySources).not.toContain("appendEvent(");
    expect(backendBoundarySources).not.toContain("appendAuditRecord(");
    expect(backendBoundarySources).not.toContain("analyticsEventRepository");
    expect(backendBoundarySources).not.toContain("auditLogRepository");
    expect(backendBoundarySources).toContain("admin_analytics_unavailable");
  });
});
