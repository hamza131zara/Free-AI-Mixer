import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import express from "express";
import { expect, test } from "@playwright/test";
import {
  createAuthenticatedRequesterContext,
} from "../../backend/auth/requesterContext";
import type { BackendRequesterContextRequest } from "../../backend/auth/trustedAuthMiddleware";
import { createAccountRouter } from "../../backend/routes/account";
import {
  SupabaseAccountWorkspaceRepository,
  type AccountWorkspaceTableQuery,
  type AccountWorkspaceTableQueryResult,
  type AppUserRow,
  type SupabaseAccountWorkspaceClient,
  type WorkspaceRow,
  type WorkspaceMembershipRow,
} from "../../backend/repositories/supabaseAccountWorkspaceRepository";
import type {
  BackendUserAccountRecord,
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRecord,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceRecord,
  BackendWorkspaceRepository,
} from "../../backend/repositories/repositoryContracts";
import { parseBackendAccountBootstrapResponse } from "../../src/services/authService";
import { mapAccountBootstrapFailureState } from "../../src/store/authStore";

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const secondWorkspaceId = "33333333-3333-4333-8333-333333333333";
const spoofedWorkspaceId = "44444444-4444-4444-8444-444444444444";

const deterministicPersonalWorkspaceId = (subject: string): string => {
  const hex = createHash("sha256")
    .update(`free-ai-mixer:personal-workspace:${subject}`)
    .digest("hex")
    .slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
};

const runtimeConfig = {
  kind: "auth_provider_configured" as const,
  provider: "future_jwt_provider" as const,
};

const env = {
  FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED: "1",
};

const toStatus = (
  status: string,
): BackendWorkspaceMembershipRecord["status"] =>
  status as BackendWorkspaceMembershipRecord["status"];

interface RepositoryHarnessOptions {
  initialUserExists?: boolean;
  memberships?: BackendWorkspaceMembershipRecord[];
  workspaceLookupError?: string;
  workspaces?: BackendWorkspaceRecord[];
}

const createRepositoryHarness = (
  options: RepositoryHarnessOptions = {},
) => {
  const memberships = [...(options.memberships ?? [])];
  const workspaces = new Map(
    (options.workspaces ?? []).map((workspace) => [workspace.workspaceId, workspace]),
  );
  const counts = {
    listForUser: 0,
    membershipWrites: 0,
    userWrites: 0,
    workspaceWrites: 0,
  };

  let account: BackendUserAccountRecord | undefined =
    options.initialUserExists === false
      ? undefined
      : {
          authProvider: "supabase",
          authSubject: userId,
          email: "member@example.test",
          userId,
        };
  const userAccountRepository: BackendUserAccountRepository = {
    createOrGetByAuthSubject: async (input) => {
      if (account) {
        return { userAccount: account, created: false };
      }

      counts.userWrites += 1;
      account = {
        authProvider: input.authProvider,
        authSubject: input.authSubject,
        ...(input.email ? { email: input.email } : {}),
        userId: input.userId,
      };
      return { userAccount: account, created: true };
    },
    getByAuthSubject: async (_provider, subject) =>
      subject === userId ? account : undefined,
    getByUserId: async (candidateUserId) =>
      candidateUserId === userId ? account : undefined,
  };
  const workspaceRepository: BackendWorkspaceRepository = {
    createPersonalWorkspace: async (input) => {
      const existing = workspaces.get(input.workspaceId);

      if (existing) {
        return { workspace: existing, created: false };
      }

      counts.workspaceWrites += 1;
      const workspace: BackendWorkspaceRecord = {
        createdByUserId: input.userId,
        name: input.name,
        workspaceId: input.workspaceId,
      };
      workspaces.set(workspace.workspaceId, workspace);
      return { workspace, created: true };
    },
    getByWorkspaceId: async (candidateWorkspaceId) =>
      options.workspaceLookupError
        ? Promise.reject(new Error(options.workspaceLookupError))
        : workspaces.get(candidateWorkspaceId),
    listForUser: async () => {
      counts.listForUser += 1;
      throw new Error("Bootstrap must not select a workspace through listForUser.");
    },
  };
  const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
    createOrGetMembership: async (input) => {
      counts.membershipWrites += 1;
      const existing = memberships.find(
        (membership) =>
          membership.workspaceId === input.workspaceId &&
          membership.userId === input.userId,
      );

      if (existing) {
        if (existing.role !== input.role || existing.status !== input.status) {
          throw new Error("Conflicting membership must fail closed.");
        }

        return { membership: existing, created: false };
      }

      const membership: BackendWorkspaceMembershipRecord = { ...input };
      memberships.push(membership);
      return { membership, created: true };
    },
    getMembership: async (candidateWorkspaceId, candidateUserId) =>
      memberships.find(
        (membership) =>
          membership.workspaceId === candidateWorkspaceId &&
          membership.userId === candidateUserId,
      ),
    listMembershipsForUser: async (candidateUserId) =>
      memberships.filter((membership) => membership.userId === candidateUserId),
    listMembershipsForWorkspace: async (candidateWorkspaceId) =>
      memberships.filter(
        (membership) => membership.workspaceId === candidateWorkspaceId,
      ),
  };

  return {
    counts,
    memberships,
    repositories: {
      userAccountRepository,
      workspaceMembershipRepository,
      workspaceRepository,
    },
    workspaces,
  };
};

