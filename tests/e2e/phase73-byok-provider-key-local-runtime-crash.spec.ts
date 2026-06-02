import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AsyncBackendRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendSupportedProviderId,
} from "../../backend/contracts/providerSettingsHttpTypes";
import type {
  ProviderSecretVault,
  ProviderSecretVaultOperationResult,
  ProviderSecretVaultReadiness,
} from "../../backend/providers/providerSecretVault";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";
import {
  SupabaseProviderKeyRepository,
  type ProviderKeyRow,
  type ProviderKeysTableQuery,
  type ProviderKeysTableQueryResult,
  type SupabaseProviderKeyClient,
} from "../../backend/repositories/supabaseProviderKeyRepository";

const fakeRawProviderKey = "FAKE_PHASE73C_PROVIDER_KEY_DO_NOT_STORE";
const fakeEncryptedPayload = "FAKE_PHASE73C_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const fakeSecretRef = "FAKE_PHASE73C_SECRET_REF_DO_NOT_RETURN";
const fakeProviderCredential = "FAKE_PHASE73C_PROVIDER_CREDENTIAL_DO_NOT_RETURN";

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
};

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const expectNoSecretLeak = (serialized: string): void => {
  for (const forbidden of [
    fakeRawProviderKey,
    fakeEncryptedPayload,
    fakeSecretRef,
    fakeProviderCredential,
    "encryptedPayload",
    "secretRef",
    "providerCredential",
    "providerRawError",
    "provider_raw_error",
    "service_role",
    '"iv"',
    '"tag"',
    "ciphertext",
    "test_passed",
    "verified_success",
    "connected_success",
    "fake_success",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

class LegacyIntegerKeyVersionProviderKeysQuery
  implements ProviderKeysTableQuery<ProviderKeyRow>
{
  private filters: Array<{ column: string; value: string | number | boolean | null }> =
    [];
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

      if (
        "key_fingerprint_suffix" in incoming ||
        "masked_fingerprint" in incoming
      ) {
        return {
          data: null,
          error: {
            code: "PGRST204",
            message:
              "Could not find the 'key_fingerprint_suffix' column of 'provider_keys' in the schema cache",
          },
        };
      }

      if (typeof incoming.key_version === "string" && incoming.key_version === "v1") {
        return {
          data: null,
          error: {
            code: "22P02",
            message:
              'invalid input syntax for type integer: "v1" for column "key_version"',
          },
        };
      }

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
      this.filters.every(
        ({ column, value }) => row[column as keyof ProviderKeyRow] === value,
      ) &&
      this.nullFilters.every((column) => row[column as keyof ProviderKeyRow] === null)
    );
  }
}

class LegacyIntegerKeyVersionProviderKeysClient
  implements SupabaseProviderKeyClient
{
  readonly rows: ProviderKeyRow[] = [];

  from(table: "provider_keys"): ProviderKeysTableQuery<ProviderKeyRow> {
    expect(table).toBe("provider_keys");
    return new LegacyIntegerKeyVersionProviderKeysQuery(this.rows);
  }
}

class Phase73CLocalVault implements ProviderSecretVault {
  readonly calls: string[] = [];

  getVaultReadiness(): ProviderSecretVaultReadiness {
    return { kind: "vault_ready" };
  }

  async encryptProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    return this.storeResult("encrypted");
  }

  async decryptProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    return {
      kind: "vault_decrypt_failed",
      message: "Provider key could not be decrypted safely.",
      status: "decrypt_failed",
    };
  }

  async storeProviderKey(input: {
    plaintextKey: string;
    providerId: BackendSupportedProviderId;
  }): Promise<ProviderSecretVaultOperationResult> {
    this.calls.push(`store:${input.providerId}:${input.plaintextKey}`);
    return this.storeResult("stored");
  }

  async rotateProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    return this.storeResult("replaced");
  }

  async revokeProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    return {
      kind: "vault_provider_key_revoked",
      status: "revoked",
    };
  }

  private storeResult(
    status: "encrypted" | "stored" | "replaced",
  ): ProviderSecretVaultOperationResult {
    return {
      keyFingerprintSuffix: "73c",
      kind:
        status === "encrypted"
          ? "vault_provider_key_encrypted"
          : status === "stored"
            ? "vault_provider_key_stored"
            : "vault_provider_key_rotated",
      maskedFingerprint: "provider-key:73c",
      secretHandle: {
        algorithm: "aes-256-gcm",
        encryptedPayload: fakeEncryptedPayload,
        keyVersion: "v1",
        kind: "encrypted_secret",
      },
      status,
    };
  }
}

