import type { IncomingHttpHeaders } from "node:http";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { BackendRequesterContext } from "./requesterContext";
import { createUnauthenticatedRequesterContext } from "./requesterContext";

export interface TrustedJwtVerificationInput {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
  issuer?: string;
  audience?: string;
}

export type TrustedJwtVerificationResult =
  | {
      kind: "verified";
      userId: string;
      workspaceId: string;
      authProvider: "jwt";
      authSubject: string;
    }
  | {
      kind: "not_verified";
      reason: "missing_credentials" | "invalid_credentials" | "auth_not_configured";
    };

export interface TrustedJwtVerificationStrategy {
  kind: "jwt_verification_not_configured" | "future_jwt_verification";
  verify(input?: TrustedJwtVerificationInput): Promise<TrustedJwtVerificationResult>;
}

export interface JoseRuntimeImportBoundaryStatus {
  jwtVerifyImported: boolean;
  createRemoteJWKSetImported: boolean;
  realVerificationEnabled: false;
}

/**
 * Phase 119 import boundary.
 *
 * This proves the selected `jose` runtime imports are available inside the JWT
 * verification boundary. It intentionally does not execute real verification yet.
 */
export const getJoseRuntimeImportBoundaryStatus =
  (): JoseRuntimeImportBoundaryStatus => ({
    jwtVerifyImported: typeof jwtVerify === "function",
    createRemoteJWKSetImported: typeof createRemoteJWKSet === "function",
    realVerificationEnabled: false,
  });

const getAuthorizationHeader = (
  headers?: TrustedJwtVerificationInput["headers"],
): string | undefined => {
  const value = headers?.authorization ?? headers?.Authorization;

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const createJwtVerificationNotConfiguredStrategy =
  (): TrustedJwtVerificationStrategy => ({
    kind: "jwt_verification_not_configured",
    verify: async () => ({
      kind: "not_verified",
      reason: "auth_not_configured",
    }),
  });

export const createFailClosedFutureJwtVerificationStrategy =
  (): TrustedJwtVerificationStrategy => ({
    kind: "future_jwt_verification",
    verify: async (input) => {
      const authorizationHeader = getAuthorizationHeader(input?.headers);

      if (!authorizationHeader) {
        return {
          kind: "not_verified",
          reason: "missing_credentials",
        };
      }

      return {
        kind: "not_verified",
        reason: "invalid_credentials",
      };
    },
  });

export const mapJwtVerificationResultToRequesterContext = (
  result: TrustedJwtVerificationResult,
): BackendRequesterContext => {
  if (result.kind === "not_verified") {
    return createUnauthenticatedRequesterContext(result.reason);
  }

  return {
    kind: "authenticated",
    userId: result.userId,
    workspaceId: result.workspaceId,
    authProvider: result.authProvider,
    authSubject: result.authSubject,
  };
};

