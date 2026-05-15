# Known Issues

This file tracks current architecture debt and unstable behaviors that future work must not ignore.

## Stability Issues

### Hydration Runtime Sign-Off

Current state:

- explicit hydration state exists
- interaction is gated until restore completes
- queued scenes sanitize to `idle`
- generating scenes sanitize to `idle` unless valid browser-local resumable provider job metadata exists
- queue dedupe guards were added

Verification recorded:

- hydration/runtime browser sign-off passed
- H01-H10 Playwright matrix passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test:e2e` passed
- `npm run verify:phase36` passed

### LocalStorage Limitations

Current state:

- scenes and generated results persist in localStorage

Why it matters:

- large payloads may eventually pressure browser storage
- there is no persistence migration strategy beyond basic versioning

Target fix phase:

- later stabilization work after current foundation phases

### Selector Cache Assumptions

Current state:

- selector stability depends on immutable store updates

Why it matters:

- in-place mutation would break cached selector expectations

Target fix phase:

- ongoing discipline

## Platform Gaps

### Export Runtime Still Deferred

Current state:

- export/render job contracts exist in `src/types/exportJob.ts`
- export submit/poll/artifact service contracts exist in `src/services/exportService.ts`
- focused export service contract and edge tests exist in `tests/e2e/phase52-export-service.spec.ts`
- export agent orchestration scaffold exists in `src/agents/exportAgent.ts`
- focused export agent orchestration tests exist in `tests/e2e/phase53-export-agent.spec.ts`
- export store integration exists in `src/store/exportStore.ts`
- focused export store tests exist in `tests/e2e/phase54-export-store.spec.ts`
- export UI/status actions exist in `src/components/TimelineExportPanel.tsx`
- focused export UI tests exist in `tests/e2e/phase55-export-ui.spec.ts`
- actual video export is not implemented
- export runtime integration is not implemented
- auto-resume polling is not implemented for export jobs
- backend render queue is not implemented
- server workers are not implemented
- webhook completion is not implemented
- remote render cancellation is not implemented
- downloadable video output is not implemented
- real video rendering is not implemented
- durable export job persistence is not implemented
- artifact hosting/signed URLs are not implemented
- multi-device export resume coordination is not implemented
- auth/credits/billing are not implemented
- production queue/worker scaling is not implemented
- frontend-to-backend local development integration now exists (Phase 6.3-B), but production-grade export runtime integration remains incomplete
- renderer implementation is not started (Phase 6.5 decision recorded; implementation deferred)

Why it matters:

- Phase 5.2 currently adds service contracts and focused contract tests only, not runtime export capability
- frontend must remain truthful and must not fake completion/progress/artifacts/cancellation
- Phase 6.1 backend scaffold must avoid fake success/progress/artifacts/download claims
- initial backend job registry may be in-memory and local-only before durable persistence phases
- current requestId idempotency is process-local/in-memory only and is not durable across restarts
- local integration support must remain truthful: no fake progress, no fake terminal success, no fake artifacts, and no fake downloadable URLs
- real artifact records must only exist after real files are produced and verified
- export API responses must remain metadata-only (no raw blobs, no local filesystem paths)
- planned renderer lifecycle/worker contracts are documented, but workers/queues/webhooks/database/durable persistence are still deferred
- planned progress policy remains truthful-only (stage milestones only unless renderer can compute real percent)
- backend lifecycle state-machine guards now exist (Phase 6.6-B), but renderer execution and real artifact production are still deferred
- no real artifact URLs/download outputs exist; artifact hosting/signing remains deferred
- backend artifact metadata contract now exists (Phase 6.7-B), but it is structural-only and does not imply real artifact files
- worker-boundary claim ownership contract now exists (Phase 6.8-B), but no real worker runtime/queue/renderer execution exists yet
- Phase 6.9-A readiness audit confirms foundation readiness for Phase 7 planning, but renderer runtime and real artifact production remain deferred
- renderer input snapshot contract exists (Phase 7.0-B), but it is backend-internal contract validation only and does not imply renderer execution or file output
- temp/output path policy helper exists (Phase 7.1-B), but no file generation or directory creation runtime exists yet
- real file verification helper exists (Phase 7.2-B), but no renderer execution, production file generation pipeline, artifact hosting/signing, or download output exists yet
- renderer failure mapping helper exists (Phase 7.3-B), but it is mapping/sanitization only; no renderer runtime, lifecycle mutation, artifact output, or download capability exists yet
- single-process render harness exists (Phase 7.4-B), but it is injected-orchestration foundation only; no Remotion runtime, no route auto-execution, no queue/worker loop, and no download capability exist yet
- Remotion adapter contract stub exists from Phase 7.5-B as a historical boundary step; real runtime execution was intentionally deferred at that stage
- Remotion dependencies now exist from Phase 7.6-B as dependency onboarding only; real runtime execution remained deferred at that stage
- Remotion import smoke coverage now exists from Phase 7.7-B as import-only validation; real runtime execution remained deferred at that stage
- Remotion adapter mocked runtime call sequencing now exists from Phase 7.8-B; real runtime execution remained deferred at that stage
- Backend-only Remotion composition boundary scaffold exists from Phase 7.9-B; composition scaffold is present, but verified runtime output production is still deferred
- Remotion runtime helper boundary exists from Phase 8.0-B; default runtime execution remains intentionally non-executing/truthful until a later audited real-runtime phase
- `@remotion/bundler` dependency and runtime type boundary prep exist from Phase 8.1-B; real runtime bundle/selectComposition/renderMedia execution remains deferred
- route auto-execution remains deferred
- Phase 8.11-B safely stopped (app.ts lacked rendererAdapter/pathPolicy)
- Phase 8.12-B adds backend dependency composition module (`backend/composition/backendDependencies.ts`) — composes registry, rendererAdapter, pathPolicy but does NOT wire them into exports router yet
- Phase 8.13-B adds worker lifecycle app wiring (`backend/workers/renderWorkerLifecycle.ts`):
  - lifecycle created in app.ts using already-composed backendDeps
  - lifecycle.init() called during app creation but remains harmless when env flags disabled
  - lifecycle stored internally as `app.locals.renderWorkerLifecycle`
  - no public lifecycle/status route added
  - rendererAdapter/pathPolicy still NOT wired into exports router (execute route still returns 501)
- Phase 8.14-B adds truthful GET /exports/:jobId status mapping:
  - GET now maps actual registry status to public ExportPollResult types
  - GET no longer always returns kind: "pending"
  - terminal_success returns safe artifact metadata only (no local paths/URLs)
  - terminal_failure intentionally excludes failure.details (no leak risk)
  - POST /exports remains unchanged (already acts as enqueue boundary when worker flags enabled)
- verified output production remains deferred
- artifact hosting/signed URL/download capability remains deferred
- no public download URLs exist yet
- Phase 9-B adds artifact access contract types only (no hosting implementation):
  - BackendArtifactAccessKind with signed_url, backend_stream, local_dev_stream
  - BackendArtifactAccessDescriptor with safety comments
  - BackendArtifactAccessReadyResponse / BackendArtifactAccessUnavailableResponse
  - No storage provider implementation yet
  - No signed URL generation yet
  - No download UI yet
  - GET /exports/:jobId/artifacts still returns 501
- Phase 9-F adds artifact access provider interface boundary:
  - backend/artifacts/artifactAccessProvider.ts with ArtifactAccessProvider interface
  - ArtifactAccessRequest includes jobId, artifactId, optional artifact
  - getArtifactAccess returns Promise<BackendArtifactAccessResponse>
  - No provider implementation yet
  - No route wiring yet
  - Provider is lifecycle-neutral (does not mutate job state)
  - Provider is renderer-neutral (does not import renderer)
  - Provider is route-neutral (does not import routes)

Target fix phase:

- later backend/export phases

### No Durable Backend Queue

Current state:

- queue execution is in-memory and browser-bound

Why it matters:

- browser-local resume works only from persisted local state, not from a server-owned durable queue
- concurrency and status are local, not globally durable

Target fix phase:

- later backend/infrastructure work

### No Multi-Device Or Cross-Tab Resume Coordination

Current state:

- browser-local resume works only in the local persisted store for one browser context
- there is no shared lease, coordination, or ownership model across devices or browser contexts

Why it matters:

- multiple clients cannot safely coordinate one remote provider job
- resume guarantees stop at the local browser boundary

Target fix phase:

- later backend/infrastructure work

### No Server Workers Or Webhook Completion

Current state:

- provider polling is browser-driven
- there are no background workers, webhook consumers, or server-authoritative completion handlers

Why it matters:

- work only progresses while a browser runtime owns the polling loop
- the system cannot yet claim durable backend orchestration

Target fix phase:

- later backend/infrastructure work

### No Remote Provider Cancellation

Current state:

- local abort behavior exists only for the browser-owned polling flow
- remote provider cancellation is not implemented

Why it matters:

- canceling browser activity does not imply the upstream provider job is canceled

Target fix phase:

- later backend/infrastructure work

## Verification Gaps

- long-running provider telemetry is not implemented; the UI currently reports app lifecycle stages only

### Timeline Phase 4.5 Boundaries

Current state:

- timeline domain types exist in `src/types/timeline.ts`
- timeline store exists in `src/store/timelineStore.ts` with actions, selectors, and local persistence
- timeline UI shell and scene-source add-flow are implemented
- timeline sequencing/reorder is implemented through store-owned `moveClipUp` / `moveClipDown` and UI Move up/Move down buttons
- timeline manual playback simulation is implemented through store-owned playback actions/selectors and UI playback controls
- focused timeline UI coverage exists in `tests/e2e/phase43-timeline-ui.spec.ts`
- focused timeline store reorder coverage exists in `tests/e2e/phase42-timeline-store.spec.ts`
- drag/drop polish is not implemented yet
- automatic playback loop/timers are not implemented yet
- real media/video playback is not implemented yet
- video export/backend rendering are not implemented yet
- backend render queue is not implemented yet
- server workers for export orchestration are not implemented yet
- webhook completion for export jobs is not implemented yet
- remote render cancellation is not implemented yet
- downloadable video output is not implemented yet

Why it matters:

- Phase 4.5 establishes baseline manual playback simulation only; automatic playback loop/timers, real media playback, and playback/export runtime behavior remain deferred

Target fix phase:

- Phase 4.6 and later timeline/video phases
## Remotion runtime status (Phase 8.16-C accuracy)

- Backend composition boundary scaffold exists (Phase 7.9).
- Backend runtime helper boundary exists (Phase 8.0-B).
- Bundler dependency/type-boundary prep exists (Phase 8.1-B).
- Controlled opt-in real smoke exists (Phase 8.2-B) and is validated.
- Adapter real-runtime boundary alignment exists (Phase 8.3-B) and is validated.
- Harness-level real-runtime integration test milestone exists (Phase 8.4-B) and is validated.
- Internal backend execution trigger milestone exists (Phase 8.5-B) and is validated.
- Phase 8.11-B safely stopped (app.ts lacked rendererAdapter/pathPolicy).
- Backend dependency composition boundary exists (Phase 8.12-B).
  - `backend/composition/backendDependencies.ts` creates registry, rendererAdapter (no-op), pathPolicy.
  - Dependencies are composed but NOT wired into exports router yet.
  - Route behavior preserved: execute route returns 501 without dependencies.

### Still intentionally deferred

- Full real runtime execution for normal app/job flow.
- Verified output production wired into regular lifecycle success path.
- Route auto-execution (`POST /exports` remains non-executing for renderer runtime).
- Artifact hosting and public download delivery (signed/download URLs).
- Real user-media decoding in renderer path.
- Durable queue/worker/scheduler/database-backed renderer execution flow.
- Frontend export lifecycle integration with real backend completion.
- Synchronous HTTP route execution blocks request until render completes (no async queue/worker yet).
- Route trigger (`POST /exports/:jobId/execute`) is dev/test-gated only; not production-exposed.
- Timeout guard now exists (120000ms default via `FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS`) but does not cancel render — only protects HTTP response from hanging.
- Caller must poll job state after receiving 504 timeout response to get latest lifecycle status.
- No cancellation, no queue, no scheduler yet.
- Worker helper `drainRenderWorkerOnce` exists but requires manual invocation (not auto-started).
- Worker loop helper `createRenderWorkerLoop` exists and is test-controlled, but requires manual `start()` call.
- Worker startup factory `createRenderWorkerStartup` exists but is not wired to app/server startup.
- No production auto-start yet — worker loop and startup are dev/test-gated only.
- Worker lifecycle app wiring exists (Phase 8.13-B):
  - `createRenderWorkerLifecycle(...)` created in app.ts using composed backendDeps
  - `lifecycle.init()` called during app creation but remains harmless without env flags
  - lifecycle stored internally as `app.locals.renderWorkerLifecycle` (internal/test/dev only)
  - no public lifecycle route or status endpoint added
  - no server.ts shutdown wiring added
  - no process signal handlers added
- No route enqueue behavior yet.
- Backend dependency composition module exists (Phase 8.12-B) but dependencies are not wired into exports router yet.
- rendererAdapter and pathPolicy composed for lifecycle (Phase 8.13-B) but still NOT passed to createExportRouter — execute route returns 501 without them.
- process.cwd()-based pathPolicy roots are acceptable for dev/test but may need env override before production.
- Registry interface boundary exists (Phase 8.15-B):
  - `ExportJobRegistry` interface separated from `InMemoryExportJobRegistry` implementation
  - `backend/registry/exportJobRegistry.ts` owns interface/types
  - `backend/registry/inMemoryExportJobRegistry.ts` contains implementation
  - Future durable persistence adapters can implement `ExportJobRegistry` without changing consumers
  - No real persistence/storage added — jobs remain in-memory only
  - requestId idempotency remains process-local only
  - Claims/leases remain in-memory only with TTL support
  - Submitted/rendering/finalizing jobs do not survive server restart yet
  - No restart recovery semantics yet
  - No JSON/SQLite/Postgres/Redis adapter yet
- Graceful shutdown helper exists (Phase 8.16-B) with server.ts wiring (Phase 8.17-B):
  - `backend/lifecycle/gracefulShutdown.ts` provides testable shutdown coordinator
  - `createGracefulShutdown(...)` returns shutdown/isShuttingDown/getStatus controller
  - `backend/server.ts` exports `startServer(...)` with shutdown coordination
  - `startServer(...)` wires lifecycle shutdown and SIGINT/SIGTERM handlers
  - Helper calls lifecycle.shutdown() and server.close() when provided
  - Helper is idempotent and safe
  - No process.exit() calls added
  - No bounded in-flight render wait/cancellation yet
  - No durable recovery semantics yet
  - No persistence-backed shutdown recovery yet
  - Shutdown stops polling/server intake but does not recover jobs after restart
  - backend/server.ts no longer auto-starts when imported by tests
  - Only startServer(...) calls app.listen

### Recovery Policy Boundary (Phase 8.18-B)

Recovery policy boundary exists (Phase 8.18-B):
- `backend/registry/exportJobRecoveryPolicy.ts` provides restart recovery policy
- Exports: recoverExportJobRecord, recoverExportJobRecords, getRecoverableRecords, getTerminalRecords
- Recovery rules: submitted stays, rendering/finalizing → submitted, terminal stays
- Claims cleared for recovered non-terminal jobs
- attemptCount and identity fields preserved
- Clone-based (original records not mutated)
- No filesystem I/O, no registry mutations, no path leakage
- Recovery policy used by JSON persistence adapter for on-load recovery

### JSON File Persistence Adapter (Phase 8.19-B)

JSON file persistence adapter exists (Phase 8.19-B):
- `backend/registry/jsonFileExportJobRegistry.ts` implements ExportJobRegistry
- Env-gated: FREE_AI_MIXER_PERSISTENCE_ENABLED (disabled by default)
- Optional: FREE_AI_MIXER_PERSISTENCE_FILE_PATH
- Default file: .free-ai-mixer-jobs.json in process.cwd()
- Atomic writes: temp file + rename
- Uses Phase 8.18 recovery policy on load
- Sanitized failure/artifact persistence (no paths/URLs/details)
- .gitignore entries for persistence files

### Persistence Runtime Local Smoke (Phase 8.20-B)

Persistence runtime smoke test exists (Phase 8.20-B):
- tests/e2e/phase820-persistence-runtime-smoke.spec.ts verifies persistence through real HTTP flow
- Uses app.listen on ephemeral port + fetch against real routes
- Does not use Express app.request as HTTP client
- Verifies POST /exports writes persistence file
- Verifies recreated app can GET truthful pending status
- Verifies requestId idempotency survives restart
- Verifies no path/URL leakage in persisted JSON
- Worker and route execution remain disabled during smoke
- No production persistence runtime mode yet

### Production DB Adapter Strategy (Phase 8.21-A complete)

Production DB adapter strategy documented (Phase 8.21-A):
- ExportJobRegistry interface is correct DB adapter boundary
- Future DB adapter must implement ExportJobRegistry directly
- DB adapter must NOT delegate lifecycle to InMemoryExportJobRegistry
- DB adapter must implement lifecycle logic transactionally in DB
- JSON persistence stays dev/local only
- Recommended: PostgreSQL via PostgresExportJobRegistry
- Recommended future env: FREE_AI_MIXER_DB_PROVIDER, DATABASE_URL, etc.
- DB must use SELECT FOR UPDATE for claim() to prevent race conditions
- DB must use optimistic locking for status transitions
- DB must sanitize failure/artifact fields before INSERT
- Recovery on startup: SELECT jobs WHERE status IN (rendering, finalizing) AND claimExpiresAt < NOW()

Still deferred:
- JSON persistence is local/dev only
- No production DB adapter yet (Postgres, Redis, SQLite)
- No DB packages installed yet
- No schema migrations yet
- No multi-process locking yet
- No production persistence runtime mode yet
- No large-scale query/indexing support yet
- No artifact hosting/download persistence yet
- No cancellation yet
- Frontend manual refresh boundary exists (Phase 8.22-B); automatic polling loop not implemented yet
- No retry with backoff, no WebSocket/SSE real-time updates, no background refresh
- Persisted export handle storage boundary exists (Phase 8.23-B); manual reconnect action added (Phase 8.24-B); manual reconnect button added (Phase 8.25-B)
- No automatic reconnect on app load yet
- No automatic polling yet

### Safety reminder

- No fake success/progress/artifacts/cancellation behavior is allowed in renderer phases.
- No public/API-safe response should expose backend local filesystem paths.
- Adapter boundary alignment does not mean production rendering rollout is complete.
- Harness opt-in test coverage does not mean production renderer rollout is complete.
- Internal trigger availability does not mean route execution is enabled or production rollout is complete.
- Dev/test-gated route trigger (`POST /exports/:jobId/execute`) is now available behind `FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1` but still requires env flag and executor configuration; it is not production-ready auto-execution.
