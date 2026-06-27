import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const project = {
  projectId: "11111111-1111-4111-8111-111111111111",
  title: "Private Preview Project",
  status: "active",
  createdAt: "2026-06-21T01:00:00.000Z",
  updatedAt: "2026-06-21T01:00:00.000Z",
} as const;

const secondProject = {
  projectId: "22222222-2222-4222-8222-222222222222",
  title: "Second Project",
  status: "active",
  createdAt: "2026-06-21T02:00:00.000Z",
  updatedAt: "2026-06-21T02:00:00.000Z",
} as const;

const authSessionResponse = {
  kind: "authenticated_session",
  status: "authenticated",
  message: "Backend session verified.",
  identity: {
    userId: "safe-user",
    email: "private-beta@example.test",
    workspaceAuthority: "verified",
    workspaceRole: "workspace_owner",
  },
};

const projectLibraryResponse = {
  kind: "project_library",
  status: "authenticated",
  message: "Project library is available for this verified session.",
  activeWorkspaceId: "44444444-4444-4444-8444-444444444444",
  persistence: "durable",
  activeProjectPreference: { status: "ready", projectId: null },
  projects: [project, secondProject],
};

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/az7nWkAAAAASUVORK5CYII=",
  "base64",
);

type HistoryEntry = {
  artifactId: string;
  contentType: "image/png";
  createdAt: string;
  deliveryStatus: "unavailable";
  generationId: string;
  previewPath: string;
  projectId: string;
  promptSummary: string;
  providerId: "mock_local";
  requestId: string;
  sha256: string;
  sizeBytes: number;
};

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const safeHistoryResponse = (history: HistoryEntry[]) => ({
  kind: "generation_history",
  status: "authenticated",
  projectId: project.projectId,
  message: "Project-scoped durable image history loaded.",
  history,
});

