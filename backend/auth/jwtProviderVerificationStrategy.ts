import type { IncomingHttpHeaders } from "node:http";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from "jose";
import type { BackendRequesterContext } from "./requesterContext";
import { createUnauthenticatedRequesterContext } from "./requesterContext";
import {
  readJwtVerificationConfiguration,
  readJwtVerificationRuntimeGate,
  type JwtVerificationConfiguration,
  type JwtVerificationConfigurationEnv,
} from "./jwtVerificationConfiguration";

export interface TrustedJwtVerificationInput {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
  issuer?: string;
  audience?: string;
}

export interface JwtBoundaryVerificationInput extends TrustedJwtVerificationInput {
  token?: string;
}

export interface TrustedJwtVerificationStrategyOptions {
  verificationConfig?: JwtVerificationConfiguration;
  executeRealVerification?: boolean;
}

export interface JwtBoundaryIdentity {
  authenticated: true;
  authProvider: "jwt";
  authSubject: string;
  supabaseUserId: string;
  email?: string;
}

export type JwtBoundaryVerificationFailureReason =
  | "auth_not_configured"
  | "verification_not_enabled"
  | "missing_bearer_token"
  | "malformed_token"
  | "invalid_signature"
  | "invalid_issuer"
  | "invalid_audience"
  | "token_expired"
  | "disallowed_algorithm"
  | "invalid_credentials";

export type JwtBoundaryVerificationResult =
  | {
      kind: "verified";
      identity: JwtBoundaryIdentity;
      claimsIgnoredForAuthorization: Array<
        | "workspaceId"
        | "workspace_id"
        | "workspaceRole"
        | "workspace_role"
        | "platformRole"
        | "platform_role"
      >;
    }
  | {
      kind: "not_verified";
      reason: JwtBoundaryVerificationFailureReason;
    };

export type TrustedJwtVerificationResult =
  | {
      kind: "verified";
      userId: string;
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
      reason:
        | "missing_config"
        | "not_configured"
        | "unsupported_key_mode"
        | "invalid_jwks_uri";
      realVerificationEnabled: false;
    };

export interface JwtVerificationExecutionOptions {
  executeRealVerification?: boolean;
  jwks?:
    | ReturnType<typeof createRemoteJWKSet>
    | ReturnType<typeof createLocalJwksForJwtVerification>;
}

export interface JwtBoundaryLocalJwksSet {
  keys: JWK[];
}

export const getJoseRuntimeImportBoundaryStatus =
  (): JoseRuntimeImportBoundaryStatus => ({
    jwtVerifyImported: typeof jwtVerify === "function",
    createRemoteJWKSetImported: typeof createRemoteJWKSet === "function",
    realVerificationEnabled: false,
  });

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

export const createLocalJwksForJwtVerification = (
  jwks: JwtBoundaryLocalJwksSet,
) => createLocalJWKSet(jwks);

