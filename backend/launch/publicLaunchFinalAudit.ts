export type PublicLaunchFinalAuditMissingItem =
  | "staging_smoke"
  | "private_beta_checklist"
  | "privacy_security_review"
  | "abuse_prevention_review"
  | "deployment_readiness"
  | "observability_readiness"
  | "storage_recovery_readiness"
  | "go_no_go_decision";

export type PublicLaunchFinalAuditDecision =
  | {
      kind: "ready_for_go_no_go";
      missingItems: [];
      stagingReady: true;
      privateBetaReady: true;
      publicLaunchApproved: false;
    }
  | {
      kind: "not_ready";
      missingItems: PublicLaunchFinalAuditMissingItem[];
      stagingReady: false;
      privateBetaReady: false;
      publicLaunchApproved: false;
    };

export interface PublicLaunchFinalAuditInput {
  launchAuditDocsText?: string;
  deploymentDocsText?: string;
  monitoringDocsText?: string;
  storageRecoveryDocsText?: string;
}

const hasAll = (source: string | undefined, tokens: string[]): boolean =>
  tokens.every((token) => source?.includes(token));

export const resolvePublicLaunchFinalAudit = ({
  launchAuditDocsText,
  deploymentDocsText,
  monitoringDocsText,
  storageRecoveryDocsText,
}: PublicLaunchFinalAuditInput): PublicLaunchFinalAuditDecision => {
  const missingItems: PublicLaunchFinalAuditMissingItem[] = [];

  if (!hasAll(launchAuditDocsText, ["Staging deployment smoke", "staging smoke passed"])) {
    missingItems.push("staging_smoke");
  }

  if (!hasAll(launchAuditDocsText, ["Private beta checklist", "private beta approval"])) {
    missingItems.push("private_beta_checklist");
  }

  if (!hasAll(launchAuditDocsText, ["Privacy and security review", "no sensitive data exposure"])) {
    missingItems.push("privacy_security_review");
  }

  if (!hasAll(launchAuditDocsText, ["Abuse prevention review", "rate-limit and abuse boundary"])) {
    missingItems.push("abuse_prevention_review");
  }

  if (!hasAll(deploymentDocsText, ["Production deployment commands", "No secrets committed"])) {
    missingItems.push("deployment_readiness");
  }

  if (!hasAll(monitoringDocsText, ["Monitoring plan", "No sensitive data in logs"])) {
    missingItems.push("observability_readiness");
  }

  if (!hasAll(storageRecoveryDocsText, ["Storage bucket policy", "Disaster recovery notes"])) {
    missingItems.push("storage_recovery_readiness");
  }

  if (!hasAll(launchAuditDocsText, ["Public launch go/no-go decision", "publicLaunchApproved remains false until manual approval"])) {
    missingItems.push("go_no_go_decision");
  }

  return missingItems.length === 0
    ? {
        kind: "ready_for_go_no_go",
        missingItems: [],
        stagingReady: true,
        privateBetaReady: true,
        publicLaunchApproved: false,
      }
    : {
        kind: "not_ready",
        missingItems,
        stagingReady: false,
        privateBetaReady: false,
        publicLaunchApproved: false,
      };
};
