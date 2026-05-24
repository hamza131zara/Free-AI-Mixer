export interface SupabaseAuthRuntimeStrategyDecision {
  kind: "planned_supabase_auth_runtime";
  strategy: "frontend_supabase_auth_plus_backend_bearer_jwt";
  frontendSessionSource: "planned_supabase_auth_client";
  backendVerificationSource: "planned_supabase_jwks_bearer_verification";
  workspaceLookupSource: "planned_app_database_membership_lookup";
  liveRuntimeEnabled: false;
  jwtVerificationEnabled: false;
  workspaceLookupEnabled: false;
  serviceRoleFrontendAllowed: false;
  trustedHeaderIdentityAllowed: false;
  fakeSessionAllowed: false;
}

/**
 * Phase 17 readiness-only Supabase Auth runtime strategy.
 *
 * This documents the planned production auth shape without enabling any live
 * frontend auth client, JWT verification, workspace lookup, or session
 * creation behavior.
 */
export const resolveSupabaseAuthRuntimeStrategy =
  (): SupabaseAuthRuntimeStrategyDecision => ({
    kind: "planned_supabase_auth_runtime",
    strategy: "frontend_supabase_auth_plus_backend_bearer_jwt",
    frontendSessionSource: "planned_supabase_auth_client",
    backendVerificationSource: "planned_supabase_jwks_bearer_verification",
    workspaceLookupSource: "planned_app_database_membership_lookup",
    liveRuntimeEnabled: false,
    jwtVerificationEnabled: false,
    workspaceLookupEnabled: false,
    serviceRoleFrontendAllowed: false,
    trustedHeaderIdentityAllowed: false,
    fakeSessionAllowed: false,
  });
