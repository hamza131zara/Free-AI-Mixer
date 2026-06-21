import type {
  BackendProjectImageGenerationHistoryRecord,
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
  limit(count: number): ProjectTableQuery<Row>;
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
  from(table: "image_generation_history"): ProjectTableQuery<ImageGenerationHistoryRow>;
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

export interface ImageGenerationHistoryRow {
  artifact_id: string | null;
  content_type: "image/png" | "image/jpeg" | "image/webp" | null;
  created_at: string | null;
  delivery_status: "unavailable" | "descriptor_only" | "ready_later";
  generation_job_id: string | null;
  generation_jobs?: { request_id: string | null } | null;
  history_id: string;
  project_id: string | null;
  prompt_summary: string | null;
  provider_id: "mock_local" | "openai";
  sha256: string | null;
  size_bytes: number | null;
  status: "metadata_ready" | "failed" | "unavailable";
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

const imageGenerationHistorySelectColumns = [
  "artifact_id",
  "content_type",
  "created_at",
  "delivery_status",
  "generation_job_id",
  "generation_jobs(request_id)",
  "history_id",
  "project_id",
  "prompt_summary",
  "provider_id",
  "sha256",
  "size_bytes",
  "status",
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

const isSupportedImageContentType = (
  value: string | null,
): value is "image/png" | "image/jpeg" | "image/webp" =>
  value === "image/png" || value === "image/jpeg" || value === "image/webp";

const fromImageGenerationHistoryRow = (
  row: ImageGenerationHistoryRow,
): BackendProjectImageGenerationHistoryRecord | undefined => {
  const requestId = row.generation_jobs?.request_id;

  if (
    !row.artifact_id ||
    !row.project_id ||
    !row.sha256 ||
    typeof row.size_bytes !== "number" ||
    row.status !== "metadata_ready" ||
    row.delivery_status !== "unavailable" ||
    !isSupportedImageContentType(row.content_type) ||
    !requestId
  ) {
    return undefined;
  }

  return {
    artifactId: row.artifact_id,
    contentType: row.content_type,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    deliveryStatus: "unavailable",
    generationId: row.history_id,
    jobId: requestId,
    projectId: row.project_id,
    ...(row.prompt_summary ? { promptSummary: row.prompt_summary } : {}),
    providerId: row.provider_id,
    requestId,
    sha256: row.sha256,
    sizeBytes: row.size_bytes,
    status: "metadata_ready",
  };
};

const getManyImageGenerationHistoryRecords = async (
  query: ProjectTableQuery<ImageGenerationHistoryRow>,
): Promise<BackendProjectImageGenerationHistoryRecord[]> => {
  const result = (await query) as ProjectTableQueryResult<ImageGenerationHistoryRow>;

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    return [];
  }

  return (Array.isArray(result.data) ? result.data : [result.data])
    .map(fromImageGenerationHistoryRow)
    .filter(
      (
        record,
      ): record is BackendProjectImageGenerationHistoryRecord =>
        Boolean(record),
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

  async listImageGenerationHistoryForProject(
    workspaceId: string,
    projectId: string,
  ): Promise<BackendProjectImageGenerationHistoryRecord[]> {
    return getManyImageGenerationHistoryRecords(
      this.client
        .from("image_generation_history")
        .select(imageGenerationHistorySelectColumns)
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("status", "metadata_ready")
        .order("created_at", { ascending: false })
        .order("history_id", { ascending: false })
        .limit(50),
    );
  }
}

export const createSupabaseProjectRepository = (
  client: SupabaseProjectClient,
): BackendProjectRepository => new SupabaseProjectRepository(client);
