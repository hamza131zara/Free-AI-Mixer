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

test.describe("phase47 private beta launch decision record", () => {
  test("launch decision record doc exists and blocks public launch interpretation", () => {
    const doc = readSource("docs/private-beta-launch-decision-record.md");

    expect(doc).toContain("Private Beta Launch Decision Record");
    expect(doc).toContain("Launch decision record is manual and reviewer-owned");
    expect(doc).toContain("Private beta launch decision is not public launch approval");
    expect(doc).toContain("does not deploy anything");
    expect(doc).toContain("invite testers automatically");
    expect(doc).toContain("fake launched/approved state");
  });

  test("decision inputs include required readiness and operational fields", () => {
    const doc = readSource("docs/private-beta-launch-decision-record.md");

    for (const input of [
      "Git status clean",
      "Commit hash placeholder",
      "Staging URL placeholder",
      "Tester group placeholder",
      "Typecheck result",
      "Build result",
      "post181 QA result",
      "Phase 37-46 readiness result",
      "Staging manual smoke result",
      "RC checklist result",
      "Controlled tester dry-run result",
      "SMTP/email verification result or documented limitation",
      "Feedback intake readiness",
      "Issue triage/patch planning readiness",
      "Known limitations",
      "Stop/rollback owner",
    ]) {
      expect(doc).toContain(input);
    }
  });

  test("decision choices template and go no-go hold rules are documented", () => {
    const doc = readSource("docs/private-beta-launch-decision-record.md");

    for (const choice of ["go", "no-go", "hold"]) {
      expect(doc).toContain(choice);
    }

    for (const templateField of [
      "Date/time placeholder",
      "Reviewer placeholder",
      "Commit hash placeholder",
      "Staging URL placeholder",
      "Tester group placeholder",
      "Decision: go/no-go/hold",
      "Reasons",
      "Known limitations",
      "Required follow-up actions",
      "Rollback/pause owner",
      "Sign-off placeholder",
    ]) {
      expect(doc).toContain(templateField);
    }

    for (const goRule of [
      "Only approved testers",
      "Only staging/private beta URL",
      "No public signup claim",
      "Feedback intake ready",
      "Monitoring cadence ready",
    ]) {
      expect(doc).toContain(goRule);
    }

    for (const holdRule of [
      "Blocker/security/auth/email/product-honesty issue",
      "Fake billing/credits",
      "Fake downloads/artifacts/signed URLs",
      "Service-role/secret exposure",
      "Admin exposure",
      "Staging outage",
      "Tester access leak",
    ]) {
      expect(doc).toContain(holdRule);
    }
  });

  test("product honesty gates and post decision recordkeeping are safe", () => {
    const doc = readSource("docs/private-beta-launch-decision-record.md");

    for (const honestyGate of [
      "No fake auth/session",
      "No fake credits/billing",
      "BYOK/provider settings remain pre-live/fail-closed",
      "no fake downloads",
      "no fake signed URLs",
      "no fake artifacts",
      "no fake success",
      "Admin/analytics remains readiness-only",
      "Public artifact delivery remains gated by production auth/RLS/storage readiness",
    ]) {
      expect(doc).toContain(honestyGate);
    }

    for (const recordRule of [
      "Store decision in docs/manual tracker only",
      "Do not store secrets",
      "Do not store private tokens/env values",
      "Do not publish as public launch announcement",
      "Do not treat go as deployment approval",
      "Do not mark private beta launched/approved in runtime state",
    ]) {
      expect(doc).toContain(recordRule);
    }
  });

  test("decision record is linked from final launch control RC go-no-go feedback triage and staging docs", () => {
    const linkedDocs = [
      readSource("docs/private-beta-final-manual-launch-runbook.md"),
      readSource("docs/private-beta-controlled-tester-account-dry-run.md"),
      readSource("docs/private-beta-launch-control.md"),
      readSource("docs/private-beta-release-candidate-checklist.md"),
      readSource("docs/private-beta-go-no-go-checklist.md"),
      readSource("docs/private-beta-feedback-intake.md"),
      readSource("docs/private-beta-issue-triage-patch-planning.md"),
      readSource("docs/staging-manual-smoke-runbook.md"),
      readSource("docs/staging-deployment-readiness.md"),
    ];

    for (const source of linkedDocs) {
      expect(source).toContain("Private Beta Launch Decision Record");
      expect(source).toContain("./private-beta-launch-decision-record.md");
    }
  });

  test("docs preserve non-live product boundaries and contain no real secrets", () => {
    const docsSource = [
      "docs/private-beta-launch-decision-record.md",
      "docs/private-beta-final-manual-launch-runbook.md",
      "docs/private-beta-controlled-tester-account-dry-run.md",
      "docs/private-beta-launch-control.md",
      "docs/private-beta-release-candidate-checklist.md",
      "docs/private-beta-go-no-go-checklist.md",
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

  test("no deployment automation invite waitlist tester database auth runtime change or fake approved state was added", () => {
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
      "privateBetaApproved",
      "private beta approved",
      "Private beta approved",
      "launchDecisionApproved",
      "launchSuccess",
      "Launch success",
      "useLaunchStore",
      "useInviteStore",
      "useWaitlistStore",
      "testerAccessApproved",
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
      "launchDecisionRouter",
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
      "launch-decision:approve",
    ]) {
      expect(packageSource).not.toContain(forbiddenScript);
    }
  });

  test("phase47 records docs-only decision boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 47");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("manual, reviewer-owned");
    expect(combined).toContain("fake launched/approved state");
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
