import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase30 dashboard beta ux", () => {
  test("dashboard renders beta quick links limitations and backend-derived status", () => {
    const dashboardSource = readSource("src/pages/DashboardPage.tsx");

    expect(dashboardSource).toContain("Private beta account dashboard");
    expect(dashboardSource).toContain("dashboard-account-status-panel");
    expect(dashboardSource).toContain("dashboard-beta-quick-links");
    expect(dashboardSource).toContain("dashboard-beta-limitations");
    expect(dashboardSource).toContain("dashboard-support-guidance");
    expect(dashboardSource).toContain("Projects");
    expect(dashboardSource).toContain("History");
    expect(dashboardSource).toContain("Provider Settings");
    expect(dashboardSource).toContain("Credits");
    expect(dashboardSource).toContain("Mixer");
    expect(dashboardSource).toContain("Help");
    expect(dashboardSource).toContain("Onboarding");
    expect(dashboardSource).toContain("No real saved projects yet.");
    expect(dashboardSource).toContain("No real credits, billing, refill, or ledger mutation yet.");
    expect(dashboardSource).toContain("No provider key or BYOK storage yet.");
    expect(dashboardSource).toContain("No real export/download account history yet.");
    expect(dashboardSource).toContain("No active workspace switching yet.");
    expect(dashboardSource).toContain("No OAuth or public launch behavior yet.");
    expect(dashboardSource).toContain("identity?.email");
    expect(dashboardSource).toContain("identity?.workspaceId");
    expect(dashboardSource).not.toContain("projectCount");
    expect(dashboardSource).not.toContain("creditBalance");
    expect(dashboardSource).not.toContain("usageMetric");
    expect(dashboardSource).not.toContain("connectedProviderCount");
  });
});
