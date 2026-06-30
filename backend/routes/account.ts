import { createHash } from "node:crypto";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type {
  BackendAccountBootstrapResponse,
} from "../contracts/accountHttpTypes";
import type {
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceRepository,
} from "../repositories/repositoryContracts";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import {
  executeJwtVerificationWithJose,
  type JwtVerificationExecutionOptions,
} from "../auth/jwtProviderVerificationStrategy";
import { readJwtVerificationConfiguration } from "../auth/jwtVerificationConfiguration";
import { resolveJwtVerificationRuntimeExecution } from "../auth/jwtProviderVerificationStrategy";
import { normalizeWorkspaceRole } from "../auth/workspaceRoleNormalization";
import { readWorkspaceMembershipRuntimeGate } from "../auth/workspaceMembershipLookup";
import type { BackendRequesterContextRequest } from "../auth/trustedAuthMiddleware";
import {
  applySensitiveAuthResponseHeaders,
  createSensitiveAuthErrorHandler,
} from "./sensitiveAuthResponse";

const personalWorkspaceName = "Personal Workspace";

export interface VerifiedAuthUserProfile {
  email?: string;
  emailVerified: boolean;
}

export interface AccountBootstrapDependencies {
  userAccountRepository: BackendUserAccountRepository;
  workspaceRepository: BackendWorkspaceRepository;
  workspaceMembershipRepository: BackendWorkspaceMembershipRepository;
  getVerifiedAuthUserProfile: (
    userId: string,
  ) => Promise<VerifiedAuthUserProfile | undefined>;
}

export interface CreateAccountRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  dependencies?: AccountBootstrapDependencies;
  env?: Record<string, string | undefined>;
  jwtVerificationExecutionOptions?: Pick<JwtVerificationExecutionOptions, "jwks">;
}

const toUnavailableResponse = (
  response: Response<BackendAccountBootstrapResponse>,
  status: "auth_not_configured" | "auth_provider_unavailable" | "bootstrap_unavailable",
  message: string,
): Response<BackendAccountBootstrapResponse> =>
  response.status(status === "bootstrap_unavailable" ? 503 : status === "auth_not_configured" ? 503 : 501).json({
    kind: "bootstrap_unavailable",
    status,
    message,
  });

const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const createDeterministicUuid = (seed: string): string => {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  const parts = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ];

  return parts.join("-");
};

const createPersonalWorkspaceId = (userId: string): string =>
  createDeterministicUuid(`free-ai-mixer:personal-workspace:${userId}`);

type BootstrapIdentity = {
  userId: string;
  appUserId?: string;
  supabaseUserId?: string;
  workspaceId?: string;
  workspaceRole?: string;
  workspaceAuthority?: "verified" | "not_available";
  workspaceAuthorityReason?:
    | "workspace_runtime_not_enabled"
    | "no_active_workspace_membership"
    | "multiple_active_workspace_memberships";
  authProvider?: string;
  authSubject?: string;
  email?: string;
};

const toIdentity = (input: {
  userId: string;
  workspaceId?: string;
  workspaceRole?: string;
  workspaceAuthority?: "verified" | "not_available";
  workspaceAuthorityReason?:
    | "workspace_runtime_not_enabled"
    | "no_active_workspace_membership"
    | "multiple_active_workspace_memberships";
  email?: string;
}): BootstrapIdentity => ({
  userId: input.userId,
  appUserId: input.userId,
  supabaseUserId: input.userId,
  authProvider: "supabase",
  authSubject: input.userId,
  ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
  ...(input.workspaceRole ? { workspaceRole: input.workspaceRole } : {}),
  ...(input.workspaceAuthority ? { workspaceAuthority: input.workspaceAuthority } : {}),
  ...(input.workspaceAuthorityReason
    ? { workspaceAuthorityReason: input.workspaceAuthorityReason }
    : {}),
  ...(input.email ? { email: input.email } : {}),
});

