import type { ExportRequesterContext } from "../requester/exportRequesterContext";

export const workspaceRoles = [
  "owner",
  "admin",
  "editor",
  "viewer",
] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];

export interface BackendUserAccountIdentity {
  userId: string;
  authProvider: "session" | "supabase" | "token";
  authSubject: string;
}

export interface BackendWorkspace {
  workspaceId: string;
  name: string;
  createdByUserId: string;
}

export interface BackendWorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: "active" | "invited" | "suspended";
}

export interface BackendWorkspaceScopedOwnership {
  ownerId: string;
  workspaceId: string;
}

export interface BackendAuthenticatedRequesterIdentity
  extends BackendWorkspaceScopedOwnership {
  userId: string;
  activeWorkspaceId: string;
  membershipRole: WorkspaceRole;
  requesterContext: ExportRequesterContext;
}

export interface BackendWorkspaceProviderKeyOwnership
  extends BackendWorkspaceScopedOwnership {
  providerKeyId: string;
  providerName: string;
  createdByUserId: string;
}

export interface BackendWorkspaceCreditLedgerEntry
  extends BackendWorkspaceScopedOwnership {
  ledgerEntryId: string;
  amountDelta: number;
  entryKind: "reserve" | "charge" | "refund" | "grant" | "adjustment";
}

export interface BackendArtifactAccessOwnership
  extends BackendWorkspaceScopedOwnership {
  jobId: string;
  artifactId: string;
  requiresWorkspaceMembership: true;
}

export interface BackendArtifactStorageMetadataOwnership
  extends BackendArtifactAccessOwnership {
  storageRecordId: string;
}
