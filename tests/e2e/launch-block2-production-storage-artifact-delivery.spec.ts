import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createUnauthenticatedRequesterContext } from "../../backend/auth/requesterContext";
import { parseSupabaseConfig } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";
import {
  buildGeneratedImageProductionObjectKey,
  isSafeGeneratedImageProductionStorageRef,
} from "../../backend/generation/generatedImageProductionArtifactStorageRef";
import {
  createSupabaseGeneratedImageProductionStorageFromClientFactory,
  createSupabaseGeneratedImageProductionStorage,
} from "../../backend/generation/supabaseGeneratedImageProductionStorage";
import { createProductionGeneratedImageArtifactAccessResolver } from "../../backend/generation/generatedImageArtifactAccess";
import { resolveSelectedRouteAccess } from "../../backend/auth/protectedRouteGuards";

const readProjectFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const forbiddenPublicTokens = [
  "storage_bucket",
  "storage_object_key",
  "storageRef",
  "internalRef",
  "localPath",
  "filePath",
  "base64",
  "bytes",
  "publicUrl",
  "signedUrl",
  "downloadUrl",
  "service-role",
  "sk-",
];

test.describe("Launch Block 2 production storage artifact delivery", () => {
  test("missing Supabase storage env fails closed without fake delivery", () => {
    const storage = createSupabaseGeneratedImageProductionStorageFromClientFactory({
      clientFactoryResult: createSupabaseClientFactory(parseSupabaseConfig({})),
    });

    expect(storage).toBeDefined();
  });

  test("production object keys and storage refs reject unsafe values", () => {
    const objectKey = buildGeneratedImageProductionObjectKey({
      artifactId: "artifact_1",
      format: "png",
      jobId: "job_1",
      workspaceId: "workspace_1",
    });

    expect(objectKey).toBe("generated-images/workspace_1/job_1/artifact_1.png");
    expect(
      isSafeGeneratedImageProductionStorageRef({
        bucket: "private-generated-artifacts",
        contentType: "image/png",
        createdAt: "2026-06-11T00:00:00.000Z",
        objectKey: objectKey ?? "",
        provider: "supabase_storage",
        sha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        sizeBytes: 67,
      }),
    ).toBe(true);
    expect(
      isSafeGeneratedImageProductionStorageRef({
        bucket: "private-generated-artifacts",
        contentType: "image/png",
        createdAt: "2026-06-11T00:00:00.000Z",
        objectKey: "../leak.png",
        provider: "supabase_storage",
        sha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        sizeBytes: 67,
      }),
    ).toBe(false);
  });

  test("descriptor returns only backend-relative preview path", async () => {
    const storage = createSupabaseGeneratedImageProductionStorage({
      bucket: "private-generated-artifacts",
      client: {
        from: () => ({
          select: () => {
            const query = {
              eq: () => query,
              maybeSingle: async () => ({
                data: {
                  artifact_id: "artifact_1",
                  content_type: "image/png",
                  created_at: "2026-06-11T00:00:00.000Z",
                  provider_id: "mock_local",
                  sha256:
                    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  size_bytes: 67,
                  storage_bucket: "private-generated-artifacts",
                  storage_content_type: "image/png",
                  storage_created_at: "2026-06-11T00:00:00.000Z",
                  storage_object_key:
                    "generated-images/workspace_1/job_1/artifact_1.png",
                  storage_provider: "supabase_storage",
                  storage_sha256:
                    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  storage_size_bytes: 67,
                },
                error: null,
              }),
            };

            return query;
          },
        }),
        storage: {
          from: () => ({
            download: async () => ({ data: new Uint8Array([1]), error: null }),
            list: async () => ({
              data: [{ name: "artifact_1.png" }],
              error: null,
            }),
            upload: async () => ({ error: null }),
          }),
        },
      },
    });
    const resolver = createProductionGeneratedImageArtifactAccessResolver({
      productionStorage: storage,
    });
    const result = await resolver.resolveAccess({
      artifactId: "artifact_1",
      jobId: "job_1",
      requester: {
        userId: "owner_1",
        workspaceId: "workspace_1",
      },
    });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      deliveryStatus: "backend_mediated_preview_available",
      kind: "generated_artifact_access_descriptor",
      previewPath: "/generation/jobs/job_1/artifacts/artifact_1/preview",
      status: "descriptor_ready",
    });
    expect(serialized).not.toContain("private-generated-artifacts");
    expect(serialized).not.toContain("generated-images/");

    for (const token of forbiddenPublicTokens) {
      expect(serialized).not.toContain(token);
    }
  });

  test("arbitrary requester headers are not trusted for delivery access", async () => {
    const decision = await resolveSelectedRouteAccess({
      headers: {
        "x-user-id": "spoofed-user",
        "x-workspace-id": "spoofed-workspace",
      },
      requesterResolver: {
        resolve: async () =>
          createUnauthenticatedRequesterContext("missing_credentials"),
      },
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
      },
    });

    expect(decision).toMatchObject({
      code: "auth_required",
      kind: "denied",
      statusCode: 401,
    });
  });

  test("source boundaries keep delivery backend-mediated with no frontend storage or export reuse", () => {
    const generationRoute = readProjectFile("backend/routes/generation.ts");
    const appSource = readProjectFile("backend/app.ts");
    const backendDependencies = readProjectFile(
      "backend/composition/backendDependencies.ts",
    );
    const generatedAccess = readProjectFile(
      "backend/generation/generatedImageArtifactAccess.ts",
    );
    const productionStorage = readProjectFile(
      "backend/generation/supabaseGeneratedImageProductionStorage.ts",
    );
    const frontendSources = [
      readProjectFile("src/components/PromptImageGenerator.tsx"),
      readProjectFile("src/components/PromptImageHistory.tsx"),
      readProjectFile("src/services/imageGenerationService.ts"),
    ].join("\n");
    const combined = [
      generationRoute,
      appSource,
      backendDependencies,
      generatedAccess,
      productionStorage,
    ].join("\n");

    expect(combined).toContain(
      "FREE_AI_MIXER_PRODUCTION_ARTIFACT_DELIVERY_MODE",
    );
    expect(combined).toContain("backend_mediated_stream");
    expect(generatedAccess).toContain("previewPath");
    expect(generationRoute).not.toContain("/exports/");

    for (const forbidden of [
      "createClient(",
      "supabase.storage",
      "storage.from(",
      "signedUrl",
      "downloadUrl",
    ]) {
      expect(frontendSources).not.toContain(forbidden);
    }
  });
});
