import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getProviderCatalog } from "../../backend/providers/providerCatalog";
import {
  chooseGenerationProvider,
} from "../../backend/generation/generationRouting";
import {
  defaultGenerationRoutingPreferences,
} from "../../backend/generation/generationProviderTypes";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 5 generation routing boundary", () => {
  test("provider ids align with the phase 3 provider catalog", () => {
    const providerIds = getProviderCatalog().map((provider) => provider.id);

    expect(providerIds).toEqual([
      "openai",
      "runway",
      "luma",
      "google",
      "stability",
      "replicate",
    ]);
  });

  test("routing decision helper selects only one provider and disables fallback by default", () => {
    const availableProviderIds = getProviderCatalog().map((provider) => provider.id);
    const decision = chooseGenerationProvider({
      availableProviderIds,
      preferences: defaultGenerationRoutingPreferences,
    });

    expect(decision.selectedProviderId).toBe("openai");
    expect(decision.selectsSingleProviderPerAttempt).toBe(true);
    expect(decision.fallbackEnabled).toBe(false);
    expect(decision.orderedFallbackProviderIds).toEqual([]);
  });

  test("fallback policy remains ordered only and does not create multi-provider fanout", () => {
    const availableProviderIds = getProviderCatalog().map((provider) => provider.id);
    const decision = chooseGenerationProvider({
      availableProviderIds,
      preferences: {
        mode: "manual",
        manualProviderId: "google",
        fallback: {
          enabled: true,
          orderedProviderIds: ["replicate", "openai", "google"],
          requiresExplicitOptIn: true,
        },
      },
    });

    expect(decision.selectedProviderId).toBe("google");
    expect(decision.selectsSingleProviderPerAttempt).toBe(true);
    expect(decision.fallbackEnabled).toBe(true);
    expect(decision.orderedFallbackProviderIds).toEqual([
      "replicate",
      "openai",
    ]);
    expect(decision.orderedFallbackProviderIds).not.toContain(
      decision.selectedProviderId,
    );
  });

  test("routing boundary source does not introduce vendor execution or fake telemetry", () => {
    const combinedSource = [
      readSource("backend/generation/generationRouting.ts"),
      readSource("backend/generation/generationProviderTypes.ts"),
      readSource("backend/generation/generationAttemptMetadata.ts"),
      readSource("backend/contracts/generationRuntimeHttpTypes.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain("api.openai.com");
    expect(combinedSource).not.toContain("googleapis.com");
    expect(combinedSource).not.toContain("stability.ai");
    expect(combinedSource).not.toContain("replicate.com");
    expect(combinedSource).not.toContain("progressPercent");
    expect(combinedSource).not.toContain("providerTelemetry");
    expect(combinedSource).not.toContain("fanout");
  });
});
