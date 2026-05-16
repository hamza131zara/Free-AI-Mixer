import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase11 artifact storage ref resolver boundary", () => {
  test("artifactStorageRefResolver.ts exists", async () => {
    await fs.access(
      path.join(process.cwd(), "backend", "artifacts", "artifactStorageRefResolver.ts"),
    );
  });

  test("source defines ArtifactStorageRefResolver", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactStorageRefResolver.ts"),
      "utf8",
    );

    expect(source).toContain("export interface ArtifactStorageRefResolver");
  });

  test("source defines resolve(jobId, artifactId)", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactStorageRefResolver.ts"),
      "utf8",
    );

    expect(source).toContain("resolve(");
    expect(source).toContain("jobId: string");
    expect(source).toContain("artifactId: string");
  });

  test("source references InternalArtifactStorageRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactStorageRefResolver.ts"),
      "utf8",
    );

    expect(source).toContain("InternalArtifactStorageRef");
  });

  test("source includes internal-only safety comments", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactStorageRefResolver.ts"),
      "utf8",
    );

    expect(source).toContain("INTERNAL ONLY");
    expect(source).toContain("exported from public contracts");
    expect(source).toContain("return data to frontend directly");
  });

  test("source does not import fs/path", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactStorageRefResolver.ts"),
      "utf8",
    );

    expect(source).not.toContain("from \"node:fs\"");
    expect(source).not.toContain("from \"node:path\"");
  });

  test("source does not import backend/routes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactStorageRefResolver.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/routes");
    expect(source).not.toContain("../routes");
  });

  test("source does not import backend/renderer", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "artifactStorageRefResolver.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/renderer");
    expect(source).not.toContain("../renderer");
  });

  test("backend/routes/exports.ts includes optional artifactStorageRefResolver option", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("artifactStorageRefResolver?: ArtifactStorageRefResolver");
  });

  test("backend/routes/exports.ts does NOT add /stream route", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).not.toContain("/artifacts/:artifactId/stream");
    expect(source).not.toContain("/stream");
  });

  test("backend/routes/exports.ts does NOT import fs/path", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).not.toContain("from \"node:fs\"");
    expect(source).not.toContain("from \"node:path\"");
  });

  test("backend/contracts/exportHttpTypes.ts does NOT mention ArtifactStorageRefResolver", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).not.toContain("ArtifactStorageRefResolver");
  });

  test("frontend files unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("ArtifactStorageRefResolver");
  });

  test("no stream route or file serving code exists", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).not.toContain("createReadStream");
    expect(source).not.toContain("sendFile");
    // Check for actual stream route path, not just the word "stream" in comments
    expect(source).not.toContain('"/exports/:jobId/artifacts/:artifactId/stream"');
    expect(source).not.toContain("download");
  });
});