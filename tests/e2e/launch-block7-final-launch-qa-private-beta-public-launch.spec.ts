import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const readRepoFile = (relativePath: string) =>
  readFile(path.join(repoRoot, relativePath), "utf8");

const launchBlockTests = [
  "launch-block0-provider-capability-policy.spec.ts",
  "launch-block1-final-qa-completion.spec.ts",
  "launch-block2-production-storage-artifact-delivery.spec.ts",
  "launch-block3-billing-credits-subscriptions.spec.ts",
  "launch-block4-real-provider-generation-boundary.spec.ts",
  "launch-block5-real-video-generation-boundary.spec.ts",
  "launch-block6-production-deployment-readiness.spec.ts",
] as const;

const forbiddenClaims = [
  /private beta is public launch/i,
  /public launch is approved/i,
  /platform-paid generation is enabled/i,
  /real video generation is enabled/i,
  /live billing is enabled/i,
  /downloads are guaranteed/i,
  /unlimited free generation/i,
] as const;

const forbiddenSecretTokens = [
  "service-role-key-value",
  "sk-live",
  "sk_test",
  "OPENAI_API_KEY=",
  "GEMINI_API_KEY=",
  "STRIPE_SECRET_KEY=",
  "SUPABASE_SERVICE_ROLE_KEY=ey",
] as const;

test.describe("Launch Block 7 final QA/private beta/public launch boundary", () => {
  test("Blocks 0-6 focused tests and final QA smoke are represented", async () => {
    const testIndex = await Promise.all(
      launchBlockTests.map(async (fileName) =>
        readRepoFile(path.join("tests", "e2e", fileName)),
      ),
    );
    const finalSmoke = await readRepoFile(
      "tests/e2e/post181-launch-qa-smoke.spec.ts",
    );

    expect(testIndex.join("\n")).toContain("Launch Block 0");
    expect(testIndex.join("\n")).toContain("Launch Block 6");
    expect(finalSmoke).toContain("post181 launch qa smoke");
    expect(finalSmoke).toContain("frontend source still avoids direct supabase storage client usage");
  });

  test("private beta docs, decision record, and final runbook preserve go/hold/no-go boundaries", async () => {
    const goNoGo = await readRepoFile("docs/private-beta-go-no-go-checklist.md");
    const finalRunbook = await readRepoFile(
      "docs/private-beta-final-manual-launch-runbook.md",
    );
    const decisionRecord = await readRepoFile(
      "docs/private-beta-launch-decision-record.md",
    );
    const matrix = await readRepoFile(
      "docs/launch-block7-final-qa-public-launch-matrix.md",
    );
    const combined = [goNoGo, finalRunbook, decisionRecord, matrix].join("\n");

    expect(combined).toContain("go");
    expect(combined).toContain("no-go");
    expect(combined).toContain("hold");
    expect(combined).toContain("Private beta is controlled testing, not public launch.");
    expect(combined).toContain("Private beta go is not public launch");
    expect(combined).toContain("feedback intake");
    expect(combined).toContain("triage");
    expect(combined).toContain("Rollback");
  });

  test("public launch blocker matrix covers unavailable launch blockers", async () => {
    const matrix = await readRepoFile(
      "docs/launch-block7-final-qa-public-launch-matrix.md",
    );

    for (const requiredText of [
      "Provider billing/quota/access must be broadly verified",
      "Platform-paid generation",
      "Real video providers",
      "Live payment processor",
      "Public/signed/download URLs",
      "Production auth/RLS/storage",
      "SMTP/onboarding/support",
      "Admin/legal/privacy",
      "Public launch approval",
    ]) {
      expect(matrix).toContain(requiredText);
    }
  });

  test("production smoke, rollback, and manual migration boundaries are documented", async () => {
    const matrix = await readRepoFile(
      "docs/launch-block7-final-qa-public-launch-matrix.md",
    );
    const deployment = await readRepoFile("docs/deployment.md");
    const combined = `${matrix}\n${deployment}`;

    expect(combined).toContain("Production Smoke Checklist");
    expect(combined).toContain("Rollback Checklist");
    expect(combined).toContain("manual migration");
    expect(combined).toContain("no app startup auto-apply");
    expect(combined).toContain("production CORS");
    expect(combined).toContain("explicit allowed origins");
  });

  test("docs do not claim unavailable provider billing video or artifact success", async () => {
    const docs = [
      await readRepoFile("docs/launch-block7-final-qa-public-launch-matrix.md"),
      await readRepoFile("docs/public-launch-audit.md"),
      await readRepoFile("docs/roadmap.md"),
      await readRepoFile("docs/known-issues.md"),
      await readRepoFile("docs/phases.md"),
    ].join("\n");

    for (const claim of forbiddenClaims) {
      expect(docs).not.toMatch(claim);
    }

    expect(docs).toContain("BYOK real generation depends on user provider billing/quota/access.");
    expect(docs).toContain("Platform-paid generation is not enabled.");
    expect(docs).toContain("Real video generation is not enabled.");
    expect(docs).toContain("Billing/subscriptions are not live unless separately approved.");
    expect(docs).toContain("Downloads/public delivery are not promised unless separately audited.");
  });

  test("docs and tests avoid secrets, direct frontend storage, arbitrary CORS, and automation provider calls", async () => {
    const docsOnly = [
      await readRepoFile("docs/launch-block7-final-qa-public-launch-matrix.md"),
      await readRepoFile("docs/private-beta-go-no-go-checklist.md"),
      await readRepoFile("docs/private-beta-final-manual-launch-runbook.md"),
      await readRepoFile("docs/public-launch-audit.md"),
    ].join("\n");

    for (const token of forbiddenSecretTokens) {
      expect(docsOnly).not.toContain(token);
    }

    expect(docsOnly).toContain("Direct frontend Supabase DB/storage access appears.");
    expect(docsOnly).toContain("CORS allows arbitrary production origins.");
    expect(docsOnly).toContain("Real provider calls occur from Codex/test automation.");
    expect(docsOnly).toContain("Remote migrations are auto-applied by app startup.");
  });
});
