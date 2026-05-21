export type JwtVerificationDependencyCandidate = "jose" | "jsonwebtoken";

export type JwtVerificationDependencyDecision =
  | {
      kind: "selected";
      packageName: "jose";
      reason:
        | "modern_jwks_and_jwt_verify_support"
        | "web_crypto_friendly"
        | "issuer_audience_expiry_validation_ready";
    }
  | {
      kind: "rejected";
      packageName: "jsonwebtoken";
      reason:
        | "legacy_api_surface"
        | "jwks_support_requires_extra_plumbing"
        | "less_suitable_for_future_runtime_boundary";
    };

export const getJwtVerificationDependencyDecision =
  (): JwtVerificationDependencyDecision => ({
    kind: "selected",
    packageName: "jose",
    reason: "modern_jwks_and_jwt_verify_support",
  });

export const getRejectedJwtVerificationDependencyDecisions =
  (): JwtVerificationDependencyDecision[] => [
    {
      kind: "rejected",
      packageName: "jsonwebtoken",
      reason: "jwks_support_requires_extra_plumbing",
    },
  ];

/**
 * Phase 115 decision boundary.
 *
 * This records the future dependency selection only.
 * It intentionally does not install, import, or execute JWT verification.
 *
 * Safety rules:
 * - Must not import the selected dependency yet.
 * - Must not verify real JWTs yet.
 * - Must not read private keys or token secrets.
 * - Must not fabricate authenticated identity.
 * - Must not trust arbitrary headers.
 * - Must not enable route authorization.
 * - Must not enable public artifact delivery.
 */
export const isJwtVerificationDependencyInstalledYet = (): false => false;
