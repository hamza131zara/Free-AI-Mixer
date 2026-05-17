import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  type BackendArtifactAccessOwnership,
  type BackendArtifactStorageMetadataOwnership,
  type BackendAuthenticatedRequesterIdentity,
  type BackendUserAccountIdentity,
  type BackendWorkspace,
  type BackendWorkspaceCreditLedgerEntry,
  type BackendWorkspaceMembership,
  type BackendWorkspaceProviderKeyOwnership,
  workspaceRoles,
} from "../../backend/auth/accountContracts";
import {
  createLocalDevFallbackExportRequesterContext,
} from "../../backend/requester/exportRequesterContext";

test.describe("phase24 account workspace auth contract boundary", () => {
  test("allowed workspace roles are explicit", () => {
    expect(workspaceRoles).toEqual(["owner", "admin", "editor", "viewer"]);
  });

  test("user workspace membership contracts support owner and workspace authorization", () => {
    const user: BackendUserAccountIdentity = {
      userId: "user-1",
      authProvider: "session",
      authSubject: "subject-1",
    };
    const workspace: BackendWorkspace = {
      workspaceId: "workspace-1",
      name: "Workspace One",
      createdByUserId: user.userId,
    };
    const membership: BackendWorkspaceMembership = {
      workspaceId: workspace.workspaceId,
      userId: user.userId,
      role: "owner",
      status: "active",
    };
    const requesterIdentity: BackendAuthenticatedRequesterIdentity = {
      ownerId: user.userId,
      workspaceId: workspace.workspaceId,
      userId: user.userId,
      activeWorkspaceId: workspace.workspaceId,
      membershipRole: membership.role,
      requesterContext: {
        ownerId: user.userId,
        workspaceId: workspace.workspaceId,
        authMode: "authenticated_session",
      },
    };

    expect(requesterIdentity.ownerId).toBe(user.userId);
    expect(requesterIdentity.workspaceId).toBe(workspace.workspaceId);
    expect(requesterIdentity.membershipRole).toBe("owner");
    expect(requesterIdentity.requesterContext.authMode).toBe("authenticated_session");
  });

  test("provider key contract is workspace scoped", () => {
    const providerKeyOwnership: BackendWorkspaceProviderKeyOwnership = {
      providerKeyId: "provider-key-1",
      providerName: "openai",
      ownerId: "user-1",
      workspaceId: "workspace-1",
      createdByUserId: "user-1",
    };

    expect(providerKeyOwnership.workspaceId).toBe("workspace-1");
    expect(providerKeyOwnership.providerName).toBe("openai");
  });

  test("credit ledger contract is workspace scoped", () => {
    const ledgerEntry: BackendWorkspaceCreditLedgerEntry = {
      ledgerEntryId: "ledger-1",
      ownerId: "user-1",
      workspaceId: "workspace-1",
      amountDelta: -25,
      entryKind: "charge",
    };

    expect(ledgerEntry.workspaceId).toBe("workspace-1");
    expect(ledgerEntry.entryKind).toBe("charge");
  });

  test("artifact and storage metadata contracts include workspace and job ownership", () => {
    const artifactOwnership: BackendArtifactAccessOwnership = {
      ownerId: "user-1",
      workspaceId: "workspace-1",
      jobId: "job-1",
      artifactId: "artifact-1",
      requiresWorkspaceMembership: true,
    };
    const storageOwnership: BackendArtifactStorageMetadataOwnership = {
      ...artifactOwnership,
      storageRecordId: "storage-1",
    };

    expect(artifactOwnership.workspaceId).toBe("workspace-1");
    expect(artifactOwnership.jobId).toBe("job-1");
    expect(storageOwnership.storageRecordId).toBe("storage-1");
  });

  test("local dev fallback remains compatibility only and not production auth", () => {
    const fallbackRequester = createLocalDevFallbackExportRequesterContext();

    expect(fallbackRequester.authMode).toBe("local_dev_fallback");
    expect(fallbackRequester.ownerId).toBe("local-dev-owner");
    expect(fallbackRequester.workspaceId).toBe("local-dev-workspace");
  });

  test("account auth contract source does not add route frontend or download behavior", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "auth", "accountContracts.ts"),
      "utf8",
    );

    expect(source).not.toContain("Router");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("window.");
    expect(source).not.toContain("signed_url");
    expect(source).not.toContain("local_dev_stream");
  });
});
