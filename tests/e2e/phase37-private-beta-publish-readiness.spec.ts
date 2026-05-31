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

test.describe("phase37 private beta publish readiness", () => {
  test("public landing and mixer shell load without backend dependency", async ({
    page,
  }) => {
    const diagnostics = attachRuntimeDiagnostics(page);

    await page.goto("/", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", {
        name: "Free AI Mixer now has a real navigation shell.",
      }),
    ).toBeVisible();

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

  test("protected areas show sign-in boundary instead of fake authenticated access", async ({
    page,
  }) => {
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
        await expect(page.getByTestId("protected-route-shell-status")).toContainText(
          "Sign in through the configured auth provider",
        );
        await expect(page.getByTestId("protected-route-shell-status")).not.toContainText(
          "authenticated",
        );
        await expect(page.getByTestId("protected-route-shell-status")).not.toContainText(
          "Verified workspace",
        );
      });
    }
  });

  test("auth pages and beta docs keep email custom SMTP and launch readiness honest", () => {
    const loginPage = readSource("src/pages/LoginPage.tsx");
    const signupPage = readSource("src/pages/SignupPage.tsx");
    const forgotPasswordPage = readSource("src/pages/ForgotPasswordPage.tsx");
    const resetPasswordPage = readSource("src/pages/ResetPasswordPage.tsx");
    const authEmailDoc = readSource("docs/auth-email-custom-smtp-onboarding.md");
    const goNoGoDoc = readSource("docs/private-beta-go-no-go-checklist.md");

    expect(loginPage).toContain("confirmed account and known password");
    expect(loginPage).toContain("not guaranteed to be instant");
    expect(signupPage).toContain("Use the newest verification email only");
    expect(signupPage).toContain("email rate limits");
    expect(forgotPasswordPage).toContain("Use the newest recovery email only");
    expect(forgotPasswordPage).toContain("not guaranteed to arrive");
    expect(resetPasswordPage).toContain("expired, reused, or opened on the wrong");
    expect(resetPasswordPage).toContain("newest link only");

    expect(authEmailDoc).toContain(
      "serious tester onboarding requires a manually configured custom SMTP provider",
    );
    expect(authEmailDoc).toContain("Do not promise instant email delivery");
    expect(goNoGoDoc).toContain("Private beta is not public launch.");
    expect(goNoGoDoc).toContain("Public artifact delivery remains gated");
    expect(goNoGoDoc).toContain("Custom SMTP must be manually verified");
    expect(goNoGoDoc).toContain("Public/open beta | Blocked");
  });

  test("account product surfaces remain truthful, non-live, and fail-closed", () => {
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const projectsPage = readSource("src/pages/ProjectsPage.tsx");
    const exportHistoryPage = readSource("src/pages/ExportHistoryPage.tsx");
    const adminPage = readSource("src/pages/AdminPage.tsx");
    const authenticatedFetch = readSource("src/services/auth/authenticatedFetch.ts");
    const providerSettingsService = readSource("src/services/providerSettingsService.ts");

    expect(creditsPage).toContain("Credits are not enabled yet");
    expect(creditsPage).toContain("No live credit balance, ledger, or remaining-credit value");
    expect(creditsPage).toContain("Credits and billing are not enabled yet.");
    expect(creditsPage).not.toContain("setBalance");
    expect(creditsPage).not.toContain("chargeCredit");

    expect(providerSettingsPage).toContain("Provider key setup is not enabled in this beta");
    expect(providerSettingsPage).toContain("Secure API key connection is not enabled yet");
    expect(providerSettingsPage).toContain("Real provider validation is not enabled yet");
    expect(providerSettingsPage).toContain("disabled");
    expect(providerSettingsPage).not.toContain("type=\"password\"");
    expect(providerSettingsPage).not.toContain("name=\"apiKey\"");
    expect(providerSettingsService).not.toContain("apiKey:");
    expect(providerSettingsService).not.toContain("providerKey:");

    expect(projectsPage).toContain("No fake project cards");
    expect(projectsPage).toContain("Verified project data is not available yet");
    expect(exportHistoryPage).toContain("No fake completed videos");
    expect(exportHistoryPage).toContain("Verified export history is not available yet");

    expect(adminPage).toContain("Admin readiness shell");
    expect(adminPage).toContain("expose any real or fake operational data.");
    expect(adminPage).toContain("Admin tools are not enabled yet.");

    expect(authenticatedFetch).toContain("/provider-settings/status");
    expect(authenticatedFetch).not.toContain("/provider-settings/connections");
    expect(authenticatedFetch).not.toContain("/admin");
    expect(authenticatedFetch).not.toContain("/billing");
  });

  test("export artifact delivery avoids fake downloads signed urls artifacts and success", () => {
    const source = [
      "src/components/ArtifactDownloadAction.tsx",
      "src/components/ArtifactDeliveryDescriptorAction.tsx",
      "src/components/TimelineExportPanel.tsx",
      "src/services/artifactDeliveryDescriptorService.ts",
      "src/services/artifactDownloadNavigationStrategy.ts",
      "src/services/artifactDownloadUiState.ts",
      "src/store/artifactDeliveryDescriptorStore.ts",
      "src/services/exportService.ts",
      "src/store/exportStore.ts",
    ]
      .map(readSource)
      .join("\n");

    expect(source).toContain("browser_navigation_disabled");
    expect(source).toContain("backend_mediated");
    expect(source).toContain("unavailable");
    expect(source).not.toContain("getPublicUrl");
    expect(source).not.toContain("createSignedUrl");
    expect(source).not.toContain("window.location.href");
    expect(source).not.toContain("document.createElement");
    expect(source).not.toContain("fakeArtifact");
    expect(source).not.toContain("fakeDownload");
    expect(source).not.toContain("fakeSignedUrl");
  });

  test("source boundaries prevent frontend storage access service role exposure committed secrets and public launch shortcuts", () => {
    const frontendSourceFiles = listSourceFiles("src");
    const frontendSource = frontendSourceFiles.map(readSource).join("\n");
    const docsSource = [
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
    expect(frontendSource).not.toContain("eyJhbGci");
    expect(frontendSource).not.toContain("sk-live");
    expect(frontendSource).not.toContain("sk-proj-");
    expect(frontendSource).not.toContain("smtp://");

    expect(docsSource).toContain("Public/open beta | Blocked");
    expect(docsSource).toContain("No production launch should happen automatically");
    expect(docsSource).not.toContain("public launch approved");
    expect(docsSource).not.toContain("production launch approved");
    expect(docsSource).not.toContain("smtp://");
    expect(docsSource).not.toContain("sk-live");
    expect(docsSource).not.toContain("sk-proj-");
    expect(docsSource).not.toContain("eyJhbGci");
  });
});