const verifyBootstrapBearer = async (
  request: Request,
  options: CreateAccountRouterOptions,
) => {
  const middlewareRequesterContext = (request as BackendRequesterContextRequest)
    .backendRequesterContext;

  if (
    middlewareRequesterContext?.kind === "authenticated" &&
    middlewareRequesterContext.authProvider === "jwt" &&
    middlewareRequesterContext.authSubject
  ) {
    if (!isUuidLike(middlewareRequesterContext.authSubject)) {
      return {
        kind: "invalid" as const,
        reason: "invalid_credentials" as const,
        message: "The supplied authentication credentials could not be verified safely.",
      };
    }

    return {
      kind: "verified" as const,
      subject: middlewareRequesterContext.authSubject,
    };
  }

  if (middlewareRequesterContext?.kind === "unauthenticated") {
    if (middlewareRequesterContext.reason === "auth_not_configured") {
      return {
        kind: "unavailable" as const,
        status: "auth_not_configured" as const,
        message: "Authentication is not configured on this backend yet.",
      };
    }

    if (middlewareRequesterContext.reason === "auth_provider_unavailable") {
      return {
        kind: "unavailable" as const,
        status: "auth_provider_unavailable" as const,
        message: "Authentication is configured but not available in this product phase.",
      };
    }

    if (middlewareRequesterContext.reason === "missing_credentials") {
      return {
        kind: "invalid" as const,
        reason: "missing_credentials" as const,
        message: "A verified bearer token is required before account setup can continue.",
      };
    }

    return {
      kind: "invalid" as const,
      reason: "invalid_credentials" as const,
      message: "The supplied authentication credentials could not be verified safely.",
    };
  }

  const runtimeConfig = options.runtimeConfig;

  if (
    runtimeConfig.kind !== "auth_provider_configured" ||
    runtimeConfig.provider !== "future_jwt_provider"
  ) {
    const status: "auth_not_configured" | "auth_provider_unavailable" =
      runtimeConfig.kind === "auth_provider_not_configured"
        ? "auth_not_configured"
        : "auth_provider_unavailable";

    return {
      kind: "unavailable" as const,
      status,
      message:
        runtimeConfig.kind === "auth_provider_not_configured"
          ? "Authentication is not configured on this backend yet."
          : "Authentication is configured but not available in this product phase.",
    };
  }

  const verificationConfig = readJwtVerificationConfiguration(options.env);
  const execution = resolveJwtVerificationRuntimeExecution(options.env);

  if (!execution.realVerificationEnabled) {
    return {
      kind: "unavailable" as const,
      status: "auth_provider_unavailable" as const,
      message: "Authentication is configured but not available in this product phase.",
    };
  }

  const verification = await executeJwtVerificationWithJose(
    { headers: request.headers },
    verificationConfig,
    {
      executeRealVerification: execution.realVerificationEnabled,
      ...(options.jwtVerificationExecutionOptions?.jwks
        ? { jwks: options.jwtVerificationExecutionOptions.jwks }
        : {}),
    },
  );

  if (verification.kind !== "verified") {
    const reason: "missing_credentials" | "invalid_credentials" =
      verification.reason === "missing_credentials"
        ? "missing_credentials"
        : "invalid_credentials";

    return {
      kind: "invalid" as const,
      reason,
      message:
        verification.reason === "missing_credentials"
          ? "A verified bearer token is required before account setup can continue."
          : "The supplied authentication credentials could not be verified safely.",
    };
  }

  if (!isUuidLike(verification.authSubject)) {
    return {
      kind: "invalid" as const,
      reason: "invalid_credentials" as const,
      message: "The supplied authentication credentials could not be verified safely.",
    };
  }

  return {
    kind: "verified" as const,
    subject: verification.authSubject,
  };
};

