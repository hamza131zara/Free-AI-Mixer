import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const runbookPath = "docs/byok-provider-keys-schema-apply-runbook.md";

const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const expectNoSecretLookingValues = (source: string): void => {
  for (const forbidden of [
    "sk-test-placeholder",
    "sk_live_",
    "sk-",
    "eyJhbGci",
    "BEGIN PRIVATE KEY",
    "supabase_service_role_",
    "service_role_PHASE70",
    "smtp_password",
    "webhook_secret",
    "FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_V1=",
    "FAKE_PHASE70_PROVIDER_KEY",
  ]) {
    expect(source).not.toContain(forbidden);
  }
};

test.describe("phase70 BYOK schema apply runbook", () => {
  test("runbook exists and references the exact executable schema file", async () => {
    const runbook = await readSource(runbookPath);

    expect(runbook).toContain("BYOK Provider Keys Schema Apply Runbook");
    expect(runbook).toContain(
      "backend/db/migrations/0003_provider_keys_schema_draft.sql",
    );
    expect(runbook).toContain("controlled local/staging schema application only");
    expect(runbook).toContain("does not apply the schema by itself");
  });

  test("runbook includes required pre-checks and production warnings", async () => {
    const runbook = await readSource(runbookPath);

    for (const required of [
      "git status --short",
      "local or staging, never production",
      "app_users",
      "workspaces",
      "service-role key remains backend-only",
      "not exposed through `VITE_*`",
      "Do not run this against production",
      "Do not run this schema apply on production",
    ]) {
      expect(runbook).toContain(required);
    }
  });

  test("verification SQL checks shape without selecting encrypted payload or secret ref values", async () => {
    const runbook = await readSource(runbookPath);

    expect(runbook).toContain("information_schema.tables");
    expect(runbook).toContain("information_schema.columns");
    expect(runbook).toContain("pg_class");
    expect(runbook).toContain("pg_policies");
    expect(runbook).toContain("pg_indexes");
    expect(runbook).toContain("column_name not in ('encrypted_payload', 'secret_ref')");
    expect(runbook).toContain("has_encrypted_payload_column");
    expect(runbook).toContain("has_secret_ref_column");
    expect(runbook).toContain("provider_keys_policy_count");
    expect(runbook).toContain("provider_keys_one_active_per_workspace_provider_idx");

    for (const forbiddenSelect of [
      /select\s+encrypted_payload\b/i,
      /select\s+secret_ref\b/i,
      /select\s+\*\s+from\s+provider_keys/i,
      /from\s+provider_keys\s*;/i,
    ]) {
      expect(runbook).not.toMatch(forbiddenSelect);
    }
  });

  test("runbook keeps frontend input provider SDK and test connection blocked", async () => {
    const runbook = await readSource(runbookPath);

    for (const requiredBoundary of [
      "does not add frontend API key input",
      "Provider SDK/API verification and test connection are still blocked",
      "frontend key input",
      "provider SDK/API calls",
      "test connection",
      "fake connected state",
      "credits",
      "billing",
      "generation",
      "export",
    ]) {
      expect(runbook).toContain(requiredBoundary);
    }
  });

  test("docs link phase70 without claiming migration execution or live BYOK", async () => {
    const strategy = await readSource("docs/byok-provider-key-storage-strategy.md");
    const authRunbook = await readSource("docs/local-auth-runtime-runbook.md");
    const phases = await readSource("docs/phases.md");
    const roadmap = await readSource("docs/roadmap.md");
    const combined = `${strategy}\n${authRunbook}\n${phases}\n${roadmap}`;

    expect(strategy).toContain("Phase 70 Local/Staging Schema Apply Runbook");
    expect(authRunbook).toContain("byok-provider-keys-schema-apply-runbook.md");
    expect(phases).toContain("Phase 70 - BYOK Provider Keys Local/Staging Schema Apply Runbook + Verification Pack");
    expect(roadmap).toContain("Phase 70 status");

    for (const requiredBoundary of [
      "no migration was executed",
      "no schema was applied",
      "No migration execution",
      "No migration execution, schema apply",
      "Live BYOK remains gated",
    ]) {
      expect(combined).toContain(requiredBoundary);
    }
  });

  test("runbook and docs contain no real secrets or instructions to print secrets", async () => {
    const runbook = await readSource(runbookPath);
    const strategy = await readSource("docs/byok-provider-key-storage-strategy.md");
    const combined = `${runbook}\n${strategy}`;

    expectNoSecretLookingValues(combined);

    for (const forbiddenInstruction of [
      /^\s*echo\s+.*service-role/im,
      /^\s*write-host\s+.*service-role/im,
      /^\s*console\.log\(.*service-role/im,
      /^\s*echo\s+.*jwt/im,
      /^\s*write-host\s+.*jwt/im,
      /^\s*console\.log\(.*jwt/im,
      /^\s*echo\s+.*encryption key/im,
      /^\s*write-host\s+.*encryption key/im,
      /^\s*echo\s+.*provider api key/im,
      /^\s*write-host\s+.*provider api key/im,
      /select\s+encrypted_payload\b/i,
      /select\s+secret_ref\b/i,
    ]) {
      expect(combined).not.toMatch(forbiddenInstruction);
    }
  });

  test("source boundaries remain unchanged for docs only schema apply runbook phase", async () => {
    const providerSettingsPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsService = await readSource("src/services/providerSettingsService.ts");
    const routeSource = await readSource("backend/routes/providerSettings.ts");
    const packageJson = await readSource("package.json");
    const frontendSource = `${providerSettingsPage}\n${providerSettingsService}`;

    for (const forbiddenFrontend of [
      'type="password"',
      'name="apiKey"',
      'name="providerKey"',
      "setApiKey",
      "setProviderKey",
      "localStorage.setItem",
      "sessionStorage.setItem",
      "document.cookie",
      "connected_success",
      "verified_success",
      "test_passed",
      "fake_success",
      'fetch("https://',
      "fetch(`https://",
      "api.openai.com",
      "replicate.com",
      "api.runway",
      "api.luma",
      "generativelanguage.googleapis.com",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontend);
    }

    expect(routeSource).toContain("providerKeysRuntimeEnabled");
    expect(routeSource).not.toContain(".decryptProviderKey(");
    expect(packageJson).not.toContain("@openai/");
    expect(packageJson).not.toContain("@replicate/");
    expect(packageJson).not.toContain("@runway");
    expect(packageJson).not.toContain("@luma");
    expect(packageJson).not.toContain("stripe");
  });
});
