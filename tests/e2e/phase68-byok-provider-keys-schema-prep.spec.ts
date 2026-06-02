import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const migrationPath = "backend/db/migrations/0003_provider_keys_schema_draft.sql";
const schemaMirrorPath = "backend/db/schema/phase59-provider-keys-schema-draft.sql";

const extractProviderKeySelectColumns = (source: string): string[] => {
  const match = source.match(
    /const providerKeySelectColumns = \[([\s\S]*?)\]\.join\(", "\);/,
  );

  expect(match, "providerKeySelectColumns should stay statically inspectable").not.toBeNull();

  return Array.from(match?.[1].matchAll(/"([^"]+)"/g) ?? []).map(
    (column) => column[1],
  );
};

const createTableBody = (source: string): string => {
  const match = source.match(
    /create table if not exists provider_keys \(([\s\S]*?)\n\);/,
  );

  expect(match, "provider_keys create table body should be present").not.toBeNull();
  return match?.[1] ?? "";
};

const expectNoLiveSecretSchemaFields = (source: string): void => {
  const tableBody = createTableBody(source).toLowerCase();

  for (const forbiddenColumnPattern of [
    /^\s*api_key\s+/m,
    /^\s*apikey\s+/m,
    /^\s*provider_key\s+/m,
    /^\s*providerkey\s+/m,
    /^\s*plaintext_key\s+/m,
    /^\s*plaintextkey\s+/m,
    /^\s*raw_key\s+/m,
    /^\s*rawkey\s+/m,
    /^\s*replacement_plaintext_key\s+/m,
    /^\s*provider_raw_error\s+/m,
    /^\s*providerrawerror\s+/m,
    /^\s*provider_credential\s+/m,
    /^\s*providercredential\s+/m,
    /^\s*service_role\s+/m,
    /^\s*servicerole\s+/m,
    /^\s*jwt\s+/m,
    /^\s*token\s+/m,
  ]) {
    expect(tableBody).not.toMatch(forbiddenColumnPattern);
  }
};

