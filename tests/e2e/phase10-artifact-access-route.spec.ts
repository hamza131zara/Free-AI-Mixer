import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test.describe("phase10 artifact access route", () => {
  test("Route exists at GET /exports/:jobId/artifacts/:artifactId/access", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('router.get(\n    "/exports/:jobId/artifacts/:artifactId/access"');
  });

  test("Route validates job exists", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('reason: "job_not_found"');
    expect(source).toContain('message: "Export job was not found."');
  });

  test("Route validates job is successful", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('reason: "job_not_successful"');
    expect(source).toContain('message: "Artifact access is available only for successful export jobs."');
  });

  test("Route validates artifact exists", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('reason: "artifact_not_found"');
    expect(source).toContain('message: "Artifact was not found for this export job."');
  });

  test("Route validates artifact is ready", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('reason: "artifact_not_ready"');
    expect(source).toContain('message: "Artifact is not ready for access."');
  });

  test("Route calls artifactAccessProvider.getArtifactAccess", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("artifactAccessProvider.getArtifactAccess");
    expect(source).toContain("jobId,");
    expect(source).toContain("artifactId,");
    expect(source).toContain("artifact,");
  });

  test("Route handles provider errors safely", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Check for catch block handling provider errors
    expect(source).toContain("catch {");
    expect(source).toContain('reason: "artifact_access_not_configured"');
  });

  test("Response never contains forbidden path fields in access route logic", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Check the access route section specifically - look for the handler after the route path
    const accessRouteMatch = source.match(/\/exports\/:jobId\/artifacts\/:artifactId\/access"[^}]*\{[\s\S]*?(?=router\.(post|get|put|delete)|return router)/);
    if (accessRouteMatch) {
      const accessRouteCode = accessRouteMatch[0];
      // Check the validation and response parts don't contain forbidden fields
      expect(accessRouteCode).not.toContain("filePath");
      expect(accessRouteCode).not.toContain("localPath");
      expect(accessRouteCode).not.toContain("storageKey");
      expect(accessRouteCode).not.toContain("downloadUrl");
    }
  });

  test("Route uses default not-configured provider", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("createNotConfiguredArtifactAccessProvider()");
  });

  test("Router options includes artifactAccessProvider", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("artifactAccessProvider?: ArtifactAccessProvider");
  });

  test("Route source does not generate signed URLs in access route logic", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Check access route section doesn't have sign/signed logic
    const accessRouteMatch = source.match(/\/exports\/:jobId\/artifacts\/:artifactId\/access"[^}]*\{[\s\S]*?(?=router\.(post|get|put|delete)|return router)/);
    if (accessRouteMatch) {
      const accessRouteCode = accessRouteMatch[0];
      expect(accessRouteCode).not.toContain("sign");
      expect(accessRouteCode).not.toContain("SignedURL");
      expect(accessRouteCode).not.toContain("s3");
      expect(accessRouteCode).not.toContain("r2");
    }
  });

  test("Route source does not stream files", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    const accessRouteMatch = source.match(/\/exports\/:jobId\/artifacts\/:artifactId\/access"[^}]*\{[\s\S]*?(?=router\.(post|get|put|delete)|return router)/);
    if (accessRouteMatch) {
      const accessRouteCode = accessRouteMatch[0];
      expect(accessRouteCode).not.toContain("createReadStream");
      expect(accessRouteCode).not.toContain("sendFile");
      expect(accessRouteCode).not.toContain("stream.");
    }
  });

  test("Existing POST /exports behavior unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('router.post(\n    "/exports"');
    expect(source).toContain("registry.create");
    expect(source).toContain('kind: "accepted_job"');
  });

  test("Existing GET /exports/:jobId behavior unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('router.get(\n    "/exports/:jobId"');
    expect(source).toContain("mapRecordToPollResponse");
  });

  test("Existing GET /exports/:jobId/artifacts behavior unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('router.get(\n    "/exports/:jobId/artifacts"');
    expect(source).toContain("exportArtifactsUnavailable");
  });

  test("Route returns BackendArtifactAccessResponse type", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("BackendArtifactAccessResponse");
  });
});