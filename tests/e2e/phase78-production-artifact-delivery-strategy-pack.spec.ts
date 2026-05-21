import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

type ExportStoreModule = typeof import("../../src/store/exportStore");

const exportHttpTypesPath = path.join(
  process.cwd(),
  "backend",
  "contracts",
  "exportHttpTypes.ts",
);
const routesPath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const artifactAccessProviderPath = path.join(
  process.cwd(),
  "backend",
  "artifacts",
  "artifactAccessProvider.ts",
);
const localDevProviderPath = path.join(
  process.cwd(),
  "backend",
  "artifacts",
  "localDevArtifactAccessProvider.ts",
);
const notConfiguredProviderPath = path.join(
  process.cwd(),
  "backend",
  "artifacts",
  "notConfiguredArtifactAccessProvider.ts",
);
const repositoryContractsPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "repositoryContracts.ts",
);
const supabaseRepoPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "supabaseExportJobsRepository.ts",
);
const exportServicePath = path.join(
  process.cwd(),
  "src",
  "services",
  "exportService.ts",
);
const exportStorePath = path.join(process.cwd(), "src", "store", "exportStore.ts");
const exportTypesPath = path.join(process.cwd(), "src", "types", "exportJob.ts");
const timelineExportPanelPath = path.join(
  process.cwd(),
  "src",
  "components",
  "TimelineExportPanel.tsx",
);

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const setUpWindowForStores = (): MemoryStorage => {
  const storage = new MemoryStorage();
  const win = {
    localStorage: storage,
    setTimeout,
    clearTimeout,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    __FREE_AI_MIXER_RUNTIME_CONFIG__: {
      exportBaseUrl: "https://example.com",
      exportArtifactsPath: "/exports",
      exportPollPath: "/exports",
      exportSubmitPath: "/exports",
    },
  };

  Object.assign(globalThis, {
    window: win,
    localStorage: storage,
  });

  return storage;
};

const withMockedFetch = async (
  callback: () => Promise<void>,
  implementation: (...args: Parameters<typeof fetch>) => Response | Promise<Response>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args) => implementation(...args)) as typeof fetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const getExportStore = async (): Promise<ExportStoreModule["useExportStore"]> => {
  const storeModule = (await import("../../src/store/exportStore")) as ExportStoreModule;
  return storeModule.useExportStore;
};

const resetExportStore = async (): Promise<void> => {
  const store = await getExportStore();
  store.setState({
    hasHydrated: true,
    hydrationError: undefined,
    jobsByTimelineId: {},
    activeExportTimelineId: undefined,
    isSubmittingByTimelineId: {},
    isResolvingByTimelineId: {},
  });
};

