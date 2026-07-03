import type { BackendUserAccountIdentity } from "../auth/accountContracts";
import type {
  BackendAccountBootstrapTransactionOutcome,
  BackendAccountBootstrapTransactionResult,
  BackendUserAccountRecord,
  BackendUserAccountCreationResult,
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRecord,
  BackendWorkspaceMembershipCreationResult,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceCreationResult,
  BackendWorkspaceRecord,
  BackendWorkspaceRepository,
} from "./repositoryContracts";

export interface AccountWorkspaceTableQueryResult<Row> {
  data: Row[] | Row | null;
  error: { message: string } | null;
}

export interface AccountWorkspaceTableQuery<Row> {
  select(columns: string): AccountWorkspaceTableQuery<Row>;
  eq(column: string, value: string): AccountWorkspaceTableQuery<Row>;
  in?(column: string, values: string[]): AccountWorkspaceTableQuery<Row>;
  upsert?(
    values: Partial<Row> | Partial<Row>[],
    options?: {
      onConflict?: string;
      ignoreDuplicates?: boolean;
    },
  ): AccountWorkspaceTableQuery<Row>;
  insert?(
    values: Partial<Row> | Partial<Row>[],
  ): AccountWorkspaceTableQuery<Row>;
  maybeSingle(): Promise<AccountWorkspaceTableQueryResult<Row>>;
  then(
    onfulfilled?: ((value: AccountWorkspaceTableQueryResult<Row>) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ): Promise<unknown>;
}

export interface SupabaseAccountWorkspaceClient {
  from(table: "app_users"): AccountWorkspaceTableQuery<AppUserRow>;
  from(table: "workspaces"): AccountWorkspaceTableQuery<WorkspaceRow>;
  from(
    table: "workspace_memberships",
  ): AccountWorkspaceTableQuery<WorkspaceMembershipRow>;
  rpc?(
    functionName: "free_ai_mixer_bootstrap_account_workspace",
    parameters: Record<string, unknown>,
  ): PromiseLike<AccountWorkspaceTableQueryResult<AccountBootstrapRpcRow>>;
}

export interface AccountBootstrapRpcRow {
  outcome: string;
  app_user_id: string;
  workspace_id: string | null;
  workspace_created_by_user_id: string | null;
  workspace_name: string | null;
  workspace_deleted_at: string | null;
  workspace_role: string | null;
  membership_status: string | null;
  app_user_created: boolean;
  workspace_created: boolean;
  membership_created: boolean;
}

export interface AppUserRow {
  id: string;
  auth_provider: BackendUserAccountIdentity["authProvider"];
  auth_subject: string;
  email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  created_by_user_id: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface WorkspaceMembershipRow {
  workspace_id: string;
  user_id: string;
  role: BackendWorkspaceMembershipRecord["role"];
  status: BackendWorkspaceMembershipRecord["status"];
  created_at: string | null;
  updated_at: string | null;
}

const duplicateRowErrorFragments = [
  "duplicate key value",
  "duplicate key",
  "23505",
] as const;

const appUserSelectColumns = [
  "id",
  "auth_provider",
  "auth_subject",
  "email",
  "created_at",
  "updated_at",
].join(", ");

const workspaceSelectColumns = [
  "id",
  "name",
  "created_by_user_id",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

const workspaceMembershipSelectColumns = [
  "workspace_id",
  "user_id",
  "role",
  "status",
  "created_at",
  "updated_at",
].join(", ");

const fromAppUserRow = (row: AppUserRow): BackendUserAccountRecord => ({
  userId: row.id,
  authProvider: row.auth_provider,
  authSubject: row.auth_subject,
  ...(row.email ? { email: row.email } : {}),
  ...(row.created_at ? { createdAt: row.created_at } : {}),
  ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
});

const fromWorkspaceRow = (row: WorkspaceRow): BackendWorkspaceRecord => ({
  workspaceId: row.id,
  name: row.name,
  createdByUserId: row.created_by_user_id,
  ...(row.created_at ? { createdAt: row.created_at } : {}),
  ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
  ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
});

const fromWorkspaceMembershipRow = (
  row: WorkspaceMembershipRow,
): BackendWorkspaceMembershipRecord => ({
  workspaceId: row.workspace_id,
  userId: row.user_id,
  role: row.role,
  status: row.status,
  ...(row.created_at ? { createdAt: row.created_at } : {}),
  ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
});

const getSingleRow = async <Row, RecordType>(
  query: AccountWorkspaceTableQuery<Row>,
  mapRow: (row: Row) => RecordType,
): Promise<RecordType | undefined> => {
  const result = await query.maybeSingle();
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data || Array.isArray(result.data)) {
    return undefined;
  }

  return mapRow(result.data);
};

const getManyRows = async <Row, RecordType>(
  query: AccountWorkspaceTableQuery<Row>,
  mapRow: (row: Row) => RecordType,
): Promise<RecordType[]> => {
  const result = (await query) as AccountWorkspaceTableQueryResult<Row>;

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    return [];
  }

