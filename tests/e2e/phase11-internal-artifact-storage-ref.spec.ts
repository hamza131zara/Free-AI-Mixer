import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase11 internal artifact storage ref boundary", () => {
  test("internalArtifactStorageRef.ts exists", async () => {
    await fs.access(
      path.join(process.cwd(), "backend", "artifacts", "internalArtifactStorageRef.ts"),
    );
  });

  test("source defines InternalArtifactStorageRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "internalArtifactStorageRef.ts"),
      "utf8",
    );

    expect(source).toContain("export interface InternalArtifactStorageRef");
  });

  test("source includes filePath, rootPath, jobSegment, directoryPath", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "internalArtifactStorageRef.ts"),
      "utf8",
    );

    expect(source).toContain("filePath: string");
    expect(source).toContain("rootPath: string");
    expect(source).toContain("jobSegment: string");
    expect(source).toContain("directoryPath: string");
  });

  test("source includes internal-only safety comments", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "internalArtifactStorageRef.ts"),
      "utf8",
    );

    expect(source).toContain("INTERNAL ONLY");
    expect(source).toContain("exported from backend/contracts/exportHttpTypes.ts");
    expect(source).toContain("returned to frontend");
    expect(source).toContain("stored in BackendArtifactMetadata");
  });

  test("backend/contracts/exportHttpTypes.ts does NOT import or mention InternalArtifactStorageRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).not.toContain("InternalArtifactStorageRef");
    expect(source).not.toContain("internalArtifactStorageRef");
  });

  test("BackendArtifactMetadata still does NOT include path/storage fields", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    const artifactMetadataMatch = source.match(/export interface BackendArtifactMetadata\s*\{[^}]*\}/s);
    expect(artifactMetadataMatch).not.toBeNull();

    const interfaceBody = artifactMetadataMatch![0];
    expect(interfaceBody).not.toContain("filePath");
    expect(interfaceBody).not.toContain("localPath");
    expect(interfaceBody).not.toContain("outputPath");
    expect(interfaceBody).not.toContain("absolutePath");
    expect(interfaceBody).not.toContain("filesystemPath");
    expect(interfaceBody).not.toContain("storageKey");
    expect(interfaceBody).not.toContain("rootPath");
    expect(interfaceBody).not.toContain("directoryPath");
  });

  test("backend/routes/exports.ts does NOT import InternalArtifactStorageRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).not.toContain("InternalArtifactStorageRef");
    expect(source).not.toContain("internalArtifactStorageRef");
  });

  test("backend/registry files do NOT import InternalArtifactStorageRef", async () => {
    const registryFiles = ["inMemoryExportJobRegistry.ts", "exportJobRegistry.ts"];

    for (const file of registryFiles) {
      const filePath = path.join(process.cwd(), "backend", "registry", file);
      try {
        const source = await fs.readFile(filePath, "utf8");
        expect(source).not.toContain("InternalArtifactStorageRef");
        expect(source).not.toContain("internalArtifactStorageRef");
      } catch {
        // File may not exist, skip
      }
    }
  });

  test("no provider implementation was added in backend/artifacts using local dev stream", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "internalArtifactStorageRef.ts"),
      "utf8",
    );

    expect(source).not.toContain("local_dev_stream");
    expect(source).not.toContain("createLocalDevArtifactAccessProvider");
    expect(source).not.toContain("getArtifactAccess");
    expect(source).not.toContain("ArtifactAccessProvider");
  });

  test("no frontend files changed", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("InternalArtifactStorageRef");
    expect(source).not.toContain("internalArtifactStorageRef");
  });
});