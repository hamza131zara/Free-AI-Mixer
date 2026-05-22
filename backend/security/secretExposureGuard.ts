export type SecretExposureScanContext =
  | "frontend_source"
  | "backend_source"
  | "docs_source"
  | "unknown";

export type SecretExposureFindingKind =
  | "service_role_reference"
  | "frontend_service_role_env"
  | "public_url_generation"
  | "direct_frontend_storage"
  | "suspicious_private_key";

export interface SecretExposureFinding {
  kind: SecretExposureFindingKind;
  token: string;
}

export type SecretExposureGuardDecision =
  | {
      kind: "safe";
      findings: [];
      safeToExpose: true;
    }
  | {
      kind: "unsafe";
      findings: SecretExposureFinding[];
      safeToExpose: false;
    };

export interface ScanForSecretExposureInput {
  content: string;
  context?: SecretExposureScanContext;
}

const uniqueFindings = (
  findings: SecretExposureFinding[],
): SecretExposureFinding[] => {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    const key = `${finding.kind}:${finding.token}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const includesCaseInsensitive = (content: string, token: string): boolean =>
  content.toLowerCase().includes(token.toLowerCase());

/**
 * Phase 176-B secret exposure guard boundary.
 *
 * This helper scans source/config/documentation text for unsafe secret exposure
 * markers. It does not read files, mutate routes, log secrets, call remote
 * services, or expose secret values.
 *
 * Safety rules:
 * - no route behavior change
 * - no frontend Supabase/storage access
 * - no public URL enablement
 * - no service-role shortcut
 * - no remote dependency
 */
export const scanForSecretExposure = ({
  content,
  context = "unknown",
}: ScanForSecretExposureInput): SecretExposureGuardDecision => {
  const findings: SecretExposureFinding[] = [];

  const serviceRoleTokens = [
    "service_role",
    "SERVICE_ROLE",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  for (const token of serviceRoleTokens) {
    if (includesCaseInsensitive(content, token)) {
      findings.push({
        kind: "service_role_reference",
        token,
      });
    }
  }

  const frontendServiceRoleEnvTokens = [
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE",
    "VITE_SUPABASE_SERVICE_ROLE",
    "PUBLIC_SUPABASE_SERVICE_ROLE",
  ];

  for (const token of frontendServiceRoleEnvTokens) {
    if (includesCaseInsensitive(content, token)) {
      findings.push({
        kind: "frontend_service_role_env",
        token,
      });
    }
  }

  if (content.includes("getPublicUrl")) {
    findings.push({
      kind: "public_url_generation",
      token: "getPublicUrl",
    });
  }

  if (
    context === "frontend_source" &&
    (content.includes("@supabase/supabase-js") ||
      content.includes("createClient(") ||
      content.includes(".storage.from("))
  ) {
    findings.push({
      kind: "direct_frontend_storage",
      token: "frontend_supabase_storage",
    });
  }

  if (
    content.includes("-----BEGIN PRIVATE KEY-----") ||
    content.includes("-----BEGIN RSA PRIVATE KEY-----")
  ) {
    findings.push({
      kind: "suspicious_private_key",
      token: "private_key_block",
    });
  }

  const normalizedFindings = uniqueFindings(findings);

  if (normalizedFindings.length > 0) {
    return {
      kind: "unsafe",
      findings: normalizedFindings,
      safeToExpose: false,
    };
  }

  return {
    kind: "safe",
    findings: [],
    safeToExpose: true,
  };
};

export const isSecretExposureSafe = (
  decision: SecretExposureGuardDecision,
): decision is Extract<SecretExposureGuardDecision, { kind: "safe" }> =>
  decision.kind === "safe";
