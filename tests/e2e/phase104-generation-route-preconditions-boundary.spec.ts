import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import type { BackendProviderKeyRecord } from "../../backend/repositories/repositoryContracts";
import {
  evaluateGenerationControlPreconditions,
  evaluateGenerationGatePreconditions,
  evaluateGenerationRequesterPreconditions,
  evaluateGenerationRolePreconditions,
  getGenerationExecutionControlReadiness,
  isActiveValidatedProviderKeyForGeneration,
  parseGenerationJobRequest,
  selectActiveValidatedProviderKeyForGeneration,
  validateGenerationPrompt,
} from "../../backend/generation/generationRuntimeOrchestrator";
import { parseGenerationRuntimeConfig } from "../../backend/generation/generationRuntimeConfig";
import { getGenerationFailureMapping } from "../../backend/generation/generationFailureMapping";
import { sanitizeSafeEventMetadata } from "../../backend/observability/safeEventSanitizer";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const rawKey = "FAKE_PHASE104_RAW_KEY_DO_NOT_RETURN";
const encryptedPayload = "FAKE_PHASE104_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE104_SECRET_REF_DO_NOT_RETURN";
const providerUrl = "https://example.invalid/phase104-provider-image.png";
const base64Image = Buffer.from("phase104-image").toString("base64");
const internalRef = "phase104-internal-ref";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase104-subject",
  kind: "authenticated",
  userId: "phase104-user",
  workspaceId: "phase104-workspace",
};

const startGenerationApp = async (): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: BackendRequesterContext }).backendRequesterContext =
      authenticatedRequester;
    next();
  });
  app.use(
    createGenerationRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "phase104-session",
      },
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
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

const createProviderKeyRecord = (
  patch: Partial<BackendProviderKeyRecord> = {},
): BackendProviderKeyRecord => ({
  providerKeyId: "phase104-provider-key",
  providerName: "openai",
  workspaceId: "phase104-workspace",
  ownerId: "phase104-owner",
  createdByUserId: "phase104-owner",
  encryptedSecret: {
    algorithm: "AES-256-GCM",
    encryptedPayload,
    keyVersion: "v1",
  },
  status: "active",
  verificationStatus: "validated",
  needsReverification: false,
  ...patch,
});

