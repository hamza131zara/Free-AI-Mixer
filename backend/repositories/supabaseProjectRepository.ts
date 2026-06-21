import type {
  BackendProjectRecord,
  BackendProjectRepository,
  BackendProjectStatus,
} from "./repositoryContracts";

export interface ProjectTableQueryResult<Row> {
  data: Row[] | Row | null;
  error: { message: string } | null;
}

export interface ProjectTableQuery<Row> {
  select(columns: string): ProjectTableQuery<Row>;
  eq(column: string, value: string): ProjectTableQuery<Row>;
  is(column: string, value: null): ProjectTableQuery<Row>;
  order(column: string, options?: { ascending?: boolean }): ProjectTableQuery<Row>;
  insert(values: Partial<Row>): ProjectTableQuery<Row>;
  update(values: Partial<Row>): ProjectTableQuery<Row>;
  maybeSingle(): Promise<ProjectTableQueryResult<Row>>;
  then(
    onfulfilled?: ((value: ProjectTableQueryResult<Row>) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ): Promise<unknown>;
}

export interface SupabaseProjectClient {
  from(table: "projects"): ProjectTableQuery<ProjectRow>;
}

export interface ProjectRow {
  project_id: string;
  workspace_id: string;
  owner_id: string;
  title: string;
  status: BackendProjectStatus;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

const projectSelectColumns = [
  "project_id",
  "workspace_id",
  "owner_id",
  "title",
  "status",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

const fromProjectRow = (row: ProjectRow): BackendProjectRecord => ({
  projectId: row.project_id,
  workspaceId: row.workspace_id,
  ownerId: row.owner_id,
  title: row.title,
  status: row.status,
  createdAt: row.created_at ?? row.updated_at ?? new Date(0).toISOString(),
  updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
});

const getSingleProject = async (
  query: ProjectTableQuery<ProjectRow>,
): Promise<BackendProjectRecord | undefined> => {
  const result = await query.maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data || Array.isArray(result.data)) {
    return undefined;
  }

  return fromProjectRow(result.data);
};

const getManyProjects = async (
  query: ProjectTableQuery<ProjectRow>,
): Promise<BackendProjectRecord[]> => {
  const result = (await query) as ProjectTableQueryResult<ProjectRow>;

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    return [];
  }

  return (Array.isArray(result.data) ? result.data : [result.data]).map(
    fromProjectRow,
  );
};

export class SupabaseProjectRepository implements BackendProjectRepository {
  constructor(private readonly client: SupabaseProjectClient) {}

  async createProject(input: {
    ownerId: string;
    projectId: string;
    title: string;
    workspaceId: string;
  }): Promise<BackendProjectRecord> {
    return getSingleProject(
      this.client
        .from("projects")
        .insert({
          owner_id: input.ownerId,
          project_id: input.projectId,
          status: "active",
          title: input.title,
          workspace_id: input.workspaceId,
        })
        .select(projectSelectColumns),
    ).then((project) => {
      if (!project) {
        throw new Error("Project creation did not return a safe project record.");
      }

      return project;
    });
  }

  async listProjectsForWorkspace(
    workspaceId: string,
  ): Promise<BackendProjectRecord[]> {
    return getManyProjects(
      this.client
        .from("projects")
        .select(projectSelectColumns)
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
    );
  }

  async getProjectForWorkspace(
    workspaceId: string,
    projectId: string,
  ): Promise<BackendProjectRecord | undefined> {
    return getSingleProject(
      this.client
        .from("projects")
        .select(projectSelectColumns)
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("status", "active")
        .is("deleted_at", null),
    );
  }

  async updateProjectTitleForWorkspace(input: {
    projectId: string;
    title: string;
    workspaceId: string;
  }): Promise<BackendProjectRecord | undefined> {
    return getSingleProject(
      this.client
        .from("projects")
        .update({
          title: input.title,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", input.workspaceId)
        .eq("project_id", input.projectId)
        .eq("status", "active")
        .is("deleted_at", null)
        .select(projectSelectColumns),
    );
  }
}

export const createSupabaseProjectRepository = (
  client: SupabaseProjectClient,
): BackendProjectRepository => new SupabaseProjectRepository(client);
