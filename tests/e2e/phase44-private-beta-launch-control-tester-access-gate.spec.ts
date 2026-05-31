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

test.describe("phase44 private beta launch control tester access gate", () => {
  test("launch control doc exists and keeps private beta separate from public launch", () => {
    const doc = readSource("docs/private-beta-launch-control.md");

    expect(doc).toContain("Private Beta Launch Control And Tester Access Gate");
    expect(doc).toContain("Private beta launch control is manual and reviewed");
    expect(doc).toContain("Private beta is not public launch");
    expect(doc).toContain("does not deploy anything");
    expect(doc).toContain("does not");
    expect(doc).toContain("fake tester access success");
  });

  test("launch control requires approved tester list and approved staging accounts", () => {
    const doc = readSource("docs/private-beta-launch-control.md");

    expect(doc).toContain("Tester access must use an approved tester list");
    expect(doc).toContain("Tester access must use approved staging accounts only");
    expect(doc).toContain("Use only the staging/private beta URL");
    expect(doc).toContain("Invite only approved testers");
    expect(doc).toContain("Use approved staging/private beta accounts only");
  });

  test("docs forbid public signup fake invite automation fake waitlist approval and fake access success", () => {
    const doc = readSource("docs/private-beta-launch-control.md");

    expect(doc).toContain("Do not claim open public signup is available");
    expect(doc).toContain("Do not claim automatic invite automation exists");
    expect(doc).toContain("Do not claim waitlist approval exists");
    expect(doc).toContain("Do not claim tester access succeeded");
    expect(doc).toContain("Do not approve production launch without manual RC and go/no-go sign-off");
  });

  test("launch control checklist includes required gate fields", () => {
    const doc = readSource("docs/private-beta-launch-control.md");

    for (const checklistItem of [
      "Current commit hash placeholder",
      "Staging URL placeholder",
      "Approved tester group placeholder",
      "Tester account list placeholder",
      "SMTP/email verified yes/no",
      "Auth/session smoke yes/no",
      "Protected routes checked yes/no",
      "Credits/billing honesty checked yes/no",
      "BYOK/provider settings fail-closed checked yes/no",
      "Export/artifact honesty checked yes/no",
      "Admin/readiness-only checked yes/no",
      "Feedback intake ready yes/no",
      "Triage/patch planning ready yes/no",
      "Rollback owner placeholder",
      "Final decision: go / no-go / hold",
    ]) {
      expect(doc).toContain(checklistItem);
    }
  });

  test("tester access gate rules and stop rollback criteria are documented", () => {
    const doc = readSource("docs/private-beta-launch-control.md");

    for (const gateRule of [
      "Revoke or stop access if a blocker, security/privacy issue, auth/session issue, or secret exposure appears",
      "Do not share service-role keys or admin secrets with testers",
      "Testers must not submit provider keys, SMTP credentials, tokens, JWTs, webhook secrets, private env values",
      "Tester reports must use the approved feedback intake channel",
      "Tester issues must pass manual triage before patch planning",
    ]) {
      expect(doc).toContain(gateRule);
    }

    for (const stopCriterion of [
      "Secret exposure",
      "Service-role exposure",
      "Broken auth/session",
      "Fake billing/credits",
      "Fake downloads/artifacts/signed URLs",
      "Public launch claim",
      "Staging outage",
      "Tester access leak",
    ]) {
      expect(doc).toContain(stopCriterion);
    }
  });

  test("communication templates cover invite hold revoked and limitations messages", () => {
    const doc = readSource("docs/private-beta-launch-control.md");

    expect(doc).toContain("Approved Tester Invite");
    expect(doc).toContain("Hold/No-Go Notice");
    expect(doc).toContain("Access Revoked/Paused Notice");
    expect(doc).toContain("Known Limitations Reminder");
    expect(doc).toContain("You are approved for the controlled Free AI Mixer private beta");
    expect(doc).toContain("private beta access is currently on hold");
    expect(doc).toContain("private beta access has been paused or revoked");
    expect(doc).toContain("Provider Settings/BYOK remains pre-live and fail-closed");
  });

  test("launch control is linked from RC go-no-go invite feedback triage staging docs", () => {
    const linkedDocs = [
      readSource("docs/private-beta-release-candidate-checklist.md"),
      readSource("docs/private-beta-go-no-go-checklist.md"),
      readSource("docs/private-beta-tester-invite-pack.md"),
      readSource("docs/private-beta-feedback-intake.md"),
      readSource("docs/private-beta-issue-triage-patch-planning.md"),
      readSource("docs/staging-manual-smoke-runbook.md"),
      readSource("docs/staging-deployment-readiness.md"),
    ];

    for (const source of linkedDocs) {
      expect(source).toContain("Private Beta Launch Control And Tester Access Gate");
      expect(source).toContain("./private-beta-launch-control.md");
    }
  });

  test("docs preserve non-live product boundaries and contain no real secrets", () => {
    const docsSource = [
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
      "Admin/analytics remains readiness-only",
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

  test("no invite waitlist tester access API fake access state or release automation was added", () => {
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
      "inviteAutomation",
      "waitlistApproved",
      "testerAccessApproved",
      "tester access approved",
      "Tester access approved",
      "tester access success",
      "Tester access success",
      "useWaitlistStore",
      "useInviteStore",
      "useTesterAccessStore",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontendMarker);
    }

    for (const forbiddenBackendMarker of [
      '"/invites"',
      "'/invites'",
      "`/invites`",
      '"/waitlist"',
      "'/waitlist'",
      "`/waitlist`",
      '"/tester-access"',
      "'/tester-access'",
      "`/tester-access`",
      "inviteRouter",
      "waitlistRouter",
      "testerAccessRouter",
      "createInviteRouter",
      "createWaitlistRouter",
      "createTesterAccessRouter",
    ]) {
      expect(backendRouteSource).not.toContain(forbiddenBackendMarker);
    }

    expect(packageSource).not.toContain("invite:testers");
    expect(packageSource).not.toContain("waitlist:approve");
    expect(packageSource).not.toContain("tester-access:grant");
    expect(packageSource).not.toContain("release:beta");
  });

  test("phase44 records docs-only launch control boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 44");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("manual launch control");
    expect(combined).toContain("approved tester list");
    expect(combined).toContain("approved staging account");
    expect(combined).toContain("fake tester access success");
    expect(combined).toMatch(/no auth runtime/i);
    expect(combined).toMatch(/no invite, waitlist, or tester access API route/i);
    expect(combined).toMatch(/no database table/i);
    expect(combined).toMatch(/no release automation/i);
    expect(combined).toMatch(/no live BYOK storage/i);
    expect(combined).toMatch(/no billing or credits mutation/i);
    expect(combined).toMatch(/no provider SDK\/API calls/i);
    expect(combined).toMatch(/no generation\/export\/render runtime behavior changed/i);
    expect(combined).toMatch(/no artifact delivery or download behavior was added/i);
    expect(combined).toMatch(/no public launch approval/i);
  });
});
