import { expect, test } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const listFiles = (relativeDirectory: string): string[] => {
  const root = path.join(projectRoot, relativeDirectory);
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = path.join(root, entry);
    const relativePath = path.join(relativeDirectory, entry).replace(/\\/g, "/");

    if (statSync(absolutePath).isDirectory()) {
      return listFiles(relativePath);
    }

    return relativePath;
  });
};

const forbiddenSecretPatterns = [
  /sk-live[_-][A-Za-z0-9]/i,
  /sk-proj[_-][A-Za-z0-9]/i,
  /eyJhbGci[A-Za-z0-9._-]+/,
  /smtp:\/\/[^\s]+/i,
  /postgres:\/\/[^\s]+/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!backend-service-role-key-from-secret-store|replace-with-server-only-service-role-secret)[^\s]+/,
  /SMTP_PASSWORD\s*=\s*[^\s]+/i,
  /PROVIDER_API_KEY\s*=\s*[^\s]+/i,
  /WEBHOOK_SECRET\s*=\s*[^\s]+/i,
  /JWT_SECRET\s*=\s*[^\s]+/i,
] as const;

test.describe("phase48 private beta first tester monitoring", () => {
  test("first tester monitoring doc exists and blocks public launch monitoring interpretation", () => {
    const doc = readSource("docs/private-beta-first-tester-monitoring.md");

    expect(doc).toContain("Private Beta First Tester Monitoring");
    expect(doc).toContain("First tester monitoring is manual and reviewer-owned");
    expect(doc).toContain("Private beta monitoring is not public launch monitoring");
    expect(doc).toContain("does not add automatic analytics");
    expect(doc).toContain("fake dashboards");
    expect(doc).toContain("fake metrics");
    expect(doc).toContain("fake success state");
    expect(doc).toContain("Monitor only approved staging/private-beta testers");
  });

  test("first tester monitoring checklist includes required observations", () => {
    const doc = readSource("docs/private-beta-first-tester-monitoring.md");

    for (const item of [
      "Confirm launch decision record exists",
      "Confirm staging URL",
      "Confirm commit hash",
      "Confirm approved tester account",
      "Confirm tester invite sent manually",
      "Monitor first login",
      "Monitor auth/session behavior",
      "Monitor email/custom SMTP issues",
      "Monitor protected route access",
      "Monitor credits/status honesty",
      "Monitor BYOK/provider settings fail-closed behavior",
      "Monitor project/history honest state",
      "Monitor export/artifact no fake downloads/no fake artifacts/no fake success",
      "Monitor admin/readiness-only boundaries",
      "Confirm feedback intake received or tester knows how to report",
    ]) {
      expect(doc).toContain(item);
    }
  });

  test("first 24-hour cadence stop criteria and monitoring note template are documented", () => {
    const doc = readSource("docs/private-beta-first-tester-monitoring.md");

    for (const cadence of [
      "First tester login check",
      "Same-day feedback review",
      "Blocker/security triage immediately",
      "Daily triage summary",
      "Hold/pause decision if needed",
    ]) {
      expect(doc).toContain(cadence);
    }

    for (const stopCriterion of [
      "Secret exposure",
      "Service-role exposure",
      "Broken auth/session",
      "Email/SMTP failure blocking tester onboarding",
      "Fake billing/credits",
      "Fake downloads/artifacts/signed URLs",
      "Admin exposure",
      "Staging outage",
      "Tester access leak",
      "Serious privacy/security report",
    ]) {
      expect(doc).toContain(stopCriterion);
    }

    for (const templateField of [
      "Tester ID placeholder",
      "Account email placeholder if safe",
      "Commit hash placeholder",
      "Staging URL placeholder",
      "Time window placeholder",
      "Pages tested",
      "Observed issues",
      "Severity",
      "Pause/go/hold recommendation",
      "Follow-up patch phase placeholder",
      "Reviewer sign-off placeholder",
    ]) {
      expect(doc).toContain(templateField);
    }
  });

  test("monitoring docs warn against collecting secrets or private env values", () => {
    const doc = readSource("docs/private-beta-first-tester-monitoring.md");

    for (const warning of [
      "Do not collect or store secrets",
      "provider keys",
      "SMTP credentials",
      "tokens",
      "JWTs",
      "webhook secrets",
      "service-role keys",
      "private env values",
      "passwords",
      "tokenized auth links",
      "recovery links",
    ]) {
      expect(doc).toContain(warning);
    }
  });

  test("first tester monitoring doc is linked from decision launch control feedback triage and go-no-go docs", () => {
    const linkedDocs = [
      readSource("docs/private-beta-launch-decision-record.md"),
      readSource("docs/private-beta-final-manual-launch-runbook.md"),
      readSource("docs/private-beta-controlled-tester-account-dry-run.md"),
      readSource("docs/private-beta-launch-control.md"),
      readSource("docs/private-beta-feedback-intake.md"),
      readSource("docs/private-beta-issue-triage-patch-planning.md"),
      readSource("docs/private-beta-go-no-go-checklist.md"),
    ];

    for (const source of linkedDocs) {
      expect(source).toContain("Private Beta First Tester Monitoring");
      expect(source).toContain("./private-beta-first-tester-monitoring.md");
    }
  });

  test("docs preserve non-live product boundaries and contain no real secrets", () => {
    const docsSource = [
      "docs/private-beta-first-tester-monitoring.md",
      "docs/private-beta-launch-decision-record.md",
      "docs/private-beta-final-manual-launch-runbook.md",
      "docs/private-beta-controlled-tester-account-dry-run.md",
      "docs/private-beta-launch-control.md",
      "docs/private-beta-feedback-intake.md",
      "docs/private-beta-issue-triage-patch-planning.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/known-issues.md",
      "docs/roadmap.md",
      "docs/phases.md",
    ]
      .map(readSource)
      .join("\n");

    for (const requiredBoundary of [
      "BYOK remains pre-live/fail-closed",
      "Credits/billing remain non-live",
      "Export/artifact delivery remains honest",
      "no fake downloads",
      "no fake signed URLs",
      "no fake artifacts",
      "no fake success",
      "Admin/analytics remains",
    ]) {
      expect(docsSource).toContain(requiredBoundary);
    }

    for (const forbiddenPattern of forbiddenSecretPatterns) {
      expect(docsSource).not.toMatch(forbiddenPattern);
    }

    expect(docsSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsSource).not.toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsSource).not.toContain("public launch approved");
    expect(docsSource).not.toContain("production launch approved");
    expect(docsSource).not.toContain("fully production ready");
  });

  test("no analytics runtime monitoring backend database table dashboard UI API route or fake metric state was added", () => {
    const frontendSource = listFiles("src")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");
    const backendRouteSource = listFiles("backend/routes")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");
    const backendSource = listFiles("backend")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");
    const packageSource = readSource("package.json");

    for (const forbiddenFrontendMarker of [
      "firstTesterMonitoringActive",
      "monitoringDashboard",
      "MonitoringDashboard",
      "fakeMetricsAllowed: true",
      "fake metrics enabled",
      "Fake metrics enabled",
      "monitoringSuccess",
      "Monitoring success",
      "useMonitoringStore",
      "useAnalyticsStore",
      "privateBetaMonitoringStatus",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontendMarker);
    }

    for (const forbiddenBackendMarker of [
      '"/tester-monitoring"',
      "'/tester-monitoring'",
      "`/tester-monitoring`",
      "testerMonitoringRouter",
      "createTesterMonitoringRouter",
      "privateBetaMonitoringRouter",
      "createPrivateBetaMonitoringRouter",
    ]) {
      expect(backendRouteSource).not.toContain(forbiddenBackendMarker);
    }

    for (const forbiddenBackendMarker of [
      "createTesterMonitoringTable",
      "tester_monitoring",
      "analytics_events",
      "monitoring_events",
    ]) {
      expect(backendSource).not.toContain(forbiddenBackendMarker);
    }

    for (const forbiddenScript of [
      "monitor:first-tester",
      "analytics:start",
      "monitoring:start",
      "launch:monitoring",
      "deploy:monitoring",
    ]) {
      expect(packageSource).not.toContain(forbiddenScript);
    }
  });

  test("phase48 records docs-only monitoring boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 48");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("manual and reviewer-owned");
    expect(combined).toContain("not public launch monitoring");
    expect(combined).toMatch(/no analytics runtime/i);
    expect(combined).toMatch(/no monitoring backend/i);
    expect(combined).toMatch(/no database table/i);
    expect(combined).toMatch(/no dashboard UI/i);
    expect(combined).toMatch(/no API route/i);
    expect(combined).toMatch(/no fake metrics/i);
    expect(combined).toMatch(/no live email sending/i);
    expect(combined).toMatch(/no live BYOK storage/i);
    expect(combined).toMatch(/no billing or credits mutation/i);
    expect(combined).toMatch(/no provider SDK\/API calls/i);
    expect(combined).toMatch(/no generation\/export\/render runtime behavior changed/i);
    expect(combined).toMatch(/no artifact delivery or download behavior was added/i);
    expect(combined).toMatch(/no public launch approval/i);
  });
});
