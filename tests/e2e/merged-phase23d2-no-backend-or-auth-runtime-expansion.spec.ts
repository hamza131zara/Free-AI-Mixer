import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23D-2 no backend or auth runtime expansion", () => {
  test("alignment stays frontend-only and auth/runtime boundaries do not expand", () => {
    const frontendAlignmentSources = [
      readSource("src/types/projectLibrary.ts"),
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/store/projectLibraryStore.ts"),
      readSource("src/types/providerSettings.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/store/providerSettingsStore.ts"),
      readSource("src/types/exportHistory.ts"),
      readSource("src/services/exportHistoryService.ts"),
      readSource("src/store/exportHistoryStore.ts"),
    ].join("\n");
    const frontendAuthBoundarySources = [
      readSource("src/App.tsx"),
      readSource("src/components/ProtectedRouteShell.tsx"),
      readSource("src/services/authService.ts"),
      readSource("src/store/authStore.ts"),
    ].join("\n");
    const deferredBackendSources = [
      readSource("backend/routes/auth.ts"),
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/billing.ts"),
    ].join("\n");

    expect(frontendAlignmentSources).toContain("workspace_runtime_not_configured");
    expect(frontendAlignmentSources).toContain("workspace_required");
    expect(frontendAuthBoundarySources).not.toContain("@supabase/supabase-js");
    expect(frontendAuthBoundarySources).not.toContain("createClient(");
    expect(frontendAuthBoundarySources).not.toContain("localStorage.setItem(\"auth");
    expect(frontendAuthBoundarySources).not.toContain("sessionStorage.setItem(\"auth");
    expect(frontendAuthBoundarySources).not.toContain("fakeSession");
    expect(frontendAuthBoundarySources).not.toContain("fakeWorkspace");

    expect(deferredBackendSources).toContain("admin_analytics_unavailable");
    expect(deferredBackendSources).not.toContain("appendEvent(");
    expect(deferredBackendSources).not.toContain("appendAuditRecord(");
    expect(deferredBackendSources).not.toContain("checkoutSession");
    expect(deferredBackendSources).not.toContain("stripe.webhooks");
  });
});
