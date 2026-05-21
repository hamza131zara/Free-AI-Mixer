import type { IncomingHttpHeaders } from "node:http";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { BackendRequesterContext } from "./requesterContext";
import { createUnauthenticatedRequesterContext } from "./requesterContext";
import type { JwtVerificationConfiguration } from "./jwtVerificationConfiguration";

export interface TrustedJwtVerificationInput {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
  issuer?: string;
  audience?: string;
}

export interface TrustedJwtVerificationStrategyOptions {
  verificationConfig?: JwtVerificationConfiguration;
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

export interface JwtVerificationExecutionReadiness {
  realVerificationEnabled: false;
  verificationConfigured: boolean;
  configurationReason?: string;
  keyMode?: "remote_jwks";
}

export type JwtRemoteJwksConstructionResult =
  | {
      kind: "constructed";
      jwks: ReturnType<typeof createRemoteJWKSet>;
      jwksUri: string;
      realVerificationEnabled: false;
    }
  | {
      kind: "not_constructed";
      reason: "missing_config" | "not_configured" | "unsupported_key_mode" | "invalid_jwks_uri";
      realVerificationEnabled: false;
    };
export interface JwtVerificationExecutionOptions {
  executeRealVerification?: boolean;
}

export const executeJwtVerificationWithJose = async (
  input: TrustedJwtVerificationInput,
  config: JwtVerificationConfiguration | undefined,
  options: JwtVerificationExecutionOptions = {},
): Promise<TrustedJwtVerificationResult> => {
  const authorizationHeader = getAuthorizationHeader(input.headers);

  if (!authorizationHeader) {
    return {
      kind: "not_verified",
      reason: "missing_credentials",
    };
  }

  if (!options.executeRealVerification) {
    return {
      kind: "not_verified",
      reason: "invalid_credentials",
    };
  }

  const jwksResult = constructRemoteJwksForJwtVerification(config);

  if (jwksResult.kind !== "constructed") {
    return {
      kind: "not_verified",
      reason: "auth_not_configured",
    };
  }

  try {
    const token = authorizationHeader.replace(/^Bearer\s+/i, "").trim();

    const verified = await jwtVerify(token, jwksResult.jwks, {
      issuer: config?.kind === "jwt_verification_configured" ? config.issuer : undefined,
      audience: config?.kind === "jwt_verification_configured" ? config.audience : undefined,
    });

    const subject = verified.payload.sub;

    if (!subject) {
      return {
        kind: "not_verified",
        reason: "invalid_credentials",
      };
    }

    const workspaceId =
      typeof verified.payload.workspaceId === "string"
        ? verified.payload.workspaceId
        : typeof verified.payload.workspace_id === "string"
          ? verified.payload.workspace_id
          : undefined;

    if (!workspaceId) {
      return {
        kind: "not_verified",
        reason: "invalid_credentials",
      };
    }

    return {
      kind: "verified",
      userId: subject,
      workspaceId,
      authProvider: "jwt",
      authSubject: subject,
    };
  } catch {
    return {
      kind: "not_verified",
      reason: "invalid_credentials",
    };
  }
};


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

/**
 * Phase 123 configuration wiring boundary.
 *
 * This lets the JWT verification boundary understand future verification
 * configuration without executing jwtVerify or constructing JWKS yet.
 */
export const getJwtVerificationExecutionReadiness = (
  config?: JwtVerificationConfiguration,
): JwtVerificationExecutionReadiness => {
  if (!config || config.kind === "jwt_verification_not_configured") {
    return {
      realVerificationEnabled: false,
      verificationConfigured: false,
      configurationReason: config?.reason ?? "missing_provider",
    };
  }

  return {
    realVerificationEnabled: false,
    verificationConfigured: true,
    keyMode: config.keyMode,
  };
};

export const constructRemoteJwksForJwtVerification = (
  config?: JwtVerificationConfiguration,
): JwtRemoteJwksConstructionResult => {
  if (!config) {
    return {
      kind: "not_constructed",
      reason: "missing_config",
      realVerificationEnabled: false,
    };
  }

  if (config.kind === "jwt_verification_not_configured") {
    return {
      kind: "not_constructed",
      reason: "not_configured",
      realVerificationEnabled: false,
    };
  }

  if (config.keyMode !== "remote_jwks") {
    return {
      kind: "not_constructed",
      reason: "unsupported_key_mode",
      realVerificationEnabled: false,
    };
  }

  try {
    const jwksUrl = new URL(config.jwksUri);

    return {
      kind: "constructed",
      jwks: createRemoteJWKSet(jwksUrl),
      jwksUri: jwksUrl.toString(),
      realVerificationEnabled: false,
    };
  } catch {
    return {
      kind: "not_constructed",
      reason: "invalid_jwks_uri",
      realVerificationEnabled: false,
    };
  }
};
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

export const createFailClosedFutureJwtVerificationStrategy = (
  options: TrustedJwtVerificationStrategyOptions = {},
): TrustedJwtVerificationStrategy => ({
  kind: "future_jwt_verification",
  verify: async (input) => {
    void getJwtVerificationExecutionReadiness(options.verificationConfig);
    void constructRemoteJwksForJwtVerification(options.verificationConfig);

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





