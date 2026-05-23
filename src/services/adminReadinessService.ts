import type { AdminStatusSummary } from "../types/adminRoles";

interface BackendAdminReadyResponse {
  kind: "admin_status";
  status: AdminStatusSummary["status"];
  message: string;
  noindexRequired: true;
  verifiedAdminSessionRequired: true;
  platformRolesConfigured: false;
}

interface BackendAdminUnavailableResponse {
  kind: "admin_unavailable" | "admin_sign_in_required";
  status: AdminStatusSummary["status"];
  message: string;
}

export const getAdminReadinessStatus = async (): Promise<AdminStatusSummary> => {
  try {
    const response = await fetch("/admin/status", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const payload = await response.json() as BackendAdminUnavailableResponse;

      return {
        status: payload.status,
        message: payload.message,
        noindexRequired: true,
        verifiedAdminSessionRequired: true,
        platformRolesConfigured: false,
      };
    }

    const payload = await response.json() as BackendAdminReadyResponse;

    return {
      status: payload.status,
      message: payload.message,
      noindexRequired: payload.noindexRequired,
      verifiedAdminSessionRequired: payload.verifiedAdminSessionRequired,
      platformRolesConfigured: payload.platformRolesConfigured,
    };
  } catch {
    return {
      status: "auth_not_configured",
      message: "Authentication is not configured on this backend yet.",
      noindexRequired: true,
      verifiedAdminSessionRequired: true,
      platformRolesConfigured: false,
    };
  }
};
