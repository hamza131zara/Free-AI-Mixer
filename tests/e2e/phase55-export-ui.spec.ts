import { expect, test, type Page } from "@playwright/test";
import {
  createPersistedStoreValue,
  createScene,
  persistKey,
} from "./helpers/persist";
import { sceneApiUrl } from "./helpers/runtime";

const timelinePersistKey = "free-ai-mixer-timelines";
const exportPersistKey = "free-ai-mixer-exports";

type RuntimeConfigSeed = {
  exportBaseUrl: string;
  exportSubmitPath?: string;
};

const seedRuntimeConfig = async (
  page: Page,
  config: RuntimeConfigSeed,
): Promise<void> => {
  await page.addInitScript((runtimeConfig: RuntimeConfigSeed) => {
    Object.assign(window, {
      __FREE_AI_MIXER_RUNTIME_CONFIG__: runtimeConfig,
    });
  }, config);
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

const seedTimelineStore = async (
  page: Page,
  timelineId: string,
  sceneId: string,
): Promise<void> => {
  await page.addInitScript(
    ({ key, persistedValue }: { key: string; persistedValue: string }) => {
      window.localStorage.setItem(key, persistedValue);
    },
    {
      key: timelinePersistKey,
      persistedValue: JSON.stringify({
        state: {
          timelines: [
            {
              id: timelineId,
              name: "Seeded Timeline",
              clips: [
                {
                  id: "clip-1",
                  sceneId,
                  source: "scene",
                  order: 0,
                  startMs: 0,
                  durationMs: 1000,
                },
              ],
              selection: {},
              playback: { status: "idle", currentTimeMs: 0 },
              totalDurationMs: 1000,
              createdAt: "2026-05-09T00:00:00.000Z",
              updatedAt: "2026-05-09T00:00:00.000Z",
            },
          ],
          activeTimelineId: timelineId,
        },
        version: 1,
      }),
    },
  );
};

const seedExportStore = async (page: Page, state: unknown): Promise<void> => {
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    {
      key: exportPersistKey,
      value: JSON.stringify({
        state,
        version: 1,
      }),
    },
  );
};

const assertExportSeedDiagnostics = async (
  page: Page,
  expectedTimelineId: string,
): Promise<void> => {
  const diagnostics = await page.evaluate(
    ({
      timelineKey,
      exportKey,
    }: {
      timelineKey: string;
      exportKey: string;
    }) => {
      const keys = Object.keys(window.localStorage);
      const timelineRaw = window.localStorage.getItem(timelineKey);
      const exportRaw = window.localStorage.getItem(exportKey);
      const timelineParsed = timelineRaw ? JSON.parse(timelineRaw) : undefined;
      const exportParsed = exportRaw ? JSON.parse(exportRaw) : undefined;
      const activeTimelineId = timelineParsed?.state?.activeTimelineId;
      const exportJobsByTimelineId = exportParsed?.state?.jobsByTimelineId;
      const exportJobKeys =
        exportJobsByTimelineId && typeof exportJobsByTimelineId === "object"
          ? Object.keys(exportJobsByTimelineId)
          : [];

      return {
        keys,
        timelineRaw,
        exportRaw,
        activeTimelineId,
        exportJobKeys,
      };
    },
    {
      timelineKey: timelinePersistKey,
      exportKey: exportPersistKey,
    },
  );

  const hasMatchingTimeline =
    diagnostics.activeTimelineId === expectedTimelineId;
  const hasMatchingExportJobKey =
    diagnostics.exportJobKeys.includes(expectedTimelineId);

  if (!hasMatchingTimeline || !hasMatchingExportJobKey) {
    throw new Error(
      [
        "Export seed diagnostic mismatch.",
        `expectedTimelineId=${expectedTimelineId}`,
        `activeTimelineId=${String(diagnostics.activeTimelineId)}`,
        `exportJobKeys=${JSON.stringify(diagnostics.exportJobKeys)}`,
        `localStorageKeys=${JSON.stringify(diagnostics.keys)}`,
        `timelineRaw=${JSON.stringify(diagnostics.timelineRaw)}`,
        `exportRaw=${JSON.stringify(diagnostics.exportRaw)}`,
      ].join("\n"),
    );
  }
};

const gotoAppWithDiagnostics = async (page: Page): Promise<void> => {
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

  await page.goto("/");

  const heading = page.getByRole("heading", { name: "Free AI Mixer" });

  if (!(await heading.isVisible())) {
    const url = page.url();
    const bodyText = (await page.locator("body").innerText()).slice(0, 500);

    throw new Error(
      [
        "App shell did not render.",
        `url=${url}`,
        `consoleErrors=${JSON.stringify(consoleErrors)}`,
        `pageErrors=${JSON.stringify(pageErrors)}`,
        `requestFailures=${JSON.stringify(requestFailures)}`,
        `bodyText=${JSON.stringify(bodyText)}`,
      ].join("\n"),
    );
  }
};

