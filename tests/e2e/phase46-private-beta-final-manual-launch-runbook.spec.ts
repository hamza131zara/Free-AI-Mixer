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

test.describe("phase46 private beta final manual launch runbook", () => {
  test("final manual launch runbook exists and blocks public launch interpretation", () => {
    const doc = readSource("docs/private-beta-final-manual-launch-runbook.md");

    expect(doc).toContain("Private Beta Final Manual Launch Runbook");
    expect(doc).toContain("Private beta final manual launch is not public launch");
    expect(doc).toContain("Launch is controlled, manual, and reviewer-approved only");
    expect(doc).toContain("does not deploy anything");
    expect(doc).toContain("add automatic deployment");
    expect(doc).toContain("add release automation");
    expect(doc).toContain("enable public signup");
    expect(doc).toContain("fake private-beta launched status");
  });

  test("pre-launch gates include required checks and previous readiness packs", () => {
    const doc = readSource("docs/private-beta-final-manual-launch-runbook.md");

    for (const gate of [
      "Git status clean",
      "Current commit hash recorded",
      "`npm.cmd run typecheck` passed",
      "`npm.cmd run build` passed",
      "`npm.cmd run test:e2e -- tests/e2e/post181-launch-qa-smoke.spec.ts` passed",
      "Phase 37 readiness checks complete",
      "Phase 38 readiness checks complete",
      "Phase 39 readiness checks complete",
      "Phase 40 readiness checks complete",
      "Phase 41 readiness checks complete",
      "Phase 42 readiness checks complete",
      "Phase 43 readiness checks complete",
      "Phase 44 readiness checks complete",
      "Phase 45 readiness checks complete",
      "Staging manual smoke complete",
      "RC checklist complete",
      "Launch control checklist complete",
      "Controlled tester account dry-run complete",
      "Custom SMTP/email delivery manually verified or limitation documented",
      "Tester invite pack ready",
      "Feedback intake ready",
      "Issue triage/patch planning ready",
    ]) {
      expect(doc).toContain(gate);
    }
  });

  test("manual launch sequence and monitoring checklist are documented", () => {
    const doc = readSource("docs/private-beta-final-manual-launch-runbook.md");

    for (const sequenceItem of [
      "Confirm staging/private-beta URL",
      "Confirm approved tester group",
      "Confirm approved staging tester accounts",
      "Send limited tester invite only after go decision",
      "Monitor first tester login",
      "Monitor auth/email issues",
      "Monitor feedback intake",
      "Pause launch if stop criteria triggers",
    ]) {
      expect(doc).toContain(sequenceItem);
    }

    for (const monitoringItem of [
      "first 24 hours",
      "Monitor first tester login and session refresh",
      "Monitor email delivery, confirmation, and password reset reports",
      "Monitor feedback intake at the agreed review cadence",
      "Triage issues at the agreed issue triage cadence",
      "Pause or revoke access when stop criteria appears",
      "Keep patch planning manual and reviewed",
      "Do not promise automatic tester-facing fixes",
    ]) {
      expect(doc).toContain(monitoringItem);
    }
  });

  test("product honesty gates stop criteria and final decision template are documented", () => {
    const doc = readSource("docs/private-beta-final-manual-launch-runbook.md");

    for (const honestyGate of [
      "No fake auth/session",
      "No fake credits/billing",
      "BYOK/provider settings remain pre-live/fail-closed",
      "Projects/history show honest state",
      "no fake downloads",
      "no fake signed URLs",
      "no fake artifacts",
      "no fake success",
      "Admin/analytics remains readiness-only",
      "Public artifact delivery remains gated by production auth/RLS/storage readiness",
    ]) {
      expect(doc).toContain(honestyGate);
    }

    for (const stopCriterion of [
      "Secret exposure",
      "Service-role exposure",
      "Broken auth/session",
      "Email/SMTP failure that blocks onboarding",
      "Fake billing/credits",
      "Fake downloads/artifacts/signed URLs",
      "Admin area exposed",
      "Public launch claim",
      "Staging outage",
      "Tester access leak",
      "Serious security/privacy report",
    ]) {
      expect(doc).toContain(stopCriterion);
    }

    for (const templateField of [
      "Commit hash placeholder",
      "Staging URL placeholder",
      "Tester group placeholder",
      "SMTP verified yes/no",
      "Smoke result pass/fail",
      "RC result pass/fail",
      "Tester dry-run pass/fail",
      "Known limitations",
      "Final decision: go / no-go / hold",
      "Reviewer sign-off placeholder",
      "Timestamp placeholder",
    ]) {
      expect(doc).toContain(templateField);
    }
  });

  test("final launch runbook is linked from control RC go-no-go invite feedback triage and staging docs", () => {
    const linkedDocs = [
      readSource("docs/private-beta-controlled-tester-account-dry-run.md"),
      readSource("docs/private-beta-launch-control.md"),
      readSource("docs/private-beta-release-candidate-checklist.md"),
      readSource("docs/private-beta-go-no-go-checklist.md"),
      readSource("docs/private-beta-tester-invite-pack.md"),
      readSource("docs/private-beta-feedback-intake.md"),
      readSource("docs/private-beta-issue-triage-patch-planning.md"),
      readSource("docs/staging-manual-smoke-runbook.md"),
      readSource("docs/staging-deployment-readiness.md"),
    ];

    for (const source of linkedDocs) {
      expect(source).toContain("Private Beta Final Manual Launch Runbook");
      expect(source).toContain("./private-beta-final-manual-launch-runbook.md");
    }
  });

  test("docs preserve non-live product boundaries and contain no real secrets", () => {
    const docsSource = [
      "docs/private-beta-final-manual-launch-runbook.md",
      "docs/private-beta-controlled-tester-account-dry-run.md",
      "docs/private-beta-launch-control.md",
      "docs/private-beta-release-candidate-checklist.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/private-beta-tester-invite-pack.md",
      "docs/private-beta-feedback-intake.md",
      "docs/private-beta-issue-triage-patch-planning.md",
      "docs/staging-manual-smoke-runbook.md",
      "docs/staging-deployment-readiness.md",
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
      "Public artifact delivery remains gated",
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

  test("no deployment automation invite waitlist tester database auth runtime change or fake launch success was added", () => {
    const frontendSource = listFiles("src")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");
    const backendRouteSource = listFiles("backend/routes")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");
    const packageSource = readSource("package.json");

    for (const forbiddenFrontendMarker of [
      "privateBetaLaunched",
      "private beta launched",
      "Private beta launched",
      "launchSuccess",
      "Launch success",
      "useLaunchStore",
      "useInviteStore",
      "useWaitlistStore",
      "testerAccessApproved",
      "tester access approved",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontendMarker);
    }

    for (const forbiddenBackendMarker of [
      '"/tester-accounts"',
      "'/tester-accounts'",
      "`/tester-accounts`",
      '"/invites"',
      "'/invites'",
      "`/invites`",
      '"/waitlist"',
      "'/waitlist'",
      "`/waitlist`",
      "testerAccountRouter",
      "createTesterAccountRouter",
      "inviteRouter",
      "waitlistRouter",
      "launchRouter",
    ]) {
      expect(backendRouteSource).not.toContain(forbiddenBackendMarker);
    }

    for (const forbiddenScript of [
      "deploy:private-beta",
      "deploy:staging",
      "launch:private-beta",
      "release:private-beta",
      "invite:testers",
      "waitlist:approve",
      "tester-account:create",
    ]) {
      expect(packageSource).not.toContain(forbiddenScript);
    }
  });

  test("phase46 records docs-only launch boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 46");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("controlled, manual, reviewer-approved");
    expect(combined).toContain("fake private-beta launched status");
    expect(combined).toMatch(/no auth runtime/i);
    expect(combined).toMatch(/no invite, waitlist, or tester access API route/i);
    expect(combined).toMatch(/no database table/i);
    expect(combined).toMatch(/no release automation/i);
    expect(combined).toMatch(/no deployment automation/i);
    expect(combined).toMatch(/no live email sending/i);
    expect(combined).toMatch(/no live BYOK storage/i);
    expect(combined).toMatch(/no billing or credits mutation/i);
    expect(combined).toMatch(/no provider SDK\/API calls/i);
    expect(combined).toMatch(/no generation\/export\/render runtime behavior changed/i);
    expect(combined).toMatch(/no artifact delivery or download behavior was added/i);
    expect(combined).toMatch(/no public launch approval/i);
  });
});
