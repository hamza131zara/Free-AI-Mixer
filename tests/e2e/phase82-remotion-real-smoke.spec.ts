import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRenderInputSnapshot } from "../../backend/contracts/renderInputSnapshot";
import { verifyRenderedArtifact } from "../../backend/renderer/artifactVerification";
import {
  FREE_MIXER_COMPOSITION_ID,
  toFreeMixerCompositionProps,
} from "../../backend/renderer/compositions/compositionProps";
import {
  resolveRenderOutputPath,
  type RenderOutputPathPolicy,
} from "../../backend/renderer/outputPathPolicy";
import {
  runRealRemotionSmokeTestOnly,
  type RealRemotionSmokeInput,
} from "../../backend/renderer/remotionRuntime";

const REAL_SMOKE_ENV = "FREE_AI_MIXER_RUN_REAL_RENDER_SMOKE";

const rmWithRetries = async (targetPath: string, retries = 5): Promise<void> => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
};

const isInsideDirectory = (parentPath: string, childPath: string): boolean => {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
};

const getSafeFailureField = (
  failure: unknown,
  fieldName: string,
): string => {
  const failureRecord = failure as Record<string, unknown>;
  const details =
    failureRecord.details && typeof failureRecord.details === "object"
      ? (failureRecord.details as Record<string, unknown>)
      : {};

  const value = failureRecord[fieldName] ?? details[fieldName] ?? "unavailable";
  return String(value);
};

const buildSnapshot = () =>
  createRenderInputSnapshot({
    jobId: "phase82-job",
    timelineId: "phase82-timeline",
    renderSettings: {
      format: "mp4",
      resolution: "720p",
      fps: 24,
      quality: "draft",
    },
    timelineSnapshot: {
      timelineId: "phase82-timeline",
      clips: [
        {
          clipId: "clip-1",
          sceneRefId: "scene-1",
          startMs: 0,
          durationMs: 500,
          order: 0,
        },
      ],
    },
    sceneRefs: [{ sceneId: "scene-1" }],
    mediaRefs: [],
    outputTarget: {
      jobFolderKey: "phase82_job",
      artifactBaseName: "smoke_output",
      format: "mp4",
    },
  });

test.describe("phase82 controlled real remotion render smoke", () => {
  test("runtime and composition boundaries remain backend-only and non-lifecycle-mutating", async () => {
    const runtimeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRuntime.ts"),
      "utf8",
    );
    const entrySource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/compositions/remotionEntry.tsx"),
      "utf8",
    );
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    expect(runtimeSource).not.toContain("markSuccess(");
    expect(runtimeSource).not.toContain("markError(");
    expect(entrySource).not.toContain("markSuccess(");
    expect(entrySource).not.toContain("markError(");
    expect(routeSource).not.toContain("executeSingleProcessRender");
    expect(routeSource).not.toContain("runRealRemotionSmokeTestOnly");
  });

  test("real remotion smoke is opt-in and verifies a real output artifact", async () => {
    test.setTimeout(240000);

    test.skip(
      process.env[REAL_SMOKE_ENV] !== "1",
      `Set ${REAL_SMOKE_ENV}=1 to run the real Remotion smoke test.`,
    );

    const snapshot = buildSnapshot();
    const baseProps = toFreeMixerCompositionProps(snapshot);

    const compositionProps = {
      ...baseProps,
      width: 64,
      height: 64,
      fps: 6,
      totalDurationMs: 100,
      clips: baseProps.clips.map((clip, index) => ({
        ...clip,
        startMs: index === 0 ? 0 : clip.startMs,
        durationMs: 100,
      })),
    };

    const tempRoot = path.resolve(os.tmpdir(), "free-ai-mixer-phase82");
    const policy: RenderOutputPathPolicy = {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    };

    const resolvedOutputPath = resolveRenderOutputPath(policy, {
      rootKey: "output",
      jobId: snapshot.outputTarget.jobFolderKey,
      baseName: snapshot.outputTarget.artifactBaseName,
      extension: snapshot.outputTarget.format,
    });

    await fs.mkdir(resolvedOutputPath.directoryPath, { recursive: true });

    const smokeInput: RealRemotionSmokeInput = {
      entryPoint: path.resolve(
        process.cwd(),
        "backend/renderer/compositions/remotionEntry.tsx",
      ),
      compositionId: FREE_MIXER_COMPOSITION_ID,
      inputProps: compositionProps,
      outputLocation: resolvedOutputPath.filePath,
      codec: "h264",
      timeoutInMilliseconds: 180000,
      bundleTimeoutMs: 60000,
      selectCompositionTimeoutMs: 90000,
      renderMediaTimeoutMs: 90000,
      logLevel: "error",
    };

    try {
      console.info("[phase82] starting real smoke: bundle/select/render");

      const smokeResult = await runRealRemotionSmokeTestOnly(smokeInput);

      if (!smokeResult.ok) {
        const safeCauseName = getSafeFailureField(
          smokeResult.failure,
          "safeCauseName",
        );
        const safeCauseSummary = getSafeFailureField(
          smokeResult.failure,
          "safeCauseSummary",
        );

        throw new Error(
          `[phase82] real smoke failed safely: stage=${smokeResult.failure.stage}; code=${smokeResult.failure.code}; message=${smokeResult.failure.message}; retryable=${smokeResult.failure.retryable}; safeCauseName=${safeCauseName}; safeCauseSummary=${safeCauseSummary}`,
        );
      }

      expect(smokeResult.ok).toBe(true);
      expect(isInsideDirectory(tempRoot, resolvedOutputPath.filePath)).toBe(true);

      console.info("[phase82] render completed, starting artifact verification");

      const verification = await Promise.race([
        verifyRenderedArtifact({
          artifactId: "artifact-phase82",
          jobId: snapshot.jobId,
          kind: "render_output",
          expectedFormat: snapshot.outputTarget.format,
          resolvedOutputPath,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("artifact verification timed out")), 20000);
        }),
      ]);

      expect(verification.ok).toBe(true);

      if (!verification.ok) {
        throw new Error(verification.error.message);
      }

      const artifactRecord = verification.artifact as unknown as Record<string, unknown>;

      expect(artifactRecord.path).toBeUndefined();
      expect(artifactRecord.filePath).toBeUndefined();
      expect(artifactRecord.localPath).toBeUndefined();
      expect(artifactRecord.url).toBeUndefined();
      expect(artifactRecord.downloadUrl).toBeUndefined();
      expect(artifactRecord.publicUrl).toBeUndefined();
      expect(artifactRecord.signedUrl).toBeUndefined();
      expect(verification.artifact.status).toBe("available");

      console.info("[phase82] artifact verification completed");
    } finally {
      await rmWithRetries(tempRoot);
    }
  });
});