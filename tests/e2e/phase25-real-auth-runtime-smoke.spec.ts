import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createApp } from "../../backend/app";

const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE";
const REQUIRED_ENV_KEYS = [
  "FREE_AI_MIXER_AUTH_RUNTIME_ENABLED",
  "FREE_AI_MIXER_AUTH_PROVIDER",
  "FREE_AI_MIXER_AUTH_ISSUER",
  "FREE_AI_MIXER_AUTH_AUDIENCE",
  "FREE_AI_MIXER_AUTH_JWKS_URI",
  "FREE_AI_MIXER_AUTH_JWT_KEY_MODE",
  "FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS",
  "FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED",
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "FREE_AI_MIXER_REAL_AUTH_SMOKE_EMAIL",
  "FREE_AI_MIXER_REAL_AUTH_SMOKE_PASSWORD",
] as const;

const SELECTED_PROTECTED_ROUTES = [
  "/project-library/projects",
  "/project-library/history",
  "/provider-settings/status",
  "/credits/status",
] as const;

const PUBLIC_ROUTES = [
  "/credits/policy",
  "/billing/plans",
  "/provider-settings/catalog",
  "/provider-settings/routing-policy",
] as const;

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase25-real-auth-runtime-smoke.spec.ts",
);
const runbookPath = path.join(
  process.cwd(),
  "docs",
  "real-auth-runtime-smoke-runbook.md",
);
const envExamplePath = path.join(process.cwd(), ".env.example");

const readSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const getMissingRequiredEnvKeys = (): string[] =>
  REQUIRED_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

