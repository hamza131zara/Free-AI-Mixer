import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "../../backend/app";
import {
  getPlatformRoleCapabilities,
  isPlatformRole,
  isWorkspaceScopedAdminRole,
  moderatorForbiddenCapabilities,
} from "../../backend/admin/adminRoleContracts";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const listFrontendSourceFiles = (directory: string): string[] => {
  const fullPath = path.join(projectRoot, directory);
  const entries = readdirSync(fullPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFrontendSourceFiles(relativePath);
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return [relativePath];
    }

    return [];
  });
};

const startServer = async (): Promise<{ server: Server; baseUrl: string }> => {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

test.describe("product phase 10 admin and moderator readiness", () => {
  test("admin route is honest, fail-closed, and noindex", async ({ page }) => {
    await page.route("**/admin/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "admin_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
          noindexRequired: true,
          verifiedAdminSessionRequired: true,
          platformRolesConfigured: false,
        }),
      });
    });

    await page.goto("/admin", { waitUntil: "load" });

    await expect(page.getByTestId("admin-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin readiness shell" })).toBeVisible();
    await expect(page.getByText("Admin tools are not enabled yet.")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
    await expect(page.getByText("No metrics, users, jobs, projects, revenue, moderation queues, or support backlog are shown here.")).toBeVisible();
  });

  test("platform moderator stays lower privilege than platform admin and route boundary fails closed", async () => {
    const adminCapabilities = new Set(getPlatformRoleCapabilities("platform_admin"));
    const moderatorCapabilities = new Set(getPlatformRoleCapabilities("platform_moderator"));

    expect(adminCapabilities.has("platform_operations_readiness")).toBe(true);
    expect(moderatorCapabilities.has("platform_operations_readiness")).toBe(false);
    expect(moderatorCapabilities.has("moderation_review")).toBe(true);
    expect(moderatorCapabilities.has("support_triage")).toBe(true);
    expect(isPlatformRole("platform_admin")).toBe(true);
    expect(isPlatformRole("workspace_admin")).toBe(false);
    expect(isWorkspaceScopedAdminRole("workspace_admin")).toBe(true);
    expect(isWorkspaceScopedAdminRole("platform_moderator")).toBe(false);
    expect(moderatorForbiddenCapabilities).toContain("service_role_credentials");
    expect(moderatorForbiddenCapabilities).toContain("signed_delivery_urls");

    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/admin/status`, {
        headers: {
          "x-user-id": "fake-admin",
          cookie: "fake-session=must-not-authenticate",
        },
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "admin_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
        noindexRequired: true,
        verifiedAdminSessionRequired: true,
        platformRolesConfigured: false,
      });
    } finally {
      await stopServer(server);
    }
  });

  test("frontend source does not use localStorage or sessionStorage as admin or moderator truth", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("localStorage.setItem(\"platform_admin\"");
    expect(frontendSource).not.toContain("localStorage.setItem('platform_admin'");
    expect(frontendSource).not.toContain("sessionStorage.setItem(\"platform_admin\"");
    expect(frontendSource).not.toContain("sessionStorage.setItem('platform_admin'");
    expect(frontendSource).not.toContain("localStorage.setItem(\"platform_moderator\"");
    expect(frontendSource).not.toContain("sessionStorage.setItem(\"platform_moderator\"");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("service_role");
  });
});