  return (Array.isArray(result.data) ? result.data : [result.data]).map(mapRow);
};

const isDuplicateRowError = (error: { message: string } | null): boolean => {
  if (!error) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return duplicateRowErrorFragments.some((fragment) =>
    normalized.includes(fragment),
  );
};

const accountBootstrapOutcomes = new Set<BackendAccountBootstrapTransactionOutcome>([
  "created",
  "recovered_partial_state",
  "existing_active_membership",
  "inactive_membership_blocked",
  "multiple_active_memberships",
  "conflicting_state",
]);

const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const isMembershipRole = (
  value: string | null,
): value is BackendWorkspaceMembershipRecord["role"] =>
  value === "owner" ||
  value === "admin" ||
  value === "editor" ||
  value === "viewer";

export class SupabaseAccountWorkspaceRepository
  implements
    BackendUserAccountRepository,
    BackendWorkspaceRepository,
    BackendWorkspaceMembershipRepository
{
  constructor(private readonly client: SupabaseAccountWorkspaceClient) {}

  async bootstrapAccountWorkspaceTransaction(input: {
    userId: string;
    authProvider: BackendUserAccountIdentity["authProvider"];
    authSubject: string;
    email?: string;
    personalWorkspaceId: string;
    personalWorkspaceName: string;
  }): Promise<BackendAccountBootstrapTransactionResult> {
    if (!this.client.rpc) {
      return { kind: "unavailable" };
    }

    try {
      const result = await this.client.rpc(
        "free_ai_mixer_bootstrap_account_workspace",
        {
          p_app_user_id: input.userId,
          p_auth_provider: input.authProvider,
          p_auth_subject: input.authSubject,
          p_email: input.email ?? null,
          p_personal_workspace_id: input.personalWorkspaceId,
          p_personal_workspace_name: input.personalWorkspaceName,
        },
      );

      if (result.error || !Array.isArray(result.data) || result.data.length !== 1) {
        return { kind: "unavailable" };
      }

      const row = result.data[0];
      if (
        !row ||
        !accountBootstrapOutcomes.has(
          row.outcome as BackendAccountBootstrapTransactionOutcome,
        ) ||
        !isUuidLike(row.app_user_id) ||
        row.app_user_id !== input.userId ||
        typeof row.app_user_created !== "boolean" ||
        typeof row.workspace_created !== "boolean" ||
        typeof row.membership_created !== "boolean"
      ) {
        return { kind: "unavailable" };
      }

      const outcome = row.outcome as BackendAccountBootstrapTransactionOutcome;
      const userAccount: BackendUserAccountRecord = {
        userId: row.app_user_id,
        authProvider: input.authProvider,
        authSubject: input.authSubject,
        ...(input.email ? { email: input.email } : {}),
      };

      if (
        outcome === "inactive_membership_blocked" ||
        outcome === "multiple_active_memberships" ||
        outcome === "conflicting_state"
      ) {
        if (
          row.app_user_created ||
          row.workspace_created ||
          row.membership_created ||
          row.workspace_id !== null ||
          row.workspace_created_by_user_id !== null ||
          row.workspace_name !== null ||
          row.workspace_deleted_at !== null ||
          row.workspace_role !== null ||
          row.membership_status !== null
        ) {
          return { kind: "unavailable" };
        }

        return {
          kind: "resolved",
          outcome,
          userAccount,
          appUserCreated: row.app_user_created,
          workspaceCreated: row.workspace_created,
          membershipCreated: row.membership_created,
        };
      }

      if (
        !row.workspace_id ||
        !isUuidLike(row.workspace_id) ||
        !row.workspace_created_by_user_id ||
        !isUuidLike(row.workspace_created_by_user_id) ||
        !row.workspace_name ||
        row.workspace_deleted_at !== null ||
        !isMembershipRole(row.workspace_role) ||
        row.membership_status !== "active"
      ) {
        return { kind: "unavailable" };
      }

      if (
        outcome !== "existing_active_membership" &&
        (row.workspace_id !== input.personalWorkspaceId ||
          row.workspace_created_by_user_id !== input.userId ||
          row.workspace_name !== input.personalWorkspaceName ||
          row.workspace_role !== "owner")
      ) {
        return { kind: "unavailable" };
      }

      if (
        outcome === "created" &&
        (!row.app_user_created ||
          !row.workspace_created ||
          !row.membership_created)
      ) {
        return { kind: "unavailable" };
      }

      if (
        outcome === "existing_active_membership" &&
        (row.app_user_created || row.workspace_created || row.membership_created)
      ) {
        return { kind: "unavailable" };
      }

      if (
        outcome === "recovered_partial_state" &&
        ((!row.app_user_created &&
          !row.workspace_created &&
          !row.membership_created) ||
          (row.app_user_created &&
            row.workspace_created &&
            row.membership_created))
      ) {
        return { kind: "unavailable" };
      }

      return {
        kind: "resolved",
        outcome,
        userAccount,
        workspace: {
          workspaceId: row.workspace_id,
          name: row.workspace_name,
          createdByUserId: row.workspace_created_by_user_id,
        },
        membership: {
          workspaceId: row.workspace_id,
          userId: row.app_user_id,
          role: row.workspace_role,
          status: "active",
        },
        appUserCreated: row.app_user_created,
        workspaceCreated: row.workspace_created,
        membershipCreated: row.membership_created,
      };
    } catch {
      return { kind: "unavailable" };
    }
  }

  async getByUserId(
    userId: string,
  ): Promise<BackendUserAccountRecord | undefined> {
    return getSingleRow(
      this.client
        .from("app_users")
        .select(appUserSelectColumns)
        .eq("id", userId),
      fromAppUserRow,
    );
  }

  async getByAuthSubject(
    authProvider: BackendUserAccountIdentity["authProvider"],
    authSubject: string,
  ): Promise<BackendUserAccountRecord | undefined> {
    return getSingleRow(
      this.client
        .from("app_users")
        .select(appUserSelectColumns)
        .eq("auth_provider", authProvider)
        .eq("auth_subject", authSubject),
      fromAppUserRow,
    );
  }

  async createOrGetByAuthSubject(input: {
    userId: string;
    authProvider: BackendUserAccountIdentity["authProvider"];
    authSubject: string;
    email?: string;
  }): Promise<BackendUserAccountCreationResult> {
    const existing = await this.getByAuthSubject(
      input.authProvider,
      input.authSubject,
    );

    if (existing) {
      if (
        existing.userId !== input.userId ||
        existing.authProvider !== input.authProvider ||
        existing.authSubject !== input.authSubject
      ) {
        throw new Error(
          "App user creation encountered an inconsistent existing record.",
        );
      }

      return { userAccount: existing, created: false };
    }

    const appUsers = this.client.from("app_users");

    if (!appUsers.insert) {
      throw new Error("Injected Supabase-like client must support insert() for app_users.");
    }

    const result = await appUsers
      .insert({
        id: input.userId,
        auth_provider: input.authProvider,
        auth_subject: input.authSubject,
        email: input.email ?? null,
      })
      .select(appUserSelectColumns)
      .maybeSingle();

    if (result.error && !isDuplicateRowError(result.error)) {
      throw new Error("App user creation is unavailable.");
    }

    const created = !result.error;
    const record = result.data && !Array.isArray(result.data)
      ? fromAppUserRow(result.data)
      : await this.getByAuthSubject(input.authProvider, input.authSubject);

    if (
      !record ||
      record.userId !== input.userId ||
      record.authProvider !== input.authProvider ||
      record.authSubject !== input.authSubject
    ) {
      throw new Error("App user bootstrap could not be completed safely.");
    }

    return { userAccount: record, created };
  }

  async getByWorkspaceId(
    workspaceId: string,
  ): Promise<BackendWorkspaceRecord | undefined> {
    return getSingleRow(
      this.client
        .from("workspaces")
        .select(workspaceSelectColumns)
        .eq("id", workspaceId),
      fromWorkspaceRow,
    );
  }

  async listForUser(userId: string): Promise<BackendWorkspaceRecord[]> {
    const membershipQuery = this.client
      .from("workspace_memberships")
      .select(workspaceMembershipSelectColumns)
      .eq("user_id", userId);
    const memberships = await getManyRows(membershipQuery, fromWorkspaceMembershipRow);
    const workspaceIds = [...new Set(memberships.map((membership) => membership.workspaceId))];

    if (workspaceIds.length === 0) {
      return [];
    }

    const workspacesQuery = this.client
      .from("workspaces")
      .select(workspaceSelectColumns);

    if (!workspacesQuery.in) {
      throw new Error("Injected Supabase-like client must support in() for listForUser.");
    }

    return getManyRows(
      workspacesQuery.in("id", workspaceIds),
      fromWorkspaceRow,
    );
  }

  async createPersonalWorkspace(input: {
    workspaceId: string;
    userId: string;
    name: string;
  }): Promise<BackendWorkspaceCreationResult> {
    const existing = await this.getByWorkspaceId(input.workspaceId);

    if (existing) {
      if (
        existing.createdByUserId !== input.userId ||
        existing.name !== input.name ||
        existing.deletedAt !== undefined
      ) {
        throw new Error(
          "Personal workspace creation encountered an inconsistent existing record.",
        );
      }

      return { workspace: existing, created: false };
    }

    const workspaces = this.client.from("workspaces");

    if (!workspaces.insert) {
      throw new Error("Injected Supabase-like client must support insert() for workspaces.");
    }

    const result = await workspaces
      .insert({
        id: input.workspaceId,
        name: input.name,
        created_by_user_id: input.userId,
      })
      .select(workspaceSelectColumns)
      .maybeSingle();

    if (result.error && !isDuplicateRowError(result.error)) {
      throw new Error("Personal workspace creation is unavailable.");
    }

    const created = !result.error;
    const workspace = result.data && !Array.isArray(result.data)
      ? fromWorkspaceRow(result.data)
      : await this.getByWorkspaceId(input.workspaceId);

    if (
      !workspace ||
      workspace.workspaceId !== input.workspaceId ||
      workspace.createdByUserId !== input.userId ||
      workspace.name !== input.name ||
      workspace.deletedAt !== undefined
    ) {
      throw new Error("Workspace bootstrap could not be completed safely.");
    }

    return { workspace, created };
  }

  async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<BackendWorkspaceMembershipRecord | undefined> {
    return getSingleRow(
      this.client
        .from("workspace_memberships")
        .select(workspaceMembershipSelectColumns)
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId),
      fromWorkspaceMembershipRow,
    );
  }