const getAuthorizationHeader = (
  headers?: TrustedJwtVerificationInput["headers"],
): string | undefined => {
  const value = headers?.authorization ?? headers?.Authorization;

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const extractBearerTokenFromHeaders = (
  headers?: TrustedJwtVerificationInput["headers"],
): string | undefined => {
  const authorizationHeader = getAuthorizationHeader(headers);

  if (!authorizationHeader) {
    return undefined;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return undefined;
  }

  const token = match[1]?.trim();
  return token && token.length > 0 ? token : undefined;
};

export const mapVerifiedJwtPayloadToVerificationResult = (
  payload: JWTPayload,
): TrustedJwtVerificationResult => {
  const subject = payload.sub;

  if (!subject) {
    return {
      kind: "not_verified",
      reason: "invalid_credentials",
    };
  }

  return {
    kind: "verified",
    userId: subject,
    authProvider: "jwt",
    authSubject: subject,
  };
};

const toJwtBoundaryFailureReason = (
  error: unknown,
): JwtBoundaryVerificationFailureReason => {
  const errorLike = error as {
    code?: string;
    claim?: string;
    message?: string;
  };

  if (errorLike?.code === "ERR_JWT_EXPIRED") {
    return "token_expired";
  }

  if (errorLike?.code === "ERR_JOSE_ALG_NOT_ALLOWED") {
    return "disallowed_algorithm";
  }

  if (
    errorLike?.code === "ERR_JWT_MALFORMED" ||
    errorLike?.code === "ERR_JWS_INVALID"
  ) {
    return "malformed_token";
  }

  if (errorLike?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
    return "invalid_signature";
  }

  if (errorLike?.code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
    if (
      errorLike.claim === "iss" ||
      errorLike.message?.includes('"iss"')
    ) {
      return "invalid_issuer";
    }

    if (
      errorLike.claim === "aud" ||
      errorLike.message?.includes('"aud"')
    ) {
      return "invalid_audience";
    }
  }

  return "invalid_credentials";
};

const mapPayloadToJwtBoundaryIdentity = (
  payload: JWTPayload,
): JwtBoundaryVerificationResult => {
  const subject = payload.sub;

  if (!subject) {
    return {
      kind: "not_verified",
      reason: "invalid_credentials",
    };
  }

  const email =
    typeof payload.email === "string" && payload.email.length > 0
      ? payload.email
      : undefined;

  return {
    kind: "verified",
    identity: {
      authenticated: true,
      authProvider: "jwt",
      authSubject: subject,
      supabaseUserId: subject,
      ...(email ? { email } : {}),
    },
    claimsIgnoredForAuthorization: [
      "workspaceId",
      "workspace_id",
      "workspaceRole",
      "workspace_role",
      "platformRole",
      "platform_role",
    ],
  };
};

export const verifyJwtBoundaryWithJose = async (
  input: JwtBoundaryVerificationInput,
  config: JwtVerificationConfiguration | undefined,
  options: {
    executeRealVerification?: boolean;
    jwks?:
      | ReturnType<typeof createRemoteJWKSet>
      | ReturnType<typeof createLocalJwksForJwtVerification>;
  } = {},
): Promise<JwtBoundaryVerificationResult> => {
  if (!config || config.kind === "jwt_verification_not_configured") {
    return {
      kind: "not_verified",
      reason: "auth_not_configured",
    };
  }

  if (!options.executeRealVerification) {
    return {
      kind: "not_verified",
      reason: "verification_not_enabled",
    };
  }

  const token = input.token ?? extractBearerTokenFromHeaders(input.headers);

  if (!token) {
    return {
      kind: "not_verified",
      reason: "missing_bearer_token",
    };
  }

  const jwksResult = options.jwks
    ? { kind: "constructed" as const, jwks: options.jwks }
    : constructRemoteJwksForJwtVerification(config);

  if (jwksResult.kind !== "constructed") {
    return {
      kind: "not_verified",
      reason: "auth_not_configured",
    };
  }

  try {
    const verified = await jwtVerify(token, jwksResult.jwks, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: config.allowedAlgorithms,
    });

    return mapPayloadToJwtBoundaryIdentity(verified.payload);
  } catch (error) {
    return {
      kind: "not_verified",
      reason: toJwtBoundaryFailureReason(error),
    };
  }
};

export const resolveJwtVerificationRuntimeExecution = (
  env: JwtVerificationConfigurationEnv = process.env,
): {
  kind: "jwt_runtime_execution";
  configured: boolean;
  runtimeEnabled: boolean;
  realVerificationEnabled: boolean;
} => {
  const config = readJwtVerificationConfiguration(env);
  const runtimeGate = readJwtVerificationRuntimeGate(env);

  return {
    kind: "jwt_runtime_execution",
    configured: config.kind === "jwt_verification_configured",
    runtimeEnabled: runtimeGate.runtimeEnabled,
    realVerificationEnabled:
      runtimeGate.runtimeEnabled && config.kind === "jwt_verification_configured",
  };
};

export const executeJwtVerificationWithJose = async (
  input: TrustedJwtVerificationInput,
  config: JwtVerificationConfiguration | undefined,
  options: JwtVerificationExecutionOptions = {},
): Promise<TrustedJwtVerificationResult> => {
  const hasBearerToken = Boolean(extractBearerTokenFromHeaders(input.headers));
  const boundaryResult = await verifyJwtBoundaryWithJose(
    { headers: input.headers },
    config,
    {
      executeRealVerification: options.executeRealVerification === true,
      ...(options.jwks ? { jwks: options.jwks } : {}),
    },
  );

  if (boundaryResult.kind !== "verified") {
    return {
      kind: "not_verified",
      reason:
        boundaryResult.reason === "missing_bearer_token"
          ? "missing_credentials"
          : boundaryResult.reason === "auth_not_configured" ||
              boundaryResult.reason === "verification_not_enabled"
            ? hasBearerToken
              ? "invalid_credentials"
              : "missing_credentials"
            : "invalid_credentials",
    };
  }

  return {
    kind: "verified",
    userId: boundaryResult.identity.supabaseUserId,
    authProvider: "jwt",
    authSubject: boundaryResult.identity.authSubject,
  };
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
  verify: async (input) =>
    executeJwtVerificationWithJose(input ?? {}, options.verificationConfig, {
      executeRealVerification: options.executeRealVerification === true,
    }),
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
    authProvider: result.authProvider,
    authSubject: result.authSubject,
  };
};
