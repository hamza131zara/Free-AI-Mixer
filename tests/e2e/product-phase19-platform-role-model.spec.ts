import { expect, test } from "@playwright/test";
import {
  getPlatformRoleCapabilities,
  isPlatformRole,
  isWorkspaceScopedAdminRole,
} from "../../backend/admin/adminRoleContracts";
import {
  isPlatformAdminRole,
  normalizePlatformRole,
} from "../../backend/auth/platformRoleNormalization";

test.describe("product phase 19 platform role model", () => {
  test("platform role normalization distinguishes platform roles from workspace roles", () => {
    expect(normalizePlatformRole("platform_admin")).toBe("platform_admin");
    expect(normalizePlatformRole("platform_moderator")).toBe("platform_moderator");
    expect(normalizePlatformRole("moderator")).toBe("platform_moderator");
    expect(normalizePlatformRole("support_agent")).toBe("support_agent");
    expect(normalizePlatformRole("read_only_analyst")).toBe("read_only_analyst");
    expect(normalizePlatformRole("owner")).toBe("unknown");
    expect(normalizePlatformRole("admin")).toBe("unknown");
    expect(normalizePlatformRole("member")).toBe("unknown");
    expect(normalizePlatformRole("viewer")).toBe("unknown");
    expect(normalizePlatformRole("workspace_owner")).toBe("unknown");
    expect(normalizePlatformRole("workspace_admin")).toBe("unknown");
    expect(normalizePlatformRole(undefined)).toBe("unknown");
    expect(isPlatformAdminRole("platform_admin")).toBe(true);
    expect(isPlatformAdminRole("workspace_admin")).toBe(false);
  });

  test("workspace roles are not platform roles and moderator remains lower privilege", () => {
    expect(isPlatformRole("platform_admin")).toBe(true);
    expect(isPlatformRole("platform_moderator")).toBe(true);
    expect(isPlatformRole("support_agent")).toBe(true);
    expect(isPlatformRole("read_only_analyst")).toBe(true);
    expect(isPlatformRole("workspace_admin")).toBe(false);
    expect(isWorkspaceScopedAdminRole("workspace_admin")).toBe(true);
    expect(isWorkspaceScopedAdminRole("platform_admin")).toBe(false);

    const adminCapabilities = new Set(getPlatformRoleCapabilities("platform_admin"));
    const moderatorCapabilities = new Set(
      getPlatformRoleCapabilities("platform_moderator"),
    );
    const supportCapabilities = new Set(getPlatformRoleCapabilities("support_agent"));
    const analystCapabilities = new Set(
      getPlatformRoleCapabilities("read_only_analyst"),
    );

    expect(adminCapabilities.has("platform_operations_readiness")).toBe(true);
    expect(moderatorCapabilities.has("platform_operations_readiness")).toBe(false);
    expect(moderatorCapabilities.has("moderation_review")).toBe(true);
    expect(supportCapabilities.has("support_triage")).toBe(true);
    expect(supportCapabilities.has("moderation_review")).toBe(false);
    expect(analystCapabilities.has("analytics_read_only")).toBe(true);
  });
});
