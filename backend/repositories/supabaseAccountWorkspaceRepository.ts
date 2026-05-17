import type { BackendUserAccountIdentity } from "../auth/accountContracts";
import type {
  BackendUserAccountRecord,
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRecord,
  BackendWorkspaceMembershipRepository,
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

export class SupabaseAccountWorkspaceRepository
  implements
    BackendUserAccountRepository,
    BackendWorkspaceRepository,
    BackendWorkspaceMembershipRepository
{
  constructor(private readonly client: SupabaseAccountWorkspaceClient) {}

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
}

export const createSupabaseAccountWorkspaceRepository = (
  client: SupabaseAccountWorkspaceClient,
): BackendUserAccountRepository &
  BackendWorkspaceRepository &
  BackendWorkspaceMembershipRepository =>
  new SupabaseAccountWorkspaceRepository(client);
