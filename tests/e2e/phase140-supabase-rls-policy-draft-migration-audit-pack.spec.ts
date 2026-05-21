import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase140 supabase rls policy draft migration audit pack", () => {
  test("rls draft exists as docs-only policy draft and is not a live migration", async () => {
    const draftPath = "docs/security/phase140-supabase-rls-policy-draft.sql";
    const draftSource = readSource(draftPath);

    expect(draftSource).toContain("DRAFT ONLY");
    expect(draftSource).toContain("not supabase/migrations");
    expect(draftSource).toContain("alter table public.export_jobs enable row level security");
    expect(draftSource).toContain("alter table public.export_artifacts enable row level security");
    expect(draftSource).toContain("alter table public.workspace_memberships enable row level security");

    expect(draftSource).toContain("export_jobs_owner_select");
    expect(draftSource).toContain("export_jobs_workspace_member_select");
    expect(draftSource).toContain("export_artifacts_workspace_member_select");
    expect(draftSource).toContain("workspace_memberships_self_select");

    expect(draftSource).toContain("auth.uid()");
    expect(draftSource).toContain("wm.status = 'active'");

    expect(existsSync(path.join(projectRoot, "supabase/migrations/phase140-supabase-rls-policy-draft.sql"))).toBe(false);
  });

  test("rls policy draft is not wired into app routes auth or repository runtime", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");
    const membershipSource = readSource("backend/auth/workspaceMembership.ts");
    const membershipRepositorySource = readSource("backend/auth/workspaceMembershipRepository.ts");
    const membershipEnforcementSource = readSource("backend/auth/workspaceMembershipEnforcement.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");

    const runtimeSource =
      routeSource +
      "\n" +
      appSource +
      "\n" +
      membershipSource +
      "\n" +
      membershipRepositorySource +
      "\n" +
      membershipEnforcementSource +
      "\n" +
      authorizationSource;

    expect(runtimeSource).not.toContain("enable row level security");
    expect(runtimeSource).not.toContain("create policy");
    expect(runtimeSource).not.toContain("auth.uid()");
    expect(runtimeSource).not.toContain("applyRls");
    expect(runtimeSource).not.toContain("rlsPolicy");
    expect(runtimeSource).not.toContain("service_role");
    expect(runtimeSource).not.toContain("SERVICE_ROLE");

    // Existing auth/route guard boundaries remain present, but RLS is not applied yet.
    expect(routeSource).toContain("authorizationMode?: ExportRouteAuthorizationMode");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");
    expect(membershipEnforcementSource).toContain("decideWorkspaceMembershipEnforcement");
  });

  test("rls draft keeps frontend storage signed urls and public artifact delivery blocked", async () => {
    const draftSource = readSource("docs/security/phase140-supabase-rls-policy-draft.sql");
    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    expect(draftSource).not.toContain("createSignedUrl");
    expect(draftSource).not.toContain("getPublicUrl");
    expect(draftSource).not.toContain("service_role");
    expect(draftSource).not.toContain("SERVICE_ROLE");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
  });
});