  async listMembershipsForUser(
    userId: string,
  ): Promise<BackendWorkspaceMembershipRecord[]> {
    return getManyRows(
      this.client
        .from("workspace_memberships")
        .select(workspaceMembershipSelectColumns)
        .eq("user_id", userId),
      fromWorkspaceMembershipRow,
    );
  }

  async listMembershipsForWorkspace(
    workspaceId: string,
  ): Promise<BackendWorkspaceMembershipRecord[]> {
    return getManyRows(
      this.client
        .from("workspace_memberships")
        .select(workspaceMembershipSelectColumns)
        .eq("workspace_id", workspaceId),
      fromWorkspaceMembershipRow,
    );
  }

  async createOrGetMembership(input: {
    workspaceId: string;
    userId: string;
    role: BackendWorkspaceMembershipRecord["role"];
    status: BackendWorkspaceMembershipRecord["status"];
  }): Promise<BackendWorkspaceMembershipCreationResult> {
    const existing = await this.getMembership(input.workspaceId, input.userId);

    if (existing) {
      if (
        existing.workspaceId !== input.workspaceId ||
        existing.userId !== input.userId ||
        existing.role !== input.role ||
        existing.status !== input.status
      ) {
        throw new Error(
          "Membership creation encountered an inconsistent existing record.",
        );
      }

      return { membership: existing, created: false };
    }

    const memberships = this.client.from("workspace_memberships");

    if (!memberships.insert) {
      throw new Error(
        "Injected Supabase-like client must support insert() for workspace_memberships.",
      );
    }

    const result = await memberships
      .insert({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        role: input.role,
        status: input.status,
      })
      .select(workspaceMembershipSelectColumns)
      .maybeSingle();

    if (result.error && !isDuplicateRowError(result.error)) {
      throw new Error("Workspace membership creation is unavailable.");
    }

    const created = !result.error;
    const membership = result.data && !Array.isArray(result.data)
      ? fromWorkspaceMembershipRow(result.data)
      : await this.getMembership(input.workspaceId, input.userId);

    if (
      !membership ||
      membership.workspaceId !== input.workspaceId ||
      membership.userId !== input.userId ||
      membership.role !== input.role ||
      membership.status !== input.status
    ) {
      throw new Error("Workspace membership bootstrap could not be completed safely.");
    }

    return { membership, created };
  }
}

export const createSupabaseAccountWorkspaceRepository = (
  client: SupabaseAccountWorkspaceClient,
): BackendUserAccountRepository &
  BackendWorkspaceRepository &
  BackendWorkspaceMembershipRepository =>
  new SupabaseAccountWorkspaceRepository(client);