test.describe("Phase 5.5 export UI status/actions", () => {
  test("export panel renders and request button gating works", async ({
    page,
  }) => {
    await seedSceneStore(page, [
      createScene({
        id: "success-scene-a",
        lifecycle: "success",
        payload: {
          prompt: "Scene A",
          style: "cinematic",
          duration: 8,
        },
        progress: 100,
        result: {
          image: "https://example.com/a.png",
          variations: ["https://example.com/a-var.png"],
        },
      }),
    ]);

    await gotoAppWithDiagnostics(page);

    await expect(page.getByTestId("timeline-export-panel")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Request export" }),
    ).toBeDisabled();
    await expect(page.getByTestId("timeline-export-panel")).toContainText(
      "Create and select a timeline to request export.",
    );

    await page.getByRole("button", { name: "Create Timeline" }).click();

    await expect(
      page.getByRole("button", { name: "Request export" }),
    ).toBeDisabled();

    await page
      .getByRole("button", {
        name: "Add scene success-scene-a to timeline",
      })
      .click();

    await expect(
      page.getByRole("button", { name: "Request export" }),
    ).toBeEnabled();
  });

  test("missing backend config failure is shown truthfully and UI does not trigger scene generation", async ({
    page,
  }) => {
    let generationRequestCount = 0;

    await page.route(sceneApiUrl, async (route) => {
      generationRequestCount += 1;
      await route.abort();
    });

    await seedRuntimeConfig(page, {
      exportBaseUrl: "",
    });

    await seedSceneStore(page, [
      createScene({
        id: "success-scene-a",
        lifecycle: "success",
        payload: {
          prompt: "Scene A",
          style: "cinematic",
          duration: 8,
        },
        progress: 100,
        result: {
          image: "https://example.com/a.png",
          variations: ["https://example.com/a-var.png"],
        },
      }),
    ]);

    await gotoAppWithDiagnostics(page);

    await page.getByRole("button", { name: "Create Timeline" }).click();
    await page
      .getByRole("button", {
        name: "Add scene success-scene-a to timeline",
      })
      .click();

    await page.getByRole("button", { name: "Request export" }).click();

    const failure = page.getByTestId("timeline-export-failure");

    await expect(failure).toContainText("missing_export_api_base_url");
    await expect(failure).toContainText(
      "Export API base URL is not configured.",
    );

    expect(generationRequestCount).toBe(0);
  });

  test("in-flight state appears and duplicate request is blocked after accepted submission", async ({
    page,
  }) => {
    await seedRuntimeConfig(page, {
      exportBaseUrl: "http://127.0.0.1:4173",
      exportSubmitPath: "/exports/jobs",
    });

    await seedSceneStore(page, [
      createScene({
        id: "success-scene-a",
        lifecycle: "success",
        payload: {
          prompt: "Scene A",
          style: "cinematic",
          duration: 8,
        },
        progress: 100,
        result: {
          image: "https://example.com/a.png",
          variations: ["https://example.com/a-var.png"],
        },
      }),
    ]);

    await gotoAppWithDiagnostics(page);

    let exportSubmitCalls = 0;

    await page.route("http://127.0.0.1:4173/exports/jobs", async (route) => {
      exportSubmitCalls += 1;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "accepted_job",
          handle: {
            provider: "backend_render",
            requestId: "request-accepted",
            jobId: "job-accepted",
            status: "submitted",
          },
        }),
      });
    });

    await page.getByRole("button", { name: "Create Timeline" }).click();
    await page
      .getByRole("button", {
        name: "Add scene success-scene-a to timeline",
      })
      .click();

    await page.getByRole("button", { name: "Request export" }).click();

    await expect(page.getByTestId("timeline-export-panel")).toContainText(
      "Export requested / in progress.",
    );
    await expect(
      page.getByRole("button", { name: "Request export" }),
    ).toBeDisabled();

    expect(exportSubmitCalls).toBe(1);
  });

  test("immediate success renders artifact refs truthfully and no fake percent", async ({
    page,
  }) => {
    await seedSceneStore(page, [
      createScene({
        id: "success-scene-a",
        lifecycle: "success",
        payload: {
          prompt: "Scene A",
          style: "cinematic",
          duration: 8,
        },
        progress: 100,
        result: {
          image: "https://example.com/a.png",
          variations: ["https://example.com/a-var.png"],
        },
      }),
    ]);

    await seedRuntimeConfig(page, {
      exportBaseUrl: "http://127.0.0.1:4173",
      exportSubmitPath: "/exports/jobs",
    });

    await page.route("http://127.0.0.1:4173/exports/jobs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "immediate_success",
          result: {
            provider: "backend_render",
            requestId: "request-success",
            jobId: "job-success",
            artifacts: [
              { id: "artifact-a" },
              { id: "artifact-b", url: "https://example.com/video.mp4" },
            ],
          },
        }),
      });
    });

    await gotoAppWithDiagnostics(page);

    await page.getByRole("button", { name: "Create Timeline" }).click();
    await page
      .getByRole("button", {
        name: "Add scene success-scene-a to timeline",
      })
      .click();

    await page.getByRole("button", { name: "Request export" }).click();

    const panel = page.getByTestId("timeline-export-panel");

    await expect(panel).toContainText("Export completed.");
    await expect(panel.getByTestId("timeline-export-artifacts")).toContainText(
      "artifact-a",
    );
    await expect(panel.getByText("artifact reference available.")).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "Open artifact" }),
    ).toHaveAttribute("href", "https://example.com/video.mp4");
    await expect(panel).not.toContainText("Progress %");
  });

  test("error state renders truthful failure code/message", async ({ page }) => {
    await seedSceneStore(page, [
      createScene({
        id: "success-scene-a",
        lifecycle: "success",
        payload: {
          prompt: "Scene A",
          style: "cinematic",
          duration: 8,
        },
        progress: 100,
        result: {
          image: "https://example.com/a.png",
          variations: ["https://example.com/a-var.png"],
        },
      }),
    ]);

    await seedRuntimeConfig(page, {
      exportBaseUrl: "http://127.0.0.1:4173",
      exportSubmitPath: "/exports/jobs",
    });

    await page.route("http://127.0.0.1:4173/exports/jobs", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          message: "backend failed",
        }),
      });
    });

    await gotoAppWithDiagnostics(page);

    await page.getByRole("button", { name: "Create Timeline" }).click();
    await page
      .getByRole("button", {
        name: "Add scene success-scene-a to timeline",
      })
      .click();

    await page.getByRole("button", { name: "Request export" }).click();

    await expect(page.getByTestId("timeline-export-failure")).toContainText(
      "http_error",
    );
  });

  test("resume_needed label renders truthfully", async ({ page }) => {
    const sceneId = "success-scene-a";
    const timelineId = "timeline-resume-needed";

    await seedSceneStore(page, [
      createScene({
        id: sceneId,
        lifecycle: "success",
        payload: {
          prompt: "Scene A",
          style: "cinematic",
          duration: 8,
        },
        progress: 100,
        result: {
          image: "https://example.com/a.png",
          variations: ["https://example.com/a-var.png"],
        },
      }),
    ]);

    await seedTimelineStore(page, timelineId, sceneId);
    await seedExportStore(page, {
      jobsByTimelineId: {
        [timelineId]: {
          timelineId,
          requestId: "request-resume-needed",
          lifecycle: "submitted",
          handle: {
            provider: "backend_render",
            requestId: "request-resume-needed",
            jobId: "job-resume-needed",
            status: "submitted",
          },
          resumeState: "resume_needed",
        },
      },
      activeExportTimelineId: timelineId,
    });

    await gotoAppWithDiagnostics(page);
    await assertExportSeedDiagnostics(page, timelineId);

    await expect(page.getByTestId("timeline-export-panel")).toContainText(
      "Resumable export job found. Resume is not started yet.",
    );
  });

  test("resume_unavailable label renders truthfully", async ({ page }) => {
    const sceneId = "success-scene-a";
    const timelineId = "timeline-resume-unavailable";

    await seedSceneStore(page, [
      createScene({
        id: sceneId,
        lifecycle: "success",
        payload: {
          prompt: "Scene A",
          style: "cinematic",
          duration: 8,
        },
        progress: 100,
        result: {
          image: "https://example.com/a.png",
          variations: ["https://example.com/a-var.png"],
        },
      }),
    ]);

    await seedTimelineStore(page, timelineId, sceneId);
    await seedExportStore(page, {
      jobsByTimelineId: {
        [timelineId]: {
          timelineId,
          requestId: "request-resume-unavailable",
          lifecycle: "error",
          resumeState: "resume_unavailable",
          failure: {
            message: "Export job resume metadata is unavailable.",
            code: "export_resume_unavailable",
          },
        },
      },
      activeExportTimelineId: timelineId,
    });

    await gotoAppWithDiagnostics(page);
    await assertExportSeedDiagnostics(page, timelineId);

    await expect(page.getByTestId("timeline-export-panel")).toContainText(
      "Resume unavailable. Request export again.",
    );
  });

  test("expired label renders truthfully", async ({ page }) => {
    const sceneId = "success-scene-a";
    const timelineId = "timeline-expired";

    await seedSceneStore(page, [
      createScene({
        id: sceneId,
        lifecycle: "success",
        payload: {
          prompt: "Scene A",
          style: "cinematic",
          duration: 8,
        },
        progress: 100,
        result: {
          image: "https://example.com/a.png",
          variations: ["https://example.com/a-var.png"],
        },
      }),
    ]);

    await seedTimelineStore(page, timelineId, sceneId);
    await seedExportStore(page, {
      jobsByTimelineId: {
        [timelineId]: {
          timelineId,
          requestId: "request-expired",
          lifecycle: "expired",
          resumeState: "expired",
          failure: {
            message: "Export job has expired.",
            code: "export_job_expired",
          },
        },
      },
      activeExportTimelineId: timelineId,
    });

    await gotoAppWithDiagnostics(page);
    await assertExportSeedDiagnostics(page, timelineId);

    await expect(page.getByTestId("timeline-export-panel")).toContainText(
      "Export expired or timed out.",
    );
  });
});