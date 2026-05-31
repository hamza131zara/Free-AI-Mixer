import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const listSourceFiles = (directory: string): string[] => {
  const fullPath = path.join(projectRoot, directory);
  const entries = readdirSync(fullPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(relativePath);
    }

    if (entry.isFile() && /\.(ts|tsx|md|env|json)$/.test(entry.name)) {
      return [relativePath];
    }

    return [];
  });
};

const forbiddenSecretPatterns = [
  /sk-live[_-][A-Za-z0-9]/i,
  /sk-proj[_-][A-Za-z0-9]/i,
  /eyJhbGci[A-Za-z0-9._-]+/,
  /smtp:\/\/[^\s]+/i,
  /postgres:\/\/[^\s]+/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!backend-service-role-key-from-secret-store|replace-with-server-only-service-role-secret)[^\s]+/,
  /SMTP_PASSWORD\s*=\s*[^\s]+/i,
  /PROVIDER_API_KEY\s*=\s*[^\s]+/i,
  /WEBHOOK_SECRET\s*=\s*[^\s]+/i,
  /JWT_SECRET\s*=\s*[^\s]+/i,
] as const;

test.describe("phase39 staging publish dry-run safety", () => {
  test("staging publish dry-run docs exist and explicitly block public launch", () => {
    const stagingDoc = readSource("docs/staging-deployment-readiness.md");
    const envDoc = readSource("docs/staging-env-example.md");
    const goNoGoDoc = readSource("docs/private-beta-go-no-go-checklist.md");

    expect(stagingDoc).toContain("Staging Publish Dry Run");
    expect(stagingDoc).toContain("not a deployment command");
    expect(stagingDoc).toContain("not public launch approval");
    expect(stagingDoc).toContain("Run the private beta go/no-go checklist");
    expect(envDoc).toContain("documentation-only staging environment example");
    expect(envDoc).toContain("not deployment automation");
    expect(envDoc).toContain("not public launch approval");
    expect(goNoGoDoc).toContain("This private beta go/no-go checklist remains the invitation gate.");
    expect(goNoGoDoc).toContain("Public/open beta | Blocked");
  });

  test("required staging env names are documented with frontend public and backend server-only boundaries", () => {
    const envDoc = readSource("docs/staging-env-example.md");
    const stagingDoc = readSource("docs/staging-deployment-readiness.md");
    const combinedDocs = `${envDoc}\n${stagingDoc}`;

    for (const envName of [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_SCENE_API_BASE_URL",
      "VITE_SCENE_GENERATION_PATH",
      "FREE_AI_MIXER_AUTH_RUNTIME_ENABLED",
      "FREE_AI_MIXER_AUTH_PROVIDER",
      "FREE_AI_MIXER_AUTH_ISSUER",
      "FREE_AI_MIXER_AUTH_AUDIENCE",
      "FREE_AI_MIXER_AUTH_JWKS_URI",
      "FREE_AI_MIXER_AUTH_JWT_KEY_MODE",
      "FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS",
      "FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED",
      "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
      "FREE_AI_MIXER_DB_PROVIDER",
      "FREE_AI_MIXER_SUPABASE_URL",
      "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
      "FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE",
      "FREE_AI_MIXER_REAL_AUTH_SMOKE_EMAIL",
      "FREE_AI_MIXER_REAL_AUTH_SMOKE_PASSWORD",
    ]) {
      expect(combinedDocs).toContain(envName);
    }

    expect(envDoc).toContain("Only public client configuration belongs in the frontend");
    expect(envDoc).toContain("Backend-only variables must live in the staging backend secret manager");
    expect(envDoc).toContain("Never add `VITE_SUPABASE_SERVICE_ROLE_KEY`");
    expect(envDoc).toContain("The service-role value is server-only.");
    expect(envDoc).toContain("replace-with-server-only-service-role-secret");
    expect(envDoc).toContain("replace-with-dedicated-smoke-password-from-secret-manager");
  });

  test("manual staging smoke and product honesty gates remain documented", () => {
    const stagingDoc = readSource("docs/staging-deployment-readiness.md");
    const goNoGoDoc = readSource("docs/private-beta-go-no-go-checklist.md");
    const combinedDocs = `${stagingDoc}\n${goNoGoDoc}`;

    expect(combinedDocs).toContain("npm.cmd run typecheck");
    expect(combinedDocs).toContain("npm.cmd run build");
    expect(combinedDocs).toContain("phase37-private-beta-publish-readiness.spec.ts");
    expect(combinedDocs).toContain("phase38-staging-deployment-readiness.spec.ts");
    expect(combinedDocs).toContain("phase25-real-auth-runtime-smoke.spec.ts");
    expect(combinedDocs).toContain("Custom SMTP must be manually verified");
    expect(combinedDocs).toContain("BYOK remains pre-live and fail-closed");
    expect(combinedDocs).toContain("Credits and billing remain non-live");
    expect(combinedDocs).toContain("Export/artifact delivery does not show fake downloads");
    expect(combinedDocs).toContain("Admin analytics remain readiness-only");
    expect(combinedDocs).toContain("No fake signed URLs or public artifact delivery");
  });

  test("docs and examples do not commit real secret-looking values", () => {
    const docsAndEnvSource = [
      ".env.example",
      "docs/staging-env-example.md",
      "docs/staging-deployment-readiness.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/known-issues.md",
      "docs/roadmap.md",
      "docs/phases.md",
    ]
      .map(readSource)
      .join("\n");

    for (const forbiddenPattern of forbiddenSecretPatterns) {
      expect(docsAndEnvSource).not.toMatch(forbiddenPattern);
    }

    expect(docsAndEnvSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsAndEnvSource).not.toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsAndEnvSource).not.toContain("public launch approved");
    expect(docsAndEnvSource).not.toContain("production launch approved");
    expect(docsAndEnvSource).toContain("Public/open beta | Blocked");
  });

  test("frontend source still avoids Supabase DB storage service-role and provider secret shortcuts", () => {
    const frontendSourceFiles = listSourceFiles("src");
    const frontendSource = frontendSourceFiles.map(readSource).join("\n");
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsService = readSource("src/services/providerSettingsService.ts");
    const supabaseImportFiles = frontendSourceFiles.filter((relativePath) =>
      readSource(relativePath).includes("@supabase/supabase-js"),
    );
    const createClientFiles = frontendSourceFiles.filter((relativePath) =>
      readSource(relativePath).includes("createClient("),
    );

    expect(supabaseImportFiles).toEqual([
      path.join("src", "services", "auth", "supabaseAuthClient.ts"),
    ]);
    expect(createClientFiles).toEqual([
      path.join("src", "services", "auth", "supabaseAuthClient.ts"),
    ]);
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain(".from(");
    expect(frontendSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
    expect(frontendSource).not.toMatch(/VITE_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*\s*=/);
    expect(frontendSource).not.toMatch(/service_role\s*[:=]\s*["'][^"']+["']/);
    expect(providerSettingsPage).not.toContain("type=\"password\"");
    expect(providerSettingsPage).not.toContain("name=\"apiKey\"");
    expect(providerSettingsService).not.toContain("apiKey:");
    expect(providerSettingsService).not.toContain("providerKey:");
  });

  test("runtime and build posture remain staging-dry-run only", () => {
    const packageJson = JSON.parse(readSource("package.json")) as {
      scripts?: Record<string, string>;
    };
    const source = [
      "src/pages/CreditsPage.tsx",
      "src/pages/ProviderSettingsPage.tsx",
      "src/pages/ExportHistoryPage.tsx",
      "src/pages/AdminPage.tsx",
      "src/services/artifactDownloadNavigationStrategy.ts",
      "src/services/artifactDeliveryDescriptorService.ts",
      "src/store/artifactDeliveryDescriptorStore.ts",
    ]
      .map(readSource)
      .join("\n");

    expect(packageJson.scripts?.typecheck).toBe("tsc -b --pretty");
    expect(packageJson.scripts?.build).toBe("tsc -b && vite build");
    expect(JSON.stringify(packageJson.scripts)).not.toContain("deploy");
    expect(JSON.stringify(packageJson.scripts)).not.toContain("supabase db push");

    expect(source).toContain("Credits are not enabled yet");
    expect(source).toContain("Provider key setup is not enabled in this beta");
    expect(source).toContain("No fake completed videos");
    expect(source).toContain("Admin readiness shell");
    expect(source).toContain("browser_navigation_disabled");
    expect(source).not.toContain("getPublicUrl");
    expect(source).not.toContain("createSignedUrl");
    expect(source).not.toContain("fakeDownload");
    expect(source).not.toContain("fakeSignedUrl");
    expect(source).not.toContain("fakeArtifact");
    expect(source).not.toContain("fakeSuccess");
  });
});