export const createAccountRouter = (
  options: CreateAccountRouterOptions,
): Router => {
  const router = Router();

  router.use(applySensitiveAuthResponseHeaders);

  const handleAccountBootstrap = (
    request: Request,
    response: Response<BackendAccountBootstrapResponse>,
    next: NextFunction,
  ) => {
    void (async () => {
      const bearer = await verifyBootstrapBearer(request, options);

      if (bearer.kind === "unavailable") {
        toUnavailableResponse(response, bearer.status, bearer.message);
        return;
      }

      if (bearer.kind === "invalid") {
        response.status(401).json({
          kind: "invalid_credentials",
          status: "unauthenticated",
          reason: bearer.reason,
          message: bearer.message,
        });
        return;
      }

      if (!options.dependencies) {
        toUnavailableResponse(
          response,
          "bootstrap_unavailable",
          "Account bootstrap is not available on this backend yet.",
        );
        return;
      }

      const verifiedAuthProfile = await options.dependencies.getVerifiedAuthUserProfile(
        bearer.subject,
      );

      if (!verifiedAuthProfile?.emailVerified) {
        response.status(403).json({
          kind: "email_verification_required",
          status: "verification_required",
          message:
            "Check your email to verify your account before Free AI Mixer account setup can continue.",
        });
        return;
      }

      const userAccountResult =
        await options.dependencies.userAccountRepository.createOrGetByAuthSubject({
          userId: bearer.subject,
          authProvider: "supabase",
          authSubject: bearer.subject,
          ...(verifiedAuthProfile.email ? { email: verifiedAuthProfile.email } : {}),
        });
      const userAccount = userAccountResult.userAccount;

      const workspaceRuntimeGate = readWorkspaceMembershipRuntimeGate(options.env);

      if (!workspaceRuntimeGate.runtimeEnabled) {
        response.status(503).json({
          kind: "bootstrap_unavailable",
          status: "bootstrap_unavailable",
          message: "Workspace authority is not configured on this backend yet.",
        });
        return;
      }

      const existingMemberships =
        await options.dependencies.workspaceMembershipRepository.listMembershipsForUser(
          userAccount.userId,
        );

      if (
        existingMemberships.some(
          (membership) =>
            membership.userId !== userAccount.userId ||
            !isUuidLike(membership.workspaceId),
        )
      ) {
        response.status(503).json({
          kind: "bootstrap_unavailable",
          status: "bootstrap_unavailable",
          message: "Account bootstrap encountered inconsistent workspace authority.",
        });
        return;
      }

      const activeMemberships = existingMemberships.filter(
        (membership) => membership.status === "active",
      );
      const nonActiveMemberships = existingMemberships.filter(
        (membership) => membership.status !== "active",
      );

      if (activeMemberships.length > 1) {
        response.status(409).json({
          kind: "workspace_bootstrap_blocked",
          status: "workspace_selection_required",
          reason: "multiple_active_memberships",
          message:
            "Free AI Mixer setup is complete, but workspace selection is required before an active workspace can be chosen safely.",
          identity: toIdentity({
            userId: userAccount.userId,
            workspaceAuthority: "not_available",
            workspaceAuthorityReason: "multiple_active_workspace_memberships",
            ...(verifiedAuthProfile.email ? { email: verifiedAuthProfile.email } : {}),
          }),
        });
        return;
      }

      if (activeMemberships.length === 0 && nonActiveMemberships.length > 0) {
        response.status(403).json({
          kind: "workspace_bootstrap_blocked",
          status: "workspace_bootstrap_blocked",
          reason: "inactive_membership_exists",
          message:
            "Workspace setup cannot continue while an inactive membership record exists.",
        });
        return;
      }

      if (activeMemberships.length === 1) {
        const membership = activeMemberships[0];
        const workspaceRecord =
          await options.dependencies.workspaceRepository.getByWorkspaceId(
            membership.workspaceId,
          );
        const workspaceRole = normalizeWorkspaceRole(membership.role);

        if (
          !workspaceRecord ||
          workspaceRecord.workspaceId !== membership.workspaceId ||
          workspaceRecord.deletedAt !== undefined ||
          workspaceRole === "unknown"
        ) {
          response.status(503).json({
            kind: "bootstrap_unavailable",
            status: "bootstrap_unavailable",
            message: "Account bootstrap could not verify workspace authority safely.",
          });
          return;
        }

        response.status(200).json({
          kind: "account_bootstrap_complete",
          status: "authenticated",
          message: "Free AI Mixer account setup is complete.",
          identity: toIdentity({
            userId: userAccount.userId,
            workspaceId: membership.workspaceId,
            workspaceRole,
            workspaceAuthority: "verified",
            ...(verifiedAuthProfile.email ? { email: verifiedAuthProfile.email } : {}),
          }),
          bootstrap: {
            appUserCreated: userAccountResult.created,
            workspaceCreated: false,
            membershipCreated: false,
          },
        });
        return;
      }

      const personalWorkspaceId = createPersonalWorkspaceId(userAccount.userId);
      const workspaceResult =
        await options.dependencies.workspaceRepository.createPersonalWorkspace({
          workspaceId: personalWorkspaceId,
          userId: userAccount.userId,
          name: personalWorkspaceName,
        });
      const workspaceRecord = workspaceResult.workspace;

      if (
        workspaceRecord.workspaceId !== personalWorkspaceId ||
        workspaceRecord.createdByUserId !== userAccount.userId ||
        workspaceRecord.deletedAt !== undefined
      ) {
        response.status(503).json({
          kind: "bootstrap_unavailable",
          status: "bootstrap_unavailable",
          message: "Account bootstrap could not verify a personal workspace safely.",
        });
        return;
      }

      const membershipResult =
        await options.dependencies.workspaceMembershipRepository.createOrGetMembership({
          workspaceId: personalWorkspaceId,
          userId: userAccount.userId,
          role: "owner",
          status: "active",
        });
      const membership = membershipResult.membership;
      const workspaceRole = normalizeWorkspaceRole(membership.role);

      if (
        membership.workspaceId !== personalWorkspaceId ||
        membership.userId !== userAccount.userId ||
        membership.role !== "owner" ||
        membership.status !== "active" ||
        workspaceRole !== "workspace_owner"
      ) {
        throw new Error(
          "Account bootstrap membership creation returned an inconsistent record.",
        );
      }

      response.status(200).json({
        kind: "account_bootstrap_complete",
        status: "authenticated",
        message: "Free AI Mixer account setup is complete.",
        identity: toIdentity({
          userId: userAccount.userId,
          workspaceId: personalWorkspaceId,
          workspaceRole,
          workspaceAuthority: "verified",
          ...(verifiedAuthProfile.email ? { email: verifiedAuthProfile.email } : {}),
        }),
        bootstrap: {
          appUserCreated: userAccountResult.created,
          workspaceCreated: workspaceResult.created,
          membershipCreated: membershipResult.created,
        },
      });
    })().catch(next);
  };

  router.post("/account/bootstrap", handleAccountBootstrap);

  router.use(createSensitiveAuthErrorHandler({ kind: "account" }));

  return router;
};
