import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import {
  parseByokProviderValidationAdapterSelection,
  parseByokProviderValidationRuntimeGate,
} from "../../backend/providers/providerSecretVaultConfig";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const withEnv = <Result>(
  values: Record<string, string | undefined>,
  callback: () => Result,
): Result => {
  const previousValues = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previousValues.set(key, process.env[key]);
    const value = values[key];

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }

      process.env[key] = value;
    }
  }
};

const validationEnv = {
  FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER: undefined,
  FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: undefined,
};

test.describe("phase87 BYOK mock validation adapter composition", () => {
  test("default composition uses fail-closed not-configured validation adapter", () => {
    withEnv(validationEnv, () => {
      const dependencies = createBackendDependencies();

      expect(dependencies.byokProviderValidationRuntimeGate).toEqual({
        kind: "byok_provider_validation_runtime_gate",
        enabled: false,
      });
      expect(dependencies.byokProviderValidationAdapterSelection).toEqual({
        kind: "byok_provider_validation_adapter_selection",
        adapter: "not_configured",
      });
      expect(dependencies.providerValidationAdapter.getReadiness()).toEqual({
        kind: "validation_unavailable",
        status: "not_configured",
        message: "Provider validation is not configured yet. No provider API call was made.",
      });
    });
  });

  test("runtime gate alone does not select mock adapter", () => {
    withEnv(
      {
        ...validationEnv,
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: "1",
      },
      () => {
        const dependencies = createBackendDependencies();

        expect(dependencies.byokProviderValidationRuntimeGate.enabled).toBe(true);
        expect(dependencies.byokProviderValidationAdapterSelection.adapter).toBe(
          "not_configured",
        );
        expect(dependencies.providerValidationAdapter.getReadiness().kind).toBe(
          "validation_unavailable",
        );
      },
    );
  });

  test("mock adapter is selected only with explicit adapter env plus runtime gate", async () => {
    const parserDecision = parseByokProviderValidationAdapterSelection({
      FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER: "mock_local",
    });

    expect(parserDecision).toEqual({
      kind: "byok_provider_validation_adapter_selection",
      adapter: "mock_local",
    });

    expect(
      parseByokProviderValidationRuntimeGate({
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: "1",
      }),
    ).toEqual({
      kind: "byok_provider_validation_runtime_gate",
      enabled: true,
    });

    await withEnv(
      {
        ...validationEnv,
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER: "mock_local",
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: "1",
      },
      async () => {
        const dependencies = createBackendDependencies();
        const readiness = dependencies.providerValidationAdapter.getReadiness();
        const result =
          await dependencies.providerValidationAdapter.validateStoredProviderKey({
            providerId: "openai",
            providerKeyId: "phase87-provider-key",
            requesterUserId: "phase87-user",
            workspaceId: "phase87-workspace",
          });

        expect(dependencies.byokProviderValidationRuntimeGate.enabled).toBe(true);
        expect(dependencies.byokProviderValidationAdapterSelection.adapter).toBe(
          "mock_local",
        );
        expect(readiness).toEqual({ kind: "validation_ready" });
        expect(result.kind).toBe("validated");
        expect(result.message).toBe(
          "Provider key validation completed by local mock adapter.",
        );
      },
    );
  });

  test("source boundaries keep mock validation local-only and frontend unchanged", () => {
    const dependencySource = readSource("backend/composition/backendDependencies.ts");
    const configSource = readSource("backend/providers/providerSecretVaultConfig.ts");
    const mockAdapterSource = readSource("backend/providers/mockProviderValidationAdapter.ts");
    const appSource = readSource("backend/app.ts");
    const packageJson = readSource("package.json");
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsService = readSource("src/services/providerSettingsService.ts");
    const providerSettingsStore = readSource("src/store/providerSettingsStore.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const generationService = readSource("src/services/sceneGenerationService.ts");
    const backendValidationBoundary = [
      dependencySource,
      configSource,
      mockAdapterSource,
      appSource,
    ].join("\n");

    expect(configSource).toContain(
      "FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER",
    );
    expect(configSource).toContain("mock_local");
    expect(dependencySource).toContain("createMockProviderValidationAdapter");
    expect(dependencySource).toContain("createNotConfiguredProviderValidationAdapter");
    expect(dependencySource).toContain("byokProviderValidationRuntimeGate.enabled");
    expect(mockAdapterSource).toContain("createMockProviderValidationAdapter");
    expect(providerSettingsPage).toContain("Validate stored key");
    expect(providerSettingsService).toContain("/test");
    expect(providerSettingsStore).toContain("testProviderConnection");

    for (const forbidden of [
      "api.openai.com",
      "replicate.com",
      "runwayml",
      "api.runway",
      "lumalabs.ai",
      "api.luma",
      "generativelanguage.googleapis.com",
      "@openai/",
      "@replicate/",
      "@runway",
      "@luma",
      'fetch("https://',
      "fetch(`https://",
      "connected_success",
      "verified_success",
      "test_passed",
      "fake_success",
    ]) {
      expect(backendValidationBoundary).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }

    expect(`${creditsPage}\n${billingService}`).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(generationService).not.toContain("/provider-settings/connections");
  });
});
