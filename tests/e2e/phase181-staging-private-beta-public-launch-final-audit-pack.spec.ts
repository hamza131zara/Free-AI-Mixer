import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolvePublicLaunchFinalAudit } from "../../backend/launch/publicLaunchFinalAudit";
import { scanForSecretExposure } from "../../backend/security/secretExposureGuard";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const launchAuditDocs = readSource("docs/public-launch-audit.md");
const deploymentDocs = readSource("docs/deployment.md");
const monitoringDocs = readSource("docs/monitoring.md");
const storageRecoveryDocs = readSource("docs/storage-recovery.md");

test.describe("phase181 staging private beta public launch final audit pack", () => {
  test("public launch final audit fails closed when required launch evidence is missing", async () => {
    expect(resolvePublicLaunchFinalAudit({})).toEqual({
      kind: "not_ready",
      missingItems: [
        "staging_smoke",
        "private_beta_checklist",
        "privacy_security_review",
        "abuse_prevention_review",
        "deployment_readiness",
        "observability_readiness",
        "storage_recovery_readiness",
        "go_no_go_decision",
      ],
      stagingReady: false,
      privateBetaReady: false,
      publicLaunchApproved: false,
    });
  });

  test("public launch final audit reaches go no-go readiness without automatically approving launch", async () => {
    expect(resolvePublicLaunchFinalAudit({
      launchAuditDocsText: launchAuditDocs,
      deploymentDocsText: deploymentDocs,
      monitoringDocsText: monitoringDocs,
      storageRecoveryDocsText: storageRecoveryDocs,
    })).toEqual({
      kind: "ready_for_go_no_go",
      missingItems: [],
      stagingReady: true,
      privateBetaReady: true,
      publicLaunchApproved: false,
    });
  });

  test("final launch audit keeps secrets frontend storage and automatic public launch blocked", async () => {
    const launchAuditSource = readSource("backend/launch/publicLaunchFinalAudit.ts");
    const securityBoundarySource = readSource("backend/security/productionSecurityAbuseBoundary.ts");
    const deploymentReadinessSource = readSource("backend/deployment/productionDeploymentReadiness.ts");
    const observabilitySource = readSource("backend/observability/productionObservability.ts");
    const storageReadinessSource = readSource("backend/storage/storageBackupRecoveryReadiness.ts");

    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    const docsSource =
      launchAuditDocs +
      "\n" +
      deploymentDocs +
      "\n" +
      monitoringDocs +
      "\n" +
      storageRecoveryDocs +
      "\n" +
      readSource("docs/phases.md") +
      "\n" +
      readSource("docs/known-issues.md");

    expect(launchAuditSource).toContain("resolvePublicLaunchFinalAudit");
    expect(launchAuditSource).toContain("publicLaunchApproved: false");
    expect(securityBoundarySource).toContain("decideProductionSecurityAbuseBoundary");
    expect(deploymentReadinessSource).toContain("resolveProductionDeploymentReadiness");
    expect(observabilitySource).toContain("resolveProductionObservabilityReadiness");
    expect(storageReadinessSource).toContain("resolveStorageBackupRecoveryReadiness");

    expect(scanForSecretExposure({
      content: frontendSource,
      context: "frontend_source",
    })).toEqual({
      kind: "safe",
      findings: [],
      safeToExpose: true,
    });

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("getPublicUrl");

    expect(docsSource).toContain("publicLaunchApproved remains false until manual approval");
    expect(docsSource).not.toContain("PUBLIC_LAUNCH_ENABLED=true");
    expect(docsSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsSource).not.toContain("-----BEGIN PRIVATE KEY-----");
    expect(docsSource).not.toContain("production_ready_public_delivery");
  });
});
