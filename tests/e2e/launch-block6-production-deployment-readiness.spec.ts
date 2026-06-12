import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const readRepoFile = (relativePath: string) =>
  readFile(path.join(repoRoot, relativePath), "utf8");

test.describe("Launch Block 6 production deployment readiness", () => {
  test("deployment readiness module exposes safe statuses without raw secret values", async () => {
    const module = await import(
      "../../backend/config/productionDeploymentReadiness"
    );

    const summary = module.getProductionDeploymentReadinessSummary({
      FREE_AI_MIXER_ALLOWED_ORIGINS: "",
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.invalid",
      FREE_AI_MIXER_AUTH_AUDIENCE: "authenticated",
      FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
      FREE_AI_MIXER_DB_PROVIDER: "supabase",
      FREE_AI_MIXER_SUPABASE_URL: "https://project.example.invalid",
      FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-role",
      FREE_AI_MIXER_STORAGE_BUCKET_ARTIFACTS: "private-artifacts",
      FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "0",
    });
    const serialized = JSON.stringify(summary);

    expect(summary.kind).toBe("production_deployment_readiness");
    expect(summary.safeForPublicLaunch).toBe(false);
    expect(summary.secretsExposed).toBe(false);
    expect(summary.platformPaidGenerationEnabled).toBe(false);
    expect(summary.videoProvidersEnabled).toBe(false);
    expect(summary.publicArtifactDeliveryEnabled).toBe(false);
    expect(serialized).not.toContain("super-secret-service-role");
  });

  test("monitoring route exposes deployment-readiness contract", async () => {
    const route = await readRepoFile("backend/routes/monitoring.ts");
    const contract = await readRepoFile(
      "backend/contracts/monitoringHttpTypes.ts",
    );

    expect(route).toContain("/monitoring/deployment-readiness");
    expect(route).toContain("getProductionDeploymentReadinessSummary");
    expect(contract).toContain(
      "BackendMonitoringDeploymentReadinessResponse",
    );
  });

  test("production CORS is explicit and fail-closed without wildcard origins", async () => {
    const cors = await import("../../backend/config/productionCorsPolicy");

    expect(
      cors.readProductionCorsPolicy({
        NODE_ENV: "production",
      }),
    ).toMatchObject({
      allowedOrigins: [],
      mode: "production_blocked",
    });
    expect(
      cors.readProductionCorsPolicy({
        FREE_AI_MIXER_ALLOWED_ORIGINS:
          "https://app.example.invalid,https://admin.example.invalid",
        NODE_ENV: "production",
      }),
    ).toMatchObject({
      allowedOrigins: [
        "https://app.example.invalid",
        "https://admin.example.invalid",
      ],
      mode: "production_explicit",
    });

    const source = await readRepoFile("backend/config/productionCorsPolicy.ts");
    expect(source).not.toContain('"*"');
    expect(source).not.toContain("Access-Control-Allow-Origin', '*");
  });

  test("frontend env policy blocks service-role and provider secrets", async () => {
    const module = await import(
      "../../backend/config/productionDeploymentReadiness"
    );

    expect(
      module.getFrontendEnvSafetyChecks({
        VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "forbidden",
      }),
    ).toContainEqual(
      expect.objectContaining({
        name: "frontend_env_allowlist",
        status: "blocked",
      }),
    );
    expect(
      module.getFrontendEnvSafetyChecks({
        VITE_SUPABASE_ANON_KEY: "public-anon-placeholder",
        VITE_SUPABASE_URL: "https://project.example.invalid",
      }),
    ).toContainEqual(
      expect.objectContaining({
        name: "frontend_env_allowlist",
        status: "ready",
      }),
    );
  });

  test("docs and env example keep provider, platform-paid, video, and downloads disabled by default", async () => {
    const combined = [
      await readRepoFile(".env.example"),
      await readRepoFile("docs/deployment.md"),
      await readRepoFile("docs/staging-deployment-readiness.md"),
      await readRepoFile("docs/staging-env-example.md"),
      await readRepoFile("docs/roadmap.md"),
      await readRepoFile("docs/known-issues.md"),
      await readRepoFile("docs/phases.md"),
    ].join("\n");

    expect(combined).toContain("FREE_AI_MIXER_ALLOWED_ORIGINS");
    expect(combined).toContain(
      "FREE_AI_MIXER_PRODUCTION_ARTIFACT_DELIVERY_MODE",
    );
    expect(combined).toContain("manual migration");
    expect(combined).toContain("rollback");
    expect(combined).toContain("smoke");
    expect(combined).toContain("real providers");
    expect(combined).toContain("platform-paid");
    expect(combined).toContain("video providers");
    expect(combined).not.toContain("unlimited free generation");
    expect(combined).not.toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=");
    expect(combined).not.toContain("signed URL delivery is enabled by default");
  });
});
