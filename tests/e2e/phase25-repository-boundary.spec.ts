import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { workspaceRoles } from "../../backend/auth/accountContracts";
import {
  type BackendArtifactRecord,
  type BackendArtifactStorageRefRecord,
  type BackendCreditLedgerMutationInput,
  type BackendProviderKeyRecord,
  type BackendSignedUrlReadiness,
  type BackendUserAccountRepository,
  type BackendWorkspaceMembershipRepository,
  type BackendWorkspaceRepository,
} from "../../backend/repositories/repositoryContracts";
import {
  createLocalDevFallbackExportRequesterContext,
} from "../../backend/requester/exportRequesterContext";

test.describe("phase25 repository boundary", () => {
  test("repository interfaces preserve workspace scoped ownership", async () => {
    const userRepository: BackendUserAccountRepository = {
      async getByUserId(userId) {
        return {
          userId,
          authProvider: "supabase",
          authSubject: `subject:${userId}`,
        };
      },
      async getByAuthSubject(authProvider, authSubject) {
        return {
          userId: "user-1",
          authProvider,
          authSubject,
        };
      },
    };
    const workspaceRepository: BackendWorkspaceRepository = {
      async getByWorkspaceId(workspaceId) {
        return {
          workspaceId,
          name: "Workspace One",
          createdByUserId: "user-1",
        };
      },
      async listForUser(userId) {
        return [
          {
            workspaceId: "workspace-1",
            name: "Workspace One",
            createdByUserId: userId,
          },
        ];
      },
    };
    const membershipRepository: BackendWorkspaceMembershipRepository = {
      async getMembership(workspaceId, userId) {
        return {
          workspaceId,
          userId,
          role: "owner",
          status: "active",
        };
      },
      async listMembershipsForWorkspace(workspaceId) {
        return [
          {
            workspaceId,
            userId: "user-1",
            role: "owner",
            status: "active",
          },
        ];
      },
    };

    const user = await userRepository.getByUserId("user-1");
    const workspace = await workspaceRepository.getByWorkspaceId("workspace-1");
    const membership = await membershipRepository.getMembership(
      "workspace-1",
      "user-1",
    );

    expect(workspaceRoles).toEqual(["owner", "admin", "editor", "viewer"]);
    expect(user?.authProvider).toBe("supabase");
    expect(workspace?.workspaceId).toBe("workspace-1");
    expect(membership?.workspaceId).toBe("workspace-1");
    expect(membership?.role).toBe("owner");
  });

  test("provider key boundary is workspace scoped", () => {
    const providerKeyRecord: BackendProviderKeyRecord = {
      providerKeyId: "provider-key-1",
      providerName: "openai",
      ownerId: "user-1",
      workspaceId: "workspace-1",
      createdByUserId: "user-1",
      encryptedSecret: {
        encryptedPayload: "ciphertext-placeholder",
        keyVersion: "v1",
        algorithm: "aes-256-gcm",
      },
      status: "active",
    };

    expect(providerKeyRecord.workspaceId).toBe("workspace-1");
    expect(providerKeyRecord.encryptedSecret.encryptedPayload).toContain(
      "placeholder",
    );
    expect(providerKeyRecord.status).toBe("active");
  });

  test("credit ledger boundary supports reserve charge refund grant and adjustment semantics", () => {
    const mutations: BackendCreditLedgerMutationInput[] = [
      {
        entryKind: "reserve",
        input: {
          workspaceId: "workspace-1",
          ownerId: "user-1",
          amount: 25,
          reason: "reserve render credits",
          jobId: "job-1",
        },
      },
      {
        entryKind: "charge",
        input: {
          workspaceId: "workspace-1",
          ownerId: "user-1",
          amount: 25,
          reason: "charge completed render",
          reservationEntryId: "ledger-1",
          jobId: "job-1",
        },
      },
      {
        entryKind: "refund",
        input: {
          workspaceId: "workspace-1",
          ownerId: "user-1",
          amount: 10,
          reason: "refund failed partial work",
          chargeEntryId: "ledger-2",
          jobId: "job-1",
        },
      },
      {
        entryKind: "grant",
        input: {
          workspaceId: "workspace-1",
          ownerId: "user-1",
          amount: 100,
          reason: "promo credits",
        },
      },
      {
        entryKind: "adjustment",
        input: {
          workspaceId: "workspace-1",
          ownerId: "user-1",
          amountDelta: -5,
          reason: "manual correction",
        },
      },
    ];

    expect(mutations.map((mutation) => mutation.entryKind)).toEqual([
      "reserve",
      "charge",
      "refund",
      "grant",
      "adjustment",
    ]);
    expect(mutations.every((mutation) => mutation.input.workspaceId === "workspace-1")).toBeTruthy();
  });

  test("artifact and storage repository boundaries preserve workspace job and artifact ownership", () => {
    const artifactRecord: BackendArtifactRecord = {
      ownerId: "user-1",
      workspaceId: "workspace-1",
      jobId: "job-1",
      artifactId: "artifact-1",
      requiresWorkspaceMembership: true,
      format: "mp4",
      kind: "video",
      status: "available",
      createdAt: "2026-05-17T00:00:00.000Z",
      sizeBytes: 1024,
    };
    const storageRefRecord: BackendArtifactStorageRefRecord = {
      ...artifactRecord,
      storageRecordId: "storage-1",
      storageProvider: "supabase_storage",
      objectKey: "exports/job-1/artifact-1.mp4",
      bucketName: "artifacts",
      contentType: "video/mp4",
      byteLength: 1024,
    };
    const signedUrlReadiness: BackendSignedUrlReadiness = "requires_authorization";

    expect(artifactRecord.workspaceId).toBe("workspace-1");
    expect(artifactRecord.jobId).toBe("job-1");
    expect(storageRefRecord.artifactId).toBe("artifact-1");
    expect(storageRefRecord.storageProvider).toBe("supabase_storage");
    expect(signedUrlReadiness).toBe("requires_authorization");
  });

  test("local dev fallback is not treated as production auth", () => {
    const fallbackRequester = createLocalDevFallbackExportRequesterContext();

    expect(fallbackRequester.authMode).toBe("local_dev_fallback");
    expect(fallbackRequester.ownerId).toBe("local-dev-owner");
    expect(fallbackRequester.workspaceId).toBe("local-dev-workspace");
  });

  test("repository contract source does not add route frontend or storage implementation behavior", async () => {
    const source = await fs.readFile(
      path.join(
        process.cwd(),
        "backend",
        "repositories",
        "repositoryContracts.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("Router");
    expect(source).not.toContain("/exports");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("window.");
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("INSERT INTO");
    expect(source).not.toContain("signedUrl:");
    expect(source).not.toContain("filePath");
  });
});
