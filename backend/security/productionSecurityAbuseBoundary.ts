export type ProductionSecurityAbuseBoundaryReason =
  | "unauthenticated"
  | "forbidden"
  | "expired_descriptor"
  | "unsafe_metadata"
  | "unsafe_navigation_target"
  | "rate_limit_exceeded";

export type ProductionSecurityAbuseBoundaryDecision =
  | {
      kind: "allowed";
      safeToProceed: true;
    }
  | {
      kind: "blocked";
      reason: ProductionSecurityAbuseBoundaryReason;
      safeToProceed: false;
    };

export interface DecideProductionSecurityAbuseBoundaryInput {
  authenticated: boolean;
  authorized: boolean;
  safeMetadataOnly: boolean;
  descriptorExpiresAt?: string;
  navigationTarget?: string;
  now?: Date;
  requestCountInWindow?: number;
  maxRequestsPerWindow?: number;
}

const isExpired = (expiresAt: string | undefined, now: Date): boolean => {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= now.getTime();
};

const isSafeNavigationTarget = (target: string | undefined): boolean => {
  if (!target) {
    return true;
  }

  if (target.startsWith("/exports/")) {
    return (
      !target.startsWith("//") &&
      !target.includes("..") &&
      !target.includes("\\") &&
      !target.includes("file:")
    );
  }

  try {
    const parsed = new URL(target);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Phase 177 production security regression + abuse boundary.
 *
 * This helper is intentionally pure and not route-wired.
 *
 * Safety rules:
 * - no fake auth/session/user
 * - no route behavior change
 * - no public URL generation
 * - no frontend Supabase/storage access
 * - no service-role shortcut
 * - no remote dependency
 */
export const decideProductionSecurityAbuseBoundary = ({
  authenticated,
  authorized,
  safeMetadataOnly,
  descriptorExpiresAt,
  navigationTarget,
  now = new Date(),
  requestCountInWindow = 0,
  maxRequestsPerWindow = 60,
}: DecideProductionSecurityAbuseBoundaryInput): ProductionSecurityAbuseBoundaryDecision => {
  if (!authenticated) {
    return {
      kind: "blocked",
      reason: "unauthenticated",
      safeToProceed: false,
    };
  }

  if (!authorized) {
    return {
      kind: "blocked",
      reason: "forbidden",
      safeToProceed: false,
    };
  }

  if (!safeMetadataOnly) {
    return {
      kind: "blocked",
      reason: "unsafe_metadata",
      safeToProceed: false,
    };
  }

  if (isExpired(descriptorExpiresAt, now)) {
    return {
      kind: "blocked",
      reason: "expired_descriptor",
      safeToProceed: false,
    };
  }

  if (!isSafeNavigationTarget(navigationTarget)) {
    return {
      kind: "blocked",
      reason: "unsafe_navigation_target",
      safeToProceed: false,
    };
  }

  if (requestCountInWindow > maxRequestsPerWindow) {
    return {
      kind: "blocked",
      reason: "rate_limit_exceeded",
      safeToProceed: false,
    };
  }

  return {
    kind: "allowed",
    safeToProceed: true,
  };
};
