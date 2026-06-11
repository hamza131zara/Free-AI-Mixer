import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const readProjectFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const forbiddenLeakTokens = [
  "encrypted_payload",
  "secret_ref",
  "service_role",
  "api_key",
  "provider response body",
  "provider headers",
  "request id header",
  "raw prompt",
  "publicUrl",
  "signedUrl",
  "downloadUrl",
  "localPath",
  "internalRef",
  "storageRef",
];

const forbiddenPublicResponseTokens = [
  "localPath",
  "internalRef",
  "storageRef",
  "publicUrl",
  "signedUrl",
  "downloadUrl",
  "base64",
  "bytes",
];

test.describe("Launch Block 4 real provider generation boundary", () => {
  test("defines BYOK, platform-paid, mock, and unsupported-provider policy decisions", () => {
    const policy = readProjectFile("backend/generation/providerExecutionPolicy.ts");

    expect(policy).toContain("byok_real_provider");
    expect(policy).toContain("platform_paid_provider");
    expect(policy).toContain("mock_local");
    expect(policy).toContain("unsupported_provider");
    expect(policy).toContain("provider_policy_blocked");
    expect(policy).toContain("platform_credits_not_configured");
    expect(policy).toContain("provider_capability_unavailable");
    expect(policy).toContain("provider_billing_or_quota_required");
    expect(policy).toContain("input.providerId !== \"openai\"");
  });

  test("generation request contract supports explicit platform-paid mode without changing BYOK default", () => {
    const orchestrator = readProjectFile(
      "backend/generation/generationRuntimeOrchestrator.ts",
    );

    expect(orchestrator).toContain("executionBillingMode");
    expect(orchestrator).toContain("\"byok\" | \"platform_paid\"");
    expect(orchestrator).toContain("Platform-paid video generation is not supported");
    expect(orchestrator).toContain("Generation billing mode is not supported");
  });

  test("route blocks platform-paid mode before provider fetch and keeps OpenAI fetch gated", () => {
    const route = readProjectFile("backend/routes/generation.ts");
    const app = readProjectFile("backend/app.ts");

    expect(route).toContain("evaluateProviderExecutionPolicy");
    expect(route).toContain("creditService?.getReadiness");
    expect(route).toContain("platform_paid_provider_not_configured");
    expect(route).toContain("openAiRealProviderFetch");
    const platformPaidReadinessIndex = route.indexOf("const platformPaidReadiness");
    const policyDecisionIndex = route.indexOf(
      "const providerExecutionPolicyDecision",
    );
    const activeKeyLookupIndex = route.indexOf("const activeKey");
    const realProviderBranchIndex = route.indexOf(
      "if (routeExecutionMode === \"real_provider_local_only\")",
    );
    const realProviderAdapterIndex = route.indexOf(
      "const adapter = createOpenAiImageGenerationAdapter",
      realProviderBranchIndex,
    );

    expect(platformPaidReadinessIndex).toBeGreaterThan(-1);
    expect(policyDecisionIndex).toBeGreaterThan(platformPaidReadinessIndex);
    expect(activeKeyLookupIndex).toBeGreaterThan(policyDecisionIndex);
    expect(realProviderAdapterIndex).toBeGreaterThan(activeKeyLookupIndex);
    expect(app).toContain("creditService: backendDeps.creditService");
  });

  test("failure contracts expose only safe enum statuses and diagnostics", () => {
    const contracts = readProjectFile(
      "backend/contracts/generationRuntimeHttpTypes.ts",
    );
    const failureMapping = readProjectFile(
      "backend/generation/generationFailureMapping.ts",
    );
    const adapterContracts = readProjectFile(
      "backend/generation/generationProviderAdapter.ts",
    );

    for (const status of [
      "platform_credits_not_configured",
      "platform_paid_provider_not_configured",
      "provider_execution_policy_blocked",
      "provider_capability_unavailable",
      "provider_billing_or_quota_required",
    ]) {
      expect(contracts).toContain(status);
      expect(failureMapping).toContain(status);
      expect(adapterContracts).toContain(status);
    }

    expect(adapterContracts).toContain("provider_policy");
  });

  test("does not add Google/Gemini/Imagen/Veo executable adapters or real provider calls in tests", () => {
    const files = [
      readProjectFile("backend/generation/providerExecutionPolicy.ts"),
      readProjectFile("backend/routes/generation.ts"),
    ].join("\n");

    expect(files).not.toContain("googleImageGenerationAdapter");
    expect(files).not.toContain("geminiImageGenerationAdapter");
    expect(files).not.toContain("imagenGenerationAdapter");
    expect(files).not.toContain("veoGenerationAdapter");
    expect(files).not.toContain("generativelanguage.googleapis.com");
    expect(files).not.toContain("imagen.googleapis.com");
    expect(files).not.toContain("veo.googleapis.com");

    expect(files).not.toContain("provider response body");
    expect(files).not.toContain("provider headers");
    expect(files).not.toContain("request id header");
    expect(files).not.toContain("raw prompt");

    const openAiAdapter = readProjectFile(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    expect(openAiAdapter).toContain("fetchImpl");
    expect(openAiAdapter).not.toContain("generativelanguage.googleapis.com");
    expect(openAiAdapter).not.toContain("googleImageGenerationAdapter");

    const publicContract = readProjectFile(
      "backend/contracts/generationRuntimeHttpTypes.ts",
    );
    for (const token of forbiddenPublicResponseTokens) {
      expect(publicContract).not.toContain(token);
    }
    for (const token of forbiddenLeakTokens.slice(0, 8)) {
      expect(publicContract).not.toContain(token);
    }
  });

  test("documents Block 4 as OpenAI-only, BYOK-owned, and no-real-provider in automation", () => {
    const docs = [
      readProjectFile("docs/architecture.md"),
      readProjectFile("docs/roadmap.md"),
      readProjectFile("docs/known-issues.md"),
      readProjectFile("docs/phases.md"),
    ].join("\n");

    expect(docs).toContain("Launch Block 4");
    expect(docs).toContain("OpenAI is the only executable real-provider adapter");
    expect(docs).toContain("BYOK uses user-owned provider key");
    expect(docs).toContain("platform_credits_not_configured");
    expect(docs).toContain("Google/Gemini/Imagen/Veo remain unavailable");
    expect(docs).toContain("Codex/test automation must not use real keys or call providers");
  });
});
