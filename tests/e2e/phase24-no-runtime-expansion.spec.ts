import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase24 no runtime expansion", () => {
  test("phase24 adds account bootstrap and selected auth runtime only", () => {
    const frontendSource = [
      readSource("src/services/authService.ts"),
      readSource("src/services/auth/authRuntimeService.ts"),
      readSource("src/services/auth/authenticatedFetch.ts"),
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/services/creditsService.ts"),
      readSource("src/services/exportHistoryService.ts"),
      readSource("src/services/sceneGenerationService.ts"),
      readSource("src/services/exportService.ts"),
      readSource("src/services/adminReadinessService.ts"),
      readSource("src/services/billingService.ts"),
    ].join("\n");
    const accountRouteSource = readSource("backend/routes/account.ts");
    const backendSource = [
      accountRouteSource,
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/billing.ts"),
      readSource("backend/routes/credits.ts"),
    ].join("\n");

    expect(frontendSource).toContain("/account/bootstrap");
    expect(frontendSource).toContain("/project-library/projects");
    expect(frontendSource).toContain("/project-library/history");
    expect(frontendSource).toContain("/provider-settings/status");
    expect(frontendSource).toContain("/credits/status");
    expect(frontendSource).not.toContain("/generation/jobs");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain(".from(");
    expect(frontendSource).not.toContain("service_role");
    expect(backendSource).not.toContain("appendAuditRecord(");
    expect(backendSource).not.toContain("appendEvent(");
    expect(accountRouteSource).not.toContain("platform_admin");
  });
});
