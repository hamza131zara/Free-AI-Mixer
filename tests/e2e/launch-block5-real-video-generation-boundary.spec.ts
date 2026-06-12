import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const readRepoFile = (relativePath: string) =>
  readFile(path.join(repoRoot, relativePath), "utf8");

const forbiddenLeakTokens = [
  "publicUrl",
  "signedUrl",
  "downloadUrl",
  "localPath",
  "storageRef",
  "internalRef",
  "base64",
  "bytes",
] as const;

test.describe("Launch Block 5 real video generation boundary", () => {
  test("video provider adapter contracts exist and future providers fail closed", async () => {
    const source = await readRepoFile(
      "backend/generation/videoGenerationProviderAdapter.ts",
    );

    expect(source).toContain("submitVideoGenerationJob");
    expect(source).toContain("pollVideoGenerationJob");
    expect(source).toContain("cancelVideoGenerationJob");
    expect(source).toContain("getReadiness");
    expect(source).toContain("video_provider_not_configured");
    expect(source).toContain("video_provider_execution_blocked");
    expect(source).toContain("video_provider_polling_unavailable");
    expect(source).toContain("video_provider_cancel_unavailable");
    expect(source).toContain('"veo"');
    expect(source).toContain('"runway"');
    expect(source).toContain('"pika"');
    expect(source).toContain('"gemini_video"');
  });

  test("does not add executable video provider endpoints or fetch URLs", async () => {
    const source = [
      await readRepoFile("backend/generation/videoGenerationProviderAdapter.ts"),
      await readRepoFile("backend/routes/generation.ts"),
    ].join("\n");

    for (const token of [
      "generativelanguage.googleapis.com",
      "aiplatform.googleapis.com",
      "veo.googleapis.com",
      "api.runwayml.com",
      "api.pika.art",
      "fetch(",
      "new Request(",
    ]) {
      expect(source).not.toContain(token);
    }
  });

  test("async lifecycle blocks fake metadata_ready without verified artifact metadata", async () => {
    const lifecycle = await import(
      "../../backend/generation/videoGenerationJobLifecycle"
    );

    expect(
      lifecycle.resolveBackendVideoLifecycleState({
        requestedState: "metadata_ready",
        verifiedArtifactMetadataReady: false,
      }),
    ).toBe("failed");
    expect(
      lifecycle.resolveBackendVideoLifecycleState({
        requestedState: "metadata_ready",
        verifiedArtifactMetadataReady: true,
      }),
    ).toBe("metadata_ready");
    expect(lifecycle.isBackendVideoGenerationTerminalState("failed")).toBe(true);
    expect(lifecycle.isBackendVideoGenerationTerminalState("processing")).toBe(
      false,
    );
  });

  test("video verifier and storage fail closed without paths, refs, bytes, or URLs", async () => {
    const verification = await import(
      "../../backend/generation/generatedVideoArtifactVerification"
    );
    const storage = await import(
      "../../backend/generation/generatedVideoArtifactStorage"
    );

    const verificationResult = verification.verifyGeneratedVideoArtifactBytes({
      bytes: new Uint8Array([0]),
      contentType: "video/mp4",
      maxBytes: 1024,
    });
    expect(verificationResult).toMatchObject({
      code: "video_artifact_verification_unavailable",
      kind: "failed",
    });

    const notConfiguredStorage =
      storage.createNotConfiguredGeneratedVideoArtifactStorage();
    expect(notConfiguredStorage.getReadiness()).toMatchObject({
      kind: "not_configured",
    });

    const storeResult =
      await notConfiguredStorage.storeVerifiedVideoArtifact({
        artifactId: "artifact_123",
        bytes: new Uint8Array([0]),
        contentType: "video/mp4",
        jobId: "job_123",
        providerId: "mock_local",
        sha256: "0".repeat(64),
        sizeBytes: 1,
        workspaceId: "workspace_123",
      });
    const serialized = JSON.stringify(storeResult);

    expect(storeResult).toMatchObject({
      kind: "failed",
      status: "video_artifact_storage_unavailable",
    });
    for (const token of forbiddenLeakTokens) {
      expect(serialized).not.toContain(token);
    }
  });

  test("route keeps real video unavailable while preserving mock video fail-closed path", async () => {
    const route = await readRepoFile("backend/routes/generation.ts");
    const contract = await readRepoFile(
      "backend/generation/generationRuntimeOrchestrator.ts",
    );

    expect(route).toContain('parsed.request.generationKind === "video"');
    expect(route).toContain('routeExecutionMode !== "mock_video_local_only"');
    expect(route).toContain("sendMockLocalVideoStorageUnavailableResult");
    expect(contract).toContain('providerId: "mock_local"');
    expect(contract).toContain(
      "Platform-paid video generation is not supported in this block.",
    );
  });

  test("video provider policy blocks platform-paid before provider execution", async () => {
    const policy = await import(
      "../../backend/generation/videoProviderExecutionPolicy"
    );

    expect(
      policy.evaluateBackendVideoProviderExecutionPolicy({
        billingMode: "platform_paid",
        platformCreditReadiness: { kind: "not_configured" },
        providerAdapterConfigured: true,
        providerId: "veo",
      }),
    ).toMatchObject({
      kind: "video_provider_execution_blocked",
      status: "platform_credits_not_configured",
    });

    expect(
      policy.evaluateBackendVideoProviderExecutionPolicy({
        billingMode: "byok",
        providerAdapterConfigured: false,
        providerId: "veo",
      }),
    ).toMatchObject({
      kind: "video_provider_execution_blocked",
      status: "video_provider_not_configured",
    });
  });

  test("Block 4 image boundary remains present and video boundary stays separate", async () => {
    const imageAdapter = await readRepoFile(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    const videoAdapter = await readRepoFile(
      "backend/generation/videoGenerationProviderAdapter.ts",
    );

    expect(imageAdapter).toContain("generateImageFromStoredProviderKey");
    expect(videoAdapter).not.toContain("generateImageFromStoredProviderKey");
    expect(videoAdapter).not.toContain("openai");
  });
});
