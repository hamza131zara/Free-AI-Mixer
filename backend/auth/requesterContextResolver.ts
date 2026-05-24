import type { IncomingHttpHeaders } from "node:http";
import {
  createAuthenticatedRequesterContext,
  createUnauthenticatedRequesterContext,
  type BackendAuthenticatedRequesterContext,
  type BackendRequesterContext,
} from "./requesterContext";
import {
  executeJwtVerificationWithJose,
  type JwtVerificationExecutionOptions,
  resolveJwtVerificationRuntimeExecution,
} from "./jwtProviderVerificationStrategy";
import { readJwtVerificationConfiguration } from "./jwtVerificationConfiguration";
import { readTrustedAuthProviderRuntimeConfig } from "./trustedAuthProviderRuntimeConfig";
import { normalizeWorkspaceRole, type CanonicalWorkspaceRole } from "./workspaceRoleNormalization";
import { readWorkspaceMembershipRuntimeGate } from "./workspaceMembershipLookup";
import type {
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceRepository,
} from "../repositories/repositoryContracts";

export interface BackendRequesterContextResolverInput {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
}

export interface BackendRequesterContextResolver {
  resolve(input?: BackendRequesterContextResolverInput): BackendRequesterContext;
}

export interface AsyncBackendRequesterContextResolver {
  resolve(
    input?: BackendRequesterContextResolverInput,
  ): Promise<BackendRequesterContext>;
}

export interface BackendRequesterContextLookupDependencies {
  userAccountRepository: BackendUserAccountRepository;
  workspaceRepository: BackendWorkspaceRepository;
  workspaceMembershipRepository: BackendWorkspaceMembershipRepository;
}

export interface BackendRequesterContextRuntimeResolverOptions {
  repositories: BackendRequesterContextLookupDependencies;
  env?: Record<string, string | undefined>;
  jwtVerificationExecutionOptions?: Pick<JwtVerificationExecutionOptions, "jwks">;
}

const withWorkspaceAuthority = (
  requester: BackendAuthenticatedRequesterContext,
  authority:
    | {
        workspaceAuthority: "verified";
        workspaceId: string;
        workspaceRole: CanonicalWorkspaceRole;
      }
    | {
        workspaceAuthority: "not_available";
        workspaceAuthorityReason:
          | "workspace_runtime_not_enabled"
          | "no_active_workspace_membership"
          | "multiple_active_workspace_memberships";
      },
): BackendAuthenticatedRequesterContext => ({
  ...requester,
  ...authority,
});

const resolveActiveWorkspaceAuthority = async (
  userId: string,
  repositories: BackendRequesterContextLookupDependencies,
): Promise<
  | {
      kind: "verified_workspace";
      workspaceId: string;
      workspaceRole: CanonicalWorkspaceRole;
    }
  | {
      kind: "no_workspace_authority";
      reason:
        | "no_active_workspace_membership"
        | "multiple_active_workspace_memberships";
    }
> => {
  const workspaces = await repositories.workspaceRepository.listForUser(userId);
  const activeMemberships: Array<{
    workspaceId: string;
    workspaceRole: CanonicalWorkspaceRole;
  }> = [];

  for (const workspace of workspaces) {
    const membership = await repositories.workspaceMembershipRepository.getMembership(
      workspace.workspaceId,
      userId,
    );

    if (!membership || membership.status !== "active") {
      continue;
    }

    const workspaceRole = normalizeWorkspaceRole(membership.role);

    if (workspaceRole === "unknown") {
      continue;
    }

    activeMemberships.push({
      workspaceId: workspace.workspaceId,
      workspaceRole,
    });
  }

  if (activeMemberships.length === 1) {
    return {
      kind: "verified_workspace",
      workspaceId: activeMemberships[0].workspaceId,
      workspaceRole: activeMemberships[0].workspaceRole,
    };
  }

  return {
    kind: "no_workspace_authority",
    reason:
      activeMemberships.length > 1
        ? "multiple_active_workspace_memberships"
        : "no_active_workspace_membership",
  };
};

/**
 * Phase 81 boundary resolver.
 *
 * This intentionally does not authenticate users yet.
 * It provides a safe, explicit requester-context seam for future auth integration.
 *
 * Safety rules:
 * - Must not fabricate a user identity.
 * - Must not trust arbitrary headers as authenticated identity.
 * - Must not read service-role secrets.
 * - Must not apply RLS policies.
 * - Must not change route authorization behavior.
 */
export const createAuthNotConfiguredRequesterContextResolver =
  (): BackendRequesterContextResolver => ({
    resolve: () => createUnauthenticatedRequesterContext("auth_not_configured"),
  });

export const resolveRequesterContext = (
  input?: BackendRequesterContextResolverInput,
): BackendRequesterContext => {
  void input;

  return createUnauthenticatedRequesterContext("auth_not_configured");
};

export const createRepositoryBackedRequesterContextResolver = (
  options: BackendRequesterContextRuntimeResolverOptions,
): AsyncBackendRequesterContextResolver => ({
  resolve: async (input) => {
    const runtimeConfig = readTrustedAuthProviderRuntimeConfig(options.env);

    if (
      runtimeConfig.kind !== "auth_provider_configured" ||
      runtimeConfig.provider !== "future_jwt_provider"
    ) {
      return createUnauthenticatedRequesterContext("auth_not_configured");
    }

    const verificationConfig = readJwtVerificationConfiguration(options.env);
    const execution = resolveJwtVerificationRuntimeExecution(options.env);
    const jwtVerification = await executeJwtVerificationWithJose(
      { headers: input?.headers },
      verificationConfig,
      {
        executeRealVerification: execution.realVerificationEnabled,
        ...(options.jwtVerificationExecutionOptions?.jwks
          ? { jwks: options.jwtVerificationExecutionOptions.jwks }
          : {}),
      },
    );

    if (jwtVerification.kind !== "verified") {
      return createUnauthenticatedRequesterContext(jwtVerification.reason);
    }

    const appUser = await options.repositories.userAccountRepository.getByAuthSubject(
      "supabase",
      jwtVerification.authSubject,
    );

    if (!appUser) {
      return createUnauthenticatedRequesterContext("invalid_credentials");
    }

    const requester = createAuthenticatedRequesterContext({
      userId: appUser.userId,
      appUserId: appUser.userId,
      supabaseUserId: jwtVerification.authSubject,
      authProvider: "supabase",
      authSubject: jwtVerification.authSubject,
      ...(appUser.email ? { email: appUser.email } : {}),
    });

    const workspaceRuntimeGate = readWorkspaceMembershipRuntimeGate(options.env);

    if (!workspaceRuntimeGate.runtimeEnabled) {
      return withWorkspaceAuthority(requester, {
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: "workspace_runtime_not_enabled",
      });
    }

    const workspaceAuthority = await resolveActiveWorkspaceAuthority(
      appUser.userId,
      options.repositories,
    );

    if (workspaceAuthority.kind !== "verified_workspace") {
      return withWorkspaceAuthority(requester, {
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: workspaceAuthority.reason,
      });
    }

    return withWorkspaceAuthority(requester, {
      workspaceAuthority: "verified",
      workspaceId: workspaceAuthority.workspaceId,
      workspaceRole: workspaceAuthority.workspaceRole,
    });
  },
});
