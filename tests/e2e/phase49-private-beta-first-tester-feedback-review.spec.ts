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

test.describe("phase49 private beta first tester feedback review", () => {
  test("first tester feedback review doc exists and blocks public support interpretation", () => {
    const doc = readSource("docs/private-beta-first-tester-feedback-review.md");

    expect(doc).toContain("Private Beta First Tester Feedback Review");
    expect(doc).toContain("First tester feedback review is manual and reviewer-owned");
    expect(doc).toContain("Feedback review is not public support launch");
    expect(doc).toContain("Feedback does not automatically become implementation");
    expect(doc).toContain("fake issue tracker");
    expect(doc).toContain("fake resolved status");
    expect(doc).toContain("fake metrics");
    expect(doc).toContain("fake success state");
  });

  test("feedback review checklist includes required review steps", () => {
    const doc = readSource("docs/private-beta-first-tester-feedback-review.md");

    for (const item of [
      "Confirm tester is approved",
      "Confirm staging/private-beta URL",
      "Confirm commit hash",
      "Confirm feedback source/channel",
      "Redact screenshots/logs before saving",
      "Classify severity",
      "Classify category",
      "Identify affected page/feature",
      "Confirm reproduction steps",
      "Separate blocker/security/auth/storage/BYOK/billing/export issues from docs/copy issues",
      "Decide patch plan: audit-first / focused implementation / docs-only / no action",
      "Record stop/pause recommendation if needed",
    ]) {
      expect(doc).toContain(item);
    }
  });

  test("categories severity levels stop criteria and patch planning template are documented", () => {
    const doc = readSource("docs/private-beta-first-tester-feedback-review.md");

    for (const category of [
      "security/privacy",
      "auth/session",
      "email/SMTP",
      "credits/billing honesty",
      "BYOK/provider settings",
      "generation/mixer",
      "export/artifact honesty",
      "admin/readiness",
      "UI/UX",
      "docs/copy",
    ]) {
      expect(doc).toContain(category);
    }

    for (const severity of [
      "blocker",
      "critical",
      "high",
      "medium",
      "low",
      "docs/copy only",
    ]) {
      expect(doc).toContain(severity);
    }

    for (const stopCriterion of [
      "Secret exposure",
      "Service-role exposure",
      "Broken auth/session",
      "Email/SMTP blocking onboarding",
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
      "Feedback reference placeholder",
      "Tester ID placeholder",
      "Commit hash placeholder",
      "Affected page/feature",
      "Severity",
      "Category",
      "Reproduction summary",
      "Expected result",
      "Actual result",
      "Proposed phase title",
      "Phase mode",
      "Files likely affected",
      "Tests required",
      "Strict exclusions",
      "Rollback/pause recommendation",
      "Reviewer sign-off placeholder",
    ]) {
      expect(doc).toContain(templateField);
    }
  });

  test("patch planning rules preserve audit-first handling and no premature fix promises", () => {
    const doc = readSource("docs/private-beta-first-tester-feedback-review.md");

    for (const rule of [
      "Docs/copy-only issues may be grouped when safe",
      "Risky auth/security/storage/BYOK/billing/export/runtime issues must be isolated",
      "Audit-first handling is required",
      "Do not mix risky runtime work with docs-only cleanup",
      "Do not promise tester-facing fixes until reviewed and committed",
      "Do not mark feedback resolved until a verified patch phase is signed off",
      "Private beta remains not public launch",
    ]) {
      expect(doc).toContain(rule);
    }
  });

  test("feedback review doc is linked from monitoring intake triage decision launch and go-no-go docs", () => {
    const linkedDocs = [
      readSource("docs/private-beta-first-tester-monitoring.md"),
      readSource("docs/private-beta-feedback-intake.md"),
      readSource("docs/private-beta-issue-triage-patch-planning.md"),
      readSource("docs/private-beta-launch-decision-record.md"),
      readSource("docs/private-beta-final-manual-launch-runbook.md"),
      readSource("docs/private-beta-go-no-go-checklist.md"),
    ];

    for (const source of linkedDocs) {
      expect(source).toContain("Private Beta First Tester Feedback Review");
      expect(source).toContain("./private-beta-first-tester-feedback-review.md");
    }
  });

  test("docs warn against storing secrets and preserve non-live boundaries", () => {
    const docsSource = [
      "docs/private-beta-first-tester-feedback-review.md",
      "docs/private-beta-first-tester-monitoring.md",
      "docs/private-beta-feedback-intake.md",
      "docs/private-beta-issue-triage-patch-planning.md",
      "docs/private-beta-launch-decision-record.md",
      "docs/private-beta-final-manual-launch-runbook.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/known-issues.md",
      "docs/roadmap.md",
      "docs/phases.md",
    ]
      .map(readSource)
      .join("\n");

    for (const warning of [
      "Do not collect or store secrets",
      "provider keys",
      "SMTP credentials",
      "tokens",
      "JWTs",
      "webhook secrets",
      "service-role keys",
      "private env values",
    ]) {
      expect(docsSource).toContain(warning);
    }

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

  test("no feedback issue tracker analytics database dashboard fake metric or fake resolved runtime was added", () => {
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
      "feedbackReviewResolved",
      "fakeResolvedStatus",
      "fake resolved status enabled",
      "fakeMetricsAllowed: true",
      "fake metrics enabled",
      "issueTrackerDashboard",
      "IssueTrackerDashboard",
      "feedbackDashboard",
      "FeedbackDashboard",
      "useFeedbackStore",
      "useIssueTrackerStore",
      "firstTesterFeedbackReviewState",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontendMarker);
    }

    for (const forbiddenBackendMarker of [
      '"/feedback"',
      "'/feedback'",
      "`/feedback`",
      '"/issues"',
      "'/issues'",
      "`/issues`",
      '"/issue-tracker"',
      "'/issue-tracker'",
      "`/issue-tracker`",
      "feedbackRouter",
      "createFeedbackRouter",
      "issueTrackerRouter",
      "createIssueTrackerRouter",
    ]) {
      expect(backendRouteSource).not.toContain(forbiddenBackendMarker);
    }

    for (const forbiddenBackendMarker of [
      "createFeedbackTable",
      "createIssueTrackerTable",
      "feedback_reports",
      "issue_tracker",
      "analytics_events",
      "monitoring_events",
    ]) {
      expect(backendSource).not.toContain(forbiddenBackendMarker);
    }

    for (const forbiddenScript of [
      "feedback:start",
      "feedback:review",
      "issue-tracker:start",
      "analytics:start",
      "monitoring:start",
    ]) {
      expect(packageSource).not.toContain(forbiddenScript);
    }
  });

  test("phase49 records docs-only review boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 49");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("manual and reviewer-owned");
    expect(combined).toContain("Feedback does not automatically become implementation");
    expect(combined).toMatch(/no feedback, issue tracker, or analytics API route/i);
    expect(combined).toMatch(/no database table/i);
    expect(combined).toMatch(/no dashboard UI/i);
    expect(combined).toMatch(/no fake metric state/i);
    expect(combined).toMatch(/no live email sending/i);
    expect(combined).toMatch(/no live BYOK storage/i);
    expect(combined).toMatch(/no billing or credits mutation/i);
    expect(combined).toMatch(/no provider SDK\/API calls/i);
    expect(combined).toMatch(/no generation\/export\/render runtime behavior changed/i);
    expect(combined).toMatch(/no artifact delivery or download behavior was added/i);
    expect(combined).toMatch(/no public launch approval/i);
  });
});
