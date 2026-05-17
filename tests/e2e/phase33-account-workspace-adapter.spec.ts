import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createSupabaseAccountWorkspaceRepository,
  type AppUserRow,
  type SupabaseAccountWorkspaceClient,
  type WorkspaceMembershipRow,
  type WorkspaceRow,
} from "../../backend/repositories/supabaseAccountWorkspaceRepository";

const adapterSourcePath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "supabaseAccountWorkspaceRepository.ts",
);
const routeRoot = path.join(process.cwd(), "backend", "routes");
const authRoot = path.join(process.cwd(), "backend", "auth");
const requesterRoot = path.join(process.cwd(), "backend", "requester");
const frontendRoot = path.join(process.cwd(), "src");
const appSourcePath = path.join(process.cwd(), "backend", "app.ts");

const getAllFileContents = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        return getAllFileContents(fullPath);
      }

      if (!entry.isFile()) {
        return [] as string[];
      }

      return [await fs.readFile(fullPath, "utf8")];
    }),
  );

  return nested.flat();
};

class FakeAccountWorkspaceQuery<Row> {
  readonly selectCalls: string[] = [];
  readonly eqCalls: Array<{ column: string; value: string }> = [];
  readonly inCalls: Array<{ column: string; values: string[] }> = [];

  constructor(
    private readonly resultData: Row[] | Row | null,
  ) {}

  select(columns: string): FakeAccountWorkspaceQuery<Row> {
    this.selectCalls.push(columns);
    return this;
  }

  eq(column: string, value: string): FakeAccountWorkspaceQuery<Row> {
    this.eqCalls.push({ column, value });
    return this;
  }

  in(column: string, values: string[]): FakeAccountWorkspaceQuery<Row> {
    this.inCalls.push({ column, values });
    return this;
  }

  async maybeSingle() {
    const data =
      Array.isArray(this.resultData)
        ? (this.resultData[0] ?? null)
        : this.resultData;

    return {
      data,
      error: null,
    };
  }

  async then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[] | Row | null; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const value = {
      data: this.resultData,
      error: null,
    };

    return onfulfilled ? onfulfilled(value) : (value as TResult1);
  }
}

class FakeSupabaseAccountWorkspaceClient
  implements SupabaseAccountWorkspaceClient
{
  readonly queries: Array<{
    table: "app_users" | "workspaces" | "workspace_memberships";
    query:
      | FakeAccountWorkspaceQuery<AppUserRow>
      | FakeAccountWorkspaceQuery<WorkspaceRow>
      | FakeAccountWorkspaceQuery<WorkspaceMembershipRow>;
  }> = [];

  constructor(
    private readonly appUsers: AppUserRow[] = [],
    private readonly workspaces: WorkspaceRow[] = [],
    private readonly memberships: WorkspaceMembershipRow[] = [],
  ) {}

  from(table: "app_users"): FakeAccountWorkspaceQuery<AppUserRow>;
  from(table: "workspaces"): FakeAccountWorkspaceQuery<WorkspaceRow>;
  from(
    table: "workspace_memberships",
  ): FakeAccountWorkspaceQuery<WorkspaceMembershipRow>;
  from(
    table: "app_users" | "workspaces" | "workspace_memberships",
  ):
    | FakeAccountWorkspaceQuery<AppUserRow>
    | FakeAccountWorkspaceQuery<WorkspaceRow>
    | FakeAccountWorkspaceQuery<WorkspaceMembershipRow> {
    const query =
      table === "app_users"
        ? new FakeAccountWorkspaceQuery<AppUserRow>(this.appUsers[0] ?? null)
        : table === "workspaces"
          ? new FakeAccountWorkspaceQuery<WorkspaceRow>(this.workspaces)
          : new FakeAccountWorkspaceQuery<WorkspaceMembershipRow>(this.memberships);

    this.queries.push({ table, query });
    return query;
  }
}

const appUserRow: AppUserRow = {
  id: "user-1",
  auth_provider: "supabase",
  auth_subject: "subject:user-1",
  email: "user@example.com",
  created_at: "2026-05-17T00:00:00.000Z",
  updated_at: "2026-05-17T00:01:00.000Z",
};