const expectNoLeak = (serialized: string): void => {
  for (const forbidden of [
    rawKey,
    encryptedPayload,
    secretRef,
    providerUrl,
    base64Image,
    internalRef,
    "encrypted_payload",
    "secret_ref",
    "b64_json",
    "filePath",
    "rootPath",
    "internalRef",
    "signedUrl",
    "publicUrl",
    "downloadUrl",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase104 generation route preconditions boundary", () => {
  test("generation jobs route remains disabled and does not echo unsafe request fields", async () => {
    const { baseUrl, server } = await startGenerationApp();

    try {
      const response = await fetch(`${baseUrl}/generation/jobs`, {
        body: JSON.stringify({
          providerId: "openai",
          generationKind: "image",
          prompt: "A safe prompt",
          requestId: "phase104_request",
          rawApiKey: rawKey,
          workspaceId: "frontend-workspace",
          providerKeyId: "frontend-provider-key",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = await response.json();
      const serialized = JSON.stringify(body);

      expect(response.status).toBe(503);
      expect(body.status).toBe("generation_runtime_disabled");
      expect(body.attemptedProviderIds).toEqual([]);
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expectNoLeak(serialized);
      expect(serialized).not.toContain("frontend-workspace");
      expect(serialized).not.toContain("frontend-provider-key");
    } finally {
      await stopServer(server);
    }
  });

  test("image-only request contract accepts only approved fields and rejects browser-owned key/workspace fields", () => {
    const valid = parseGenerationJobRequest({
      providerId: "openai",
      generationKind: "image",
      prompt: "  a small image prompt  ",
      requestId: "phase104_request",
    });
    const rejected = parseGenerationJobRequest({
      providerId: "openai",
      generationKind: "image",
      prompt: "A prompt",
      requestId: "phase104_request",
      apiKey: rawKey,
      workspaceId: "frontend-workspace",
      providerKeyId: "frontend-provider-key",
      model: "unapproved-model",
      n: 2,
      stream: true,
      deliveryOptions: { publicUrl: true },
    });

    expect(valid).toMatchObject({
      kind: "valid",
      request: {
        providerId: "openai",
        generationKind: "image",
        prompt: "a small image prompt",
        requestId: "phase104_request",
      },
    });
    expect(rejected).toMatchObject({
      kind: "invalid",
      code: "unsupported_field",
    });
    expect(rejected.kind === "invalid" ? rejected.rejectedFields : []).toEqual(
      expect.arrayContaining([
        "apiKey",
        "workspaceId",
        "providerKeyId",
        "model",
        "n",
        "stream",
        "deliveryOptions",
      ]),
    );
  });

  test("auth workspace owner-admin gates and execution controls are modeled fail-closed", () => {
    expect(evaluateGenerationGatePreconditions(parseGenerationRuntimeConfig({}))).toMatchObject({
      kind: "blocked",
      code: "generation_runtime_disabled",
    });
    expect(
      evaluateGenerationGatePreconditions(
        parseGenerationRuntimeConfig({
          FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED: "1",
          FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
        }),
      ),
    ).toMatchObject({ kind: "blocked", code: "vendor_calls_disabled" });
    expect(
      evaluateGenerationRequesterPreconditions(undefined),
    ).toMatchObject({ kind: "blocked", code: "sign_in_required" });
    expect(
      evaluateGenerationRequesterPreconditions({
        authProvider: "session",
        authSubject: "phase104-subject",
        kind: "authenticated",
        userId: "phase104-user",
      }),
    ).toMatchObject({
      kind: "blocked",
      code: "workspace_permission_not_verified",
    });
    expect(evaluateGenerationRolePreconditions("owner")).toEqual({ kind: "ready" });
    expect(evaluateGenerationRolePreconditions("admin")).toEqual({ kind: "ready" });
    expect(evaluateGenerationRolePreconditions("editor")).toMatchObject({
      kind: "blocked",
      code: "workspace_owner_or_admin_required",
    });
    expect(evaluateGenerationRolePreconditions("viewer")).toMatchObject({
      kind: "blocked",
      code: "workspace_owner_or_admin_required",
    });
    expect(
      evaluateGenerationControlPreconditions(
        getGenerationExecutionControlReadiness(),
      ),
    ).toMatchObject({
      kind: "blocked",
      code: "rate_limit_not_configured",
    });
  });

  test("active validated BYOK key lookup is server-side only and blocks unsafe key states", () => {
    const eligible = createProviderKeyRecord();
    const blockedRecords: BackendProviderKeyRecord[] = [
      createProviderKeyRecord({ verificationStatus: "not_validated" }),
      createProviderKeyRecord({ verificationStatus: "validation_failed" }),
      createProviderKeyRecord({ needsReverification: true }),
      createProviderKeyRecord({ status: "disabled" }),
      createProviderKeyRecord({ status: "rotated" }),
      createProviderKeyRecord({ revokedAt: "2026-06-03T00:00:00.000Z" }),
      createProviderKeyRecord({ disabledAt: "2026-06-03T00:00:00.000Z" }),
      createProviderKeyRecord({ rotatedAt: "2026-06-03T00:00:00.000Z" }),
      createProviderKeyRecord({ deletedAt: "2026-06-03T00:00:00.000Z" }),
    ];

    expect(isActiveValidatedProviderKeyForGeneration(eligible)).toBe(true);
    for (const record of blockedRecords) {
      expect(isActiveValidatedProviderKeyForGeneration(record)).toBe(false);
    }
    expect(selectActiveValidatedProviderKeyForGeneration(blockedRecords)).toBeUndefined();
    expect(
      selectActiveValidatedProviderKeyForGeneration([...blockedRecords, eligible]),
    ).toBe(eligible);

    const repositoryContract = readSource("backend/repositories/repositoryContracts.ts");
    const supabaseRepository = readSource(
      "backend/repositories/supabaseProviderKeyRepository.ts",
    );
    expect(repositoryContract).toContain(
      "getActiveValidatedProviderKeyForWorkspaceProvider",
    );
    expect(supabaseRepository).toContain(".eq(\"verification_status\", \"validated\")");
    expect(supabaseRepository).toContain(".eq(\"needs_reverification\", false)");
    expect(supabaseRepository).toContain(".is(\"revoked_at\", null)");
    expect(supabaseRepository).toContain(".is(\"deleted_at\", null)");
  });

  test("prompt validation trims invalid input and sanitizer redacts prompt and sensitive fields", () => {
    expect(validateGenerationPrompt("  a prompt  ")).toEqual({
      kind: "valid_prompt",
      prompt: "a prompt",
    });
    expect(validateGenerationPrompt("   ")).toMatchObject({
      kind: "invalid_prompt",
    });
    expect(validateGenerationPrompt("x".repeat(4_001))).toMatchObject({
      kind: "invalid_prompt",
    });

    const sanitized = sanitizeSafeEventMetadata({
      prompt: "A private prompt",
      rawPrompt: "A raw private prompt",
      providerKeyId: "phase104-provider-key",
      rawApiKey: rawKey,
      nested: {
        encrypted_payload: encryptedPayload,
        secret_ref: secretRef,
      },
    });

    expect(sanitized.rejected).toBe(true);
    expect(JSON.stringify(sanitized.sanitizedMetadata)).not.toContain(rawKey);
    expect(JSON.stringify(sanitized.sanitizedMetadata)).not.toContain(
      "A private prompt",
    );
    expect(sanitized.redactedFields).toEqual(
      expect.arrayContaining([
        "prompt",
        "rawPrompt",
        "providerKeyId",
        "rawApiKey",
        "nested.encrypted_payload",
        "nested.secret_ref",
      ]),
    );
  });

  test("safe lifecycle response and failure mappings are modeled without exposing delivery or storage internals", () => {
    const contractSource = readSource("backend/contracts/generationRuntimeHttpTypes.ts");
    const orchestratorSource = readSource(
      "backend/generation/generationRuntimeOrchestrator.ts",
    );

    for (const state of [
      "rejected",
      "submitted",
      "running",
      "generated_metadata_ready",
      "artifact_storage_failed",
      "delivery_unavailable",
      "failed",
    ]) {
      expect(contractSource).toContain(state);
      expect(orchestratorSource).toContain(state);
    }

    for (const code of [
      "sign_in_required",
      "workspace_permission_not_verified",
      "workspace_owner_or_admin_required",
      "generation_runtime_disabled",
      "vendor_calls_disabled",
      "provider_key_not_configured",
      "invalid_prompt",
      "vault_decrypt_failed",
      "artifact_storage_unavailable",
      "invalid_credentials",
      "rate_limited",
      "timeout",
      "provider_unavailable",
      "rate_limit_not_configured",
      "idempotency_not_configured",
      "single_flight_not_configured",
      "cost_controls_not_configured",
    ]) {
      const mapping = getGenerationFailureMapping(code as never);
      expect(mapping.message).not.toMatch(/raw|provider body|request id|header/i);
    }

    const metadataOnly = {
      artifactId: "phase104-artifact",
      providerId: "openai",
      contentType: "image/png",
      sizeBytes: 12,
      sha256: "a".repeat(64),
      createdAt: "2026-06-03T00:00:00.000Z",
      deliveryStatus: "unavailable",
    };

    expectNoLeak(JSON.stringify(metadataOnly));
    expect(metadataOnly).not.toHaveProperty("url");
    expect(metadataOnly).not.toHaveProperty("base64");
    expect(metadataOnly).not.toHaveProperty("bytes");
    expect(metadataOnly).not.toHaveProperty("internalRef");
  });

  test("source boundaries keep adapter storage route execution frontend credits billing export and fake artifacts untouched", () => {
    const routeSource = readSource("backend/routes/generation.ts");
    const orchestratorSource = readSource(
      "backend/generation/generationRuntimeOrchestrator.ts",
    );
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const packageJson = readSource("package.json");
    const frontendSource = [sceneService, sceneStore, sceneAgent].join("\n");
    const unrelatedSource = [creditsPage, billingService, exportRoute].join("\n");

    expect(routeSource).not.toContain("generateImageFromStoredProviderKey");
    expect(routeSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(routeSource).not.toContain("GeneratedImageArtifactStorage");
    expect(sceneService).not.toContain("/generation/jobs");
    expect(exportRoute).toContain("route_execution_disabled");

    for (const forbidden of [
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "recordLedger",
      "mutateLedger",
      "checkoutEnabled",
      "publicUrl",
      "signedUrl",
      "downloadUrl",
      "internalRef",
      "filePath",
      "rootPath",
    ]) {
      expect(packageJson).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      if (
        forbidden !== "publicUrl" &&
        forbidden !== "signedUrl" &&
        forbidden !== "downloadUrl" &&
        forbidden !== "internalRef" &&
        forbidden !== "filePath" &&
        forbidden !== "rootPath"
      ) {
        expect(unrelatedSource).not.toContain(forbidden);
      }
      expect(orchestratorSource).not.toContain(forbidden);
    }
  });
});
