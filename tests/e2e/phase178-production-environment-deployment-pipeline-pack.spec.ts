import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveProductionDeploymentReadiness } from "../../backend/deployment/productionDeploymentReadiness";
import { scanForSecretExposure } from "../../backend/security/secretExposureGuard";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const packageJson = JSON.parse(readSource("package.json")) as {
  scripts: Record<string, string | undefined>;
};

const deploymentDocs = readSource("docs/deployment.md");

test.describe("phase178 production environment deployment pipeline pack", () => {
  test("production deployment readiness fails closed for missing env docs or commands", async () => {
    expect(resolveProductionDeploymentReadiness({ env: {}, packageScripts: {} })).toEqual({
      kind: "not_ready",
      missingItems: [
        "node_env",
        "auth_provider",
        "auth_issuer",
        "auth_audience",
        "auth_jwks_uri",
        "supabase_url",
        "supabase_anon_key",
        "supabase_artifacts_storage_bucket",
        "supabase_uploads_storage_bucket",
        "frontend_build_command",
        "backend_start_command",
        "deployment_docs",
        "supabase_checklist",
      ],
      buildCommand: "npm run build",
      backendStartCommand: "npm run backend:start",
      publicLaunchEnabled: false,
      secretsCommitted: false,
    });
  });

  test("production deployment readiness validates env checklist commands docs and supabase checklist without enabling launch", async () => {
    expect(resolveProductionDeploymentReadiness({
      env: {
        NODE_ENV: "production",
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example",
        FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
        FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example/.well-known/jwks.json",
        FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
        FREE_AI_MIXER_SUPABASE_ANON_KEY: "redacted-anon-key",
        FREE_AI_MIXER_STORAGE_BUCKET_ARTIFACTS: "exports",
        FREE_AI_MIXER_STORAGE_BUCKET_UPLOADS: "uploads",
      },
      packageScripts: packageJson.scripts,
      deploymentDocsText: deploymentDocs,
      supabaseChecklistText: deploymentDocs,
    })).toEqual({
      kind: "ready",
      missingItems: [],
      buildCommand: "npm run build",
      backendStartCommand: "npm run backend:start",
      publicLaunchEnabled: false,
      secretsCommitted: false,
    });
  });

  test("deployment docs and pipeline boundaries do not commit secrets public launch or frontend storage shortcuts", async () => {
    const readinessSource = readSource("backend/deployment/productionDeploymentReadiness.ts");
    const gitignoreSource = readSource(".gitignore");
    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    expect(packageJson.scripts.build).toBe("tsc -b && vite build");
    expect(packageJson.scripts["backend:start"]).toBe("tsx backend/server.ts");
    expect(gitignoreSource).toContain(".env");
    expect(gitignoreSource).toContain(".env.*");
    expect(gitignoreSource).toContain("!.env.example");
    expect(gitignoreSource).toContain("dist/");

    expect(readinessSource).toContain("resolveProductionDeploymentReadiness");
    expect(readinessSource).toContain("publicLaunchEnabled: false");
    expect(readinessSource).toContain("secretsCommitted: false");

    expect(scanForSecretExposure({ content: frontendSource, context: "frontend_source" })).toEqual({
      kind: "safe",
      findings: [],
      safeToExpose: true,
    });

    expect(deploymentDocs).toContain("Production deployment commands");
    expect(deploymentDocs).toContain("Frontend hosting");
    expect(deploymentDocs).toContain("Backend hosting");
    expect(deploymentDocs).toContain("Supabase project checklist");
    expect(deploymentDocs).toContain("No secrets committed");
    expect(deploymentDocs).toContain("Public launch remains blocked");

    expect(deploymentDocs).not.toContain("PUBLIC_LAUNCH_ENABLED=true");
    expect(deploymentDocs).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(deploymentDocs).not.toContain("-----BEGIN PRIVATE KEY-----");
    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
  });
});
