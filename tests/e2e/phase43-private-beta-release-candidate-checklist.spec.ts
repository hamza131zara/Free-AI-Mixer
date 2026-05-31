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

test.describe("phase43 private beta release candidate checklist", () => {
  test("release candidate checklist doc exists and blocks public launch interpretation", () => {
    const doc = readSource("docs/private-beta-release-candidate-checklist.md");

    expect(doc).toContain("Private Beta Release Candidate Checklist");
    expect(doc).toContain("Private beta RC is not public launch");
    expect(doc).toContain("RC candidate means ready for controlled tester review only");
    expect(doc).toContain("does not deploy anything");
    expect(doc).toContain("does not");
    expect(doc).toContain("fake RC-approved status");
  });

  test("RC prerequisites include manual smoke build typecheck post181 and phase readiness packs", () => {
    const doc = readSource("docs/private-beta-release-candidate-checklist.md");

    for (const requiredCheck of [
      "Manual staging smoke must pass",
      "npm.cmd run typecheck",
      "npm.cmd run build",
      "npm.cmd run test:e2e -- tests/e2e/post181-launch-qa-smoke.spec.ts",
      "Phase 37 private beta publish readiness checks must be complete",
      "Phase 38 staging deployment readiness checks must be complete",
      "Phase 39 staging publish dry-run safety checks must be complete",
      "Phase 40 staging manual smoke and tester invite checks must be complete",
      "Phase 41 feedback intake checks must be complete",
      "Phase 42 issue triage and patch planning checks must be complete",
    ]) {
      expect(doc).toContain(requiredCheck);
    }
  });

  test("RC checklist includes SMTP tester invite feedback intake and triage readiness", () => {
    const doc = readSource("docs/private-beta-release-candidate-checklist.md");

    expect(doc).toContain("Custom SMTP/email delivery must be manually verified before serious tester onboarding");
    expect(doc).toContain("Tester invite pack must be ready");
    expect(doc).toContain("Feedback intake must be ready");
    expect(doc).toContain("Issue triage/patch planning must be ready");
    expect(doc).toContain("Feedback intake channel is ready and secret-safe");
    expect(doc).toContain("Issue triage and patch planning are ready");
  });

  test("RC checklist preserves security privacy and product honesty boundaries", () => {
    const doc = readSource("docs/private-beta-release-candidate-checklist.md");

    for (const requiredBoundary of [
      "No committed secrets or real env values",
      "No service-role exposure",
      "No service-role key in frontend config or `VITE_*` env",
      "No frontend Supabase DB access",
      "No frontend Supabase storage access",
      "No fake auth/session",
      "No fake credits/billing",
      "BYOK remains pre-live/fail-closed",
      "Provider Settings remain honest",
      "Export/artifact delivery remains honest",
      "no fake downloads",
      "no fake signed URLs",
      "no fake artifacts",
      "no fake success",
      "Public artifact delivery remains gated by production auth/RLS/storage readiness",
      "Admin/analytics remains readiness-only",
    ]) {
      expect(doc).toContain(requiredBoundary);
    }
  });

  test("RC checklist includes stop rollback criteria and final manual decision template", () => {
    const doc = readSource("docs/private-beta-release-candidate-checklist.md");

    for (const stopCriterion of [
      "Secret exposure",
      "Service-role exposure",
      "Broken auth/session",
      "Fake billing/credits",
      "Fake downloads/artifacts",
      "Fake signed URLs",
      "Public launch claim",
      "Fake RC-approved status",
      "Major staging outage",
    ]) {
      expect(doc).toContain(stopCriterion);
    }

    for (const templateField of [
      "Candidate date",
      "Commit hash placeholder",
      "Staging URL placeholder",
      "Tester group placeholder",
      "Pass/fail checklist",
      "Known limitations",
      "Decision: go / no-go / hold",
      "Reviewer sign-off placeholder",
    ]) {
      expect(doc).toContain(templateField);
    }
  });

  test("RC checklist is linked from staging go-no-go feedback and patch-planning docs", () => {
    const linkedDocs = [
      readSource("docs/private-beta-go-no-go-checklist.md"),
      readSource("docs/staging-deployment-readiness.md"),
      readSource("docs/staging-manual-smoke-runbook.md"),
      readSource("docs/private-beta-feedback-intake.md"),
      readSource("docs/private-beta-issue-triage-patch-planning.md"),
    ];

    for (const source of linkedDocs) {
      expect(source).toContain("Private Beta Release Candidate Checklist");
      expect(source).toContain("./private-beta-release-candidate-checklist.md");
    }
  });

  test("phase43 docs do not include real secrets or fake launch approval claims", () => {
    const docsSource = [
      "docs/private-beta-release-candidate-checklist.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/staging-deployment-readiness.md",
      "docs/staging-manual-smoke-runbook.md",
      "docs/private-beta-feedback-intake.md",
      "docs/private-beta-issue-triage-patch-planning.md",
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
    expect(docsSource).not.toContain("RC approved");
    expect(docsSource).not.toContain("release candidate approved");
    expect(docsSource).toContain("Private beta RC is not public launch");
  });

  test("no release automation fake deployment or fake tester onboarding success was added", () => {
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
      "rcApproved",
      "releaseCandidateApproved",
      "tester onboarding complete",
      "Tester onboarding complete",
      "deployment successful",
      "Deployment successful",
      "publicLaunchApproved",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontendMarker);
    }

    for (const forbiddenBackendMarker of [
      '"/release"',
      "'/release'",
      "`/release`",
      '"/rc"',
      "'/rc'",
      "`/rc`",
      "releaseRouter",
      "createReleaseRouter",
      "rcApproved",
      "publicLaunchApproved",
    ]) {
      expect(backendRouteSource).not.toContain(forbiddenBackendMarker);
    }

    expect(packageSource).not.toContain("deploy:staging");
    expect(packageSource).not.toContain("release:rc");
    expect(packageSource).not.toContain("publish:beta");
  });

  test("phase43 records docs-only RC boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 43");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("Private beta RC is not public launch");
    expect(combined).toContain("fake RC-approved status");
    expect(combined).toContain("fake deployment");
    expect(combined).toContain("fake tester onboarding success");
    expect(combined).toMatch(/no auth runtime/i);
    expect(combined).toMatch(/no release automation/i);
    expect(combined).toMatch(/no live BYOK storage/i);
    expect(combined).toMatch(/no billing or credits mutation/i);
    expect(combined).toMatch(/no provider SDK\/API calls/i);
    expect(combined).toMatch(/no generation\/export\/render runtime behavior changed/i);
    expect(combined).toMatch(/no artifact delivery or download behavior was added/i);
    expect(combined).toMatch(/no public launch approval/i);
  });
});
