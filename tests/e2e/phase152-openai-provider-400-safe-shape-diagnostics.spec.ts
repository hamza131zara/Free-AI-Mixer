import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createOpenAiImageGenerationAdapter } from "../../backend/generation/openAiImageGenerationAdapter";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE152_OPENAI_KEY_DO_NOT_RETURN";
const encryptedPayload = "PHASE152_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "PHASE152_SECRET_REF_DO_NOT_RETURN";
const promptText = "A phase 152 prompt that must stay out of responses";
const providerEndpoint = "https://api.openai.com/v1/images/generations";
const rawProviderMessage = "PHASE152_RAW_PROVIDER_MESSAGE_DO_NOT_RETURN";
const rawProviderBody = "PHASE152_RAW_PROVIDER_BODY_DO_NOT_RETURN";
const providerRequestId = "req_phase152_do_not_return";
const orgMetadata = "org_phase152_do_not_return";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const createActiveValidatedKey = (): BackendProviderKeyRecord => ({
  providerKeyId: "phase152-provider-key",
  providerName: "openai",
  workspaceId: "phase152-workspace",
  ownerId: "phase152-owner",
  createdByUserId: "phase152-owner",
  encryptedSecret: {
    algorithm: "AES-256-GCM",
    encryptedPayload,
    keyVersion: "v1",
  },
  secretRef,
  status: "active",
  verificationStatus: "validated",
  needsReverification: false,
});

const createProviderKeyRepository = (): BackendProviderKeyRepository => ({
  getByProviderKeyId: async () => createActiveValidatedKey(),
  getActiveValidatedProviderKeyForWorkspaceProvider: async () =>
    createActiveValidatedKey(),
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in Phase 152.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in Phase 152.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in Phase 152.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in Phase 152.");
  },
});

const createReadyVault = (): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in Phase 152.");
  },
  decryptProviderKey: async () => ({
    kind: "vault_provider_key_decrypted",
    plaintextKey: rawProviderKey,
    status: "decrypted",
  }),
  storeProviderKey: async () => {
    throw new Error("Vault store must not run in Phase 152.");
  },
  revokeProviderKey: async () => {
    throw new Error("Vault revoke must not run in Phase 152.");
  },
  rotateProviderKey: async () => {
    throw new Error("Vault rotate must not run in Phase 152.");
  },
});