const routeAccessResolver: AsyncBackendRequesterContextResolver = {
  resolve: async () => ({
    appUserId: "00000000-0000-0000-0000-000000000073",
    authProvider: "supabase",
    authSubject: "phase73c-auth-subject",
    kind: "authenticated",
    supabaseUserId: "00000000-0000-0000-0000-000000000074",
    userId: "00000000-0000-0000-0000-000000000073",
    workspaceAuthority: "verified",
    workspaceId: "00000000-0000-0000-0000-000000000075",
    workspaceRole: "workspace_owner",
  }),
};

const workspaceMembershipRepository: WorkspaceMembershipRepository = {
  getMembership: async ({ userId, workspaceId }) => ({
    kind: "member",
    membership: {
      role: "owner",
      source: "workspace_memberships",
      status: "active",
      userId,
      workspaceId,
    },
  }),
};

const startProviderSettingsApp = async (
  client: LegacyIntegerKeyVersionProviderKeysClient,
): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());
  app.use(
    createProviderSettingsRouter({
      providerKeyRepository: new SupabaseProviderKeyRepository(client),
      providerKeysRuntimeEnabled: true,
      providerSecretVault: new Phase73CLocalVault(),
      routeAccessResolver,
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository,
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
};

const postProviderKey = async (
  baseUrl: string,
): Promise<{ status: number; text: string }> => {
  const response = await fetch(`${baseUrl}/provider-settings/connections`, {
    body: JSON.stringify({
      apiKey: fakeRawProviderKey,
      encryptedPayload: fakeEncryptedPayload,
      providerCredential: fakeProviderCredential,
      providerId: "openai",
      secretRef: fakeSecretRef,
    }),
    headers: {
      authorization: "Bearer phase73c-placeholder-token",
      "content-type": "application/json",
    },
    method: "POST",
  });

  return { status: response.status, text: await response.text() };
};

test.describe("phase73-C BYOK provider key local runtime crash", () => {
  test("create route stores through repository when local schema still has integer key_version", async () => {
    const client = new LegacyIntegerKeyVersionProviderKeysClient();
    const { baseUrl, server } = await startProviderSettingsApp(client);

    try {
      const result = await postProviderKey(baseUrl);

      expect(result.status).toBe(201);
      expect(result.text).toContain("provider_settings_connection_stored");
      expect(client.rows).toHaveLength(1);
      expect(client.rows[0].provider_name).toBe("openai");
      expect(client.rows[0].status).toBe("active");
      expect(client.rows[0].key_version).toBe(1);
      expect("key_fingerprint_suffix" in client.rows[0]).toBe(false);
      expect("masked_fingerprint" in client.rows[0]).toBe(false);
      expectNoSecretLeak(result.text);

      const duplicate = await postProviderKey(baseUrl);

      expect(duplicate.status).toBe(409);
      expect(duplicate.text).toContain("provider_settings_mutation_conflict");
      expect(duplicate.text).toContain(
        "An active provider key already exists for this workspace/provider.",
      );
      expect(client.rows).toHaveLength(1);
      expectNoSecretLeak(duplicate.text);
    } finally {
      await stopServer(server);
    }
  });
});
