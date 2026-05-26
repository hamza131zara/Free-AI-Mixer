import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23C-2 no runtime or frontend expansion", () => {
  test("frontend remains unchanged and no deferred runtime wiring is added", () => {
    const frontendSources = [
      readSource("src/services/creditsService.ts"),
      readSource("src/store/creditsStore.ts"),
      readSource("src/pages/CreditsPage.tsx"),
      readSource("src/App.tsx"),
      readSource("src/main.tsx"),
    ].join("\n");
    const backendDeferredSources = [
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/billing.ts"),
      readSource("backend/composition/backendDependencies.ts"),
    ].join("\n");

    expect(frontendSources).not.toContain("@supabase/supabase-js");
    expect(frontendSources).not.toContain("createClient(");
    expect(frontendSources).not.toContain(".storage.from(");
    expect(frontendSources).not.toContain("localStorage.setItem");
    expect(frontendSources).not.toContain("sessionStorage.setItem");
    expect(frontendSources).not.toContain("fakeSession");
    expect(frontendSources).not.toContain("fakeWorkspace");
    expect(frontendSources).not.toContain("service_role");

    expect(backendDeferredSources).not.toContain("appendEvent(");
    expect(backendDeferredSources).not.toContain("appendAuditRecord(");
    expect(backendDeferredSources).not.toContain("analyticsEventRepository");
    expect(backendDeferredSources).not.toContain("auditLogRepository");
    expect(backendDeferredSources).toContain("admin_analytics_unavailable");
    expect(backendDeferredSources).not.toContain("checkoutSession");
    expect(backendDeferredSources).not.toContain("stripe.webhooks");
  });
});
