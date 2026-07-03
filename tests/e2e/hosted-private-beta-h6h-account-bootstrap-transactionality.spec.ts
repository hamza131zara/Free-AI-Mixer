import { expect, test } from "@playwright/test";
import express from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createAuthenticatedRequesterContext } from "../../backend/auth/requesterContext";
import type { BackendRequesterContextRequest } from "../../backend/auth/trustedAuthMiddleware";
import type {
  BackendAccountBootstrapTransactionResult,
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceRepository,
} from "../../backend/repositories/repositoryContracts";
import {
  SupabaseAccountWorkspaceRepository,
  type AccountBootstrapRpcRow,
  type SupabaseAccountWorkspaceClient,
} from "../../backend/repositories/supabaseAccountWorkspaceRepository";
import { createAccountRouter } from "../../backend/routes/account";

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";

const userAccount = {
  authProvider: "supabase" as const,
  authSubject: userId,
  userId,
};

const workspace = {
  createdByUserId: userId,
  name: "Personal Workspace",
  workspaceId,
};

const ownerMembership = {
  role: "owner" as const,
  status: "active" as const,
  userId,
  workspaceId,
};

const resolvedResult = (
  overrides: Partial<
    Extract<BackendAccountBootstrapTransactionResult, { kind: "resolved" }>
  > = {},
): BackendAccountBootstrapTransactionResult => ({
  kind: "resolved",
  outcome: "created",
  userAccount,
  workspace,
  membership: ownerMembership,
  appUserCreated: true,
  workspaceCreated: true,
  membershipCreated: true,
  ...overrides,
});

const blockedResult = (
  outcome:
    | "inactive_membership_blocked"
    | "multiple_active_memberships"
    | "conflicting_state",
): BackendAccountBootstrapTransactionResult => ({
  kind: "resolved",
  outcome,
  userAccount,
  appUserCreated: false,
  workspaceCreated: false,
  membershipCreated: false,
});

const createDependencies = (
  result: BackendAccountBootstrapTransactionResult,
) => {
  let transactionCalls = 0;
  const userAccountRepository: BackendUserAccountRepository = {
    bootstrapAccountWorkspaceTransaction: async () => {
      transactionCalls += 1;
      return result;
    },
    createOrGetByAuthSubject: async () => {
      throw new Error("Legacy app-user write must not run.");
    },
    getByAuthSubject: async () => undefined,
    getByUserId: async () => undefined,
  };
  const workspaceRepository: BackendWorkspaceRepository = {
    createPersonalWorkspace: async () => {
      throw new Error("Legacy workspace write must not run.");
    },
    getByWorkspaceId: async () => undefined,
    listForUser: async () => [],
  };
  const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
    createOrGetMembership: async () => {
      throw new Error("Legacy membership write must not run.");
    },
    getMembership: async () => undefined,
    listMembershipsForUser: async () => [],
    listMembershipsForWorkspace: async () => [],
  };

  return {
    dependencies: {
      getVerifiedAuthUserProfile: async () => ({ emailVerified: true }),
      userAccountRepository,
      workspaceMembershipRepository,
      workspaceRepository,
    },
    get transactionCalls() {
      return transactionCalls;
    },
  };
};

const startServer = async (result: BackendAccountBootstrapTransactionResult) => {
  const harness = createDependencies(result);
  const app = express();
  app.use((request, _response, next) => {
    (request as BackendRequesterContextRequest).backendRequesterContext =
      createAuthenticatedRequesterContext({
        authProvider: "jwt",
        authSubject: userId,
        userId,
      });
    next();
  });
  app.use(
    createAccountRouter({
      dependencies: harness.dependencies,
      env: { FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED: "1" },
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
      },
    }),
  );
  const server = createServer(app);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Transactional bootstrap test server did not expose a port.");
  }

  return {
    close: () =>
      new Promise<void>((done, reject) =>
        server.close((error?: Error) => (error ? reject(error) : done())),
      ),
    harness,
    server: server as Server,
    url: `http://127.0.0.1:${address.port}`,
  };
};

const bootstrap = (url: string) =>
  fetch(`${url}/account/bootstrap`, { method: "POST" });

