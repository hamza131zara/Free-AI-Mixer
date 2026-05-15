import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase9 artifact access provider boundary", () => {
  test("artifactAccessProvider.ts exists", async () => {
    await fs.access(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
    );
  });

  test("source defines ArtifactAccessRequest", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).toContain("export interface ArtifactAccessRequest");
    expect(source).toContain("jobId");
    expect(source).toContain("artifactId");
  });

  test("source defines ArtifactAccessProvider", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).toContain("export interface ArtifactAccessProvider");
    expect(source).toContain("getArtifactAccess");
  });

  test("source defines getArtifactAccess", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).toContain("getArtifactAccess");
    expect(source).toContain("Promise<BackendArtifactAccessResponse>");
  });

  test("source references BackendArtifactAccessResponse", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).toContain("BackendArtifactAccessResponse");
  });

  test("source does not contain forbidden path/storage fields", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("filePath");
    expect(source).not.toContain("localPath");
    expect(source).not.toContain("outputPath");
    expect(source).not.toContain("absolutePath");
    expect(source).not.toContain("filesystemPath");
    expect(source).not.toContain("storageKey");
    expect(source).not.toContain("downloadUrl");
  });

  test("source does not import backend/renderer", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/renderer");
  });

  test("source does not import backend/routes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/routes");
  });

  test("source does not contain signed URL generation code", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("sign");
    expect(source).not.toContain("SignedURL");
    expect(source).not.toContain("s3");
    expect(source).not.toContain("r2");
  });

  test("source does not contain local file serving code", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactAccessProvider.ts"),
      "utf8",
    );

    expect(source).not.toContain("createReadStream");
    expect(source).not.toContain("serveStatic");
    expect(source).not.toContain("express.static");
    expect(source).not.toContain("sendFile");
  });

  test("backend/routes/exports.ts remains unchanged by this phase", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).not.toContain("ArtifactAccessProvider");
    expect(source).not.toContain("artifactAccessProvider");
  });

  test("no frontend files changed in this phase", async () => {
    const timelineExportSource = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(timelineExportSource).not.toContain("ArtifactAccessProvider");
  });

  test("backend/contracts/exportHttpTypes.ts remains unchanged in this phase", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    // Should still not have url/path fields in BackendArtifactMetadata
    const artifactMetadataMatch = source.match(/export interface BackendArtifactMetadata\s*\{[^}]*\}/s);
    expect(artifactMetadataMatch).not.toBeNull();

    const interfaceBody = artifactMetadataMatch![0];
    expect(interfaceBody).not.toContain("storageKey");
  });
});