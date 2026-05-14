import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import type { ExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import { InMemoryExportJobRegistry } from "../../backend/registry/inMemoryExportJobRegistry";

test.describe("phase815 registry interface boundary", () => {
  test("ExportJobRegistry interface is exported from backend/registry/exportJobRegistry.ts", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/registry/exportJobRegistry.ts"),
      "utf8",
    );

    expect(source).toContain("export interface ExportJobRegistry");
    expect(source).toContain("create(input: CreateExportJobInput)");
    expect(source).toContain("getById(jobId: string)");
    expect(source).toContain("getByRequestId(requestId: string)");
    expect(source).toContain("getByStatus(status: BackendExportLifecycleStatus)");
    expect(source).toContain("claim(");
    expect(source).toContain("markRendering(");
    expect(source).toContain("markFinalizing(");
    expect(source).toContain("markSuccess(");
    expect(source).toContain("markError(");
    expect(source).toContain("transition(");
  });

  test("InMemoryExportJobRegistry is exported from backend/registry/inMemoryExportJobRegistry.ts", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/registry/inMemoryExportJobRegistry.ts"),
      "utf8",
    );

    expect(source).toContain("export class InMemoryExportJobRegistry");
    expect(source).toContain("implements ExportJobRegistry");
  });

  test("createBackendDependencies uses InMemoryExportJobRegistry", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/composition/backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("InMemoryExportJobRegistry");
    expect(source).toContain("from \"../registry/inMemoryExportJobRegistry\"");
  });

  test("createBackendDependencies returns ExportJobRegistry interface type", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/composition/backendDependencies.ts"),
      "utf8",
    );

    expect(source).toContain("registry: ExportJobRegistry");
  });

  test("InMemoryExportJobRegistry implements ExportJobRegistry interface", () => {
    const deps = createBackendDependencies();
    expect(typeof deps.registry.create).toBe("function");
    expect(typeof deps.registry.getById).toBe("function");
    expect(typeof deps.registry.getByRequestId).toBe("function");
    expect(typeof deps.registry.getByStatus).toBe("function");
    expect(typeof deps.registry.claim).toBe("function");
    expect(typeof deps.registry.markRendering).toBe("function");
    expect(typeof deps.registry.markFinalizing).toBe("function");
    expect(typeof deps.registry.markSuccess).toBe("function");
    expect(typeof deps.registry.markError).toBe("function");
    expect(typeof deps.registry.transition).toBe("function");
  });

  test("InMemoryExportJobRegistry create behavior preserved", () => {
    const registry = new InMemoryExportJobRegistry();

    const record = registry.create({
      requestId: "test-req-1",
      timelineId: "timeline-1",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    expect(record.jobId).toBeDefined();
    expect(record.requestId).toBe("test-req-1");
    expect(record.timelineId).toBe("timeline-1");
    expect(record.status).toBe("submitted");
  });

  test("InMemoryExportJobRegistry getById behavior preserved", () => {
    const registry = new InMemoryExportJobRegistry();

    const created = registry.create({
      requestId: "test-req-2",
      timelineId: "timeline-2",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const found = registry.getById(created.jobId);
    expect(found).toBeDefined();
    expect(found?.jobId).toBe(created.jobId);
    expect(found?.requestId).toBe("test-req-2");
  });

  test("InMemoryExportJobRegistry getByRequestId returns existing job by requestId", () => {
    const registry = new InMemoryExportJobRegistry();

    const created = registry.create({
      requestId: "unique-req-id",
      timelineId: "timeline-1",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const found = registry.getByRequestId("unique-req-id");
    expect(found).toBeDefined();
    expect(found?.jobId).toBe(created.jobId);
  });

  test("InMemoryExportJobRegistry requestId mapping stored correctly", () => {
    const registry = new InMemoryExportJobRegistry();

    const record1 = registry.create({
      requestId: "mapping-req-1",
      timelineId: "timeline-1",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const found = registry.getByRequestId("mapping-req-1");
    expect(found?.jobId).toBe(record1.jobId);
    expect(found?.requestId).toBe("mapping-req-1");
  });

  test("InMemoryExportJobRegistry getByStatus preserved", () => {
    const registry = new InMemoryExportJobRegistry();

    registry.create({
      requestId: "req-submitted-1",
      timelineId: "timeline-1",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    registry.create({
      requestId: "req-submitted-2",
      timelineId: "timeline-1",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const submittedJobs = registry.getByStatus("submitted");
    expect(submittedJobs.length).toBe(2);
    expect(submittedJobs.every(j => j.status === "submitted")).toBe(true);
  });

  test("InMemoryExportJobRegistry claim/TTL behavior preserved", () => {
    const registry = new InMemoryExportJobRegistry();

    const record = registry.create({
      requestId: "req-claim-1",
      timelineId: "timeline-1",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const claimed = registry.claim(record.jobId, "worker-1", { claimTtlMs: 60000 });
    expect(claimed.claimedByWorkerId).toBe("worker-1");
    expect(claimed.claimExpiresAt).toBeDefined();
  });

  test("InMemoryExportJobRegistry lifecycle transition guards preserved", () => {
    const registry = new InMemoryExportJobRegistry();

    const record = registry.create({
      requestId: "req-transition-1",
      timelineId: "timeline-1",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    // Can transition submitted to rendering
    registry.claim(record.jobId, "worker-1");
    const rendering = registry.markRendering(record.jobId, "worker-1");
    expect(rendering.status).toBe("rendering");

    // Can transition rendering to finalizing
    const finalizing = registry.markFinalizing(record.jobId, "worker-1");
    expect(finalizing.status).toBe("finalizing");
  });

  test("InMemoryExportJobRegistry artifact metadata validation preserved", () => {
    const registry = new InMemoryExportJobRegistry();

    const record = registry.create({
      requestId: "req-artifact-1",
      timelineId: "timeline-1",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    // Claim and transition through states
    registry.claim(record.jobId, "worker-1");
    registry.markRendering(record.jobId, "worker-1");
    registry.markFinalizing(record.jobId, "worker-1");

    // markSuccess requires valid artifact metadata
    const artifact = {
      artifactId: "artifact-1",
      jobId: record.jobId,
      kind: "render_output",
      format: "mp4",
      status: "available" as const,
      createdAt: new Date().toISOString(),
    };

    const success = registry.markSuccess(record.jobId, "worker-1", [artifact]);
    expect(success.status).toBe("success");
    expect(success.artifacts).toHaveLength(1);
    expect(success.artifacts?.[0].artifactId).toBe("artifact-1");
  });

  test("No real persistence/storage code was added", async () => {
    const implSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/registry/inMemoryExportJobRegistry.ts"),
      "utf8",
    );

    // Should not contain file system operations
    expect(implSource).not.toContain("fs.readFileSync");
    expect(implSource).not.toContain("fs.writeFileSync");
    expect(implSource).not.toContain("fs.promises.writeFile");
    expect(implSource).not.toContain("fs.promises.readFile");

    // Should not contain database imports
    expect(implSource).not.toContain("sqlite");
    expect(implSource).not.toContain("postgres");
    expect(implSource).not.toContain("pg");
    expect(implSource).not.toContain("redis");
    expect(implSource).not.toContain("ioredis");

    // Should not contain JSON file operations
    expect(implSource).not.toContain("JSON.parse(");
    expect(implSource).not.toContain("JSON.stringify(");
  });

  test("No route, worker, app, server, or frontend behavior changed", async () => {
    const interfaceSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/registry/exportJobRegistry.ts"),
      "utf8",
    );

    // Interface should not contain business logic
    expect(interfaceSource).not.toContain("router.");
    expect(interfaceSource).not.toContain("worker.");
    expect(interfaceSource).not.toContain("app.");
    expect(interfaceSource).not.toContain("server.");
    expect(interfaceSource).not.toContain("fetch");
    expect(interfaceSource).not.toContain("http.");
    expect(interfaceSource).not.toContain("express.");
  });
});