const startAccountServer = async (
  repositories: ReturnType<typeof createRepositoryHarness>["repositories"],
) => {
  const app = express();
  app.use(express.json());
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
      dependencies: {
        ...repositories,
        getVerifiedAuthUserProfile: async () => ({
          email: "member@example.test",
          emailVerified: true,
        }),
      },
      env,
      runtimeConfig,
    }),
  );

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("H6-G.1 test server did not expose a port.");
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    url: `http://127.0.0.1:${address.port}`,
  };
};

const bootstrap = (url: string) =>
  fetch(`${url}/account/bootstrap`, {
    headers: {
      "x-user-id": "spoofed-user",
      "x-workspace-id": spoofedWorkspaceId,
    },
    method: "POST",
  });

const expectSafeBlockedBody = (body: unknown): void => {
  const serialized = JSON.stringify(body);

  for (const forbidden of [
    workspaceId,
    secondWorkspaceId,
    spoofedWorkspaceId,
    "owner",
    "admin",
    "editor",
    "viewer",
    "service_role",
    "storage_ref",
    "database",
    "supabase",
  ]) {
    expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
};

test.describe("H6-G.1 account bootstrap authorization", () => {
  for (const [role, expectedRole] of [
    ["owner", "workspace_owner"],
    ["admin", "workspace_admin"],
    ["editor", "workspace_member"],
    ["viewer", "workspace_viewer"],
  ] as const) {
    test(`preserves an active ${role} membership without authorization writes`, async () => {
      const harness = createRepositoryHarness({
        memberships: [
          { role, status: "active", userId, workspaceId },
        ],
        workspaces: [
          { createdByUserId: userId, name: "Verified workspace", workspaceId },
        ],
      });
      const server = await startAccountServer(harness.repositories);

      try {
        const response = await bootstrap(server.url);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
          bootstrap: {
            membershipCreated: false,
            workspaceCreated: false,
          },
          identity: {
            userId,
            workspaceAuthority: "verified",
            workspaceId,
            workspaceRole: expectedRole,
          },
          kind: "account_bootstrap_complete",
          status: "authenticated",
        });
        expect(harness.memberships[0]).toMatchObject({ role, status: "active" });
        expect(harness.counts).toMatchObject({
          listForUser: 0,
          membershipWrites: 0,
          workspaceWrites: 0,
        });
        expect(JSON.stringify(body)).not.toContain("spoofed");
      } finally {
        await server.close();
      }
    });
  }

  for (const status of [
    "invited",
    "disabled",
    "revoked",
    "nonstandard_inactive",
  ] as const) {
    test(`blocks an inactive ${status} membership without selecting or creating a workspace`, async () => {
      const harness = createRepositoryHarness({
        memberships: [
          { role: "viewer", status: toStatus(status), userId, workspaceId },
        ],
        workspaces: [
          { createdByUserId: userId, name: "Inactive workspace", workspaceId },
        ],
      });
      const server = await startAccountServer(harness.repositories);

      try {
        const response = await bootstrap(server.url);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({
          kind: "workspace_bootstrap_blocked",
          message:
            "Workspace setup cannot continue while an inactive membership record exists.",
          reason: "inactive_membership_exists",
          status: "workspace_bootstrap_blocked",
        });
        expect(harness.memberships[0]).toMatchObject({ status: toStatus(status) });
        expect(harness.counts).toMatchObject({
          listForUser: 0,
          membershipWrites: 0,
          workspaceWrites: 0,
        });
        expectSafeBlockedBody(body);
      } finally {
        await server.close();
      }
    });
  }

  test("blocks multiple active memberships without any workspace or membership write", async () => {
    const harness = createRepositoryHarness({
      memberships: [
        { role: "owner", status: "active", userId, workspaceId },
        {
          role: "admin",
          status: "active",
          userId,
          workspaceId: secondWorkspaceId,
        },
      ],
    });
    const server = await startAccountServer(harness.repositories);

    try {
      const response = await bootstrap(server.url);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({
        kind: "workspace_bootstrap_blocked",
        reason: "multiple_active_memberships",
        status: "workspace_selection_required",
      });
      expect(harness.counts).toMatchObject({
        listForUser: 0,
        membershipWrites: 0,
        workspaceWrites: 0,
      });
      expect(JSON.stringify(body)).not.toContain(spoofedWorkspaceId);
      expect(JSON.stringify(body)).not.toContain(workspaceId);
      expect(JSON.stringify(body)).not.toContain(secondWorkspaceId);
      expect(body.identity).toMatchObject({
  workspaceAuthority: "not_available",
  workspaceAuthorityReason: "multiple_active_workspace_memberships",
});

expect(body.identity).not.toHaveProperty("workspaceId");
expect(body.identity).not.toHaveProperty("workspaceRole");
    } finally {
      await server.close();
    }
  });

  test("creates one deterministic personal workspace and membership, then reuses both", async () => {
    const harness = createRepositoryHarness({ initialUserExists: false });
    const server = await startAccountServer(harness.repositories);

    try {
      const firstResponse = await bootstrap(server.url);
      const firstBody = await firstResponse.json();
      const secondResponse = await bootstrap(server.url);
      const secondBody = await secondResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(firstBody.identity.workspaceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(secondBody.identity.workspaceId).toBe(firstBody.identity.workspaceId);
      expect(firstBody).toMatchObject({
        bootstrap: {
          appUserCreated: true,
          membershipCreated: true,
          workspaceCreated: true,
        },
        identity: { workspaceRole: "workspace_owner" },
      });
      expect(secondBody).toMatchObject({
        bootstrap: {
          appUserCreated: false,
          membershipCreated: false,
          workspaceCreated: false,
        },
        identity: { workspaceRole: "workspace_owner" },
      });
      expect(harness.counts).toMatchObject({
        listForUser: 0,
        membershipWrites: 1,
        userWrites: 1,
        workspaceWrites: 1,
      });
      expect(harness.memberships).toHaveLength(1);
      expect(harness.memberships[0]).toMatchObject({
        role: "owner",
        status: "active",
        userId,
        workspaceId: firstBody.identity.workspaceId,
      });
    } finally {
      await server.close();
    }
  });

  test("reports an existing exact personal workspace and newly inserted membership truthfully", async () => {
    const personalWorkspaceId = deterministicPersonalWorkspaceId(userId);
    const harness = createRepositoryHarness({
      workspaces: [
        {
          createdByUserId: userId,
          name: "Personal Workspace",
          workspaceId: personalWorkspaceId,
        },
      ],
    });
    const server = await startAccountServer(harness.repositories);

    try {
      const response = await bootstrap(server.url);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        bootstrap: {
          membershipCreated: true,
          workspaceCreated: false,
        },
        identity: {
          workspaceId: personalWorkspaceId,
          workspaceRole: "workspace_owner",
        },
      });
      expect(harness.counts).toMatchObject({
        membershipWrites: 1,
        workspaceWrites: 0,
      });
    } finally {
      await server.close();
    }
  });

  for (const deletedAt of [undefined, "2026-06-28T00:00:00.000Z"]) {
    test(`${deletedAt ? "deleted" : "missing"} active workspace fails closed`, async () => {
      const harness = createRepositoryHarness({
        memberships: [
          { role: "owner", status: "active", userId, workspaceId },
        ],
        workspaces: deletedAt
          ? [
              {
                createdByUserId: userId,
                deletedAt,
                name: "Deleted workspace",
                workspaceId,
              },
            ]
          : [],
      });
      const server = await startAccountServer(harness.repositories);

      try {
        const response = await bootstrap(server.url);
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toEqual({
          kind: "bootstrap_unavailable",
          message: "Account bootstrap could not verify workspace authority safely.",
          status: "bootstrap_unavailable",
        });
        expect(harness.counts.membershipWrites).toBe(0);
        expect(harness.counts.workspaceWrites).toBe(0);
        expectSafeBlockedBody(body);
      } finally {
        await server.close();
      }
    });
  }

  test("repository failures are redacted and cannot publish workspace authority", async () => {
    const rawRepositoryError = "SENSITIVE database workspace lookup failure";
    const harness = createRepositoryHarness({
      memberships: [
        { role: "owner", status: "active", userId, workspaceId },
      ],
      workspaceLookupError: rawRepositoryError,
    });
    const server = await startAccountServer(harness.repositories);

    try {
      const response = await bootstrap(server.url);
      const body = await response.json();
      const serialized = JSON.stringify(body);

      expect(response.status).toBe(503);
      expect(body).toEqual({
        kind: "bootstrap_unavailable",
        message: "Account bootstrap is temporarily unavailable.",
        status: "bootstrap_unavailable",
      });
      expect(serialized).not.toContain(rawRepositoryError);
      expect(serialized).not.toContain(workspaceId);
      expect(serialized).not.toContain("owner");
      expect(harness.counts.membershipWrites).toBe(0);
      expect(harness.counts.workspaceWrites).toBe(0);
    } finally {
      await server.close();
    }
  });
});

