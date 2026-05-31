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

test.describe("phase45 controlled tester account dry run", () => {
  test("controlled tester account dry-run doc exists and stays manual private beta only", () => {
    const doc = readSource("docs/private-beta-controlled-tester-account-dry-run.md");

    expect(doc).toContain("Private Beta Controlled Tester Account Dry Run");
    expect(doc).toContain("Controlled tester account dry-run is manual");
    expect(doc).toContain("Private beta is not public launch");
    expect(doc).toContain("does not create tester accounts automatically");
    expect(doc).toContain("does not");
    expect(doc).toContain("fake tester account success");
  });

  test("docs require approved tester accounts and forbid personal admin service-role accounts", () => {
    const doc = readSource("docs/private-beta-controlled-tester-account-dry-run.md");

    expect(doc).toContain("Use approved staging/private-beta tester accounts only");
    expect(doc).toContain("Do not use personal accounts for tester dry-run");
    expect(doc).toContain("Do not use admin accounts for tester dry-run");
    expect(doc).toContain("Do not use service-role accounts for tester dry-run");
    expect(doc).toContain("Custom SMTP/email delivery must be manually verified before serious onboarding");
  });

  test("docs warn not to share secrets private env values or tokenized auth links", () => {
    const doc = readSource("docs/private-beta-controlled-tester-account-dry-run.md");

    for (const warning of [
      "service-role keys",
      "SMTP credentials",
      "provider keys",
      "JWTs",
      "webhook secrets",
      "tokens",
      "passwords",
      "tokenized auth links",
      "private env values",
    ]) {
      expect(doc).toContain(warning);
    }
  });

  test("tester account dry-run checklist includes required manual checks", () => {
    const doc = readSource("docs/private-beta-controlled-tester-account-dry-run.md");

    for (const checklistItem of [
      "Create/approve staging tester account manually",
      "Confirm email delivery or document email limitation",
      "Login smoke",
      "Logout smoke",
      "Password reset smoke if SMTP is verified",
      "Dashboard/account bootstrap check",
      "Protected route access check",
      "Credits/status honesty check",
      "Provider settings/BYOK fail-closed check",
      "Projects/history honest empty state check",
      "Export/artifact no fake downloads/no fake artifacts/no fake success check",
      "Admin/analytics blocked or readiness-only check",
      "Feedback intake link/process shared",
      "Access pause/revoke path documented",
    ]) {
      expect(doc).toContain(checklistItem);
    }
  });

  test("dry-run stop rollback criteria and result template are documented", () => {
    const doc = readSource("docs/private-beta-controlled-tester-account-dry-run.md");

    for (const stopCriterion of [
      "Tester cannot authenticate",
      "Email delivery is broken or unknown",
      "Secret exposure",
      "Service-role exposure",
      "Fake billing/credits",
      "Fake downloads/artifacts/signed URLs",
      "Admin area exposed",
      "Public launch claim",
      "Tester access leak",
    ]) {
      expect(doc).toContain(stopCriterion);
    }

    for (const templateField of [
      "Tester account placeholder",
      "Staging URL placeholder",
      "Commit hash placeholder",
      "SMTP verified yes/no",
      "Auth/session pass/fail",
      "Protected routes pass/fail",
      "Product honesty pass/fail",
      "Feedback intake pass/fail",
      "Decision: go / no-go / hold",
      "Reviewer sign-off placeholder",
    ]) {
      expect(doc).toContain(templateField);
    }
  });

  test("dry-run doc is linked from launch control RC go-no-go invite and staging docs", () => {
    const linkedDocs = [
      readSource("docs/private-beta-launch-control.md"),
      readSource("docs/private-beta-release-candidate-checklist.md"),
      readSource("docs/private-beta-go-no-go-checklist.md"),
      readSource("docs/private-beta-tester-invite-pack.md"),
      readSource("docs/staging-manual-smoke-runbook.md"),
      readSource("docs/staging-deployment-readiness.md"),
    ];

    for (const source of linkedDocs) {
      expect(source).toContain("Private Beta Controlled Tester Account Dry Run");
      expect(source).toContain("./private-beta-controlled-tester-account-dry-run.md");
    }
  });

  test("docs preserve non-live product boundaries and contain no real secrets", () => {
    const docsSource = [
      "docs/private-beta-controlled-tester-account-dry-run.md",
      "docs/private-beta-launch-control.md",
      "docs/private-beta-release-candidate-checklist.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/private-beta-tester-invite-pack.md",
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

  test("no tester database invite waitlist auth runtime change or fake account success was added", () => {
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
      "testerAccountApproved",
      "tester account approved",
      "Tester account approved",
      "tester account success",
      "Tester account success",
      "testerDryRunPassed",
      "useTesterAccountStore",
      "useInviteStore",
      "useWaitlistStore",
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
    ]) {
      expect(backendRouteSource).not.toContain(forbiddenBackendMarker);
    }

    expect(packageSource).not.toContain("tester-account:create");
    expect(packageSource).not.toContain("tester-account:dry-run");
    expect(packageSource).not.toContain("invite:testers");
    expect(packageSource).not.toContain("waitlist:approve");
  });

  test("phase45 records docs-only tester dry-run boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 45");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("approved staging/private beta tester accounts only");
    expect(combined).toContain("fake tester account success");
    expect(combined).toMatch(/no auth runtime/i);
    expect(combined).toMatch(/no invite, waitlist, or tester access API route/i);
    expect(combined).toMatch(/no database table/i);
    expect(combined).toMatch(/no release automation/i);
    expect(combined).toMatch(/no live email sending/i);
    expect(combined).toMatch(/no live BYOK storage/i);
    expect(combined).toMatch(/no billing or credits mutation/i);
    expect(combined).toMatch(/no provider SDK\/API calls/i);
    expect(combined).toMatch(/no generation\/export\/render runtime behavior changed/i);
    expect(combined).toMatch(/no artifact delivery or download behavior was added/i);
    expect(combined).toMatch(/no public launch approval/i);
  });
});
