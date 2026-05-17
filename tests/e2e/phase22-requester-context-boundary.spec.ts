import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createAuthenticatedSessionExportRequesterContext,
  createAuthenticatedTokenExportRequesterContext,
  createLocalDevFallbackExportRequesterContext,
  isAuthenticatedSessionExportRequesterContext,
  isAuthenticatedTokenExportRequesterContext,
  isLocalDevFallbackExportRequesterContext,
  resolveExportRequesterContext,
} from "../../backend/requester/exportRequesterContext";

test.describe("phase22 requester context boundary", () => {
  test("local-dev fallback context remains explicit and detectable", () => {
    const fallbackContext = createLocalDevFallbackExportRequesterContext();

    expect(fallbackContext.ownerId).toBe("local-dev-owner");
    expect(fallbackContext.workspaceId).toBe("local-dev-workspace");
    expect(fallbackContext.authMode).toBe("local_dev_fallback");
    expect(isLocalDevFallbackExportRequesterContext(fallbackContext)).toBe(true);
    expect(isAuthenticatedSessionExportRequesterContext(fallbackContext)).toBe(false);
    expect(isAuthenticatedTokenExportRequesterContext(fallbackContext)).toBe(false);
  });

  test("authenticated session context can be represented with owner scope", () => {
    const requesterContext = createAuthenticatedSessionExportRequesterContext({
      ownerId: "owner-session",
      workspaceId: "workspace-session",
    });

    expect(requesterContext.ownerId).toBe("owner-session");
    expect(requesterContext.workspaceId).toBe("workspace-session");
    expect(requesterContext.authMode).toBe("authenticated_session");
    expect(isAuthenticatedSessionExportRequesterContext(requesterContext)).toBe(true);
    expect(isLocalDevFallbackExportRequesterContext(requesterContext)).toBe(false);
  });

  test("authenticated token context can be represented with owner scope", () => {
    const requesterContext = createAuthenticatedTokenExportRequesterContext({
      ownerId: "owner-token",
      workspaceId: "workspace-token",
    });

    expect(requesterContext.ownerId).toBe("owner-token");
    expect(requesterContext.workspaceId).toBe("workspace-token");
    expect(requesterContext.authMode).toBe("authenticated_token");
    expect(isAuthenticatedTokenExportRequesterContext(requesterContext)).toBe(true);
    expect(isLocalDevFallbackExportRequesterContext(requesterContext)).toBe(false);
  });

  test("default resolver still returns local-dev fallback", () => {
    const requesterContext = resolveExportRequesterContext({} as never);

    expect(requesterContext.ownerId).toBe("local-dev-owner");
    expect(requesterContext.workspaceId).toBe("local-dev-workspace");
    expect(requesterContext.authMode).toBe("local_dev_fallback");
    expect(isLocalDevFallbackExportRequesterContext(requesterContext)).toBe(true);
  });

  test("requester context source does not add real auth parsing", async () => {
    const source = await fs.readFile(
      path.join(
        process.cwd(),
        "backend",
        "requester",
        "exportRequesterContext.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("Authorization");
    expect(source).not.toContain("Bearer ");
    expect(source).not.toContain("Cookie");
    expect(source).not.toContain("cookie");
    expect(source).not.toContain("req.session");
    expect(source).not.toContain("request.session");
    expect(source).not.toContain("req.headers");
    expect(source).not.toContain("request.headers");
  });
});
