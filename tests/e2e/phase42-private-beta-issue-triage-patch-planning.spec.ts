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

test.describe("phase42 private beta issue triage patch planning", () => {
  test("issue triage and patch planning doc exists with manual reviewed posture", () => {
    const doc = readSource("docs/private-beta-issue-triage-patch-planning.md");

    expect(doc).toContain("Private Beta Issue Triage And Patch Planning");
    expect(doc).toContain("Private beta issue triage is manual and reviewed");
    expect(doc).toContain("Private beta is not public launch");
    expect(doc).toContain("feedback intake does not automatically become implementation");
    expect(doc).toContain("does not add an issue tracker");
    expect(doc).toContain("does not add");
    expect(doc).toContain("public launch approval");
  });

  test("feedback intake tester invite and go-no-go docs link triage planning", () => {
    const feedbackIntake = readSource("docs/private-beta-feedback-intake.md");
    const testerInvite = readSource("docs/private-beta-tester-invite-pack.md");
    const goNoGo = readSource("docs/private-beta-go-no-go-checklist.md");

    for (const source of [feedbackIntake, testerInvite, goNoGo]) {
      expect(source).toContain("Private Beta Issue Triage And Patch Planning");
      expect(source).toContain("./private-beta-issue-triage-patch-planning.md");
    }

    expect(feedbackIntake).toContain("before converting accepted feedback into patch work");
    expect(testerInvite).toContain("before any patch work is promised or implemented");
    expect(goNoGo).toContain("manual issue classification");
  });

  test("severity levels and triage categories are documented", () => {
    const doc = readSource("docs/private-beta-issue-triage-patch-planning.md");

    for (const severity of [
      "Blocker",
      "Critical",
      "High",
      "Medium",
      "Low",
      "Docs/copy only",
    ]) {
      expect(doc).toContain(severity);
    }

    for (const category of [
      "Security/privacy",
      "Auth/session",
      "Email/SMTP",
      "Credits/billing honesty",
      "BYOK/provider settings",
      "Generation/mixer",
      "Export/artifact honesty",
      "Admin/readiness",
      "UI/UX",
      "Docs/copy",
    ]) {
      expect(doc).toContain(category);
    }
  });

  test("stop rollback criteria and audit-first patch lifecycle are documented", () => {
    const doc = readSource("docs/private-beta-issue-triage-patch-planning.md");

    for (const stopCriterion of [
      "Secret exposure",
      "Service-role exposure",
      "Broken auth/session",
      "Fake billing/credits",
      "Fake downloads/artifacts",
      "Public launch claim",
      "Major staging outage",
    ]) {
      expect(doc).toContain(stopCriterion);
    }

    for (const lifecycleStep of [
      "Audit first for risky issues",
      "Focused implementation",
      "Focused tests",
      "Docs included in the same phase when safe",
      "Commit after verification",
      "Final sign-off",
    ]) {
      expect(doc).toContain(lifecycleStep);
    }
  });

  test("patch planning template includes required safe planning fields", () => {
    const doc = readSource("docs/private-beta-issue-triage-patch-planning.md");

    for (const templateField of [
      "Issue summary",
      "Source feedback link/reference placeholder",
      "Severity",
      "Category",
      "Affected page/feature",
      "Reproduction steps",
      "Expected result",
      "Actual result",
      "Proposed safe phase",
      "Files likely affected",
      "Tests required",
      "Rollback notes",
      "Strict exclusions",
    ]) {
      expect(doc).toContain(templateField);
    }

    expect(doc).toContain("Do not paste tokenized links");
  });

  test("grouping rules separate docs cleanup from risky runtime work", () => {
    const doc = readSource("docs/private-beta-issue-triage-patch-planning.md");

    expect(doc).toContain("Group docs/copy-only issues together when safe");
    expect(doc).toContain("Separate security/privacy issues");
    expect(doc).toContain("Separate auth/session issues");
    expect(doc).toContain("Separate storage, BYOK/provider settings, billing/credits, generation/export, artifact delivery, and admin/readiness runtime issues");
    expect(doc).toContain("Do not mix risky runtime work with docs-only cleanup");
  });

  test("docs contain no real secrets or fake launch and resolved-status claims", () => {
    const docsSource = [
      "docs/private-beta-issue-triage-patch-planning.md",
      "docs/private-beta-feedback-intake.md",
      "docs/private-beta-tester-invite-pack.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/known-issues.md",
      "docs/roadmap.md",
      "docs/phases.md",
    ]
      .map(readSource)
      .join("\n");

    for (const forbiddenPattern of forbiddenSecretPatterns) {
      expect(docsSource).not.toMatch(forbiddenPattern);
    }

    expect(docsSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsSource).not.toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsSource).not.toContain("public launch approved");
    expect(docsSource).not.toContain("production launch approved");
    expect(docsSource).not.toContain("fully production ready");
    expect(docsSource).toContain("No fake resolved status");
    expect(docsSource).toContain("Public launch remains manually gated");
  });

  test("no fake issue tracker patch automation or backend issue route was added", () => {
    const frontendSource = listFiles("src")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");
    const backendRouteSource = listFiles("backend/routes")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");

    for (const forbiddenFrontendMarker of [
      "submitIssue",
      "createIssue",
      "issue resolved",
      "Issue resolved",
      "patch submitted",
      "Patch submitted",
      "patch automation",
      "useIssueStore",
      "issueTrackerStore",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontendMarker);
    }

    for (const forbiddenBackendMarker of [
      '"/issues"',
      "'/issues'",
      "`/issues`",
      '"/issue-tracker"',
      "'/issue-tracker'",
      "`/issue-tracker`",
      "issueRouter",
      "createIssueRouter",
      "submitIssue",
      "issueSubmission",
    ]) {
      expect(backendRouteSource).not.toContain(forbiddenBackendMarker);
    }
  });

  test("phase42 records docs-only patch planning boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 42");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("Feedback intake still does not automatically become implementation");
    expect(combined).toContain("fake issue tracker");
    expect(combined).toContain("fake resolved status");
    expect(combined).toContain("patch automation");
    expect(combined).toMatch(/no auth runtime/i);
    expect(combined).toMatch(/no issue tracker API route/i);
    expect(combined).toMatch(/no live BYOK storage/i);
    expect(combined).toMatch(/no billing or credits mutation/i);
    expect(combined).toMatch(/no provider SDK\/API calls/i);
    expect(combined).toMatch(/no generation\/export\/render runtime behavior changed/i);
    expect(combined).toMatch(/no public launch approval/i);
  });
});
