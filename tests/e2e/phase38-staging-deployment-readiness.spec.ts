import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

type RuntimeDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
};

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

const attachRuntimeDiagnostics = (page: Page): RuntimeDiagnostics => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    requestFailures.push(
      `${request.method()} ${request.url()} :: ${
        request.failure()?.errorText ?? "unknown"
      }`,
    );
  });

  return {
    consoleErrors,
    pageErrors,
    requestFailures,
  };
};

const unauthenticatedSessionResponse = {
  kind: "unauthenticated_session",
  status: "unauthenticated",
  reason: "missing_credentials",
  message: "Sign in is required for this route.",
};

test.describe("phase38 staging deployment readiness", () => {
  test("package build script remains production-build capable", () => {
    const packageJson = JSON.parse(readSource("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toBe("tsc -b && vite build");
    expect(packageJson.scripts?.typecheck).toBe("tsc -b --pretty");
    expect(packageJson.scripts?.build).not.toContain("deploy");
    expect(packageJson.scripts?.build).not.toContain("supabase db push");
  });

  test("public landing and mixer shell stay backend-safe for staging smoke", async ({
    page,
  }) => {
    const diagnostics = attachRuntimeDiagnostics(page);

    await page.goto("/", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", {
        name: "Free AI Mixer now has a real navigation shell.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Workbench today")).toBeVisible();

    await page.goto("/mixer", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "Free AI Mixer" })).toBeVisible();
    await expect(page.getByText("AI Scene Generation")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Scene" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate All" })).toBeVisible();

    await page.waitForTimeout(250);

    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.requestFailures).toEqual([]);
  });

  test("protected pages do not fake auth during staging readiness", async ({ page }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify(unauthenticatedSessionResponse),
      });
    });

    for (const protectedPath of [
      "/dashboard",
      "/projects",
      "/settings/providers",
    ]) {
      await test.step(protectedPath, async () => {
        await page.goto(protectedPath, { waitUntil: "load" });
        await expect(page.getByTestId("protected-route-shell")).toBeVisible();
        await expect(page.getByTestId("protected-route-shell-status")).toContainText(
          "Sign in required",
        );
        await expect(page.getByTestId("protected-route-shell-status")).not.toContainText(
          "Verified workspace",
        );
        await expect(page.getByTestId("protected-route-shell-status")).not.toContainText(
          "account_bootstrap_complete",
        );
      });
    }
  });

  test("staging docs document required env names without real values or launch claims", () => {
    const stagingDoc = readSource("docs/staging-deployment-readiness.md");
    const goNoGoDoc = readSource("docs/private-beta-go-no-go-checklist.md");
    const envExample = readSource(".env.example");

    for (const envName of [
      "FREE_AI_MIXER_AUTH_RUNTIME_ENABLED",
      "FREE_AI_MIXER_AUTH_PROVIDER",
      "FREE_AI_MIXER_AUTH_ISSUER",
      "FREE_AI_MIXER_AUTH_AUDIENCE",
      "FREE_AI_MIXER_AUTH_JWKS_URI",
      "FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED",
      "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
      "FREE_AI_MIXER_DB_PROVIDER",
      "FREE_AI_MIXER_SUPABASE_URL",
      "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE",
      "FREE_AI_MIXER_REAL_AUTH_SMOKE_EMAIL",
      "FREE_AI_MIXER_REAL_AUTH_SMOKE_PASSWORD",
    ]) {
      expect(stagingDoc).toContain(envName);
    }

    expect(stagingDoc).toContain("Do not commit real values");
    expect(stagingDoc).toContain("Do not create `VITE_*SERVICE_ROLE*` variables");
    expect(stagingDoc).toContain("Custom SMTP must be manually verified");
    expect(stagingDoc).toContain("BYOK remains pre-live and fail-closed");
    expect(stagingDoc).toContain("Credits and billing remain non-live");
    expect(stagingDoc).toContain("Admin analytics remain readiness-only");
    expect(stagingDoc).toContain("Private beta is not public launch.");
    expect(goNoGoDoc).toContain("Staging Deployment Readiness");
    expect(goNoGoDoc).toContain("manual go/no-go approval");

    expect(envExample).toContain(
      "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=backend-service-role-key-from-secret-store",
    );
    expect(envExample).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY=");
    expect(envExample).not.toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=");
  });

  test("source boundaries block frontend storage access service-role exposure and secret-looking values", () => {
    const frontendSourceFiles = listSourceFiles("src");
    const frontendSource = frontendSourceFiles.map(readSource).join("\n");
    const docsAndEnvSource = [
      ".env.example",
      "docs/staging-deployment-readiness.md",
      "docs/private-beta-go-no-go-checklist.md",
      "docs/known-issues.md",
      "docs/roadmap.md",
      "docs/phases.md",
    ]
      .map(readSource)
      .join("\n");

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
    expect(frontendSource).not.toContain(
      "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(frontendSource).not.toMatch(/VITE_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*\s*=/);
    expect(frontendSource).not.toMatch(/service_role\s*[:=]\s*["'][^"']+["']/);

    expect(docsAndEnvSource).not.toContain("sk-live");
    expect(docsAndEnvSource).not.toContain("sk-proj-");
    expect(docsAndEnvSource).not.toContain("eyJhbGci");
    expect(docsAndEnvSource).not.toContain("smtp://");
    expect(docsAndEnvSource).not.toContain("postgres://");
    expect(docsAndEnvSource).not.toContain("public launch approved");
    expect(docsAndEnvSource).not.toContain("production launch approved");
    expect(docsAndEnvSource).toContain("Public/open beta | Blocked");
  });

  test("product runtime boundaries remain non-live for staging readiness", () => {
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const exportHistoryPage = readSource("src/pages/ExportHistoryPage.tsx");
    const projectsPage = readSource("src/pages/ProjectsPage.tsx");
    const adminPage = readSource("src/pages/AdminPage.tsx");
    const artifactSource = [
      "src/components/ArtifactDownloadAction.tsx",
      "src/components/ArtifactDeliveryDescriptorAction.tsx",
      "src/services/artifactDownloadNavigationStrategy.ts",
      "src/services/artifactDeliveryDescriptorService.ts",
      "src/store/artifactDeliveryDescriptorStore.ts",
    ]
      .map(readSource)
      .join("\n");

    expect(creditsPage).toContain("Credits are not enabled yet");
    expect(creditsPage).toContain("No live credit balance");
    expect(creditsPage).toContain("Credits and billing are not enabled yet.");

    expect(providerSettingsPage).toContain("Provider key setup is not enabled in this beta");
    expect(providerSettingsPage).toContain("Secure API key connection is not enabled yet");
    expect(providerSettingsPage).toContain("Real provider validation is not enabled yet");
    expect(providerSettingsPage).not.toContain("type=\"password\"");
    expect(providerSettingsPage).not.toContain("name=\"apiKey\"");

    expect(projectsPage).toContain("No fake project cards");
    expect(exportHistoryPage).toContain("No fake completed videos");
    expect(adminPage).toContain("Admin readiness shell");
    expect(adminPage).toContain("Admin tools are not enabled yet.");

    expect(artifactSource).toContain("browser_navigation_disabled");
    expect(artifactSource).toContain("unavailable");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("fakeDownload");
    expect(artifactSource).not.toContain("fakeSignedUrl");
    expect(artifactSource).not.toContain("fakeArtifact");
    expect(artifactSource).not.toContain("fakeSuccess");
  });
});