const installProjectGenerationRoutes = async (page: Page) => {
  const generationBodies: unknown[] = [];
  const previewRequests: string[] = [];
  const historyEntries: HistoryEntry[] = [
    {
      artifactId: "artifact_existing_private_preview",
      contentType: "image/png",
      createdAt: "2026-06-21T03:00:00.000Z",
      deliveryStatus: "unavailable",
      generationId: "history-existing",
      previewPath: `/generation/jobs/history-existing/artifacts/artifact_existing_private_preview/preview?projectId=${project.projectId}`,
      projectId: project.projectId,
      promptSummary: "Previously generated private preview",
      providerId: "mock_local",
      requestId: "history-existing",
      sha256: "a".repeat(64),
      sizeBytes: pngBytes.length,
    },
  ];

  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (
      url.includes("api.openai.com") ||
      url.includes("generativelanguage.googleapis.com") ||
      url.includes("veo.googleapis.com") ||
      url.includes("runway") ||
      url.includes("pika") ||
      url.includes("supabase.co/storage") ||
      url.includes("stripe")
    ) {
      throw new Error(`Unexpected external call: ${url}`);
    }

    await route.continue();
  });

  await page.route("**/auth/session", async (route) => {
    await route.fulfill({
      body: JSON.stringify(authSessionResponse),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route("**/project-library/projects**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathParts = url.pathname.split("/").filter(Boolean);
    const projectId = pathParts.length === 3 ? pathParts[2] : undefined;

    if (request.method() === "GET" && !projectId) {
      await route.fulfill({
        body: JSON.stringify(projectLibraryResponse),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (request.method() === "GET" && projectId) {
      const matchedProject = [project, secondProject].find(
        (candidate) => candidate.projectId === projectId,
      );

      await route.fulfill({
        body: JSON.stringify(
          matchedProject
            ? {
                kind: "project_record",
                status: "loaded",
                project: matchedProject,
              }
            : {
                kind: "project_not_found",
                status: "not_found",
                message: "Project was not found for this workspace.",
              },
        ),
        contentType: "application/json",
        status: matchedProject ? 200 : 404,
      });
      return;
    }

    throw new Error(`Unexpected project request: ${request.method()} ${url.pathname}`);
  });

  await page.route("**/project-library/active-project", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { projectId?: string };
    const matchedProject = [project, secondProject].find(
      (candidate) => candidate.projectId === body.projectId,
    );

    await route.fulfill({
      body: JSON.stringify(
        matchedProject
          ? {
              kind: "active_project",
              status: "selected",
              activeProject: matchedProject,
            }
          : {
              kind: "project_not_found",
              status: "not_found",
              message: "Project was not found for this workspace.",
            },
      ),
      contentType: "application/json",
      status: matchedProject ? 200 : 404,
    });
  });

  await page.route("**/generation/history**", async (route) => {
    const url = new URL(route.request().url());

    if (route.request().method() !== "GET") {
      throw new Error(`Unexpected history method: ${route.request().method()}`);
    }

    if (url.searchParams.get("projectId") !== project.projectId) {
      await route.fulfill({
        body: JSON.stringify({
          kind: "generation_history_rejected",
          status: "invalid_project_id",
          message: "Generated image history requires a valid project.",
        }),
        contentType: "application/json",
        status: 400,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify(safeHistoryResponse(historyEntries)),
      contentType: "application/json",
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Expires: "0",
        Pragma: "no-cache",
      },
      status: 200,
    });
  });

  await page.route("**/generation/jobs", async (route) => {
    const request = route.request();

    if (request.method() !== "POST") {
      throw new Error(`Unexpected generation method: ${request.method()}`);
    }

    const body = request.postDataJSON() as Record<string, unknown>;
    generationBodies.push(body);

    if (body.projectId !== project.projectId) {
      await route.fulfill({
        body: JSON.stringify({
          kind: "generation_job_rejected",
          status: "invalid_project_id",
          message: "Generation requires a verified project.",
        }),
        contentType: "application/json",
        status: 400,
      });
      return;
    }

    if (
      typeof body.requestId !== "string" ||
      typeof body.prompt !== "string" ||
      body.generationKind !== "image" ||
      body.providerId !== "openai"
    ) {
      await route.fulfill({
        body: JSON.stringify({
          kind: "generation_job_rejected",
          status: "unsupported_generation_request",
          message: "Generation request is invalid.",
        }),
        contentType: "application/json",
        status: 400,
      });
      return;
    }

    const artifactId = "artifact_generated_private_preview";
    historyEntries.unshift({
      artifactId,
      contentType: "image/png",
      createdAt: "2026-06-21T04:00:00.000Z",
      deliveryStatus: "unavailable",
      generationId: artifactId,
      previewPath: `/generation/jobs/${body.requestId}/artifacts/${artifactId}/preview?projectId=${project.projectId}`,
      projectId: project.projectId,
      promptSummary: body.prompt,
      providerId: "mock_local",
      requestId: body.requestId,
      sha256: "b".repeat(64),
      sizeBytes: pngBytes.length,
    });

    await route.fulfill({
      body: JSON.stringify({
        kind: "generation_job_metadata_ready",
        status: "generated_metadata_ready",
        message: "Backend returned verified local artifact metadata.",
        artifact: {
          artifactId,
          providerId: "mock_local",
          contentType: "image/png",
          sizeBytes: pngBytes.length,
          sha256: "b".repeat(64),
          createdAt: "2026-06-21T04:00:00.000Z",
          deliveryStatus: "unavailable",
        },
        runtime: { vendorCallsEnabled: false },
        attemptedProviderIds: ["mock_local"],
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route("**/generation/jobs/*/artifacts/*/preview**", async (route) => {
    await fulfillPreview(route, previewRequests);
  });

  return { generationBodies, previewRequests };
};

const fulfillPreview = async (route: Route, previewRequests: string[]) => {
  const url = new URL(route.request().url());
  previewRequests.push(`${url.pathname}${url.search}`);

  if (url.searchParams.get("projectId") !== project.projectId) {
    await route.fulfill({
      body: JSON.stringify({
        kind: "generated_artifact_preview_unavailable",
        status: "invalid_project_id",
        deliveryStatus: "unavailable",
      }),
      contentType: "application/json",
      status: 404,
    });
    return;
  }

  await route.fulfill({
    body: pngBytes,
    contentType: "image/png",
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Expires: "0",
      Pragma: "no-cache",
    },
    status: 200,
  });
};

const expectNoUnsafeVisibleTokens = async (page: Page) => {
  const visibleText = await page.locator("body").innerText();
  const browserState = await page.evaluate(() =>
    JSON.stringify({
      localStorage: { ...window.localStorage },
      sessionStorage: { ...window.sessionStorage },
      url: window.location.href,
    }),
  );
  const combined = `${visibleText}\n${browserState}`;

  for (const forbidden of [
    "ownerId",
    "owner_id",
    "workspaceId",
    "workspace_id",
    "44444444-4444-4444-8444-444444444444",
    "Authorization",
    "Bearer ",
    "service-role",
    "service_role",
    "jwt",
    "database error",
    "PostgREST",
    "storageRef",
    "storage_ref",
    "internalRef",
    "localPath",
    "base64",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
  ]) {
    expect(combined).not.toContain(forbidden);
  }
};

const expectNoServerHistoryInLocalStorage = async (page: Page) => {
  const localStorageState = await page.evaluate(() =>
    JSON.stringify({ ...window.localStorage }),
  );

  for (const forbidden of [
    project.projectId,
    "history-existing",
    "artifact_existing_private_preview",
    "artifact_generated_private_preview",
    "/generation/jobs/",
    "previewPath",
    "Previously generated private preview",
    "A safe private beta mock image for the selected project.",
    "2026-06-21T03:00:00.000Z",
    "2026-06-21T04:00:00.000Z",
  ]) {
    expect(localStorageState).not.toContain(forbidden);
  }
};

test.describe("Hosted private beta H6-E mock image private preview history", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("scopes mock image generation and private previews to the selected project", async ({
    page,
  }) => {
    const { generationBodies, previewRequests } =
      await installProjectGenerationRoutes(page);

    await page.goto("/projects");
    const projectRow = page.locator("li").filter({ hasText: project.title });

    await projectRow.getByRole("button", { name: "Select" }).click();
    await expect(projectRow.getByRole("button", { name: "Selected" })).toBeVisible();
    await expect(page.getByTestId("project-selection-confirmation")).toContainText(
      `Selected project: ${project.title}`,
    );

    await page.getByRole("button", { name: "Use in Mixer" }).click();
    await expect(page).toHaveURL(new RegExp(`/mixer\\?projectId=${project.projectId}$`));
    await expect(page.getByTestId("mixer-project-context")).toContainText(
      `Verified project context: ${project.title}`,
    );
    await expect(page.getByTestId("prompt-image-project-state")).toContainText(
      `Project-scoped generation is enabled for ${project.title}.`,
    );
    await expect(page.getByTestId("prompt-image-history-status")).toContainText(
      "Project-scoped durable image history loaded.",
    );
    await expect(page.getByTestId("prompt-image-history-entry")).toContainText(
      "Previously generated private preview",
    );
    await expect(
      page.getByAltText("Backend-mediated generated image history preview"),
    ).toHaveAttribute("src", /^blob:/);

    await page
      .getByRole("textbox", { name: "Image prompt" })
      .fill("A safe private beta mock image for the selected project.");
    await page.getByRole("button", { name: "Generate Image" }).click();

    await expect(page.getByTestId("prompt-image-status")).toContainText(
      "Backend returned verified local artifact metadata.",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "mock_local",
    );
    await expect(
      page.getByAltText("Backend-mediated generated image preview"),
    ).toHaveAttribute("src", /^blob:/);
    await expect(page.getByTestId("prompt-image-history-entry").first()).toContainText(
      "A safe private beta mock image for the selected project.",
    );

    expect(generationBodies).toHaveLength(1);
    expect(generationBodies[0]).toMatchObject({
      generationKind: "image",
      projectId: project.projectId,
      providerId: "openai",
      prompt: "A safe private beta mock image for the selected project.",
    });
    expect(JSON.stringify(generationBodies[0])).not.toContain("workspaceId");
    expect(JSON.stringify(generationBodies[0])).not.toContain("ownerId");
    expect(previewRequests.every((request) => request.includes(project.projectId))).toBe(
      true,
    );

    await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
    await expectNoServerHistoryInLocalStorage(page);
    await expectNoUnsafeVisibleTokens(page);
  });

  test("blocks generation when the Mixer project context is missing or invalid", async ({
    page,
  }) => {
    await installProjectGenerationRoutes(page);

    await page.goto("/mixer");
    await expect(page.getByTestId("mixer-project-context")).toContainText(
      "Select a saved project before running hosted mock image generation.",
    );
    await expect(page.getByRole("button", { name: "Generate Image" })).toBeDisabled();

    await page.goto("/mixer?projectId=not-a-project");
    await expect(page.getByTestId("mixer-project-context")).toContainText(
      "The Mixer project link is invalid.",
    );
    await expect(page.getByRole("button", { name: "Generate Image" })).toBeDisabled();
    await expectNoUnsafeVisibleTokens(page);
  });

  test("keeps frontend preview/history calls backend-mediated and bearer-capable", () => {
    const generationRouteSource = readSource("backend/routes/generation.ts");
    const authenticatedFetchSource = readSource(
      "src/services/auth/authenticatedFetch.ts",
    );
    const imageServiceSource = readSource("src/services/imageGenerationService.ts");
    const generatorSource = readSource("src/components/PromptImageGenerator.tsx");
    const historySource = readSource("src/components/PromptImageHistory.tsx");
    const mixerSource = readSource("src/pages/MixerPage.tsx");
    const historyStoreSource = readSource("src/store/imageGenerationHistoryStore.ts");
    const combined = [
      generationRouteSource,
      authenticatedFetchSource,
      imageServiceSource,
      generatorSource,
      historySource,
      mixerSource,
      historyStoreSource,
    ].join("\n");
    const historyWriteProjectAssociations =
      generationRouteSource.match(/persistImageGenerationHistory\(\{[\s\S]*?projectId: input\.projectId/g) ??
      [];

    expect(historyWriteProjectAssociations).toHaveLength(2);
    expect(generationRouteSource).toContain(
      "Generated image history is temporarily unavailable.",
    );
    expect(generationRouteSource).toContain(
      "Generated artifact preview is temporarily unavailable.",
    );
    expect(generationRouteSource).toMatch(
      /catch \{[\s\S]*sendGenerationHistoryRejected\([\s\S]*"persistence_unavailable"[\s\S]*503/,
    );
    expect(generationRouteSource).toMatch(
      /catch \{[\s\S]*sendGeneratedArtifactAccessUnavailable\([\s\S]*"generated_artifact_access_unavailable"[\s\S]*503/,
    );
    expect(authenticatedFetchSource).toContain('"/generation/history"');
    expect(authenticatedFetchSource).toContain(
      "generatedImagePreviewPathPattern",
    );
    expect(imageServiceSource).toContain("fetchWithOptionalAccountBearer");
    expect(imageServiceSource).toContain("projectId");
    expect(imageServiceSource).toContain("fetchGeneratedImagePreviewBlob");
    expect(historyStoreSource).toContain("partialize");
    expect(historyStoreSource).toContain("entries: []");
    expect(historyStoreSource).toContain('historyStatus: "idle"');
    expect(historyStoreSource).not.toContain("sessionStorage");
    expect(generatorSource).not.toContain("src={artifact.previewPath}");
    expect(historySource).not.toContain("src={previewPath}");
    expect(combined).not.toContain(".storage.from(");
    expect(combined).not.toContain("supabase.storage");
    expect(combined).not.toContain("createSignedUrl(");
    expect(combined).not.toContain("getPublicUrl(");
    expect(combined).not.toContain("downloadUrl");
    expect(combined).not.toContain("signedUrl");
    expect(combined).not.toContain("publicUrl");
    expect(combined).not.toContain("service_role");
    expect(combined).not.toContain("service-role");
  });
});