class DuplicateMembershipQuery
  implements AccountWorkspaceTableQuery<WorkspaceMembershipRow>
{
  private inserting = false;

  constructor(
    private readonly state: {
      firstLookupMissing: boolean;
      insertSucceeds: boolean;
      lookupCount: number;
      row: WorkspaceMembershipRow;
    },
  ) {}

  eq(): AccountWorkspaceTableQuery<WorkspaceMembershipRow> {
    return this;
  }

  insert(): AccountWorkspaceTableQuery<WorkspaceMembershipRow> {
    this.inserting = true;
    return this;
  }

  select(): AccountWorkspaceTableQuery<WorkspaceMembershipRow> {
    return this;
  }

  maybeSingle(): Promise<AccountWorkspaceTableQueryResult<WorkspaceMembershipRow>> {
    if (this.inserting) {
      if (this.state.insertSucceeds) {
        return Promise.resolve({ data: this.state.row, error: null });
      }

      return Promise.resolve({
        data: null,
        error: { message: "23505 duplicate key value" },
      });
    }

    this.state.lookupCount += 1;
    return Promise.resolve({
      data:
        this.state.firstLookupMissing && this.state.lookupCount === 1
          ? null
          : this.state.row,
      error: null,
    });
  }

  then(
    onfulfilled?: ((value: AccountWorkspaceTableQueryResult<WorkspaceMembershipRow>) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ): Promise<unknown> {
    return this.maybeSingle().then(onfulfilled, onrejected);
  }
}

const createDuplicateMembershipClient = (
  row: WorkspaceMembershipRow,
  firstLookupMissing = true,
  insertSucceeds = false,
): SupabaseAccountWorkspaceClient => {
  const state = { firstLookupMissing, insertSucceeds, lookupCount: 0, row };

  return {
    from: () => new DuplicateMembershipQuery(state),
  } as unknown as SupabaseAccountWorkspaceClient;
};

test("insert-only membership creation accepts only an identical duplicate", async () => {
  const identicalRepository = new SupabaseAccountWorkspaceRepository(
    createDuplicateMembershipClient({
      created_at: null,
      role: "owner",
      status: "active",
      updated_at: null,
      user_id: userId,
      workspace_id: workspaceId,
    }),
  );

  await expect(
    identicalRepository.createOrGetMembership({
      role: "owner",
      status: "active",
      userId,
      workspaceId,
    }),
  ).resolves.toMatchObject({
    created: false,
    membership: { role: "owner", status: "active", userId, workspaceId },
  });

  const freshRepository = new SupabaseAccountWorkspaceRepository(
    createDuplicateMembershipClient(
      {
        created_at: null,
        role: "owner",
        status: "active",
        updated_at: null,
        user_id: userId,
        workspace_id: workspaceId,
      },
      true,
      true,
    ),
  );

  await expect(
    freshRepository.createOrGetMembership({
      role: "owner",
      status: "active",
      userId,
      workspaceId,
    }),
  ).resolves.toMatchObject({
    created: true,
    membership: { role: "owner", status: "active", userId, workspaceId },
  });

  const existingRepository = new SupabaseAccountWorkspaceRepository(
    createDuplicateMembershipClient(
      {
        created_at: null,
        role: "owner",
        status: "active",
        updated_at: null,
        user_id: userId,
        workspace_id: workspaceId,
      },
      false,
    ),
  );

  await expect(
    existingRepository.createOrGetMembership({
      role: "owner",
      status: "active",
      userId,
      workspaceId,
    }),
  ).resolves.toMatchObject({
    created: false,
    membership: { role: "owner", status: "active", userId, workspaceId },
  });

  const conflictingRows: ReadonlyArray<{
  role: BackendWorkspaceMembershipRecord["role"];
  status: BackendWorkspaceMembershipRecord["status"];
}> = [
  { role: "admin", status: "active" },
  { role: "owner", status: toStatus("disabled") },
];

for (const conflictingRow of conflictingRows) {
    const repository = new SupabaseAccountWorkspaceRepository(
      createDuplicateMembershipClient({
        created_at: null,
        role: conflictingRow.role as BackendWorkspaceMembershipRecord["role"],
        status: conflictingRow.status,
        updated_at: null,
        user_id: userId,
        workspace_id: workspaceId,
      }),
    );

    await expect(
      repository.createOrGetMembership({
        role: "owner",
        status: "active",
        userId,
        workspaceId,
      }),
    ).rejects.toThrow(
      "Workspace membership bootstrap could not be completed safely.",
    );
  }
});

class DuplicateWorkspaceQuery implements AccountWorkspaceTableQuery<WorkspaceRow> {
  private inserting = false;

  constructor(
    private readonly state: {
      firstLookupMissing: boolean;
      insertSucceeds: boolean;
      lookupCount: number;
      row: WorkspaceRow;
    },
  ) {}

  eq(): AccountWorkspaceTableQuery<WorkspaceRow> {
    return this;
  }

  insert(): AccountWorkspaceTableQuery<WorkspaceRow> {
    this.inserting = true;
    return this;
  }

  select(): AccountWorkspaceTableQuery<WorkspaceRow> {
    return this;
  }

  maybeSingle(): Promise<AccountWorkspaceTableQueryResult<WorkspaceRow>> {
    if (this.inserting) {
      if (this.state.insertSucceeds) {
        return Promise.resolve({ data: this.state.row, error: null });
      }

      return Promise.resolve({
        data: null,
        error: { message: "23505 duplicate key value" },
      });
    }

    this.state.lookupCount += 1;
    return Promise.resolve({
      data:
        this.state.firstLookupMissing && this.state.lookupCount === 1
          ? null
          : this.state.row,
      error: null,
    });
  }

  then(
    onfulfilled?: ((value: AccountWorkspaceTableQueryResult<WorkspaceRow>) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ): Promise<unknown> {
    return this.maybeSingle().then(onfulfilled, onrejected);
  }
}

const createWorkspaceClient = (
  firstLookupMissing: boolean,
  insertSucceeds = false,
): SupabaseAccountWorkspaceClient => {
  const state = {
    firstLookupMissing,
    insertSucceeds,
    lookupCount: 0,
    row: {
      created_at: null,
      created_by_user_id: userId,
      deleted_at: null,
      id: workspaceId,
      name: "Personal Workspace",
      updated_at: null,
    },
  };

  return {
    from: () => new DuplicateWorkspaceQuery(state),
  } as unknown as SupabaseAccountWorkspaceClient;
};

test("workspace creation distinguishes existing records from duplicate recovery", async () => {
  for (const firstLookupMissing of [false, true]) {
    const repository = new SupabaseAccountWorkspaceRepository(
      createWorkspaceClient(firstLookupMissing),
    );

    await expect(
      repository.createPersonalWorkspace({
        name: "Personal Workspace",
        userId,
        workspaceId,
      }),
    ).resolves.toMatchObject({
      created: false,
      workspace: {
        createdByUserId: userId,
        name: "Personal Workspace",
        workspaceId,
      },
    });
  }


  const freshRepository = new SupabaseAccountWorkspaceRepository(
    createWorkspaceClient(true, true),
  );

  await expect(
    freshRepository.createPersonalWorkspace({
      name: "Personal Workspace",
      userId,
      workspaceId,
    }),
  ).resolves.toMatchObject({
    created: true,
    workspace: {
      createdByUserId: userId,
      name: "Personal Workspace",
      workspaceId,
    },
  });
});

class AppUserCreationQuery implements AccountWorkspaceTableQuery<AppUserRow> {
  private inserting = false;

  constructor(
    private readonly state: {
      firstLookupMissing: boolean;
      insertSucceeds: boolean;
      lookupCount: number;
      row: AppUserRow;
    },
  ) {}

  eq(): AccountWorkspaceTableQuery<AppUserRow> {
    return this;
  }

  insert(): AccountWorkspaceTableQuery<AppUserRow> {
    this.inserting = true;
    return this;
  }

  select(): AccountWorkspaceTableQuery<AppUserRow> {
    return this;
  }

  maybeSingle(): Promise<AccountWorkspaceTableQueryResult<AppUserRow>> {
    if (this.inserting) {
      return Promise.resolve(
        this.state.insertSucceeds
          ? { data: this.state.row, error: null }
          : { data: null, error: { message: "23505 duplicate key value" } },
      );
    }

    this.state.lookupCount += 1;
    return Promise.resolve({
      data:
        this.state.firstLookupMissing && this.state.lookupCount === 1
          ? null
          : this.state.row,
      error: null,
    });
  }

  then(
    onfulfilled?: ((value: AccountWorkspaceTableQueryResult<AppUserRow>) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ): Promise<unknown> {
    return this.maybeSingle().then(onfulfilled, onrejected);
  }
}

const createAppUserClient = (options: {
  firstLookupMissing: boolean;
  insertSucceeds?: boolean;
  row?: AppUserRow;
}): SupabaseAccountWorkspaceClient => {
  const state = {
    firstLookupMissing: options.firstLookupMissing,
    insertSucceeds: options.insertSucceeds ?? false,
    lookupCount: 0,
    row:
      options.row ??
      ({
        auth_provider: "supabase",
        auth_subject: userId,
        created_at: null,
        email: "member@example.test",
        id: userId,
        updated_at: null,
      } satisfies AppUserRow),
  };

  return {
    from: () => new AppUserCreationQuery(state),
  } as unknown as SupabaseAccountWorkspaceClient;
};

const createAppUser = (repository: SupabaseAccountWorkspaceRepository) =>
  repository.createOrGetByAuthSubject({
    authProvider: "supabase",
    authSubject: userId,
    email: "member@example.test",
    userId,
  });

test("app-user creation reports fresh, existing, and duplicate outcomes truthfully", async () => {
  await expect(
    createAppUser(
      new SupabaseAccountWorkspaceRepository(
        createAppUserClient({ firstLookupMissing: true, insertSucceeds: true }),
      ),
    ),
  ).resolves.toMatchObject({
    created: true,
    userAccount: { authProvider: "supabase", authSubject: userId, userId },
  });

  await expect(
    createAppUser(
      new SupabaseAccountWorkspaceRepository(
        createAppUserClient({ firstLookupMissing: false }),
      ),
    ),
  ).resolves.toMatchObject({
    created: false,
    userAccount: { authProvider: "supabase", authSubject: userId, userId },
  });

  await expect(
    createAppUser(
      new SupabaseAccountWorkspaceRepository(
        createAppUserClient({ firstLookupMissing: true }),
      ),
    ),
  ).resolves.toMatchObject({
    created: false,
    userAccount: { authProvider: "supabase", authSubject: userId, userId },
  });
});

test("inconsistent duplicate app-user identity fails closed", async () => {
  const repository = new SupabaseAccountWorkspaceRepository(
    createAppUserClient({
      firstLookupMissing: true,
      row: {
        auth_provider: "supabase",
        auth_subject: userId,
        created_at: null,
        email: null,
        id: "55555555-5555-4555-8555-555555555555",
        updated_at: null,
      },
    }),
  );

  await expect(createAppUser(repository)).rejects.toThrow(
    "App user bootstrap could not be completed safely.",
  );
});

test("frontend bootstrap parsing preserves inactive membership blocking and fails malformed payloads closed", () => {
  const multipleMemberships = parseBackendAccountBootstrapResponse({
    kind: "workspace_bootstrap_blocked",
    status: "workspace_selection_required",
    reason: "multiple_active_memberships",
    identity: {
      userId,
      workspaceAuthority: "not_available",
      workspaceAuthorityReason: "multiple_active_workspace_memberships",
    },
    rawDatabasePayload: "must be discarded",
  });
  const blocked = parseBackendAccountBootstrapResponse({
    kind: "workspace_bootstrap_blocked",
    status: "workspace_bootstrap_blocked",
    reason: "inactive_membership_exists",
    message: "Workspace setup is blocked.",
    rawDatabasePayload: "must be discarded",
  });

  expect(multipleMemberships).toEqual({
    kind: "workspace_bootstrap_blocked",
    status: "workspace_selection_required",
    reason: "multiple_active_memberships",
    identity: {
      userId,
      workspaceAuthority: "not_available",
      workspaceAuthorityReason: "multiple_active_workspace_memberships",
    },
  });
  expect(JSON.stringify(multipleMemberships)).not.toContain("rawDatabasePayload");
  expect(blocked).toEqual({
    kind: "workspace_bootstrap_blocked",
    status: "workspace_bootstrap_blocked",
    reason: "inactive_membership_exists",
    message: "Workspace setup is blocked.",
  });
  expect(blocked.kind).not.toBe("invalid_credentials");
  expect(JSON.stringify(blocked)).not.toContain("sign_in_required");
  expect(JSON.stringify(blocked)).not.toContain("rawDatabasePayload");

  expect(
    parseBackendAccountBootstrapResponse({
      kind: "workspace_bootstrap_blocked",
      status: "workspace_bootstrap_blocked",
      reason: "unexpected_reason",
      rawDatabasePayload: "must be discarded",
    }),
  ).toEqual({
    kind: "bootstrap_unavailable",
    status: "bootstrap_unavailable",
    message: "Account setup returned an invalid response.",
  });
});

test("bootstrap success and workspace-selection parsing require authoritative workspace identity", () => {
  const completePayload = {
    kind: "account_bootstrap_complete",
    status: "authenticated",
    identity: {
      userId,
      workspaceId,
      workspaceAuthority: "verified",
      workspaceRole: "workspace_owner",
    },
    bootstrap: {
      appUserCreated: false,
      workspaceCreated: false,
      membershipCreated: false,
    },
  };

  expect(parseBackendAccountBootstrapResponse(completePayload)).toMatchObject({
    kind: "account_bootstrap_complete",
    identity: {
      workspaceId,
      workspaceAuthority: "verified",
      workspaceRole: "workspace_owner",
    },
  });

  for (const invalidIdentity of [
    { userId, workspaceAuthority: "verified", workspaceRole: "workspace_owner" },
    {
      userId,
      workspaceId,
      workspaceAuthority: "not_available",
      workspaceRole: "workspace_owner",
    },
    {
      userId,
      workspaceId,
      workspaceAuthority: "verified",
      workspaceRole: "workspace_superuser",
    },
  ]) {
    expect(
      parseBackendAccountBootstrapResponse({
        ...completePayload,
        identity: invalidIdentity,
      }),
    ).toEqual({
      kind: "bootstrap_unavailable",
      status: "bootstrap_unavailable",
      message: "Account setup returned an invalid response.",
    });
  }

  expect(
    parseBackendAccountBootstrapResponse({
      kind: "workspace_bootstrap_blocked",
      status: "workspace_selection_required",
      reason: "multiple_active_memberships",
      identity: {
        userId,
        workspaceAuthority: "verified",
        workspaceAuthorityReason: "multiple_active_workspace_memberships",
      },
    }),
  ).toEqual({
    kind: "bootstrap_unavailable",
    status: "bootstrap_unavailable",
    message: "Account setup returned an invalid response.",
  });
});

test("manual and automatic bootstrap failures share the same fail-closed state mapping", () => {
  const existingIdentity = {
    userId,
    workspaceAuthority: "not_available" as const,
    workspaceAuthorityReason: "no_active_workspace_membership" as const,
  };
  const inactiveBlocked = parseBackendAccountBootstrapResponse({
    kind: "workspace_bootstrap_blocked",
    status: "workspace_bootstrap_blocked",
    reason: "inactive_membership_exists",
    message: "Workspace setup is blocked.",
  });
  const manualMapping = mapAccountBootstrapFailureState(
    inactiveBlocked,
    existingIdentity,
  );
  const automaticMapping = mapAccountBootstrapFailureState(
    inactiveBlocked,
    existingIdentity,
  );

  expect(manualMapping).toEqual(automaticMapping);
  expect(manualMapping).toEqual({
    clearRuntimeProjectAuthority: true,
    state: {
      status: "unavailable",
      identity: undefined,
      message: "Workspace setup is blocked.",
      reasonCode: "workspace_bootstrap_blocked",
      bootstrapPhase: "workspace_forbidden",
      bootstrapMessage: "Workspace setup is blocked.",
      bootstrapDiagnosticCode: "workspace_forbidden",
      pendingAction: null,
    },
  });
  expect(manualMapping.state.bootstrapPhase).not.toBe("temporarily_unavailable");
  expect(manualMapping.state.bootstrapPhase).not.toBe("sign_in_required");
  expect(manualMapping.state.identity).toBeUndefined();
  expect(JSON.stringify(manualMapping.state)).not.toContain(workspaceId);
  expect(JSON.stringify(manualMapping.state)).not.toContain("workspace_owner");

  const multipleMembershipMapping = mapAccountBootstrapFailureState(
    parseBackendAccountBootstrapResponse({
      kind: "workspace_bootstrap_blocked",
      status: "workspace_selection_required",
      reason: "multiple_active_memberships",
      message: "Workspace selection is required.",
      identity: {
        userId,
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: "multiple_active_workspace_memberships",
      },
    }),
    {
      userId,
      workspaceId,
      workspaceAuthority: "verified",
      workspaceRole: "workspace_owner",
    },
  );
  expect(multipleMembershipMapping).toMatchObject({
    clearRuntimeProjectAuthority: true,
    state: {
      status: "unavailable",
      identity: undefined,
      reasonCode: "workspace_bootstrap_blocked",
      bootstrapPhase: "workspace_forbidden",
      bootstrapDiagnosticCode: "workspace_forbidden",
      pendingAction: null,
    },
  });
  expect(JSON.stringify(multipleMembershipMapping.state)).not.toContain(workspaceId);
  expect(JSON.stringify(multipleMembershipMapping.state)).not.toContain(
    "workspace_owner",
  );

  const invalidCredentials = mapAccountBootstrapFailureState(
    {
      kind: "invalid_credentials",
      status: "unauthenticated",
      reason: "invalid_credentials",
      message: "Credentials are invalid.",
    },
    existingIdentity,
  );
  expect(invalidCredentials).toMatchObject({
    clearRuntimeProjectAuthority: true,
    state: {
      status: "unauthenticated",
      identity: undefined,
      bootstrapPhase: "sign_in_required",
    },
  });

  const unavailable = mapAccountBootstrapFailureState(undefined, existingIdentity);
  expect(unavailable).toMatchObject({
    clearRuntimeProjectAuthority: false,
    state: {
      status: "unavailable",
      reasonCode: "account_bootstrap_unavailable",
      bootstrapPhase: "temporarily_unavailable",
      bootstrapDiagnosticCode: "session_verification_unavailable",
    },
  });
});

test("workspace and membership bootstrap methods remain insert-only", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "backend/repositories/supabaseAccountWorkspaceRepository.ts",
    ),
    "utf8",
  );
  const workspaceMethod = source.slice(
    source.indexOf("async createPersonalWorkspace"),
    source.indexOf("async getMembership"),
  );
  const membershipMethod = source.slice(
    source.indexOf("async createOrGetMembership"),
    source.indexOf("export const createSupabaseAccountWorkspaceRepository"),
  );
  const appUserMethod = source.slice(
    source.indexOf("async createOrGetByAuthSubject"),
    source.indexOf("async getByWorkspaceId"),
  );
  const authServiceSource = readFileSync(
    join(process.cwd(), "src/services/authService.ts"),
    "utf8",
  );
  const bootstrapRequest = authServiceSource.slice(
    authServiceSource.indexOf("const requestAccountBootstrap"),
    authServiceSource.indexOf("export const invalidateAccountBootstrapRequests"),
  );

const authStoreSource = readFileSync(
  join(process.cwd(), "src/store/authStore.ts"),
  "utf8",
);

const sliceSourceSection = (
  sourceText: string,
  startMarker: string,
  endMarker: string,
): string => {
  const start = sourceText.indexOf(startMarker);

  expect(
    start,
    `Expected source marker: ${startMarker}`,
  ).toBeGreaterThanOrEqual(0);

  const end = sourceText.indexOf(
    endMarker,
    start + startMarker.length,
  );

  expect(
    end,
    `Expected ${endMarker} after ${startMarker}`,
  ).toBeGreaterThan(start);

  return sourceText.slice(start, end);
};

const manualBootstrap = sliceSourceSection(
  authStoreSource,
  "retryAccountBootstrap: async",
  "markBackendWaking:",
);

const automaticBootstrap = sliceSourceSection(
  authStoreSource,
  "bootstrapBackendAccount: async",
  "setRecoveryState:",
);

  expect(appUserMethod).toContain(".insert(");
  expect(appUserMethod).not.toContain(".upsert(");
  expect(workspaceMethod).toContain(".insert(");
  expect(workspaceMethod).not.toContain(".upsert(");
  expect(membershipMethod).toContain(".insert(");
  expect(membershipMethod).not.toContain(".upsert(");
  expect(bootstrapRequest).toContain("fetch(accountBootstrapEndpoint");
  expect(bootstrapRequest).not.toContain("fetchWithBackendRequestPolicy");
  expect(bootstrapRequest).not.toMatch(/for\s*\(|while\s*\(/);
  expect(manualBootstrap).toContain("mapAccountBootstrapFailureState(");
  expect(automaticBootstrap).toContain("mapAccountBootstrapFailureState(");
  expect(manualBootstrap).toContain("clearRuntimeProjectContext()");
  expect(automaticBootstrap).toContain("clearRuntimeProjectContext()");
  expect(manualBootstrap.match(/bootstrapAccount\(accessToken\)/g)).toHaveLength(1);
  expect(automaticBootstrap.match(/bootstrapAccount\(accessToken\)/g)).toHaveLength(1);
});
