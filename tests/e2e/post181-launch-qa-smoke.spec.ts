import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  decideArtifactDownloadNavigation,
  navigateToArtifactDownloadDescriptor,
} from "../../src/services/artifactDownloadNavigationStrategy";
import type { ArtifactDownloadDescriptor } from "../../src/services/artifactDownloadUiState";
import {
  createPersistedStoreValue,
  createScene,
  persistKey,
} from "./helpers/persist";

const projectRoot = process.cwd();
type RuntimeDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
};

const frontendDownloadBoundaryFiles = [
  "src/components/ArtifactDownloadAction.tsx",
  "src/components/ArtifactDeliveryDescriptorAction.tsx",
  "src/components/TimelineExportPanel.tsx",
  "src/services/artifactDeliveryDescriptorService.ts",
  "src/services/artifactDownloadNavigationStrategy.ts",
  "src/services/artifactDownloadUiState.ts",
  "src/store/artifactDeliveryDescriptorStore.ts",
];

const viewportCases = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const listFrontendSourceFiles = (directory: string): string[] => {
  const fullPath = path.join(projectRoot, directory);
  const entries = readdirSync(fullPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFrontendSourceFiles(relativePath);
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
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

const seedSceneStore = async (
  page: Page,
  scenes: ReturnType<typeof createScene>[],
): Promise<void> => {
  await page.addInitScript(
    ({ key, persistedValue }: { key: string; persistedValue: string }) => {
      window.localStorage.setItem(key, persistedValue);
    },
    {
      key: persistKey,
      persistedValue: createPersistedStoreValue({ scenes }),
    },
  );
};

const gotoMixerAndAssertShell = async (
  page: Page,
): Promise<{ elapsedMs: number; diagnostics: RuntimeDiagnostics }> => {
  const diagnostics = attachRuntimeDiagnostics(page);
  const startedAt = Date.now();

  await page.goto("/mixer", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Free AI Mixer" })).toBeVisible();
  await expect(page.getByText("AI Scene Generation")).toBeVisible();

  return {
    elapsedMs: Date.now() - startedAt,
    diagnostics,
  };
};

const createSuccessfulScene = (id: string) =>
  createScene({
    id,
    lifecycle: "success",
    payload: {
      prompt: "Launch QA observatory scene",
      style: "cinematic",
      duration: 8,
    },
    progress: 100,
    result: {
      image: "https://example.com/launch-qa.png",
      variations: ["https://example.com/launch-qa-variation.png"],
    },
  });

test.describe("post181 launch qa smoke", () => {
  test("main app render finishes locally without initial console or page error spam", async ({
    page,
  }) => {
    const { elapsedMs, diagnostics } = await gotoMixerAndAssertShell(page);

    await expect(page.getByRole("button", { name: "Add Scene" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Timeline" })).toBeVisible();

    await page.waitForTimeout(250);

    const navigationTiming = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;

      return navigation
        ? {
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            loadEventEndMs: navigation.loadEventEnd,
          }
        : undefined;
    });

    expect(elapsedMs).toBeLessThan(10_000);
    expect(navigationTiming?.domContentLoadedMs ?? 0).toBeGreaterThan(0);
    expect(navigationTiming?.domContentLoadedMs ?? Number.POSITIVE_INFINITY).toBeLessThan(
      5_000,
    );
    expect(navigationTiming?.loadEventEndMs ?? 0).toBeGreaterThan(0);
    expect(navigationTiming?.loadEventEndMs ?? Number.POSITIVE_INFINITY).toBeLessThan(
      8_000,
    );

    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.requestFailures).toEqual([]);
  });

  test("responsive smoke holds across desktop tablet and mobile widths", async ({
    page,
  }) => {
    for (const viewport of viewportCases) {
      await test.step(viewport.name, async () => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await page.goto("/mixer", { waitUntil: "load" });

        await expect(page.getByRole("heading", { name: "Free AI Mixer" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Add Scene" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Generate All" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Create Timeline" })).toBeVisible();
        await expect(page.getByTestId("timeline-export-panel")).toContainText(
          "Create and select a timeline to request export.",
        );
      });
    }
  });

  test("core visible actions remain present and usable without remote services", async ({
    page,
  }) => {
    await seedSceneStore(page, [createSuccessfulScene("launch-qa-success-scene")]);
    await gotoMixerAndAssertShell(page);

    await page.getByLabel("Prompt").fill("Post-181 launch QA scene");
    await page.getByLabel("Style").selectOption("cinematic");
    await page.getByLabel("Duration").fill("8");
    await page.getByRole("button", { name: "Add Scene" }).click();

    const queuedSceneCard = page
      .locator("article")
      .filter({ hasText: "Post-181 launch QA scene" });
    await expect(queuedSceneCard).toBeVisible();
    await expect(
      queuedSceneCard.getByRole("button", { name: "Generate scene" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Create Timeline" }).click();
    await expect(page.getByText("Active Timeline 1")).toBeVisible();

    await page
      .getByRole("button", {
        name: "Add scene launch-qa-success-scene to timeline",
      })
      .click();

    await expect(page.getByTestId("timeline-track")).toContainText(
      "Total duration: 3000ms",
    );

    const requestExportButton = page.getByRole("button", {
      name: "Request export",
    });
    await expect(requestExportButton).toBeEnabled();
    await requestExportButton.click();

    await expect(page.getByTestId("timeline-export-failure")).toContainText(
      "missing_export_api_base_url",
    );
    await expect(page.getByTestId("timeline-export-failure")).toContainText(
      "Export API base URL is not configured.",
    );
  });

  test("artifact download remains descriptor based and explicit user triggered only", async () => {
    const descriptor: ArtifactDownloadDescriptor = {
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "launch-qa-job",
      artifactId: "launch-qa-artifact",
      backendRoutePath: "/exports/launch-qa-job/artifacts/launch-qa-artifact/stream",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };

    expect(
      decideArtifactDownloadNavigation({
        descriptor,
        allowBrowserNavigation: false,
        now: new Date("2026-05-22T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "browser_navigation_disabled",
    });

    const opened: Array<{ url: string; target?: string; features?: string }> = [];

    const decision = navigateToArtifactDownloadDescriptor({
      descriptor,
      allowBrowserNavigation: true,
      now: new Date("2026-05-22T00:00:00.000Z"),
      windowRef: {
        open: (url, target, features) => {
          opened.push({ url, target, features });
          return null;
        },
      },
    });

    expect(decision).toEqual({
      kind: "permitted",
      deliveryMode: "backend_mediated",
      jobId: "launch-qa-job",
      artifactId: "launch-qa-artifact",
      backendRoutePath: "/exports/launch-qa-job/artifacts/launch-qa-artifact/stream",
      navigationUrl: "/exports/launch-qa-job/artifacts/launch-qa-artifact/stream",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    expect(opened).toEqual([
      {
        url: "/exports/launch-qa-job/artifacts/launch-qa-artifact/stream",
        target: "_blank",
        features: "noopener,noreferrer",
      },
    ]);
  });

  test("frontend source still avoids direct supabase storage client usage", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain(
      "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(frontendSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
  });

  test("download implementation still avoids location href createElement and click shortcuts", async () => {
    const source = frontendDownloadBoundaryFiles
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(source).toContain("navigateToArtifactDownloadDescriptor");
    expect(source).toContain("targetWindow.open");
    expect(source).not.toContain("window.location.href");
    expect(source).not.toContain("location.href =");
    expect(source).not.toContain("document.createElement");
    expect(source).not.toContain(".click()");
  });
});