const getRequiredEnvValue = (key: (typeof REQUIRED_ENV_KEYS)[number]): string => {
  const value = process.env[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required real auth smoke env var: ${key}`);
  }

  return value.trim();
};

const sanitizeSmokeErrorMessage = (error: unknown): string => {
  const sensitiveValues = REQUIRED_ENV_KEYS.map((key) => process.env[key])
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.trim().length > 0);
  const initial =
    error instanceof Error
      ? error.message
      : "Unknown real auth runtime smoke failure.";

  return sensitiveValues.reduce(
    (message, value) => message.replaceAll(value, "[redacted]"),
    initial,
  );
};

const parseJson = async <Payload>(response: Response): Promise<Payload> =>
  (await response.json()) as Payload;

const startBackendServer = async (): Promise<{
  baseUrl: string;
  server: Server;
}> => {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
};

const stopBackendServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const buildForbiddenMethodPattern = (methodName: string): string =>
  [".", methodName, "("].join("");

const buildForbiddenSecretLoggingPattern = (): string =>
  [
    "console",
    "log(process",
    "env",
    ["FREE", "AI", "MIXER", "SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
    ")",
  ].join(".");

const buildForbiddenConsolePattern = (methodName: string): string =>
  ["console", methodName].join(".");

test.describe("phase25 real auth runtime smoke", () => {
  test("source keeps real auth smoke opt-in, non-destructive, secret-safe, and docs-only outside the smoke", async () => {
    const [specSource, runbookSource, envExampleSource] =
      await Promise.all([
        readSource(specPath),
        readSource(runbookPath),
        readSource(envExamplePath),
      ]);
    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSignupCall = buildForbiddenMethodPattern("signUp");
    const forbiddenDeleteCall = buildForbiddenMethodPattern("delete");
    const forbiddenRemoveCall = buildForbiddenMethodPattern("remove");
    const forbiddenRpcCall = buildForbiddenMethodPattern("rpc");
    const forbiddenConsoleLog = buildForbiddenConsolePattern("log");
    const forbiddenConsoleError = buildForbiddenConsolePattern("error");

    expect(specSource).toContain(`const OPT_IN_ENV = "${OPT_IN_ENV}"`);
    expect(specSource).toContain("test.skip(");
    expect(specSource).toContain("persistSession: false");
    expect(specSource).toContain("signInWithPassword");
    expect(specSource).toContain("/account/bootstrap");
    expect(specSource).toContain("/auth/session");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSignupCall);
    expect(specSource).not.toContain(forbiddenDeleteCall);
    expect(specSource).not.toContain(forbiddenRemoveCall);
    expect(specSource).not.toContain(forbiddenRpcCall);
    expect(specSource).not.toContain(forbiddenConsoleLog);
    expect(specSource).not.toContain(forbiddenConsoleError);

    expect(runbookSource).toContain("disabled unless the explicit opt-in flag is set");
    expect(runbookSource).toContain("Do not add automatic cleanup");
    expect(runbookSource).toContain("Signup can create real Supabase users");
    expect(runbookSource).toContain("Never create any `VITE_*SERVICE_ROLE*` env var");

    expect(envExampleSource).toContain("FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE=0");
    expect(envExampleSource).toContain("FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY");
    expect(envExampleSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY=");
    expect(envExampleSource).not.toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=");
  });

  test("real Supabase account bootstrap and selected protected routes work only when explicitly enabled", async () => {
    test.skip(
      process.env[OPT_IN_ENV] !== "1",
      `Set ${OPT_IN_ENV}=1 to run the real auth runtime smoke test.`,
    );

    const missingEnvKeys = getMissingRequiredEnvKeys();
    expect(
      missingEnvKeys,
      `Real auth runtime smoke requires env vars: ${missingEnvKeys.join(", ")}`,
    ).toEqual([]);

    const supabase = createClient(
      getRequiredEnvValue("VITE_SUPABASE_URL"),
      getRequiredEnvValue("VITE_SUPABASE_ANON_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    let backendServer: Server | undefined;

    try {
      const signInResult = await supabase.auth.signInWithPassword({
        email: getRequiredEnvValue("FREE_AI_MIXER_REAL_AUTH_SMOKE_EMAIL"),
        password: getRequiredEnvValue("FREE_AI_MIXER_REAL_AUTH_SMOKE_PASSWORD"),
      });

      if (signInResult.error || !signInResult.data.session?.access_token) {
        throw new Error(
          signInResult.error?.message ??
            "Dedicated real auth smoke user did not return a session token.",
        );
      }

      const accessToken = signInResult.data.session.access_token;
      const { baseUrl, server } = await startBackendServer();
      backendServer = server;

      const bootstrapResponse = await fetch(`${baseUrl}/account/bootstrap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const bootstrapPayload = await parseJson<{ kind?: string; message?: string }>(
        bootstrapResponse,
      );

      if (bootstrapResponse.status === 409) {
        throw new Error(
          "Real auth smoke reached workspace selection required. Keep exactly one active membership for the dedicated smoke user until active workspace selection is implemented.",
        );
      }

      if (
        bootstrapResponse.status === 403 &&
        bootstrapPayload.kind === "email_verification_required"
      ) {
        throw new Error(
          "Dedicated real auth smoke user must be email-verified before account bootstrap can continue.",
        );
      }

      expect(bootstrapResponse.status).toBe(200);
      expect(bootstrapPayload).toMatchObject({
        kind: "account_bootstrap_complete",
      });

      const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const sessionPayload = await parseJson<{ kind?: string; status?: string }>(
        sessionResponse,
      );

      expect(sessionResponse.status).toBe(200);
      expect(sessionPayload).toMatchObject({
        kind: "authenticated_session",
        status: "authenticated",
      });

      for (const routePath of SELECTED_PROTECTED_ROUTES) {
        const protectedResponse = await fetch(`${baseUrl}${routePath}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        expect(protectedResponse.status, `${routePath} should allow bearer access`).toBe(
          200,
        );
      }

      for (const routePath of PUBLIC_ROUTES) {
        const publicResponse = await fetch(`${baseUrl}${routePath}`, {
          method: "GET",
        });

        expect(publicResponse.status, `${routePath} should remain public`).toBe(200);
      }
    } catch (error) {
      throw new Error(`Real auth runtime smoke failed: ${sanitizeSmokeErrorMessage(error)}`);
    } finally {
      if (backendServer) {
        await stopBackendServer(backendServer);
      }

      await supabase.auth.signOut();
    }
  });
});
