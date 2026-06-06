import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  evaluateGenerationRealProviderLocalGateReadiness,
  parseGenerationGeneratedImageStorageMode,
  parseGenerationGeneratedImageStorageRoot,
  parseGenerationOpenAiImageRealLocalSmokeEnabled,
  parseGenerationRouteExecutionMode,
  parseGenerationRuntimeConfig,
  type BackendGenerationRealProviderLocalGateReadinessInput,
  type BackendGenerationRuntimeEnv,
} from "../../backend/generation/generationRuntimeConfig";

const secretLikeStorageRoot =
  "C:\\phase140\\storage-root-path-must-not-be-serialized";
const fakeApiKey = "sk-phase140-key-must-not-appear";
const fakeJwt = "phase140.jwt.must.not.appear";
const fakeServiceRole = "phase140-service-role-must-not-appear";
const fakeEncryptedPayload = "PHASE140_ENCRYPTED_PAYLOAD_NOT_RETURNED";
const fakeSecretRef = "PHASE140_SECRET_REF_NOT_RETURNED";

const readyEnv = (): BackendGenerationRuntimeEnv => ({
  FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "1",
  FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_MODE: "local_staging",
  FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_ROOT: secretLikeStorageRoot,
  FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED: "1",
  FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY: "1",
  FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
  FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE: "real_provider_local_only",
  FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED: "1",
});

const readyInput = (
  overrides: Partial<BackendGenerationRuntimeEnv> = {},
  dependencyOverrides: Partial<
    BackendGenerationRealProviderLocalGateReadinessInput["dependencies"]
  > = {},
): BackendGenerationRealProviderLocalGateReadinessInput => {
  const env = {
    ...readyEnv(),
    ...overrides,
  };

  return {
    runtimeConfig: parseGenerationRuntimeConfig(env),
    routeExecutionMode: parseGenerationRouteExecutionMode(env),
    preflightControlsReady:
      env.FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY === "1",
    generatedImageStorageMode: parseGenerationGeneratedImageStorageMode(env),
    generatedImageStorageRoot: parseGenerationGeneratedImageStorageRoot(env),
    openAiImageRealLocalSmokeEnabled:
      parseGenerationOpenAiImageRealLocalSmokeEnabled(env),
    dependencies: {
      openAiRealProviderFetchAvailable: true,
      providerKeyRepositoryAvailable: true,
      providerSecretVaultAvailable: true,
      ...dependencyOverrides,
    },
  };
};

const expectNoLeak = (serialized: string): void => {
  for (const forbidden of [
    secretLikeStorageRoot,
    fakeApiKey,
    fakeJwt,
    fakeServiceRole,
    fakeEncryptedPayload,
    fakeSecretRef,
    "encrypted_payload",
    "secret_ref",
    "service-role",
    "service_role",
    "Authorization",
    "Bearer ",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "internalRef",
    "filePath",
    "rootPath",
    "directoryPath",
    "b64_json",
    "base64",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase140 real provider gate env preflight", () => {
  test("all required envs and dependencies present report safe readiness", () => {
    const readiness =
      evaluateGenerationRealProviderLocalGateReadiness(readyInput());
    const serialized = JSON.stringify(readiness);

    expect(readiness).toMatchObject({
      kind: "generation_real_provider_local_gate_readiness",
      ready: true,
      reason: "ready",
      checks: {
        allowRealProviderCalls: true,
        generatedImageStorageLocalStaging: true,
        generatedImageStorageRootPresent: true,
        openAiImageRealLocalSmokeEnabled: true,
        openAiRealProviderFetchAvailable: true,
        preflightControlsReady: true,
        providerAdapterOpenAiImageMinimal: true,
        providerKeyRepositoryAvailable: true,
        providerSecretVaultAvailable: true,
        routeModeRealProviderLocalOnly: true,
        runtimeEnabled: true,
      },
    });
    expectNoLeak(serialized);
  });

  test("missing env gates return safe enum reasons", () => {
    const cases = [
      {
        env: { FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED: undefined },
        reason: "runtime_disabled",
      },
      {
        env: { FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "not_configured" },
        reason: "provider_adapter_not_openai_image_minimal",
      },
      {
        env: { FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: undefined },
        reason: "real_provider_calls_disabled",
      },
      {
        env: { FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE: "disabled" },
        reason: "route_mode_not_real_provider_local_only",
      },
      {
        env: { FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY: undefined },
        reason: "preflight_controls_not_ready",
      },
      {
        env: {
          FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_MODE:
            "not_configured",
        },
        reason: "generated_image_storage_mode_not_local_staging",
      },
      {
        env: {
          FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_ROOT: undefined,
        },
        reason: "generated_image_storage_root_missing",
      },
      {
        env: {
          FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED:
            undefined,
        },
        reason: "real_provider_smoke_gate_disabled",
      },
    ];

    for (const testCase of cases) {
      const readiness = evaluateGenerationRealProviderLocalGateReadiness(
        readyInput(testCase.env),
      );
      const serialized = JSON.stringify(readiness);

      expect(readiness.ready).toBe(false);
      expect(readiness.reason).toBe(testCase.reason);
      expectNoLeak(serialized);
    }
  });

  test("missing route dependencies return safe enum reasons", () => {
    const cases = [
      {
        dependencies: { openAiRealProviderFetchAvailable: false },
        reason: "openai_real_provider_fetch_missing",
      },
      {
        dependencies: { providerKeyRepositoryAvailable: false },
        reason: "provider_key_repository_missing",
      },
      {
        dependencies: { providerSecretVaultAvailable: false },
        reason: "provider_secret_vault_missing",
      },
    ];

    for (const testCase of cases) {
      const readiness = evaluateGenerationRealProviderLocalGateReadiness(
        readyInput({}, testCase.dependencies),
      );
      const serialized = JSON.stringify(readiness);

      expect(readiness.ready).toBe(false);
      expect(readiness.reason).toBe(testCase.reason);
      expectNoLeak(serialized);
    }
  });

  test("runbook documents same-shell safe preflight without raw values", () => {
    const runbookSource = readFileSync(
      path.join(
        process.cwd(),
        "docs/real-openai-generation-diagnostic-capture-runbook.md",
      ),
      "utf8",
    );

    for (const requiredName of [
      "FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED",
      "FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER",
      "FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS",
      "FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE",
      "FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY",
      "FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_MODE",
      "FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_ROOT",
      "FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED",
    ]) {
      expect(runbookSource).toContain(requiredName);
    }

    expect(runbookSource).toContain("same PowerShell session");
    expect(runbookSource).toContain("<set>");
    expect(runbookSource).toContain("<missing>");
    expect(runbookSource).toContain("Do not proceed");
    expect(runbookSource).toContain("Do not retry automatically");
    expect(runbookSource).not.toContain(secretLikeStorageRoot);
  });
});
