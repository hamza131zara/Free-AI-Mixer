import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendArtifactAccessResponse } from "../../backend/contracts/exportHttpTypes";

const expectUnavailableResponse = (
  response: BackendArtifactAccessResponse,
) => {
  expect(response.kind).toBe("artifact_access_unavailable");

  if (response.kind !== "artifact_access_unavailable") {
    throw new Error("Expected artifact_access_unavailable response.");
  }

  return response;
};

test.describe("phase9 not-configured artifact access provider", () => {
  test("notConfiguredArtifactAccessProvider.ts exists", async () => {
    await fs.access(
      path.join(
        process.cwd(),
        "backend",
        "artifacts",
        "notConfiguredArtifactAccessProvider.ts",
      ),
    );
  });

  test("createNotConfiguredArtifactAccessProvider is exported", async () => {
    const source = await fs.readFile(
      path.join(
        process.cwd(),
        "backend",
        "artifacts",
        "notConfiguredArtifactAccessProvider.ts",
      ),
      "utf8",
    );

    expect(source).toContain("export const createNotConfiguredArtifactAccessProvider");
  });

  test("factory returns object with getArtifactAccess method", async () => {
    const { createNotConfiguredArtifactAccessProvider } = await import(
      "../../backend/artifacts/notConfiguredArtifactAccessProvider"
    );

    const provider = createNotConfiguredArtifactAccessProvider();

    expect(typeof provider.getArtifactAccess).toBe("function");
  });

  test("getArtifactAccess returns kind artifact_access_unavailable", async () => {
    const { createNotConfiguredArtifactAccessProvider } = await import(
      "../../backend/artifacts/notConfiguredArtifactAccessProvider"
    );

    const provider = createNotConfiguredArtifactAccessProvider();
    const result = await provider.getArtifactAccess({
      jobId: "any-job",
      artifactId: "any-artifact",
    });

    expectUnavailableResponse(result);
  });

  test("reason is artifact_access_not_configured", async () => {
    const { createNotConfiguredArtifactAccessProvider } = await import(
      "../../backend/artifacts/notConfiguredArtifactAccessProvider"
    );

    const provider = createNotConfiguredArtifactAccessProvider();
    const result = await provider.getArtifactAccess({
      jobId: "any-job",
      artifactId: "any-artifact",
    });

    const unavailable = expectUnavailableResponse(result);

    expect(unavailable.reason).toBe("artifact_access_not_configured");
  });

  test("message is present and non-empty", async () => {
    const { createNotConfiguredArtifactAccessProvider } = await import(
      "../../backend/artifacts/notConfiguredArtifactAccessProvider"
    );

    const provider = createNotConfiguredArtifactAccessProvider();
    const result = await provider.getArtifactAccess({
      jobId: "any-job",
      artifactId: "any-artifact",
    });

    const unavailable = expectUnavailableResponse(result);

    expect(typeof unavailable.message).toBe("string");
    expect(unavailable.message.length).toBeGreaterThan(0);
  });

  test("response does not contain url", async () => {
    const { createNotConfiguredArtifactAccessProvider } = await import(
      "../../backend/artifacts/notConfiguredArtifactAccessProvider"
    );

    const provider = createNotConfiguredArtifactAccessProvider();
    const result = await provider.getArtifactAccess({
      jobId: "any-job",
      artifactId: "any-artifact",
    });

    expect(result).not.toHaveProperty("url");
    expect(result).not.toHaveProperty("access");
  });

  test("response does not contain access descriptor", async () => {
    const { createNotConfiguredArtifactAccessProvider } = await import(
      "../../backend/artifacts/notConfiguredArtifactAccessProvider"
    );

    const provider = createNotConfiguredArtifactAccessProvider();
    const result = await provider.getArtifactAccess({
      jobId: "any-job",
      artifactId: "any-artifact",
    });

    expect(result).not.toHaveProperty("access");
  });

  test("source does not contain forbidden path/storage fields", async () => {
    const source = await fs.readFile(
      path.join(
        process.cwd(),
        "backend",
        "artifacts",
        "notConfiguredArtifactAccessProvider.ts",
      ),
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
      path.join(
        process.cwd(),
        "backend",
        "artifacts",
        "notConfiguredArtifactAccessProvider.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("backend/renderer");
    expect(source).not.toContain("../renderer");
  });

  test("source does not import backend/routes", async () => {
    const source = await fs.readFile(
      path.join(
        process.cwd(),
        "backend",
        "artifacts",
        "notConfiguredArtifactAccessProvider.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("backend/routes");
    expect(source).not.toContain("../routes");
  });

  test("source does not import fs or path", async () => {
    const source = await fs.readFile(
      path.join(
        process.cwd(),
        "backend",
        "artifacts",
        "notConfiguredArtifactAccessProvider.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("from \"node:fs\"");
    expect(source).not.toContain("from \"node:path\"");
    expect(source).not.toContain("import.meta.url");
  });

  test("backend/routes/exports.ts safety boundaries preserved", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Phase 10-B allows the route to use the not-configured provider as a safe default.
    expect(source).toContain("createNotConfiguredArtifactAccessProvider");
    expect(source).toContain("ArtifactAccessProvider");

    const forbiddenTerms = [
      '"filePath"',
      '"localPath"',
      '"outputPath"',
      '"absolutePath"',
      '"filesystemPath"',
      '"storageKey"',
      '"downloadUrl"',
      "createSigned",
      "getSignedUrl",
      "presign",
      "createReadStream",
      "sendFile",
      "express.static",
    ];

    for (const term of forbiddenTerms) {
      expect(source).not.toContain(term);
    }
  });

  test("frontend files remain unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("notConfiguredArtifactAccessProvider");
    expect(source).not.toContain("ArtifactAccessProvider");
  });

  test("backend/contracts/exportHttpTypes.ts remains unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"),
      "utf8",
    );

    expect(source).not.toContain("notConfiguredArtifactAccessProvider");
    expect(source).toContain("artifact_access_not_configured");
  });
});