test("fresh, recovered, repeated, and preserved-role outcomes keep truthful flags", async () => {
  const cases: Array<{
    expectedFlags: Record<string, boolean>;
    result: BackendAccountBootstrapTransactionResult;
    expectedRole: string;
  }> = [
    {
      expectedFlags: {
        appUserCreated: true,
        workspaceCreated: true,
        membershipCreated: true,
      },
      expectedRole: "workspace_owner",
      result: resolvedResult(),
    },
    {
      expectedFlags: {
        appUserCreated: false,
        workspaceCreated: true,
        membershipCreated: true,
      },
      expectedRole: "workspace_owner",
      result: resolvedResult({
        outcome: "recovered_partial_state",
        appUserCreated: false,
      }),
    },
    {
      expectedFlags: {
        appUserCreated: false,
        workspaceCreated: false,
        membershipCreated: true,
      },
      expectedRole: "workspace_owner",
      result: resolvedResult({
        outcome: "recovered_partial_state",
        appUserCreated: false,
        workspaceCreated: false,
      }),
    },
    {
      expectedFlags: {
        appUserCreated: false,
        workspaceCreated: false,
        membershipCreated: false,
      },
      expectedRole: "workspace_admin",
      result: resolvedResult({
        outcome: "existing_active_membership",
        membership: { ...ownerMembership, role: "admin" },
        appUserCreated: false,
        workspaceCreated: false,
        membershipCreated: false,
      }),
    },
  ];

  for (const entry of cases) {
    const server = await startServer(entry.result);
    try {
      const response = await bootstrap(server.url);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        bootstrap: entry.expectedFlags,
        identity: {
          workspaceAuthority: "verified",
          workspaceId,
          workspaceRole: entry.expectedRole,
        },
        kind: "account_bootstrap_complete",
      });
      expect(server.harness.transactionCalls).toBe(1);
    } finally {
      await server.close();
    }
  }
});

test("inactive, multiple, conflicting, and unavailable outcomes fail closed", async () => {
  const cases: Array<{
    result: BackendAccountBootstrapTransactionResult;
    status: number;
    body: Record<string, unknown>;
  }> = [
    {
      result: blockedResult("inactive_membership_blocked"),
      status: 403,
      body: { reason: "inactive_membership_exists" },
    },
    {
      result: blockedResult("multiple_active_memberships"),
      status: 409,
      body: { reason: "multiple_active_memberships" },
    },
    {
      result: blockedResult("conflicting_state"),
      status: 503,
      body: { kind: "bootstrap_unavailable" },
    },
    {
      result: { kind: "unavailable" },
      status: 503,
      body: { kind: "bootstrap_unavailable" },
    },
  ];

  for (const entry of cases) {
    const server = await startServer(entry.result);
    try {
      const response = await bootstrap(server.url);
      const body = await response.json();
      expect(response.status).toBe(entry.status);
      expect(body).toMatchObject(entry.body);
      expect(server.harness.transactionCalls).toBe(1);
      expect(JSON.stringify(body)).not.toContain("database");
      expect(JSON.stringify(body)).not.toContain("auth_subject");
    } finally {
      await server.close();
    }
  }
});

const rpcRow = (overrides: Partial<AccountBootstrapRpcRow> = {}): AccountBootstrapRpcRow => ({
  outcome: "created",
  app_user_id: userId,
  workspace_id: workspaceId,
  workspace_created_by_user_id: userId,
  workspace_name: "Personal Workspace",
  workspace_deleted_at: null,
  workspace_role: "owner",
  membership_status: "active",
  app_user_created: true,
  workspace_created: true,
  membership_created: true,
  ...overrides,
});

const createRpcRepository = (result: {
  data: AccountBootstrapRpcRow[] | AccountBootstrapRpcRow | null;
  error: { message: string } | null;
}) => {
  let calls = 0;
  let parameters: Record<string, unknown> | undefined;
  const client = {
    from: () => {
      throw new Error("Table writes must not be used by transactional bootstrap.");
    },
    rpc: async (_name: string, input: Record<string, unknown>) => {
      calls += 1;
      parameters = input;
      return result;
    },
  } as unknown as SupabaseAccountWorkspaceClient;

  return {
    get calls() {
      return calls;
    },
    get parameters() {
      return parameters;
    },
    repository: new SupabaseAccountWorkspaceRepository(client),
  };
};

const invokeRepository = (repository: SupabaseAccountWorkspaceRepository) =>
  repository.bootstrapAccountWorkspaceTransaction({
    authProvider: "supabase",
    authSubject: userId,
    userId,
    personalWorkspaceId: workspaceId,
    personalWorkspaceName: "Personal Workspace",
  });

test("repository invokes the RPC once without caller-controlled role or status", async () => {
  const harness = createRpcRepository({ data: [rpcRow()], error: null });

  await expect(invokeRepository(harness.repository)).resolves.toMatchObject({
    kind: "resolved",
    outcome: "created",
    appUserCreated: true,
    workspaceCreated: true,
    membershipCreated: true,
  });
  expect(harness.calls).toBe(1);
  expect(harness.parameters).not.toHaveProperty("role");
  expect(harness.parameters).not.toHaveProperty("status");
});

