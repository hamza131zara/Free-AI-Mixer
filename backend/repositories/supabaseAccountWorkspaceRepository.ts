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

  async createOrGetByAuthSubject(input: {
    userId: string;
    authProvider: BackendUserAccountIdentity["authProvider"];
    authSubject: string;
    email?: string;
  }): Promise<BackendUserAccountRecord> {
    const existing = await this.getByAuthSubject(
      input.authProvider,
      input.authSubject,
    );

    if (existing) {
      return existing;
    }

    const appUsers = this.client.from("app_users");

    if (!appUsers.upsert) {
      throw new Error("Injected Supabase-like client must support upsert() for app_users.");
    }

    const result = await appUsers
      .upsert(
        {
          id: input.userId,
          auth_provider: input.authProvider,
          auth_subject: input.authSubject,
          email: input.email ?? null,
        },
        {
          onConflict: "auth_provider,auth_subject",
        },
      )
      .select(appUserSelectColumns)
      .maybeSingle();

    if (result.error && !isDuplicateRowError(result.error)) {
      throw new Error(result.error.message);
    }

    const record = result.data && !Array.isArray(result.data)
      ? fromAppUserRow(result.data)
      : await this.getByAuthSubject(input.authProvider, input.authSubject);

    if (!record) {
      throw new Error("App user bootstrap could not be completed safely.");
    }

    return record;
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
  }): Promise<BackendWorkspaceRecord> {
    const existing = await this.getByWorkspaceId(input.workspaceId);

    if (existing) {
      return existing;
    }

    const workspaces = this.client.from("workspaces");

    if (!workspaces.upsert) {
      throw new Error("Injected Supabase-like client must support upsert() for workspaces.");
    }

    const result = await workspaces
      .upsert(
        {
          id: input.workspaceId,
          name: input.name,
          created_by_user_id: input.userId,
        },
        {
          onConflict: "id",
        },
      )
      .select(workspaceSelectColumns)
      .maybeSingle();

    if (result.error && !isDuplicateRowError(result.error)) {
      throw new Error(result.error.message);
    }

    const workspace = result.data && !Array.isArray(result.data)
      ? fromWorkspaceRow(result.data)
      : await this.getByWorkspaceId(input.workspaceId);

    if (!workspace) {
      throw new Error("Workspace bootstrap could not be completed safely.");
    }

    return workspace;
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
  }): Promise<BackendWorkspaceMembershipRecord> {
    const existing = await this.getMembership(input.workspaceId, input.userId);

    if (
      existing &&
      existing.role === input.role &&
      existing.status === input.status
    ) {
      return existing;
    }

    const memberships = this.client.from("workspace_memberships");

    if (!memberships.upsert) {
      throw new Error(
        "Injected Supabase-like client must support upsert() for workspace_memberships.",
      );
    }

    const result = await memberships
      .upsert(
        {
          workspace_id: input.workspaceId,
          user_id: input.userId,
          role: input.role,
          status: input.status,
        },
        {
          onConflict: "workspace_id,user_id",
        },
      )
      .select(workspaceMembershipSelectColumns)
      .maybeSingle();

    if (result.error && !isDuplicateRowError(result.error)) {
      throw new Error(result.error.message);
    }

    const membership = result.data && !Array.isArray(result.data)
      ? fromWorkspaceMembershipRow(result.data)
      : await this.getMembership(input.workspaceId, input.userId);

    if (!membership) {
      throw new Error("Workspace membership bootstrap could not be completed safely.");
    }

    return membership;
  }
}

export const createSupabaseAccountWorkspaceRepository = (
  client: SupabaseAccountWorkspaceClient,
): BackendUserAccountRepository &
  BackendWorkspaceRepository &
  BackendWorkspaceMembershipRepository =>
  new SupabaseAccountWorkspaceRepository(client);
