import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23D-1 no runtime expansion", () => {
  test("frontend shell stays frontend-only and deferred backend/runtime boundaries remain unchanged", () => {
    const frontendSources = [
      readSource("src/App.tsx"),
      readSource("src/components/ProtectedRouteShell.tsx"),
      readSource("src/store/authStore.ts"),
      readSource("src/services/authService.ts"),
      readSource("src/pages/AdminPage.tsx"),
      readSource("src/pages/ExportHistoryPage.tsx"),
    ].join("\n");
    const deferredBackendSources = [
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/billing.ts"),
      readSource("backend/routes/auth.ts"),
    ].join("\n");

    expect(frontendSources).not.toContain("@supabase/supabase-js");
    expect(frontendSources).not.toContain("createClient(");
    expect(frontendSources).not.toContain("sessionStorage.setItem");
    expect(frontendSources).not.toContain("localStorage.setItem(\"auth");
    expect(frontendSources).not.toContain("window.location.href");
    expect(frontendSources).not.toContain("fakeSession");
    expect(frontendSources).not.toContain("fakeWorkspace");
    expect(frontendSources).not.toContain("service_role");
    expect(frontendSources).not.toContain("checkoutSession");

    expect(deferredBackendSources).toContain("admin_analytics_unavailable");
    expect(deferredBackendSources).not.toContain("appendEvent(");
    expect(deferredBackendSources).not.toContain("appendAuditRecord(");
    expect(deferredBackendSources).not.toContain("analyticsEventRepository");
    expect(deferredBackendSources).not.toContain("auditLogRepository");
    expect(deferredBackendSources).not.toContain("stripe.webhooks");
  });
});
