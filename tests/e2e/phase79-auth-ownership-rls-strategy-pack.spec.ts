import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const readTree = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);

  if (!existsSync(fullPath)) {
    return "";
  }

  const parts: string[] = [];

  const visit = (currentPath: string): void => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (/\.(ts|tsx|sql|md)$/.test(entry.name)) {
        parts.push(readFileSync(entryPath, "utf8"));
      }
    }
  };

  visit(fullPath);

  return parts.join("\n");
};

const expectNoUnsafeArtifactDelivery = (source: string): void => {
  expect(source).not.toContain("window.open");
  expect(source).not.toContain("createSignedUrl");
  expect(source).not.toContain("getPublicUrl");
  expect(source).not.toContain("href=");
  expect(source).not.toContain("download=");
  expect(source).not.toContain("location.href");
  expect(source).not.toContain("URL.createObjectURL");
};

test.describe("phase79 auth ownership rls strategy pack", () => {
  test("ownership contracts exist while production auth and rls remain strategy-gated", async () => {
    const exportContractsSource = readSource("backend/contracts/exportHttpTypes.ts");
    const repositoryContractsSource = readSource("backend/repositories/repositoryContracts.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const authSource = readTree("backend/auth");
    const dbSource =
      readTree("backend/db/migrations") + "\n" + readTree("backend/db/schema");

    const ownershipSurface =
      exportContractsSource +
      "\n" +
      repositoryContractsSource +
      "\n" +
      routeSource +
      "\n" +
      authSource +
      "\n" +
      dbSource;

    expect(ownershipSurface).toContain("ownerId");
    expect(ownershipSurface).toContain("workspaceId");

    expect(routeSource).toContain("ownerId");
    expect(routeSource).toContain("workspaceId");

    // Phase 79 is a strategy/guard boundary only, not broad production auth.
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    // RLS/auth enforcement must remain explicit future work, not silently faked here.
    expect(ownershipSurface).not.toContain("fakeSession");
    expect(ownershipSurface).not.toContain("mockAuthenticatedUser");
    expect(ownershipSurface).not.toContain("window.localStorage.auth");
  });

  test("frontend remains backend-mediated with no direct supabase or storage artifact delivery", async () => {
    const exportServiceSource = readSource("src/services/exportService.ts");
    const exportStoreSource = readSource("src/store/exportStore.ts");
    const exportTypesSource = readIfExists("src/types/exportJob.ts");
    const handleStorageSource = readIfExists("src/services/exportHandleStorage.ts");
    const frontendSource =
      exportServiceSource +
      "\n" +
      exportStoreSource +
      "\n" +
      exportTypesSource +
      "\n" +
      handleStorageSource;

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");

    expectNoUnsafeArtifactDelivery(frontendSource);

    expect(frontendSource).not.toContain("file://");
    expect(frontendSource).not.toContain("C:\\\\");
    expect(frontendSource).not.toContain("/tmp/");
  });

  test("artifact delivery remains blocked until auth rls and ownership enforcement exist", async () => {
    const phase78SpecSource = readIfExists(
      "tests/e2e/phase78-production-artifact-delivery-strategy-pack.spec.ts",
    );
    const routeSource = readSource("backend/routes/exports.ts");
    const artifactSource = readTree("backend/artifacts");
    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(phase78SpecSource).toContain("local_dev_stream");
    expect(phase78SpecSource).toContain("signed_url");

    expect(artifactSource).toContain("local_dev_stream");
    expect(artifactSource).not.toContain("production_ready_local_dev_stream");

    expectNoUnsafeArtifactDelivery(routeSource);
    expectNoUnsafeArtifactDelivery(artifactSource);

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});
