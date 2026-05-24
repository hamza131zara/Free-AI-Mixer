import { expect, test } from "@playwright/test";
import { decideProviderKeyAuthorization } from "../../backend/authorization/providerKeyAuthorization";
import {
  isOwnerOrAdminWorkspaceRole,
  normalizeWorkspaceRole,
} from "../../backend/auth/workspaceRoleNormalization";
import {
  sendProtectedRouteGuardDecision,
  toProtectedRouteDeniedDecision,
} from "../../backend/auth/protectedRouteGuards";

test.describe("product phase 16 workspace role and guard boundary", () => {
  test("workspace role normalization maps legacy and canonical roles safely", () => {
    expect(normalizeWorkspaceRole("owner")).toBe("workspace_owner");
    expect(normalizeWorkspaceRole("admin")).toBe("workspace_admin");
    expect(normalizeWorkspaceRole("editor")).toBe("workspace_member");
    expect(normalizeWorkspaceRole("member")).toBe("workspace_member");
    expect(normalizeWorkspaceRole("viewer")).toBe("workspace_viewer");
    expect(normalizeWorkspaceRole("workspace_owner")).toBe("workspace_owner");
    expect(normalizeWorkspaceRole(undefined)).toBe("unknown");
    expect(normalizeWorkspaceRole("strange-role")).toBe("unknown");

    expect(isOwnerOrAdminWorkspaceRole("owner")).toBe(true);
    expect(isOwnerOrAdminWorkspaceRole("admin")).toBe(true);
    expect(isOwnerOrAdminWorkspaceRole("member")).toBe(false);
    expect(isOwnerOrAdminWorkspaceRole("viewer")).toBe(false);
  });

  test("workspace member and viewer cannot perform owner admin provider key operations while owner admin remain distinguishable", () => {
    const requesterContext = {
      kind: "authenticated" as const,
      userId: "user_1",
      workspaceId: "workspace_1",
      authProvider: "session",
      authSubject: "subject_1",
    };

    expect(
      decideProviderKeyAuthorization({
        action: "add_provider_key",
        requesterContext,
        actorRole: "owner",
      }),
    ).toMatchObject({
      kind: "allowed",
      actorRole: "workspace_owner",
    });

    expect(
      decideProviderKeyAuthorization({
        action: "add_provider_key",
        requesterContext,
        actorRole: "admin",
      }),
    ).toMatchObject({
      kind: "allowed",
      actorRole: "workspace_admin",
    });

    expect(
      decideProviderKeyAuthorization({
        action: "add_provider_key",
        requesterContext,
        actorRole: "member",
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "workspace_member_forbidden",
    });

    expect(
      decideProviderKeyAuthorization({
        action: "add_provider_key",
        requesterContext,
        actorRole: "viewer",
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "workspace_viewer_forbidden",
    });
  });

  test("protected route guard response mapper emits safe generic responses", () => {
    const captured: {
      statusCode?: number;
      body?: unknown;
    } = {};

    const response = {
      status(code: number) {
        captured.statusCode = code;
        return this;
      },
      json(body: unknown) {
        captured.body = body;
        return this;
      },
    } as const;

    sendProtectedRouteGuardDecision(
      response as never,
      toProtectedRouteDeniedDecision("owner_admin_required"),
    );

    expect(captured.statusCode).toBe(403);
    expect(captured.body).toEqual({
      code: "owner_admin_required",
      message:
        "Workspace owner or workspace admin permission is required before this protected route can continue.",
    });
    expect(JSON.stringify(captured.body)).not.toContain("jwt");
    expect(JSON.stringify(captured.body)).not.toContain("cookie");
    expect(JSON.stringify(captured.body)).not.toContain("claims");
  });
});