test.describe("phase68 BYOK provider key executable schema prep", () => {
  test("migration is executable/idempotent local staging prep instead of alter-only draft", async () => {
    const migration = await readSource(migrationPath);

    expect(migration).toContain("create table if not exists provider_keys");
    expect(migration).toContain("alter table provider_keys");
    expect(migration).toContain("add column if not exists");
    expect(migration).toContain("create unique index if not exists");
    expect(migration).toContain("alter table provider_keys enable row level security");
    expect(migration).toContain("No client-facing SELECT, INSERT, UPDATE, or DELETE policies");

    expect(migration).not.toMatch(/^alter table provider_keys/i);
    expect(migration).not.toContain("create policy");
    expect(migration).not.toContain("using (true)");
    expect(migration).not.toContain("with check (true)");
  });

  test("schema mirror stays aligned with executable migration shape", async () => {
    const migration = await readSource(migrationPath);
    const schemaMirror = await readSource(schemaMirrorPath);

    for (const requiredSnippet of [
      "provider_key_id uuid primary key",
      "workspace_id uuid not null references workspaces(id)",
      "owner_id uuid not null references app_users(id)",
      "provider_id text not null",
      "provider_name text not null",
      "encrypted_payload text",
      "secret_ref text",
      "storage_mode text not null default 'encrypted_payload'",
      "key_version text not null",
      "encryption_algorithm text not null",
      "algorithm text",
      "key_fingerprint_suffix text",
      "masked_fingerprint text",
      "status text not null default 'active'",
      "verification_status text not null default 'not_validated'",
      "last_verification_error_code text",
      "needs_reverification boolean not null default true",
      "created_by_user_id uuid not null references app_users(id)",
      "updated_by_user_id uuid references app_users(id)",
      "rotated_at timestamptz",
      "revoked_at timestamptz",
      "disabled_at timestamptz",
      "deleted_at timestamptz",
      "created_at timestamptz not null default now()",
      "updated_at timestamptz not null default now()",
    ]) {
      expect(migration).toContain(requiredSnippet);
      expect(schemaMirror).toContain(requiredSnippet);
    }

    for (const requiredConstraint of [
      "provider_keys_provider_id_check",
      "provider_keys_storage_mode_check",
      "provider_keys_status_check",
      "provider_keys_verification_status_check",
      "provider_keys_active_storage_reference_check",
      "provider_keys_sanitized_verification_error_code_check",
      "provider_keys_key_fingerprint_suffix_check",
      "provider_keys_masked_fingerprint_check",
    ]) {
      expect(migration).toContain(requiredConstraint);
      expect(schemaMirror).toContain(requiredConstraint);
    }
  });

  test("repository selected columns are present in migration and schema mirror", async () => {
    const repositorySource = await readSource(
      "backend/repositories/supabaseProviderKeyRepository.ts",
    );
    const migration = await readSource(migrationPath);
    const schemaMirror = await readSource(schemaMirrorPath);
    const selectedColumns = extractProviderKeySelectColumns(repositorySource);

    expect(selectedColumns).toEqual([
      "provider_key_id",
      "workspace_id",
      "owner_id",
      "provider_id",
      "provider_name",
      "encrypted_payload",
      "secret_ref",
      "storage_mode",
      "key_version",
      "encryption_algorithm",
      "algorithm",
      "status",
      "verification_status",
      "last_verified_at",
      "last_verification_error_code",
      "needs_reverification",
      "created_by_user_id",
      "updated_by_user_id",
      "rotated_at",
      "revoked_at",
      "disabled_at",
      "deleted_at",
      "created_at",
      "updated_at",
    ]);

    for (const column of selectedColumns) {
      expect(migration).toContain(column);
      expect(schemaMirror).toContain(column);
    }
  });

  test("storage reference checks allow exactly one active backend-only handle", async () => {
    const migration = await readSource(migrationPath);
    const schemaMirror = await readSource(schemaMirrorPath);

    for (const source of [migration, schemaMirror]) {
      expect(source).toContain("storage_mode = 'encrypted_payload'");
      expect(source).toContain("encrypted_payload is not null");
      expect(source).toContain("secret_ref is null");
      expect(source).toContain("storage_mode = 'external_secret_ref'");
      expect(source).toContain("secret_ref is not null");
      expect(source).toContain("encrypted_payload is null");
      expect(source).toContain("status <> 'active'");
    }
  });

  test("schema prep preserves no-secret and default-deny boundaries", async () => {
    const migration = await readSource(migrationPath);
    const schemaMirror = await readSource(schemaMirrorPath);
    const combined = `${migration}\n${schemaMirror}`;

    expectNoLiveSecretSchemaFields(migration);
    expectNoLiveSecretSchemaFields(schemaMirror);

    for (const requiredWarning of [
      "Plaintext provider keys",
      "raw provider errors",
      "service-role values",
      "provider credentials",
      "browser-visible secret material",
      "Never return to frontend responses",
      "Raw provider error bodies and account metadata are forbidden",
      "Safe non-secret key fingerprint suffix",
      "Safe non-secret masked fingerprint",
    ]) {
      expect(combined).toContain(requiredWarning);
    }

    for (const forbiddenValue of [
      "sk-test-placeholder",
      "FAKE_PHASE68_PROVIDER_KEY",
      "supabase_service_role_PHASE68",
      "eyJhbGci",
      "smtp_password",
      "FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_V1=",
      "BEGIN PRIVATE KEY",
    ]) {
      expect(combined).not.toContain(forbiddenValue);
    }
  });

  test("runtime boundaries remain source-level unchanged for this schema prep phase", async () => {
    const routeSource = await readSource("backend/routes/providerSettings.ts");
    const providerSettingsPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsService = await readSource("src/services/providerSettingsService.ts");
    const packageJson = await readSource("package.json");
    const frontendSource = `${providerSettingsPage}\n${providerSettingsService}`;

    expect(routeSource).toContain("providerKeysRuntimeEnabled");
    expect(routeSource).toContain(".storeProviderKey(");
    expect(routeSource).toContain(".replaceProviderKey(");
    expect(routeSource).toContain(".revokeProviderKey(");
    expect(routeSource).not.toContain(".decryptProviderKey(");

    for (const forbiddenFrontend of [
      'type="password"',
      'name="apiKey"',
      'name="providerKey"',
      "setApiKey",
      "setProviderKey",
      "localStorage.setItem",
      "sessionStorage.setItem",
      "document.cookie",
      'fetch("https://',
      "fetch(`https://",
      "api.openai.com",
      "replicate.com",
      "api.runway",
      "api.luma",
      "generativelanguage.googleapis.com",
      "connected_success",
      "verified_success",
      "test_passed",
      "fake_success",
    ]) {
      expect(frontendSource).not.toContain(forbiddenFrontend);
    }

    expect(packageJson).not.toContain("@openai/");
    expect(packageJson).not.toContain("@replicate/");
    expect(packageJson).not.toContain("@runway");
    expect(packageJson).not.toContain("@luma");
    expect(packageJson).not.toContain("stripe");
  });
});
