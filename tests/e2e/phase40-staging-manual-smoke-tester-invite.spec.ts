import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

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

test.describe("phase40 staging manual smoke tester invite", () => {
  test("manual staging smoke runbook and tester invite pack exist with non-launch posture", () => {
    const runbook = readSource("docs/staging-manual-smoke-runbook.md");
    const invitePack = readSource("docs/private-beta-tester-invite-pack.md");

    expect(runbook).toContain("Staging Manual Smoke Runbook");
    expect(runbook).toContain("not public launch approval");
    expect(runbook).toContain("Private beta is not public launch");
    expect(invitePack).toContain("Private Beta Tester Invite Pack");
    expect(invitePack).toContain("Tester onboarding remains manual and controlled");
    expect(invitePack).toContain("Private beta is not public launch");
  });

  test("manual smoke checklist covers public auth account protected product and admin surfaces", () => {
    const runbook = readSource("docs/staging-manual-smoke-runbook.md");

    for (const requiredCopy of [
      "Open the landing page",
      "Open the mixer page",
      "Visit login",
      "Visit signup",
      "Visit forgot password",
      "Visit reset password",
      "Log in with an approved staging tester account",
      "dashboard shows backend-derived account/session status",
      "account bootstrap/setup status is clear",
      "selected protected route behavior remains auth/workspace-gated",
      "/project-library/projects",
      "/project-library/history",
      "/provider-settings/status",
      "/credits/status",
      "Credits",
      "BYOK/provider key storage remains pre-live and fail-closed",
      "Projects",
      "History",
      "fake downloads",
      "fake signed URLs",
      "fake artifacts",
      "fake success",
      "admin/analytics remain readiness-only",
    ]) {
      expect(runbook).toContain(requiredCopy);
    }
  });

  test("tester invite pack requires approved accounts email caution and known limitations", () => {
    const invitePack = readSource("docs/private-beta-tester-invite-pack.md");

    expect(invitePack).toContain("approved staging testers");
    expect(invitePack).toContain("approved staging tester accounts only");
    expect(invitePack).toContain("Custom SMTP must be manually verified");
    expect(invitePack).toContain("check spam, junk, or promotions folders");
    expect(invitePack).toContain("use only the newest confirmation or recovery email");
    expect(invitePack).toContain("not to share passwords, full confirmation links, recovery links, URL hashes");
    expect(invitePack).toContain("Provider Settings/BYOK remains pre-live and fail-closed");
    expect(invitePack).toContain("Credits and billing remain non-live");
    expect(invitePack).toContain("fake downloads, fake signed URLs, fake artifacts, or fake success");
    expect(invitePack).toContain("Admin analytics remain readiness-only");
  });

  test("docs include stop rollback criteria and remain linked from go-no-go and staging readiness", () => {
    const runbook = readSource("docs/staging-manual-smoke-runbook.md");
    const invitePack = readSource("docs/private-beta-tester-invite-pack.md");
    const goNoGo = readSource("docs/private-beta-go-no-go-checklist.md");
    const stagingReadiness = readSource("docs/staging-deployment-readiness.md");

    expect(runbook).toContain("Stop And Rollback Criteria");
    expect(runbook).toContain("Pause tester invitations");
    expect(runbook).toContain("Return to the internal smoke user only");
    expect(invitePack).toContain("Stop Criteria During Tester Onboarding");
    expect(invitePack).toContain("Revocation And Rollback");
    expect(invitePack).toContain("Disable or delete tester users in Supabase");
    expect(goNoGo).toContain("Staging Manual Smoke Runbook");
    expect(goNoGo).toContain("Private Beta Tester Invite Pack");
    expect(stagingReadiness).toContain("Staging Manual Smoke Runbook");
    expect(stagingReadiness).toContain("Private Beta Tester Invite Pack");
  });

  test("phase40 docs do not include real secrets or public launch readiness claims", () => {
    const docsSource = [
      "docs/staging-manual-smoke-runbook.md",
      "docs/private-beta-tester-invite-pack.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/staging-deployment-readiness.md",
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
    expect(docsSource).toContain("Public/open beta | Blocked");
  });

  test("phase40 is docs only and records no runtime behavior expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 40");
    expect(combined).toContain("docs and focused docs regression coverage only");
    expect(combined).toContain("no deployment");
    expect(combined).toContain("no auth runtime");
    expect(combined).toContain("no live BYOK storage");
    expect(combined).toContain("no billing or credits mutation");
    expect(combined).toContain("no provider SDK/API calls");
    expect(combined).toContain("no generation/export/render runtime behavior changed");
    expect(combined).toContain("no artifact delivery or download behavior was added");
    expect(combined).toContain("no public launch approval");
  });
});