test.describe("phase78 production artifact delivery strategy pack", () => {
  test.beforeEach(async () => {
    setUpWindowForStores();
    await resetExportStore();
  });

  test("frontend keeps artifact metadata safe and artifact access backend-mediated without direct storage access", async () => {
    const store = await getExportStore();
    const timelineId = "timeline-phase78";
    store.setState({
      jobsByTimelineId: {
        [timelineId]: {
          timelineId,
          requestId: "request-phase78",
          lifecycle: "success",
          result: {
            provider: "backend_render",
            requestId: "request-phase78",
            jobId: "job-phase78",
            artifacts: [
              {
                id: "artifact-phase78",
                status: "ready",
                bytes: 4096,
                metadata: { durationMs: 2000 },
              },
            ],
          },
          resumeState: "none",
        },
      },
    });

    const artifact = store.getState().jobsByTimelineId[timelineId]?.result?.artifacts[0] as
      | Record<string, unknown>
      | undefined;

    expect(artifact?.url).toBeUndefined();
    expect(artifact?.downloadUrl).toBeUndefined();
    expect(artifact?.signedUrl).toBeUndefined();
    expect(artifact?.storageRef).toBeUndefined();
    expect(artifact?.filePath).toBeUndefined();
    expect(artifact?.path).toBeUndefined();
    expect(JSON.stringify(artifact)).not.toContain("\\");

    let requestedUrl: string | undefined;

    await withMockedFetch(async () => {
      const access = await store
        .getState()
        .requestExportArtifactAccess(timelineId, "artifact-phase78");

      expect(requestedUrl).toBe(
        "https://example.com/exports/job-phase78/artifacts/artifact-phase78/access",
      );
      expect(access?.status).toBe("ready");
      if (!access || access.status !== "ready") {
        return;
      }

      expect(access.access.kind).toBe("local_dev_stream");
      expect(access.access.url).toBe(
        "/exports/job-phase78/artifacts/artifact-phase78/stream",
      );
      expect((access.access as Record<string, unknown>).signedUrl).toBeUndefined();
      expect((access.access as Record<string, unknown>).downloadUrl).toBeUndefined();
      expect((access.access as Record<string, unknown>).storageRef).toBeUndefined();
      expect((access.access as Record<string, unknown>).filePath).toBeUndefined();
      expect(access.access.url?.startsWith("/exports/")).toBeTruthy();
    }, async (...args) => {
      requestedUrl = String(args[0]);

      return new Response(
        JSON.stringify({
          kind: "artifact_access_ready",
          artifact: {
            id: "artifact-phase78",
            status: "ready",
            bytes: 4096,
            metadata: { durationMs: 2000 },
          },
          access: {
            kind: "local_dev_stream",
            artifactId: "artifact-phase78",
            jobId: "job-phase78",
            url: "/exports/job-phase78/artifacts/artifact-phase78/stream",
            method: "GET",
            sizeBytes: 4096,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
  });

  test("source keeps production artifact delivery deferred behind safe backend-mediated contracts", async () => {
    const [
      exportHttpTypesSource,
      routesSource,
      artifactAccessProviderSource,
      localDevProviderSource,
      notConfiguredProviderSource,
      repositoryContractsSource,
      supabaseRepoSource,
      exportServiceSource,
      exportStoreSource,
      exportTypesSource,
      timelineExportPanelSource,
    ] = await Promise.all([
      fs.readFile(exportHttpTypesPath, "utf8"),
      fs.readFile(routesPath, "utf8"),
      fs.readFile(artifactAccessProviderPath, "utf8"),
      fs.readFile(localDevProviderPath, "utf8"),
      fs.readFile(notConfiguredProviderPath, "utf8"),
      fs.readFile(repositoryContractsPath, "utf8"),
      fs.readFile(supabaseRepoPath, "utf8"),
      fs.readFile(exportServicePath, "utf8"),
      fs.readFile(exportStorePath, "utf8"),
      fs.readFile(exportTypesPath, "utf8"),
      fs.readFile(timelineExportPanelPath, "utf8"),
    ]);

    expect(exportHttpTypesSource).toContain('"signed_url"');
    expect(exportHttpTypesSource).toContain('"backend_stream"');
    expect(exportHttpTypesSource).toContain('"local_dev_stream"');
    expect(exportHttpTypesSource).not.toContain("downloadUrl");

    const artifactMetadataMatch = exportHttpTypesSource.match(
      /export interface BackendArtifactMetadata\s*\{[^}]*\}/s,
    );
    expect(artifactMetadataMatch).not.toBeNull();
    const artifactMetadataBody = artifactMetadataMatch?.[0] ?? "";
    expect(artifactMetadataBody).not.toContain("url");
    expect(artifactMetadataBody).not.toContain("filePath");
    expect(artifactMetadataBody).not.toContain("path");
    expect(artifactMetadataBody).not.toContain("storageRef");

    expect(artifactAccessProviderSource).toContain(
  "Never expose local filesystem paths in responses.",
);
    expect(localDevProviderSource).toContain('kind: "local_dev_stream"');
    expect(localDevProviderSource).toContain(
      "Must never return filePath/rootPath/directoryPath in response",
    );
    expect(localDevProviderSource).not.toContain("getSignedUrl");
    expect(localDevProviderSource).not.toContain("presign");
    expect(notConfiguredProviderSource).toContain(
      'reason: "artifact_access_not_configured"',
    );

    expect(routesSource).toContain("artifactAccessProvider.getArtifactAccess");
    expect(routesSource).toContain("requesterContextResolver");
    expect(routesSource).toContain("registry.getByIdForOwner");
    expect(routesSource).not.toContain("getSignedUrl");
    expect(routesSource).not.toContain("presign");

    expect(repositoryContractsSource).toContain("BackendSignedUrlReadiness");
    expect(repositoryContractsSource).toContain('"requires_authorization"');
    expect(repositoryContractsSource).toContain("BackendArtifactAccessReadinessRecord");
    expect(supabaseRepoSource).not.toContain("signed_url");
    expect(supabaseRepoSource).not.toContain("getSignedUrl");
    expect(supabaseRepoSource).not.toContain("presign");

    expect(exportServiceSource).not.toContain("@supabase");
    expect(exportServiceSource).not.toContain("createClient");
    expect(exportStoreSource).not.toContain("@supabase");
    expect(exportStoreSource).not.toContain("createClient");
    expect(exportTypesSource).not.toContain("downloadUrl");
    expect(exportTypesSource).not.toContain("filePath");
    expect(exportTypesSource).not.toContain("storageRef");

    expect(timelineExportPanelSource).not.toContain("window.open");
    expect(timelineExportPanelSource).not.toContain("createObjectURL");
    expect(timelineExportPanelSource).not.toContain("download=");
    expect(timelineExportPanelSource).not.toContain("Download artifact");
    expect(timelineExportPanelSource).toContain("Check artifact access");
  });
});
