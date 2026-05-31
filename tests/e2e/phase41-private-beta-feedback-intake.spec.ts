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

test.describe("phase41 private beta feedback intake", () => {
  test("feedback intake doc exists and remains private-beta only", () => {
    const doc = readSource("docs/private-beta-feedback-intake.md");

    expect(doc).toContain("Private Beta Feedback Intake");
    expect(doc).toContain("Private beta feedback intake is not a public support launch");
    expect(doc).toContain("It does not add in-app feedback submission");
    expect(doc).toContain("All feedback must be reviewed manually");
    expect(doc).toContain("Approved Feedback Channels");
    expect(doc).toContain("Private beta feedback email placeholder");
    expect(doc).toContain("Approved form placeholder");
    expect(doc).toContain("Manual tracker placeholder");
  });

  test("feedback intake warns testers not to send secrets or tokenized auth links", () => {
    const doc = readSource("docs/private-beta-feedback-intake.md");

    for (const requiredWarning of [
      "API keys",
      "Provider keys",
      "SMTP credentials",
      "Access tokens",
      "Refresh tokens",
      "Reset tokens",
      "Service-role keys",
      "JWTs",
      "Webhook secrets",
      "Private environment values",
      "Passwords",
      "Full confirmation links",
      "Recovery links",
      "URL hashes from auth flows",
      "Screenshots or videos that show tokenized URLs",
    ]) {
      expect(doc).toContain(requiredWarning);
    }
  });

  test("feedback template includes reproduction details severity and redaction warning", () => {
    const doc = readSource("docs/private-beta-feedback-intake.md");

    for (const requiredField of [
      "Tester name or approved tester ID",
      "Test account email, if safe",
      "Browser/device/OS",
      "Staging URL or environment label, without secrets",
      "Page/feature tested",
      "Expected result",
      "Actual result",
      "Steps to reproduce",
      "Screenshot/video optional, with secret redaction warning",
      "Severity",
      "Blocker/non-blocker",
      "Auth/email issue category",
      "Billing/credits honesty issue category",
      "BYOK/provider settings issue category",
      "Export/artifact honesty issue category",
      "Admin/readiness issue category",
    ]) {
      expect(doc).toContain(requiredField);
    }

    expect(doc).toContain("crop or blur passwords, tokens");
  });

  test("triage categories stop criteria and communication flow are documented", () => {
    const doc = readSource("docs/private-beta-feedback-intake.md");

    for (const requiredCategory of [
      "Blocker",
      "Security/privacy",
      "Auth/session",
      "Email/SMTP",
      "Credits/billing",
      "BYOK/provider settings",
      "Generation/mixer",
      "Export/artifact",
      "UI/UX",
      "Docs/copy",
    ]) {
      expect(doc).toContain(requiredCategory);
    }

    expect(doc).toContain("Stop And Rollback Criteria");
    expect(doc).toContain("Pause tester onboarding");
    expect(doc).toContain("Tester Communication Flow");
    expect(doc).toContain("Acknowledge receipt manually");
    expect(doc).toContain("Manual Review Before Implementation");
    expect(doc).toContain("Feedback does not automatically become an implementation phase");
  });

  test("invite runbook and go-no-go docs link the feedback intake process", () => {
    const invitePack = readSource("docs/private-beta-tester-invite-pack.md");
    const runbook = readSource("docs/staging-manual-smoke-runbook.md");
    const goNoGo = readSource("docs/private-beta-go-no-go-checklist.md");

    for (const source of [invitePack, runbook, goNoGo]) {
      expect(source).toContain("Private Beta Feedback Intake");
      expect(source).toContain("./private-beta-feedback-intake.md");
    }

    expect(invitePack).toContain("approved private beta feedback channel");
    expect(goNoGo).toContain("approved feedback intake channel is ready and secret-safe");
  });

  test("phase41 docs do not include real secrets or public launch claims", () => {
    const docsSource = [
      "docs/private-beta-feedback-intake.md",
      "docs/private-beta-tester-invite-pack.md",
      "docs/staging-manual-smoke-runbook.md",
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
    expect(docsSource).toContain("Private beta is not public launch");
  });

  test("no fake in-app feedback submission or backend feedback route was added", () => {
    const frontendSource = listFiles("src")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");
    const backendRouteSource = listFiles("backend/routes")
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .map(readSource)
      .join("\n");

    for (const forbiddenFrontendMarker of [
      "submitFeedback",
      "sendFeedback",
      "feedback submitted",
      "feedback received",
      "Feedback submitted",
      "Feedback received",
      "useFeedbackStore",
      "feedbackStore",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontendMarker);
    }

    for (const forbiddenBackendMarker of [
      '"/feedback"',
      "'/feedback'",
      "`/feedback`",
      "feedbackRouter",
      "createFeedbackRouter",
      "submitFeedback",
      "feedbackSubmission",
    ]) {
      expect(backendRouteSource).not.toContain(forbiddenBackendMarker);
    }
  });

  test("phase41 records docs-only intake boundaries without runtime expansion", () => {
    const roadmap = readSource("docs/roadmap.md");
    const phases = readSource("docs/phases.md");
    const knownIssues = readSource("docs/known-issues.md");
    const combined = `${roadmap}\n${phases}\n${knownIssues}`;

    expect(combined).toContain("Phase 41");
    expect(combined).toContain("docs plus focused regression coverage only");
    expect(combined).toContain("no feedback API route");
    expect(combined).toContain("no in-app feedback submission");
    expect(combined).toMatch(/no app runtime/i);
    expect(combined).toMatch(/no auth runtime/i);
    expect(combined).toMatch(/no live BYOK storage/i);
    expect(combined).toMatch(/no billing or credits mutation/i);
    expect(combined).toMatch(/no provider SDK\/API calls/i);
    expect(combined).toMatch(/no generation\/export\/render runtime behavior changed/i);
    expect(combined).toMatch(/no public launch approval/i);
  });
});
