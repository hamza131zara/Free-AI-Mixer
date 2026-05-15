import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase9 artifact access contract boundary", () => {
  test("Contract source includes BackendArtifactAccessResponse", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).toContain("BackendArtifactAccessResponse");
  });

  test("Contract source includes artifact_access_ready", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).toContain('kind: "artifact_access_ready"');
  });

  test("Contract source includes artifact_access_unavailable", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).toContain('kind: "artifact_access_unavailable"');
  });

  test("Contract source includes safe access kinds only: signed_url, backend_stream, local_dev_stream", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).toContain('"signed_url"');
    expect(source).toContain('"backend_stream"');
    expect(source).toContain('"local_dev_stream"');
  });

  test("Contract source does not contain forbidden path fields: filePath, localPath, outputPath, absolutePath, filesystemPath", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).not.toContain("filePath");
    expect(source).not.toContain("localPath");
    expect(source).not.toContain("outputPath");
    expect(source).not.toContain("absolutePath");
    expect(source).not.toContain("filesystemPath");
  });

  test("Contract source does not add downloadUrl", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).not.toContain("downloadUrl");
  });

  test("BackendArtifactMetadata still does not include url/path fields", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    const artifactMetadataMatch = source.match(/export interface BackendArtifactMetadata\s*\{[^}]*\}/s);
    expect(artifactMetadataMatch).not.toBeNull();

    const interfaceBody = artifactMetadataMatch![0];
    expect(interfaceBody).not.toContain("url");
    expect(interfaceBody).not.toContain("path");
    expect(interfaceBody).not.toContain("filePath");
  });

  test("No backend route files changed in this phase", async () => {
    await fs.access(path.join(process.cwd(), "backend", "routes", "exports.ts"));
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).not.toContain("artifact_access");
    expect(source).not.toContain("BackendArtifactAccess");
  });

  test("No frontend files changed in this phase", async () => {
    const timelineExportSource = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(timelineExportSource).not.toContain("BackendArtifactAccess");
    expect(timelineExportSource).not.toContain("artifact_access");
  });

  test("No package/docs files changed in this phase", async () => {
    const packageJson = await fs.readFile(
      path.join(process.cwd(), "package.json"),
      "utf8",
    );

    expect(packageJson).not.toContain("artifact_access");
  });
});