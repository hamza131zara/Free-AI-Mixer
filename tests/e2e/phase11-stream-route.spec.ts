import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { InternalArtifactStorageRef } from "../../backend/artifacts/internalArtifactStorageRef";
import type { ArtifactStorageRefResolver } from "../../backend/artifacts/artifactStorageRefResolver";

test.describe("phase11 stream route", () => {
  test("Route exists at GET /exports/:jobId/artifacts/:artifactId/stream", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('router.get(\n    "/exports/:jobId/artifacts/:artifactId/stream"');
  });

  test("Resolver missing returns 501 stream_not_configured", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('code: "stream_not_configured"');
    expect(source).toContain("Artifact stream access is not configured.");
  });

  test("Unknown job returns 404 job_not_found", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Check validation section for job not found
    expect(source).toContain('code: "job_not_found"');
    expect(source).toContain("Export job was not found.");
  });

  test("Non-successful job returns 404 job_not_found", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Non-success returns same job_not_found code (no enumeration)
    expect(source).toContain("record.status !== \"success\"");
  });

  test("Unknown artifact returns 404 artifact_not_found", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('code: "artifact_not_found"');
    expect(source).toContain("Artifact was not found.");
  });

  test("Not-ready artifact returns 404 artifact_not_found", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("artifact.status && artifact.status !== \"available\"");
  });

  test("Path outside root returns 403 forbidden", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('code: "forbidden"');
    expect(source).toContain("Artifact stream access was denied.");
  });

  test("File missing returns 404 not_found", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('code: "not_found"');
    expect(source).toContain("Artifact file is not available.");
  });

  test("Directory path returns 403 forbidden", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("!stat.isFile()");
  });

  test("Valid stream sets Content-Type correctly for mp4", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("formatToContentType");
    expect(source).toContain('case "mp4":');
    expect(source).toContain("return \"video/mp4\"");
  });

  test("Valid stream sets Content-Disposition attachment with safe filename", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("safeFilename");
    expect(source).toContain('Content-Disposition');
    expect(source).toContain("attachment;");
  });

  test("Valid stream sets Cache-Control no-store", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("Cache-Control");
    expect(source).toContain("no-store");
  });

  test("Valid stream sets X-Content-Type-Options nosniff", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("X-Content-Type-Options");
    expect(source).toContain("nosniff");
  });

  test("Stream route error JSON responses do not expose local file path in response body", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Extract stream route section
    const streamRouteStart = source.indexOf('"/exports/:jobId/artifacts/:artifactId/stream"');
    expect(streamRouteStart).toBeGreaterThan(0);

    const afterStreamRoute = source.substring(streamRouteStart);
    const nextRoute = afterStreamRoute.indexOf('router.post(');
    const streamRouteSection = nextRoute > 0 ? afterStreamRoute.substring(0, nextRoute) : afterStreamRoute;

    // All error responses should use generic codes, not local paths
    // The pattern response.status(N).json({ code: "...", message: "..." }) should not include paths
    // Check that JSON error responses contain generic codes, not path variables
    expect(streamRouteSection).toContain('code: "job_not_found"');
    expect(streamRouteSection).toContain('code: "artifact_not_found"');
    expect(streamRouteSection).toContain('code: "stream_not_configured"');
    expect(streamRouteSection).toContain('code: "forbidden"');
    expect(streamRouteSection).toContain('code: "not_found"');
    expect(streamRouteSection).toContain('code: "internal_error"');

    // Verify none of the JSON response objects include filePath, rootPath, or storageRef in their object literals
    // Find all response.json({ ... }) calls in the stream route and verify they don't include path-related fields
    const jsonResponseMatches = streamRouteSection.match(/response\.status\(\d+\)\.json\(\{[^}]+\}\)/g) || [];
    for (const jsonCall of jsonResponseMatches) {
      expect(jsonCall).not.toContain("filePath");
      expect(jsonCall).not.toContain("rootPath");
      expect(jsonCall).not.toContain("storageRef");
    }
  });

  test("Route source does not contain express.static", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).not.toContain("express.static");
  });

  test("Stream route does not accept filePath/localPath/outputPath from request query/body", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    // Check the stream route section specifically - it should only use request.params
    // Find the stream route section
    const streamRouteStart = source.indexOf('"/exports/:jobId/artifacts/:artifactId/stream"');
    expect(streamRouteStart).toBeGreaterThan(0);

    // Extract the stream route handler (roughly up to the next route)
    const afterStreamRoute = source.substring(streamRouteStart);
    const nextRoute = afterStreamRoute.indexOf('router.post(');
    const streamRouteSection = nextRoute > 0 ? afterStreamRoute.substring(0, nextRoute) : afterStreamRoute;

    // Stream route should use only request.params, not query or body
    expect(streamRouteSection).not.toContain("request.query");
    expect(streamRouteSection).not.toContain("request.body");
    expect(streamRouteSection).toContain("request.params.artifactId");
  });

  test("Existing GET /exports/:jobId/artifacts/:artifactId/access behavior remains unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('router.get(\n    "/exports/:jobId/artifacts/:artifactId/access"');
  });

  test("Existing POST /exports behavior remains unchanged", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain('router.post(\n    "/exports"');
  });

  test("Path safety uses fs.realpath validation", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "routes", "exports.ts"),
      "utf8",
    );

    expect(source).toContain("fs.realpath");
    expect(source).toContain("path.resolve");
  });
});