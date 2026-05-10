import { expect, test } from "@playwright/test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../backend/app";
import type { TimelineExportRequest } from "../../src/types/exportJob";

type RuntimeConfig = {
  exportBaseUrl?: string;
  exportSubmitPath?: string;
  exportPollPath?: string;
  exportArtifactsPath?: string;
};

type ExportServiceModule = typeof import("../../src/services/exportService");

let server: Server;
let baseUrl: string;

const createRequest = (requestId: string): TimelineExportRequest => ({
  requestId,
  timelineId: "timeline-phase63",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  requestedAt: new Date().toISOString(),
});

const setRuntimeConfig = (config: RuntimeConfig): void => {
  Object.assign(globalThis, {
    window: {
      __FREE_AI_MIXER_RUNTIME_CONFIG__: config,
    },
  });
};

test.beforeAll(async () => {
  const app = createApp();

  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test.beforeEach(() => {
  setRuntimeConfig({
    exportBaseUrl: baseUrl,
    exportSubmitPath: "/exports",
    exportPollPath: "/exports",
    exportArtifactsPath: "/exports",
  });
});
test.afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});
// test.afterEach(() => {
//   const globalWithWindow = globalThis as typeof globalThis & {
//     window?: { __FREE_AI_MIXER_RUNTIME_CONFIG__?: RuntimeConfig };
//   };

//   delete globalWithWindow.window;
// });

const loadServiceModule = async (
  cacheKey: string,
): Promise<ExportServiceModule> => {
  const servicePath = new URL(
    `../../src/services/exportService.ts?phase63=${encodeURIComponent(
      cacheKey,
    )}-${Date.now()}-${Math.random()}`,
    import.meta.url,
  ).href;

  return (await import(servicePath)) as ExportServiceModule;
};

test.describe("Phase 6.3 frontend-backend local integration support", () => {
  test("exportService submit + poll aligns with backend /exports route shape", async () => {
    const serviceModule = await loadServiceModule("submit-poll");

    const submitResult = await serviceModule.submitExportJob(
      createRequest("request-phase63-submit"),
    );

    if (submitResult.kind === "failure") {
      throw new Error(
        `submitExportJob failed unexpectedly: ${
          submitResult.failure.code ?? "unknown"
        } - ${submitResult.failure.message}`,
      );
    }

    expect(submitResult.kind).toBe("accepted_job");

    if (submitResult.kind !== "accepted_job") {
      return;
    }

    expect(submitResult.handle.status).toBe("submitted");

    const pollResult = await serviceModule.pollExportJob(submitResult.handle);

    expect(pollResult.kind).toBe("pending");
    expect(pollResult).not.toHaveProperty("result");
    expect(pollResult).not.toHaveProperty("artifacts");
    expect(pollResult).not.toHaveProperty("downloadUrl");
    expect(pollResult).not.toHaveProperty("progress");
  });

  test("exportService artifacts request receives export_artifacts_unavailable truthfully", async () => {
    const serviceModule = await loadServiceModule("artifacts");

    const submitResult = await serviceModule.submitExportJob(
      createRequest("request-phase63-artifacts"),
    );

    if (submitResult.kind === "failure") {
      throw new Error(
        `submitExportJob failed unexpectedly: ${
          submitResult.failure.code ?? "unknown"
        } - ${submitResult.failure.message}`,
      );
    }

    expect(submitResult.kind).toBe("accepted_job");

    if (submitResult.kind !== "accepted_job") {
      return;
    }

    const artifactsResult = await serviceModule.getExportArtifactInfo(
      submitResult.handle,
    );

    expect(artifactsResult.kind).toBe("failure");

    if (artifactsResult.kind !== "failure") {
      return;
    }

    expect(artifactsResult.failure.code).toBe("export_artifacts_unavailable");
    expect(artifactsResult).not.toHaveProperty("artifacts");
    expect(
      (artifactsResult as unknown as Record<string, unknown>).downloadUrl,
    ).toBeUndefined();
  });

  test("exportService repeated polling over backend pending does not fabricate success", async () => {
    const serviceModule = await loadServiceModule("service-pending-loop");

    const submitResult = await serviceModule.submitExportJob(
      createRequest("request-phase63-service-pending-loop"),
    );

    if (submitResult.kind === "failure") {
      throw new Error(
        `submitExportJob failed unexpectedly: ${
          submitResult.failure.code ?? "unknown"
        } - ${submitResult.failure.message}`,
      );
    }

    expect(submitResult.kind).toBe("accepted_job");

    if (submitResult.kind !== "accepted_job") {
      return;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const pollResult = await serviceModule.pollExportJob(submitResult.handle);

      expect(pollResult.kind).toBe("pending");
      expect(pollResult).not.toHaveProperty("result");
      expect(pollResult).not.toHaveProperty("artifacts");
      expect(pollResult).not.toHaveProperty("downloadUrl");
      expect(pollResult).not.toHaveProperty("progress");
    }
  });

  test("missing-config behavior remains truthful", async () => {
    setRuntimeConfig({
      exportBaseUrl: "",
      exportSubmitPath: "/exports",
      exportPollPath: "/exports",
      exportArtifactsPath: "/exports",
    });

    const freshServiceModule = await loadServiceModule("missing-config");

    const result = await freshServiceModule.submitExportJob(
      createRequest("request-phase63-missing-config"),
    );

    expect(result.kind).toBe("failure");

    if (result.kind !== "failure") {
      return;
    }

    expect(result.failure.code).toBe("missing_export_api_base_url");
  });
});