const workspaceRow: WorkspaceRow = {
  id: "workspace-1",
  name: "Workspace One",
  created_by_user_id: "user-1",
  created_at: "2026-05-17T00:00:00.000Z",
  updated_at: "2026-05-17T00:01:00.000Z",
  deleted_at: null,
};

const membershipRow: WorkspaceMembershipRow = {
  workspace_id: "workspace-1",
  user_id: "user-1",
  role: "owner",
  status: "active",
  created_at: "2026-05-17T00:00:00.000Z",
  updated_at: "2026-05-17T00:01:00.000Z",
};

test.describe("phase33 account workspace adapter", () => {
  test("adapter maps app_users fields correctly", async () => {
    const client = new FakeSupabaseAccountWorkspaceClient([appUserRow]);
    const repository = createSupabaseAccountWorkspaceRepository(client);

    const result = await repository.getByUserId("user-1");

    expect(result).toEqual({
      userId: "user-1",
      authProvider: "supabase",
      authSubject: "subject:user-1",
      email: "user@example.com",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:01:00.000Z",
    });
  });

  test("adapter maps workspaces fields correctly and preserves workspace ownership semantics", async () => {
    const client = new FakeSupabaseAccountWorkspaceClient([], [workspaceRow]);
    const repository = createSupabaseAccountWorkspaceRepository(client);

    const result = await repository.getByWorkspaceId("workspace-1");

    expect(result).toEqual({
      workspaceId: "workspace-1",
      name: "Workspace One",
      createdByUserId: "user-1",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:01:00.000Z",
    });
    expect(result?.createdByUserId).toBe("user-1");
  });

  test("adapter maps workspace_memberships fields correctly and preserves workspaceId userId scope", async () => {
    const client = new FakeSupabaseAccountWorkspaceClient([], [], [membershipRow]);
    const repository = createSupabaseAccountWorkspaceRepository(client);

    const result = await repository.getMembership("workspace-1", "user-1");

    expect(result).toEqual({
      workspaceId: "workspace-1",
      userId: "user-1",
      role: "owner",
      status: "active",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:01:00.000Z",
    });
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0].table).toBe("workspace_memberships");
    expect(client.queries[0].query.eqCalls).toEqual([
      { column: "workspace_id", value: "workspace-1" },
      { column: "user_id", value: "user-1" },
    ]);
  });

  test("listForUser uses injected fake client only and membership-scoped workspace lookup", async () => {
    const client = new FakeSupabaseAccountWorkspaceClient(
      [],
      [workspaceRow],
      [membershipRow],
    );
    const repository = createSupabaseAccountWorkspaceRepository(client);
    const source = await fs.readFile(adapterSourcePath, "utf8");

    const result = await repository.listForUser("user-1");

    expect(result).toHaveLength(1);
    expect(result[0].workspaceId).toBe("workspace-1");
    expect(client.queries).toHaveLength(2);
    expect(client.queries[0].table).toBe("workspace_memberships");
    expect(client.queries[1].table).toBe("workspaces");
    expect(client.queries[1].query.inCalls).toEqual([
      { column: "id", values: ["workspace-1"] },
    ]);
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("serviceRoleKey");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("../db/supabaseClientFactory");
  });

  test("adapter does not execute migrations or introduce provider key ledger artifact storage signed-url or billing behavior", async () => {
    const source = await fs.readFile(adapterSourcePath, "utf8");

    expect(source).not.toContain("migrate(");
    expect(source).not.toContain("migrationWorkflow");
    expect(source).not.toContain("provider_keys");
    expect(source).not.toContain("credit_ledger");
    expect(source).not.toContain("storage_refs");
    expect(source).not.toContain("signed_url");
    expect(source).not.toContain("billing");
  });

  test("routes app frontend auth and requester sources do not import the adapter", async () => {
    const [routeSources, authSources, requesterSources, frontendSources, appSource] =
      await Promise.all([
        getAllFileContents(routeRoot),
        getAllFileContents(authRoot),
        getAllFileContents(requesterRoot),
        getAllFileContents(frontendRoot),
        fs.readFile(appSourcePath, "utf8"),
      ]);

    expect(routeSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(authSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(requesterSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(frontendSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(appSource).not.toContain("supabaseAccountWorkspaceRepository");
  });
});
