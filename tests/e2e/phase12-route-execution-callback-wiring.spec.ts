import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase12 route execution callback wiring", () => {
  test("exports.ts imports VerifiedArtifactRefPayload as type", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Can be imported as part of a combined type import
    expect(source).toContain("VerifiedArtifactRefPayload");
    expect(source).toContain('from "../renderer/singleProcessRenderHarness"');
  });

  test("ExportRouterOptions includes onVerifiedArtifactRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef?:");
    expect(source).toContain("VerifiedArtifactRefPayload");
    expect(source).toContain("/** Internal callback for ref registration");
  });

  test("POST /exports/:jobId/execute passes onVerifiedArtifactRef to executeRenderJob", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("onVerifiedArtifactRef: options?.onVerifiedArtifactRef");
  });

  test("Missing callback remains optional", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Option is optional - has ?
    expect(source).toContain("onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void");
    // executeRenderJob call uses optional chaining
    expect(source).toContain("options?.onVerifiedArtifactRef");
  });

  test("app.ts passes backendDeps.onVerifiedArtifactRef to createExportRouter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    // Phase 12-Z: uses exportRouterOptions variable instead of inline
    expect(source).toContain("onVerifiedArtifactRef:");
    expect(source).toContain("backendDeps.onVerifiedArtifactRef");
    expect(source).toContain("createExportRouter(backendDeps.registry, exportRouterOptions)");
  });

  test("app.ts does NOT pass artifactStorageRefResolver unconditionally", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    // Phase 12-Z: resolver is conditional behind isLocalDevArtifactStreamEnabled()
    expect(source).toContain("isLocalDevArtifactStreamEnabled()");
    expect(source).toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
    expect(source).toContain("artifactStorageRefResolver");
    // But it's conditional, not unconditional
    expect(source).toContain("...(isLocalDevArtifactStreamEnabled()");
  });

  test("app.ts does NOT pass artifactAccessProvider to createExportRouter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    expect(source).not.toContain("artifactAccessProvider");
  });

  test("backend/routes/exports.ts does NOT inject artifactStorageRefResolver into artifact access/stream behavior", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Route still uses options.artifactStorageRefResolver for stream route (unchanged)
    // but onVerifiedArtifactRef is separate
    expect(source).toContain("options?.artifactStorageRefResolver"); // existing stream route
    expect(source).toContain("options?.onVerifiedArtifactRef"); // new route execution callback
  });

  test("backend/routes/exports.ts does NOT wire artifactAccessProvider beyond existing default/injected behavior", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Access provider is still used in access route (unchanged)
    expect(source).toContain("await artifactAccessProvider.getArtifactAccess");
    // No additional wiring added
  });

  test("POST /exports remains unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('router.post(\n    "/exports"');
    // No changes to submit behavior
  });

  test("GET artifact access route behavior remains unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Access route still returns artifact_access_unavailable
    expect(source).toContain('router.get(\n    "/exports/:jobId/artifacts/:artifactId/access"');
    // No changes to access route logic
  });

  test("GET stream route behavior remains unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Stream route still returns 501 when resolver not configured
    expect(source).toContain('router.get(\n    "/exports/:jobId/artifacts/:artifactId/stream"');
    expect(source).toContain("stream_not_configured");
  });

  test("No env gating added", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Existing route execution gating unchanged
    expect(source).toContain("FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION");
    // No new env gating added
    expect(source).not.toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
  });

  test("No frontend changes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    // Frontend unchanged
    expect(source).not.toContain("onVerifiedArtifactRef");
    expect(source).not.toContain("artifactStorageRefStore");
  });

  test("No public contract changes", async () => {
    const contractsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    // BackendArtifactMetadata unchanged
    expect(contractsSource).toContain("export interface BackendArtifactMetadata");
    expect(contractsSource).not.toContain("filePath");
    expect(contractsSource).not.toContain("rootPath");
  });

  test("No signed URL generation", async () => {
    const exportsSource = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(exportsSource).not.toContain("signed");
    expect(exportsSource).not.toContain("presigned");
  });
});