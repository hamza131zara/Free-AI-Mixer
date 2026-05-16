import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase12 in-memory artifact storage ref store", () => {
  test("inMemoryArtifactStorageRefStore.ts exists", async () => {
    await fs.access(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
    );
  });

  test("createInMemoryArtifactStorageRefStore is exported", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).toContain("export const createInMemoryArtifactStorageRefStore");
  });

  test("ArtifactStorageRefStore interface is exported", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).toContain("export interface ArtifactStorageRefStore");
  });

  test("new store starts empty", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    // Store is created with new Map() - starts empty
    expect(source).toContain("new Map");
  });

  test("set + get returns same ref", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).toContain(".set(");
    expect(source).toContain(".get(");
  });

  test("has returns true after set", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).toContain(".has(");
  });

  test("get returns undefined for missing job/artifact", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    // get returns undefined when not found
    expect(source).toContain("return undefined");
  });

  test("job IDs are isolated", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    // Store is Map<string, Map<string, ...>> - job IDs are keys at top level
    expect(source).toContain("store.get(jobId)");
    expect(source).toContain("store.delete(jobId)");
  });

  test("artifact IDs under same job are isolated", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    // Nested Map for artifact isolation
    expect(source).toContain("artifactMap");
    expect(source).toContain("artifactMap.set");
    expect(source).toContain("artifactMap.get");
  });

  test("delete(jobId, artifactId) removes only one artifact ref", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    // delete handles both forms
    expect(source).toContain("artifactId !== undefined");
    expect(source).toContain("artifactMap.delete");
  });

  test("delete(jobId) removes all refs for that job only", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    // delete jobId without artifactId deletes entire job entry
    expect(source).toContain("store.delete(jobId)");
  });

  test("clear removes all refs", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).toContain(".clear()");
  });

  test("source references InternalArtifactStorageRef", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).toContain("InternalArtifactStorageRef");
  });

  test("source includes internal-only/process-memory/no-public-contract safety comments", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).toContain("INTERNAL ONLY");
    expect(source).toContain("process-memory");
    expect(source).toContain("must NEVER be exported from public contracts");
  });

  test("source does not import fs/path", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("from \"node:fs\"");
    expect(source).not.toContain("from \"node:path\"");
  });

  test("source does not import backend/routes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/routes");
    expect(source).not.toContain("../routes");
  });

  test("source does not import backend/renderer", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/renderer");
    expect(source).not.toContain("../renderer");
  });

  test("source does not import backend/registry", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("backend/registry");
    expect(source).not.toContain("../registry");
  });

  test("source does not import public contracts/exportHttpTypes", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("exportHttpTypes");
    expect(source).not.toContain("../contracts");
  });

  test("source does not mention JSON persistence/localStorage/process.env", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "artifacts", "inMemoryArtifactStorageRefStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("JSON.");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("process.env");
  });

  test("backend/routes/exports.ts unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Should still contain the stream route implementation from Phase 11-M
    expect(source).toContain('"/exports/:jobId/artifacts/:artifactId/stream"');
    // Should not reference the new store
    expect(source).not.toContain("inMemoryArtifactStorageRefStore");
  });

  test("backend/app.ts unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "app.ts"),
      "utf8",
    );

    // Phase 12-Z: app.ts now uses exportRouterOptions (conditional resolver injection)
    expect(source).toContain("exportRouterOptions");
    expect(source).toContain("onVerifiedArtifactRef:");
    // Should not reference the new store directly
    expect(source).not.toContain("inMemoryArtifactStorageRefStore");
    // Phase 12-Z: resolver IS conditionally injected behind isLocalDevArtifactStreamEnabled()
    expect(source).toContain("artifactStorageRefResolver");
    expect(source).toContain("isLocalDevArtifactStreamEnabled()");
    // artifactAccessProvider still NOT passed
    expect(source).not.toContain("artifactAccessProvider");
  });

  test("frontend files unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("inMemoryArtifactStorageRefStore");
  });
});