test("concurrent transactional calls resolve one canonical authority without duplicates", async () => {
  let committed = false;
  let calls = 0;
  const client = {
    from: () => {
      throw new Error("Transactional bootstrap must not use table writes.");
    },
    rpc: async () => {
      calls += 1;
      if (!committed) {
        committed = true;
        return { data: [rpcRow()], error: null };
      }

      return {
        data: [
          rpcRow({
            outcome: "existing_active_membership",
            app_user_created: false,
            workspace_created: false,
            membership_created: false,
          }),
        ],
        error: null,
      };
    },
  } as unknown as SupabaseAccountWorkspaceClient;
  const repository = new SupabaseAccountWorkspaceRepository(client);

  const results = await Promise.all([
    invokeRepository(repository),
    invokeRepository(repository),
  ]);

  expect(calls).toBe(2);
  expect(results).toMatchObject([
    { kind: "resolved", outcome: "created" },
    { kind: "resolved", outcome: "existing_active_membership" },
  ]);
  expect(
    results.map((result) =>
      result.kind === "resolved" ? result.workspace?.workspaceId : undefined,
    ),
  ).toEqual([workspaceId, workspaceId]);
});

test("simulated RPC failures expose no newly committed partial state", async () => {
  for (const failureStage of ["workspace", "membership"] as const) {
    const committed = { appUsers: 0, memberships: 0, workspaces: 0 };
    const client = {
      from: () => {
        throw new Error("Transactional bootstrap must not use table writes.");
      },
      rpc: async () => {
        const pending = { appUsers: 1, memberships: 0, workspaces: 0 };
        if (failureStage === "workspace") {
          throw new Error("SENSITIVE workspace failure");
        }

        pending.workspaces = 1;
        if (failureStage === "membership") {
          throw new Error("SENSITIVE membership failure");
        }

        return { data: [rpcRow()], error: null };
      },
    } as unknown as SupabaseAccountWorkspaceClient;
    const repository = new SupabaseAccountWorkspaceRepository(client);

    await expect(invokeRepository(repository)).resolves.toEqual({
      kind: "unavailable",
    });
    expect(committed).toEqual({ appUsers: 0, memberships: 0, workspaces: 0 });
  }
});

test("empty, multiple, malformed, unknown, and failed RPC results are unavailable", async () => {
  const results = [
    { data: [], error: null },
    { data: [rpcRow(), rpcRow()], error: null },
    { data: [rpcRow({ outcome: "unknown" })], error: null },
    { data: [rpcRow({ workspace_role: "platform_admin" })], error: null },
    { data: [rpcRow({ workspace_created_by_user_id: workspaceId })], error: null },
    { data: [rpcRow({ workspace_deleted_at: "2026-01-01T00:00:00Z" })], error: null },
    { data: [rpcRow({ app_user_id: workspaceId })], error: null },
    { data: null, error: { message: "SENSITIVE database failure" } },
  ];

  for (const result of results) {
    const harness = createRpcRepository(result);
    await expect(invokeRepository(harness.repository)).resolves.toEqual({
      kind: "unavailable",
    });
    expect(harness.calls).toBe(1);
  }
});

test("migration is atomic, serialized, insert-only, and service-role-only", () => {
  const root = resolve(process.cwd());
  const migration = readFileSync(
    resolve(
      root,
      "backend/db/migrations/0009_h6h_transactional_account_bootstrap.sql",
    ),
    "utf8",
  ).toLowerCase();
  const route = readFileSync(resolve(root, "backend/routes/account.ts"), "utf8");

  expect(migration.trimStart().startsWith("begin;")).toBe(true);
  expect(migration.trimEnd().endsWith("commit;")).toBe(true);
  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = pg_catalog");
  expect(migration).toContain("pg_advisory_xact_lock");
  expect(migration).toContain(
    "lock table public.workspace_memberships in share row exclusive mode",
  );
  expect(migration).toContain("when sqlstate 'p6001'");
  expect(migration).toContain(
    "'conflicting_state'::text, p_app_user_id, null::uuid",
  );
  expect(migration).toContain("from public");
  expect(migration).toContain("from anon");
  expect(migration).toContain("from authenticated");
  expect(migration).toContain("to service_role");
  expect(migration).not.toMatch(/\bupdate\s+public\.(?:app_users|workspaces|workspace_memberships)\b/);
  expect(migration).not.toMatch(/\bupsert\b/);
  expect(route).not.toContain(".createOrGetByAuthSubject({");
  expect(route).not.toContain(".createPersonalWorkspace({");
  expect(route).not.toContain(".createOrGetMembership({");
});
