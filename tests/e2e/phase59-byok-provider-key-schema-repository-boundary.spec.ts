import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  SupabaseProviderKeyRepository,
  type ProviderKeyRow,
  type ProviderKeysTableQuery,
  type ProviderKeysTableQueryResult,
  type SupabaseProviderKeyClient,
} from "../../backend/repositories/supabaseProviderKeyRepository";

const fakeEncryptedPayload = "FAKE_PHASE59_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const fakeSecretRef = "FAKE_PHASE59_SECRET_REF_DO_NOT_RETURN";
const fakeRawKey = "FAKE_PHASE59_RAW_PROVIDER_KEY_DO_NOT_STORE";
const fakeProviderRawError = "FAKE_PHASE59_PROVIDER_RAW_ERROR_DO_NOT_RETURN";

const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const expectNoSecretMaterial = (serialized: string): void => {
  for (const forbidden of [
    fakeEncryptedPayload,
    fakeSecretRef,
    fakeRawKey,
    fakeProviderRawError,
    "providerCredential",
    "provider_raw_error",
    "providerRawError",
    "service_role",
    "serviceRole",
    "secretRef",
    "encryptedPayload",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

class InMemoryProviderKeysQuery
  implements ProviderKeysTableQuery<ProviderKeyRow>
{
  private filters: Array<{ column: string; value: string | number | boolean | null }> = [];
  private nullFilters: string[] = [];
  private insertValue?: Partial<ProviderKeyRow>;
  private updateValue?: Partial<ProviderKeyRow>;

  constructor(private readonly rows: ProviderKeyRow[]) {}

  select(_columns: string): ProviderKeysTableQuery<ProviderKeyRow> {
    return this;
  }

  eq(
    column: string,
    value: string | number | boolean | null,
  ): ProviderKeysTableQuery<ProviderKeyRow> {
    this.filters.push({ column, value });
    return this;
  }

  is(column: string, value: null): ProviderKeysTableQuery<ProviderKeyRow> {
    if (value === null) {
      this.nullFilters.push(column);
    }
    return this;
  }

  insert(values: Partial<ProviderKeyRow>): ProviderKeysTableQuery<ProviderKeyRow> {
    this.insertValue = values;
    return this;
  }

  update(values: Partial<ProviderKeyRow>): ProviderKeysTableQuery<ProviderKeyRow> {
    this.updateValue = values;
    return this;
  }

  async maybeSingle(): Promise<ProviderKeysTableQueryResult<ProviderKeyRow>> {
    const result = await this.execute();

    return {
      ...result,
      data: Array.isArray(result.data) ? result.data[0] ?? null : result.data,
    };
  }

  then<TResult1 = ProviderKeysTableQueryResult<ProviderKeyRow>, TResult2 = never>(
    onfulfilled?:
      | ((value: ProviderKeysTableQueryResult<ProviderKeyRow>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<ProviderKeysTableQueryResult<ProviderKeyRow>> {
    if (this.insertValue) {
      const incoming = this.insertValue as ProviderKeyRow;
      const conflict = this.rows.some(
        (row) =>
          row.workspace_id === incoming.workspace_id &&
          row.provider_name === incoming.provider_name &&
          row.status === "active" &&
          row.deleted_at === null,
      );

      if (conflict) {
        return {
          data: null,
          error: {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          },
        };
      }

      this.rows.push({ ...incoming });
      return { data: { ...incoming }, error: null };
    }

    const matches = this.rows.filter((row) => this.matches(row));

    if (this.updateValue) {
      const updated = matches.map((row) => {
        Object.assign(row, this.updateValue);
        return { ...row };
      });

      return { data: updated, error: null };
    }

    return { data: matches.map((row) => ({ ...row })), error: null };
  }

  private matches(row: ProviderKeyRow): boolean {
    return (
      this.filters.every(({ column, value }) => row[column as keyof ProviderKeyRow] === value) &&
      this.nullFilters.every((column) => row[column as keyof ProviderKeyRow] === null)
    );
  }
}

class InMemoryProviderKeysClient implements SupabaseProviderKeyClient {
  constructor(readonly rows: ProviderKeyRow[] = []) {}

  from(table: "provider_keys"): ProviderKeysTableQuery<ProviderKeyRow> {
    expect(table).toBe("provider_keys");
    return new InMemoryProviderKeysQuery(this.rows);
  }
}

test.describe("phase59 BYOK provider key schema and repository boundary", () => {
  test("schema draft supports backend-only storage references verification metadata and default-deny posture", async () => {
    const migration = await readSource(
      "backend/db/migrations/0003_provider_keys_schema_draft.sql",
    );
    const schemaMirror = await readSource(
      "backend/db/schema/phase59-provider-keys-schema-draft.sql",
    );
    const combinedSchema = `${migration}\n${schemaMirror}`;

    for (const required of [
      "secret_ref",
      "encrypted_payload",
      "storage_mode",
      "provider_id",
      "provider_name",
      "workspace_id",
      "owner_id",
      "created_by_user_id",
      "updated_by_user_id",
      "key_version",
      "encryption_algorithm",
      "verification_status",
      "last_verified_at",
      "last_verification_error_code",
      "needs_reverification",
      "revoked_at",
      "deleted_at",
      "provider_keys_one_active_per_workspace_provider_idx",
      "enable row level security",
      "Default-deny RLS posture",
      "Raw provider error bodies",
    ]) {
      expect(combinedSchema).toContain(required);
    }

    expect(combinedSchema).toContain("storage_mode = 'encrypted_payload'");
    expect(combinedSchema).toContain("storage_mode = 'external_secret_ref'");
    expect(combinedSchema).toContain("encrypted_payload is not null");
    expect(combinedSchema).toContain("secret_ref is not null");
    expect(combinedSchema).not.toContain("plaintext_key");
    expect(combinedSchema).not.toContain("raw_provider_error text");
    expect(combinedSchema).not.toContain("provider_credential");
    expect(combinedSchema).not.toContain("service_role");
  });

  test("repository adapter create conflict replace and revoke return redacted storage results only", async () => {
    const client = new InMemoryProviderKeysClient();
    const repository = new SupabaseProviderKeyRepository(client);

    const stored = await repository.createProviderKey({
      createdByUserId: "phase59-user",
      encryptedSecret: {
        algorithm: "aes-256-gcm",
        encryptedPayload: fakeEncryptedPayload,
        keyVersion: "phase59-key-v1",
      },
      ownerId: "phase59-owner",
      providerId: "openai",
      workspaceId: "phase59-workspace",
    });

    expect(stored.kind).toBe("stored");
    expectNoSecretMaterial(JSON.stringify(stored));

    const conflict = await repository.createProviderKey({
      createdByUserId: "phase59-user",
      encryptedSecret: {
        algorithm: "aes-256-gcm",
        encryptedPayload: fakeEncryptedPayload,
        keyVersion: "phase59-key-v1",
      },
      ownerId: "phase59-owner",
      providerId: "openai",
      workspaceId: "phase59-workspace",
    });

    expect(conflict).toMatchObject({
      kind: "conflict",
      code: "active_provider_key_exists",
    });
    expectNoSecretMaterial(JSON.stringify(conflict));

    const activeBeforeReplace = client.rows.find((row) => row.status === "active");
    expect(activeBeforeReplace?.provider_key_id).toBeTruthy();

    const replaced = await repository.replaceProviderKey({
      providerId: "openai",
      providerKeyId: activeBeforeReplace?.provider_key_id ?? "missing",
      requesterUserId: "phase59-user",
      secretRef: fakeSecretRef,
      workspaceId: "phase59-workspace",
    });

    expect(replaced.kind).toBe("replaced");
    expectNoSecretMaterial(JSON.stringify(replaced));
    expect(
      client.rows.some(
        (row) =>
          row.provider_key_id === activeBeforeReplace?.provider_key_id &&
          row.status === "rotated" &&
          Boolean(row.rotated_at),
      ),
    ).toBeTruthy();

    const activeAfterReplace = client.rows.find((row) => row.status === "active");
    expect(activeAfterReplace?.storage_mode).toBe("external_secret_ref");

    const revoked = await repository.revokeProviderKey({
      providerKeyId: activeAfterReplace?.provider_key_id ?? "missing",
      requesterUserId: "phase59-user",
      workspaceId: "phase59-workspace",
    });

    expect(revoked.kind).toBe("revoked");
    expectNoSecretMaterial(JSON.stringify(revoked));
    expect(
      client.rows.some(
        (row) =>
          row.provider_key_id === activeAfterReplace?.provider_key_id &&
          row.status === "disabled" &&
          Boolean(row.revoked_at) &&
          Boolean(row.disabled_at),
      ),
    ).toBeTruthy();
  });

  test("repository adapter source keeps secret material out of public results and logging", async () => {
    const source = await readSource(
      "backend/repositories/supabaseProviderKeyRepository.ts",
    );

    expect(source).toContain("createProviderKey");
    expect(source).toContain("replaceProviderKey");
    expect(source).toContain("revokeProviderKey");
    expect(source).toContain("active_provider_key_exists");
    expect(source).toContain("rotated_at");
    expect(source).toContain("revoked_at");
    expect(source).toContain("toRedactedConnectionSummary");
    expect(source).not.toContain("console.");
    expect(source).not.toContain("logger.");
    expect(source).not.toContain("rawProviderError");
    expect(source).not.toContain("providerCredential");
    expect(source).not.toContain("serviceRole");
    expect(source).not.toContain("return row.encrypted_payload");
    expect(source).not.toContain("return row.secret_ref");
  });

  test("provider settings routes remain fail closed and unwired to live repository storage", async () => {
    const providerSettingsRoute = await readSource("backend/routes/providerSettings.ts");
    const backendDependencies = await readSource(
      "backend/composition/backendDependencies.ts",
    );
    const appSource = await readSource("backend/app.ts");
    const combinedRuntime = `${providerSettingsRoute}\n${backendDependencies}\n${appSource}`;

    expect(providerSettingsRoute).toContain("secure_provider_key_storage_not_enabled");
    expect(providerSettingsRoute).toContain("createNotConfiguredProviderSecretVault");
    expect(combinedRuntime).not.toContain("SupabaseProviderKeyRepository");
    expect(combinedRuntime).not.toContain("createSupabaseProviderKeyRepository");
    expect(combinedRuntime).not.toContain("supabaseProviderKeyRepository");
    expect(providerSettingsRoute).not.toContain(".createProviderKey(");
    expect(providerSettingsRoute).not.toContain(".replaceProviderKey(");
    expect(providerSettingsRoute).not.toContain(".revokeProviderKey(");
  });

  test("frontend and runtime source boundaries remain unchanged for pre-live BYOK", async () => {
    const providerSettingsPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsStore = await readSource("src/store/providerSettingsStore.ts");
    const providerSettingsService = await readSource("src/services/providerSettingsService.ts");
    const authenticatedFetch = await readSource("src/services/auth/authenticatedFetch.ts");
    const packageJson = await readSource("package.json");
    const combinedFrontend = [
      providerSettingsPage,
      providerSettingsStore,
      providerSettingsService,
      authenticatedFetch,
    ].join("\n");

    for (const forbidden of [
      'type="password"',
      'name="apiKey"',
      'name="providerKey"',
      "setApiKey",
      "setProviderKey",
      "localStorage.setItem",
      "localStorage.getItem",
      "localStorage.removeItem",
      "sessionStorage.setItem",
      "sessionStorage.getItem",
      "sessionStorage.removeItem",
      "document.cookie",
      "persist(",
      "api.openai.com",
      "replicate.com",
      "runwayml",
      "api.runway",
      "lumalabs.ai",
      "api.luma",
      "generativelanguage.googleapis.com",
      'fetch("https://',
      "fetch(`https://",
      "connected_success",
      "verified_success",
      "verification_success",
      "test_passed",
      "fake_success",
    ]) {
      expect(combinedFrontend).not.toContain(forbidden);
    }

    expect(authenticatedFetch).toContain('"/provider-settings/status"');
    expect(authenticatedFetch).not.toContain('"/provider-settings/connections"');
    expect(packageJson).not.toContain("@openai/");
    expect(packageJson).not.toContain("@replicate/");
    expect(packageJson).not.toContain("@runway");
    expect(packageJson).not.toContain("@luma");
    expect(packageJson).not.toContain("stripe");
  });

  test("phase59 docs record schema and repository boundary without live BYOK claims", async () => {
    const byokDoc = await readSource("docs/byok-provider-key-storage-strategy.md");
    const phases = await readSource("docs/phases.md");
    const roadmap = await readSource("docs/roadmap.md");
    const combinedDocs = `${byokDoc}\n${phases}\n${roadmap}`;

    expect(byokDoc).toContain("Phase 59 Schema Draft And Repository Adapter Boundary");
    expect(byokDoc).toContain("draft provider key schema refinement");
    expect(byokDoc).toContain("Supabase provider key repository adapter boundary");
    expect(byokDoc).toContain("Provider Settings routes remain fail-closed and unwired");
    expect(phases).toContain("Phase 59 - BYOK Provider Key Schema Draft");
    expect(roadmap).toContain("Phase 59 status");
    expect(combinedDocs).toContain("No frontend API key input");
    expect(combinedDocs).toContain("No provider SDK/API calls");
    expect(combinedDocs).toContain("No fake connected, verified, or test-passed state");
    expect(combinedDocs).not.toContain(fakeEncryptedPayload);
    expect(combinedDocs).not.toContain(fakeSecretRef);
    expect(combinedDocs).not.toContain(fakeRawKey);
  });
});
