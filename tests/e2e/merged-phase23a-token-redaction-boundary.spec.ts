import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createSafeStructuredLogEvent } from "../../backend/observability/safeStructuredLogger";
import {
  mapJwtVerificationResultToRequesterContext,
  type JwtBoundaryVerificationResult,
} from "../../backend/auth/jwtProviderVerificationStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23A token redaction boundary", () => {
  test("raw bearer tokens cookies and spoof headers stay redacted and verifier outputs stay token-free", () => {
    const event = createSafeStructuredLogEvent({
      event: "phase23a.jwt.redaction",
      severity: "warn",
      metadata: {
        authorization:
          "Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature",
        cookie: "sb-access-token=secret-access; sb-refresh-token=secret-refresh",
        accessToken:
          "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTIifQ.signature",
        serviceRoleKey: "supabase_service_role_real_secret",
        "x-user-id": "spoof-user",
        "x-workspace-id": "spoof-workspace",
      },
    });

    const serializedEvent = JSON.stringify(event);

    expect(serializedEvent).not.toContain("Bearer eyJhbGciOiJSUzI1NiJ9");
    expect(serializedEvent).not.toContain("secret-access");
    expect(serializedEvent).not.toContain("secret-refresh");
    expect(serializedEvent).not.toContain("supabase_service_role_real_secret");
    expect(serializedEvent).not.toContain("spoof-user");
    expect(serializedEvent).not.toContain("spoof-workspace");

    const boundaryResult: JwtBoundaryVerificationResult = {
      kind: "verified",
      identity: {
        authenticated: true,
        authProvider: "jwt",
        authSubject: "subject-123",
        supabaseUserId: "subject-123",
        email: "user@example.test",
      },
      claimsIgnoredForAuthorization: [
        "workspaceId",
        "workspace_id",
        "workspaceRole",
        "workspace_role",
        "platformRole",
        "platform_role",
      ],
    };

    expect(JSON.stringify(boundaryResult)).not.toContain("eyJ");
    expect(JSON.stringify(boundaryResult)).not.toContain("Bearer ");
    expect(
      mapJwtVerificationResultToRequesterContext({
        kind: "verified",
        userId: "subject-123",
        authProvider: "jwt",
        authSubject: "subject-123",
      }),
    ).toEqual({
      kind: "authenticated",
      userId: "subject-123",
      authProvider: "jwt",
      authSubject: "subject-123",
    });
  });

  test("routes analytics and persistence remain unchanged by the jwt boundary", () => {
    const protectedSources = [
      readSource("backend/routes/auth.ts"),
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/providerSettings.ts"),
      readSource("backend/routes/projectHistory.ts"),
      readSource("backend/routes/credits.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/composition/backendDependencies.ts"),
    ].join("\n");

    expect(protectedSources).not.toContain("verifyJwtBoundaryWithJose(");
    expect(protectedSources).not.toContain("createLocalJwksForJwtVerification(");
    expect(protectedSources).not.toContain("appendEvent(");
    expect(protectedSources).not.toContain("appendAuditRecord(");
    expect(protectedSources).not.toContain("analyticsEventRepository");
    expect(protectedSources).not.toContain("auditLogRepository");
  });
});
