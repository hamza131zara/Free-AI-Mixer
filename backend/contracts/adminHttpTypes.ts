export interface BackendAdminStatusResponse {
  kind: "admin_status" | "admin_unavailable" | "admin_sign_in_required";
  status: "auth_not_configured" | "sign_in_required" | "not_enabled_yet";
  message: string;
  noindexRequired: true;
  verifiedAdminSessionRequired: true;
  platformRolesConfigured: false;
}