const createProvider400Fetch = ({
  body,
  rawBody,
}: {
  body?: unknown;
  rawBody?: string;
}): typeof fetch =>
  (async (input, init) => {
    expect(String(input)).toBe(providerEndpoint);
    expect(init?.method).toBe("POST");
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawProviderKey}`);
    expect(JSON.stringify(init?.body)).toContain(promptText);
    expect(JSON.stringify(init?.body)).not.toContain(rawProviderKey);

    return new Response(rawBody ?? JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": providerRequestId,
      },
      status: 400,
    });
  }) as typeof fetch;

const generateWithProvider400 = async (
  providerBody: { body?: unknown; rawBody?: string },
) =>
  createOpenAiImageGenerationAdapter({
    fetchImpl: createProvider400Fetch(providerBody),
    providerKeyRepository: createProviderKeyRepository(),
    providerSecretVault: createReadyVault(),
    requestShape: "minimal",
    timeoutMs: 10,
  }).generateImageFromStoredProviderKey?.({
    generationKind: "image",
    prompt: promptText,
    providerId: "openai",
    providerKeyId: "phase152-provider-key",
    requestId: "phase152_request",
    workspaceId: "phase152-workspace",
  });

const providerErrorBody = (error: Record<string, unknown>) => ({
  error,
  organization: orgMetadata,
  rawProviderBody,
});

const expectNoLeak = (serialized: string): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    promptText,
    providerEndpoint,
    rawProviderMessage,
    rawProviderBody,
    providerRequestId,
    orgMetadata,
    "organization must be verified",
    "you do not have access to model gpt-image-2",
    "unknown parameter",
    "opaque provider condition",
    "Authorization",
    "Bearer ",
    "workspaceId",
    "ownerId",
    "providerKeyId",
    "encrypted_payload",
    "secret_ref",
    "service_role",
    "JWT",
    "request_id",
    "organization",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "internalRef",
    "filePath",
    "rootPath",
    "directoryPath",
    "\"b64_json\":",
    "\"base64\":",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase152 OpenAI provider 400 safe shape diagnostics", () => {
  test("400 body shape and unclassified token diagnostics are enum-only", async () => {
    const cases = [
      {
        body: { rawProviderBody },
        expectedDiagnosticCode: "provider_400_error_shape_missing",
      },
      {
        body: { error: {}, rawProviderBody },
        expectedDiagnosticCode: "provider_400_error_tokens_missing",
      },
      {
        body: providerErrorBody({ message: "opaque provider condition" }),
        expectedDiagnosticCode: "provider_400_error_tokens_unclassified",
      },
      {
        body: providerErrorBody({ param: "phase152_unknown_param" }),
        expectedDiagnosticCode: "provider_400_error_param_unclassified",
      },
      {
        rawBody: "{not-json",
        expectedDiagnosticCode: "provider_400_body_unparseable",
      },
    ];

    for (const entry of cases) {
      const result = await generateWithProvider400(entry);

      expect(result).toMatchObject({
        diagnosticCode: entry.expectedDiagnosticCode,
        failureCategory: "provider_status",
        kind: "generation_failed",
      });
      expectNoLeak(JSON.stringify(result));
    }
  });

  test("known 400 provider messages and params classify to actionable safe enums", async () => {
    const cases = [
      {
        body: providerErrorBody({ message: "organization must be verified" }),
        expectedDiagnosticCode: "provider_org_verification_required",
        expectedKind: "generation_failed",
      },
      {
        body: providerErrorBody({
          message: "you do not have access to model gpt-image-2",
        }),
        expectedDiagnosticCode: "provider_model_unsupported",
        expectedKind: "generation_failed",
      },
      {
        body: providerErrorBody({ param: "model" }),
        expectedDiagnosticCode: "provider_model_unsupported",
        expectedKind: "generation_failed",
      },
      {
        body: providerErrorBody({ type: "invalid_request_error" }),
        expectedDiagnosticCode: "provider_request_shape_invalid",
        expectedKind: "generation_failed",
      },
      {
        body: providerErrorBody({ message: "moderation blocked this request" }),
        expectedDiagnosticCode: "provider_moderation_blocked",
        expectedKind: "invalid_prompt",
      },
      {
        body: providerErrorBody({ message: "prompt rejected" }),
        expectedDiagnosticCode: "provider_invalid_prompt",
        expectedKind: "invalid_prompt",
      },
    ];

    for (const entry of cases) {
      const result = await generateWithProvider400({ body: entry.body });

      expect(result).toMatchObject({
        diagnosticCode: entry.expectedDiagnosticCode,
        failureCategory: "provider_status",
        kind: entry.expectedKind,
      });
      expectNoLeak(JSON.stringify(result));
    }
  });

  test("runbook and source document shape diagnostics without enabling frontend delivery", () => {
    const adapterSource = readSource(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    const runbookSource = readSource(
      "docs/real-openai-generation-diagnostic-capture-runbook.md",
    );
    const packageJson = readSource("package.json");
    const frontendSource = [
      readSource("src/services/sceneGenerationService.ts"),
      readSource("src/store/sceneStore.ts"),
      readSource("src/agents/sceneGenerationAgent.ts"),
      readSource("src/pages/MixerPage.tsx"),
    ].join("\n");
    const exportRouteSource = readSource("backend/routes/exports.ts");

    expect(adapterSource).toContain("provider_400_body_unparseable");
    expect(adapterSource).toContain("provider_400_error_shape_missing");
    expect(adapterSource).toContain("provider_400_error_tokens_missing");
    expect(adapterSource).toContain("provider_400_error_tokens_unclassified");
    expect(adapterSource).toContain("provider_400_error_param_unclassified");
    expect(runbookSource).toContain("provider_400_error_tokens_unclassified");
    expect(runbookSource).toContain("never print raw provider body/message");

    for (const forbidden of [
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "publicUrl",
      "signedUrl",
      "downloadUrl",
    ]) {
      expect(adapterSource).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }

    expect(frontendSource).not.toContain("/generation/jobs");
    expect(exportRouteSource).toContain("route_execution_disabled");
  });
});
