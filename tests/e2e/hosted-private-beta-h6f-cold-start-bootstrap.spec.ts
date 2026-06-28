import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BackendRequestAbortedError,
  BOOTSTRAP_READ_ATTEMPT_TIMEOUT_MS,
  BOOTSTRAP_READ_MAX_ATTEMPTS,
  BOOTSTRAP_READ_MAX_EXPECTED_MS,
  BOOTSTRAP_READ_RETRY_DELAY_MS,
  createBackendRequestPolicy,
} from "../../src/services/backendRequestPolicy";

const readSource = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const immediateTimeout = ((handler: TimerHandler) => {
  if (typeof handler === "function") {
    handler();
  }
  return 0;
}) as typeof globalThis.setTimeout;

test.describe("H6-F hosted cold-start bootstrap", () => {
  test("keeps retry timing centralized and bounded", () => {
    expect(BOOTSTRAP_READ_ATTEMPT_TIMEOUT_MS).toBe(35_000);
    expect(BOOTSTRAP_READ_MAX_ATTEMPTS).toBe(2);
    expect(BOOTSTRAP_READ_RETRY_DELAY_MS).toBe(500);
    expect(BOOTSTRAP_READ_MAX_EXPECTED_MS).toBe(70_500);
  });

  test("policy timeout receives exactly one retry using injected timing", async () => {
    let attempts = 0;
    const request = createBackendRequestPolicy({
      fetch: async (_input, init) => {
        attempts += 1;
        if (init?.signal?.aborted) {
          throw new DOMException("aborted", "AbortError");
        }
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      },
      setTimeout: immediateTimeout,
      clearTimeout: () => undefined,
      sleep: async () => undefined,
    });

    await expect(
      request("/auth/session", { method: "GET" }, { mode: "bootstrap_read_once" }),
    ).rejects.toMatchObject({
      code: "backend_wake_timeout",
    });
    expect(attempts).toBe(2);
  });

  test("502, 503, and 504 receive exactly one retry", async () => {
    for (const status of [502, 503, 504]) {
      let attempts = 0;
      const request = createBackendRequestPolicy({
        fetch: async () => {
          attempts += 1;
          return new Response(null, { status });
        },
        sleep: async () => undefined,
      });

      const response = await request(
        "/project-library/projects",
        { method: "GET" },
        { mode: "bootstrap_read_once" },
      );
      expect(response.status).toBe(status);
      expect(attempts).toBe(2);
    }
  });

  test("network failure receives exactly one retry and a safe terminal error", async () => {
    let attempts = 0;
    const request = createBackendRequestPolicy({
      fetch: async () => {
        attempts += 1;
        throw new Error("test-only transport failure");
      },
      sleep: async () => undefined,
    });

    await expect(
      request(
        "/auth/session",
        { method: "GET" },
        { mode: "bootstrap_read_once" },
      ),
    ).rejects.toMatchObject({ code: "backend_temporarily_unavailable" });
    expect(attempts).toBe(2);
  });

  test("400, 401, 403, and 404 receive no retry", async () => {
    for (const status of [400, 401, 403, 404]) {
      let attempts = 0;
      const request = createBackendRequestPolicy({
        fetch: async () => {
          attempts += 1;
          return new Response(null, { status });
        },
      });

      const response = await request(
        "/auth/session",
        { method: "GET" },
        { mode: "bootstrap_read_once" },
      );
      expect(response.status).toBe(status);
      expect(attempts).toBe(1);
    }
  });

  test("POST, PUT, PATCH, and DELETE never retry even when opt-in is requested", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      let attempts = 0;
      const request = createBackendRequestPolicy({
        fetch: async () => {
          attempts += 1;
          return new Response(null, { status: 503 });
        },
      });

      await request("/mutation", { method }, { mode: "bootstrap_read_once" });
      expect(attempts).toBe(1);
    }
  });

  test("superseded abort receives no retry", async () => {
    let attempts = 0;
    const controller = new AbortController();
    controller.abort();
    const request = createBackendRequestPolicy({
      fetch: async () => {
        attempts += 1;
        return new Response(null, { status: 200 });
      },
    });

    await expect(
      request(
        "/auth/session",
        { method: "GET" },
        { mode: "bootstrap_read_once", signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(BackendRequestAbortedError);
    expect(attempts).toBe(0);
  });

  test("auth verification is revisioned, single-flight, and stale-safe", () => {
    const store = readSource("src/store/authStore.ts");
    const service = readSource("src/services/authService.ts");

    expect(store).toContain("verificationFlight?.revision === revision");
    expect(store).toContain("beginAuthRevision(toTokenKey(accessToken))");
    expect(store).toContain("if (!isCurrentRevision(revision))");
    expect(store).toContain("invalidateAuthSessionRequests()");
    expect(store).toContain("identity: state.identity");
    expect(service).toContain("authSessionFlight?.key === key");
    expect(service).toContain("authSessionFlight?.controller.abort()");
    expect(service).toContain("response.status === 401");
    expect(service).toContain("response.status === 403");
  });

  test("logout invalidates verification and clears runtime project authority", () => {
    const store = readSource("src/store/authStore.ts");

    expect(store).toContain('beginAuthRevision("logged_out", true)');
    expect(store).toContain("invalidateProjectLibraryRequests()");
    expect(store).toContain("clearRuntimeProjectContext()");
    expect(store).toMatch(/status:\s*"unknown"[\s\S]*identity:\s*undefined/);
  });

  test("account bootstrap POST is single-flight, non-retried, and gates second verification", () => {
    const authService = readSource("src/services/authService.ts");
    const bridge = readSource("src/services/auth/supabaseAuthSessionBridge.ts");

    expect(authService).toContain("accountBootstrapFlights.get(accessToken)");
    expect(authService).toContain('method: "POST"');
    expect(authService).not.toMatch(
      /accountBootstrapEndpoint[\s\S]{0,500}bootstrap_read_once/,
    );
    expect(bridge).toMatch(
      /const repaired = await runSingleWorkspaceRepair[\s\S]*if \(repaired\) \{[\s\S]*await refreshBackendSession/,
    );
  });

  test("project GET opts in while active-project PUT remains keyed and non-retried", () => {
    const service = readSource("src/services/projectLibraryService.ts");

    expect(service).toMatch(
      /projectLibraryEndpoint[\s\S]{0,500}method: "GET"[\s\S]{0,500}mode: "bootstrap_read_once"/,
    );
    expect(service).toContain("projectLibraryFlight?.revision === projectRequestRevision");
    expect(service).toContain("`${projectRequestRevision}:${projectId}`");
    expect(service).toContain('method: "PUT"');
    expect(service).not.toMatch(
      /requestActiveProjectMutation[\s\S]{0,900}bootstrap_read_once/,
    );
  });

  test("Projects and Mixer coalesce focus and visibility reconciliation", () => {
    for (const path of ["src/pages/ProjectsPage.tsx", "src/pages/MixerPage.tsx"]) {
      const source = readSource(path);
      expect(source).toContain("reconciliationPending");
      expect(source).toContain("reconciliationTrailing");
      expect(source).toContain("queueMicrotask(() =>");
      expect(source).toMatch(
        /const reconcile = \(\) => \{\s*if \(disposed\) \{\s*return;/,
      );
      expect(source).toMatch(
        /queueMicrotask\(\(\) => \{\s*if \(!disposed\) \{\s*reconcile\(\);/,
      );
      expect(source).toMatch(
        /\.finally\(\(\) => \{\s*if \(disposed\) \{\s*return;/,
      );
      expect(source).toMatch(
        /disposed = true;\s*reconciliationPending\.current = false;\s*reconciliationTrailing\.current = false;/,
      );
      expect(source).toMatch(
        /const pendingAction = useProjectLibraryStore\.getState\(\)\.pendingAction;\s*if \(pendingAction !== null && pendingAction !== "refresh"\) \{\s*return;/,
      );
      expect(source).toContain('window.addEventListener("focus", reconcile)');
      expect(source).toContain(
        'document.addEventListener("visibilitychange", reconcile)',
      );
    }
  });

  test("temporary project failure preserves URL and authenticated absence may clear it", () => {
    const projects = readSource("src/pages/ProjectsPage.tsx");
    const mixer = readSource("src/pages/MixerPage.tsx");

    expect(projects).toMatch(
      /const listResolved =[\s\S]*if \(!listResolved\) \{[\s\S]*return;/,
    );
    expect(projects).toMatch(
      /if \([\s\S]*currentUrl\.invalid[\s\S]*updateProjectsProjectIdUrl\(\)/,
    );
    expect(mixer).toMatch(
      /if \(listResolved\)[\s\S]*if \(requestedProjectId\) \{[\s\S]*removeMixerProjectIdFromUrl\(\)/,
    );
  });

  test("Mixer generation remains disabled until verified project restoration is ready", () => {
    const source = readSource("src/pages/MixerPage.tsx");

    expect(source).toMatch(
      /projectContextStatus === "ready" && bootstrapPhase === "ready"\s*\? activeProject\s*:\s*undefined/,
    );
    expect(source).toContain(
      "<PromptImageGenerator project={verifiedActiveProject} />",
    );
    expect(source).toContain('setProjectContextStatus("unavailable")');
  });

  test("protected shell consumes store state without launching a credentialless request", () => {
    const source = readSource("src/components/ProtectedRouteShell.tsx");
    const allowedPhases = source.match(
      /const protectedContentAllowedPhases = new Set\(\[([\s\S]*?)\]\);/,
    )?.[1];

    expect(source).toContain("bootstrapPhase");
    expect(allowedPhases).toContain('"restoring_project"');
    expect(allowedPhases).toContain('"ready"');
    expect(allowedPhases).toContain('"temporarily_unavailable"');
    expect(allowedPhases).not.toContain('"starting"');
    expect(allowedPhases).not.toContain('"verifying_session"');
    expect(allowedPhases).not.toContain('"backend_waking"');
    expect(allowedPhases).not.toContain('"sign_in_required"');
    expect(allowedPhases).not.toContain('"workspace_forbidden"');
    expect(source).toMatch(
      /authStatus === "authenticated" &&\s*protectedContentAllowedPhases\.has\(bootstrapPhase\)/,
    );
    expect(source).not.toContain("refreshSession");
    expect(source).not.toContain("useEffect");
  });

  test("Supabase INITIAL_SESSION does not repeat the completed initial bridge lookup", () => {
    const source = readSource(
      "src/services/auth/supabaseAuthSessionBridge.ts",
    );

    expect(source).toContain("let initialSessionProcessed = false");
    expect(source).toContain("initialSessionProcessed = true");
    expect(source).toMatch(
      /if \(event === "INITIAL_SESSION" && initialSessionProcessed\) \{\s*return;/,
    );
  });

  test("project retries do not claim the auth-owned backend_waking phase", () => {
    for (const path of ["src/pages/ProjectsPage.tsx", "src/pages/MixerPage.tsx"]) {
      const source = readSource(path);
      expect(source).not.toContain("state.markBackendWaking");
      expect(source).not.toContain("onRetry: markBackendWaking");
    }
  });

  test("project reconciliation silently discards superseded aborts", () => {
    for (const path of ["src/pages/ProjectsPage.tsx", "src/pages/MixerPage.tsx"]) {
      const source = readSource(path);
      expect(source).toContain(
        'import { BackendRequestAbortedError } from "../services/backendRequestPolicy"',
      );
      expect(source).toMatch(
        /\.catch\(\(error: unknown\) => \{\s*if \(disposed \|\| error instanceof BackendRequestAbortedError\) \{\s*return;/,
      );
      expect(source).toContain(
        'failProjectRestoration("temporarily_unavailable")',
      );
    }
  });

  test("stale project failure cannot overwrite non-authenticated auth state", () => {
    const source = readSource("src/store/authStore.ts");

    expect(source).toMatch(
      /failProjectRestoration: \(phase\) => \{\s*set\(\(state\) =>\s*state\.status === "authenticated" &&\s*state\.pendingAction === null &&\s*\(state\.bootstrapPhase === "restoring_project" \|\|\s*state\.bootstrapPhase === "backend_waking"\)/,
    );
    expect(source).toMatch(/:\s*state,\s*\);/);
  });

  test("project phase callbacks cannot replace active auth or mutation phases", () => {
    const source = readSource("src/store/authStore.ts");

    expect(source).toMatch(
      /beginProjectRestoration: \(\) => \{[\s\S]*?state\.status === "authenticated" &&\s*state\.pendingAction === null &&\s*\(state\.bootstrapPhase === "restoring_project" \|\|\s*state\.bootstrapPhase === "ready" \|\|\s*state\.bootstrapPhase === "temporarily_unavailable"\)/,
    );
    expect(source).toMatch(
      /markBackendWaking: \(\) => \{[\s\S]*?state\.status === "authenticated" &&\s*state\.pendingAction === null &&\s*\(state\.bootstrapPhase === "restoring_project" \|\|\s*state\.bootstrapPhase === "backend_waking"\)/,
    );
    expect(source).toMatch(
      /completeProjectRestoration: \(\) => \{[\s\S]*?state\.status === "authenticated" &&\s*state\.pendingAction === null &&\s*\(state\.bootstrapPhase === "restoring_project" \|\|\s*state\.bootstrapPhase === "backend_waking"\)/,
    );
  });

  test("account bootstrap remains blocked until authoritative re-verification", () => {
    const source = readSource("src/store/authStore.ts");
    const bootstrapBlockingUpdates =
      source.match(
        /pendingAction: "bootstrap",\s*bootstrapPhase: "verifying_session",\s*bootstrapMessage: "Completing secure account setup\.",\s*bootstrapDiagnosticCode: undefined/g,
      ) ?? [];
 const retryStart = source.indexOf("retryAccountBootstrap: async () => {");
const retryEnd = source.indexOf(
  "markBackendWaking: () => {",
  retryStart,
);

expect(retryStart).toBeGreaterThanOrEqual(0);
expect(retryEnd).toBeGreaterThan(retryStart);

const retrySegment = source.slice(retryStart, retryEnd);
    const bridgeBootstrapSegment = source.slice(
      source.indexOf("bootstrapBackendAccount: async"),
      source.indexOf("setRecoveryState:", source.indexOf("bootstrapBackendAccount: async")),
    );

    expect(bootstrapBlockingUpdates).toHaveLength(2);
    expect(retrySegment).toContain("await bootstrapAccount(accessToken)");
    expect(retrySegment).toContain("await useAuthStore.getState().refreshSession(accessToken)");
    expect(retrySegment).not.toContain('bootstrapPhase: "ready"');
    expect(bridgeBootstrapSegment).not.toContain('bootstrapPhase: "ready"');
    expect(bridgeBootstrapSegment).not.toContain('bootstrapPhase: "restoring_project"');
  });

  test("Mixer keeps every non-ready bootstrap phase outside generation context", () => {
    const source = readSource("src/pages/MixerPage.tsx");

    expect(source).toContain(
      "const bootstrapPhase = useAuthStore((state) => state.bootstrapPhase)",
    );
    expect(source).toContain(
      "<PromptImageGenerator project={verifiedActiveProject} />",
    );
    expect(source).toContain("<PromptImageHistory project={verifiedActiveProject} />");
    expect(source).toContain(
      'const authStatus = useAuthStore((state) => state.status)',
    );
    expect(source).toMatch(
      /const projectBootstrapAllowed =\s*authStatus === "authenticated" &&/,
    );
    expect(source).toMatch(
      /const reconcile = \(\) => \{[\s\S]*?if \(!projectBootstrapAllowed\) \{\s*return;/,
    );
  });

  test("diagnostics remain coarse and browser storage or direct data access is not added", () => {
    const files = [
      "src/services/backendRequestPolicy.ts",
      "src/services/authService.ts",
      "src/store/authStore.ts",
      "src/services/projectLibraryService.ts",
      "src/store/projectLibraryStore.ts",
      "src/pages/ProjectsPage.tsx",
      "src/pages/MixerPage.tsx",
    ];
    const source = files.map(readSource).join("\n");

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("supabase.storage.from(");
    expect(source).not.toMatch(/supabase\s*\.\s*from\s*\(/);
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("response.statusText");
    expect(source).not.toContain("raw backend");
  });
});
