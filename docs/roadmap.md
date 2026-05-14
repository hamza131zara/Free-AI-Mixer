# Roadmap

This file is the concise delivery roadmap for Free AI Mixer. Detailed technical truth lives in [PROJECT_BIBLE.md](../PROJECT_BIBLE.md). Canonical phase numbering lives in [docs/phases.md](./phases.md).

## Current Direction

The platform is being built in this order:

1. establish product direction and production intent
2. preserve UI experimentation history without letting it drive architecture
3. stabilize the real logic layer
4. expand into timeline and video systems
5. expand into agent systems
6. expand into backend and infrastructure
7. optimize for production scale and reliability

## Roadmap Sequence

### Phase 1: Vision & Product Direction

- AI scene generation platform
- multi-provider orchestration
- real generation lifecycle
- production-oriented architecture

Status:

- established

### Phase 2: UI Exploration

- antigravity experiments
- Stitches design iterations
- scene queue interface
- generation cards
- provider visibility

Status:

- historical exploration phase

### Phase 3: Real Logic Layer

- Phase 3.0 UI System
- Phase 3.1 Zustand Global Store / Scene Lifecycle
- Phase 3.2 Global Store Stabilization
- Phase 3.3 Error Normalization / Async Pipeline
- Phase 3.4 Queue + Providers
- Phase 3.5 Lifecycle Engine
- Phase 3.6 Hydration & State Stability
- Phase 3.7 Transport Truthfulness & Provider Realism
- Phase 3.8 Long-running Provider Patterns

Status:

- complete through Phase 3.8

### Phase 4: Timeline & Video System

- sequence structures
- timeline orchestration
- scene ordering and video-oriented systems

Status:

- started (Phase 4.1 timeline domain types complete; Phase 4.2 timeline store complete; Phase 4.3 timeline UI complete; Phase 4.4 sequencing/reorder complete; Phase 4.5 playback simulation complete; Phase 4.6 video/export orchestration planning complete; export implementation deferred)

### Phase 5: Agent System

- AI director agents
- scene memory
- collaborative and workflow agents

Status:

- in progress (Phase 5.1 export/render job domain types complete; Phase 5.2 export service contracts complete; Phase 5.3 export agent scaffold complete; Phase 5.4 export store integration complete; Phase 5.5 export UI/status actions complete; Phase 5.6 export resume/hardening complete; runtime export still deferred)

### Phase 6: Backend & Infrastructure

- durable backend queue
- infrastructure services
- cloud execution paths

Status:

- started (Phase 6.0-A backend/export planning audit complete; Phase 6.0-B docs/architecture sync complete; Phase 6.1-A/B/C backend scaffold and contract tests complete; Phase 6.2-A/B registry idempotency/lifecycle complete; Phase 6.3-A/B local frontend/backend integration support complete; Phase 6.5-A renderer architecture decision audit complete)

Recommended Phase 6 path:

- backend contract scaffold first
- truthful local job registry next
- frontend endpoint/config integration next
- contract/integration testing next
- renderer architecture decision after contract stability
- do not claim real video rendering or downloadable export output yet

Phase 6.3 integration note:

- local Vite proxy support is in place for `/exports -> http://127.0.0.1:8787`
- export service defaults align to backend scaffold `/exports` route family
- runtime config precedence and `VITE_EXPORT_*` fallback behavior remain preserved
- focused local integration test coverage exists in `tests/e2e/phase63-frontend-backend-integration.spec.ts`
- this does not imply renderer availability, artifact URLs, progress telemetry, cancellation authority, or downloadable output

Phase 6.5 renderer decision note:

- recommended future direction is a Remotion-first backend renderer pilot
- no renderer implementation exists yet
- no real video rendering or downloadable output exists yet
- artifact hosting/signed URLs are still deferred
- renderer rollout requires worker/queue boundaries first
- planned prerequisite lifecycle is `submitted -> rendering -> finalizing -> success | error | expired` (`queued` deferred)
- planned worker boundary is claim/render/finalize/success-or-error with backend-authoritative transitions
- metadata-only artifact API contract remains required (no raw blobs, no local paths)
- progress remains stage-only unless truthful renderer percent becomes available
- next phase was Phase 6.6-A backend lifecycle state machine audit only

Phase 6.6 lifecycle state machine note:

- Phase 6.6-A audit is complete
- Phase 6.6-B backend lifecycle state machine implementation + focused tests is complete
- backend lifecycle transition guards now exist in registry/contracts while route behavior remains contract-compatible
- frontend remains unchanged
- no renderer/worker/queue runtime, artifact hosting, or downloadable output was introduced
- next phase was Phase 6.6-D backend lifecycle state machine final sign-off

Phase 6.7 artifact metadata note:

- Phase 6.7-A audit is complete
- Phase 6.7-B artifact metadata contract implementation + focused tests is complete
- artifact metadata contract is backend-only and structural-only in this phase
- no real artifact files, hosting/signing URLs, or downloadable outputs exist yet
- routes remain truthful and keep artifacts unavailable unless real artifacts exist
- next phase was Phase 6.7-D artifact metadata contract final sign-off

Phase 6.8 worker boundary claim note:

- Phase 6.8-A audit is complete
- Phase 6.8-B worker boundary claim contract implementation + focused tests is complete
- worker boundary claim ownership exists in backend registry only (process-local/in-memory)
- no route mutation surface was added, and frontend remains unchanged
- this is not worker runtime, queue runtime, or renderer execution
- next phase was Phase 6.8-D worker boundary claim contract final sign-off

Phase 6.9 renderer-readiness note:

- Phase 6.9-A backend renderer-readiness audit is complete
- backend/export foundation is ready to move into Phase 7.0-A Remotion renderer pilot audit planning
- remaining implementation prerequisites are:
  - renderer input snapshot contract
  - media input reference normalization
  - temp/output directory policy
  - real file existence verification
  - artifact retention/cleanup policy
  - Remotion runtime/dependency execution wrapper
  - renderer failure mapping
  - single-process worker execution harness
- next phase is Phase 6.9-C final Phase 6 manual sign-off, then Phase 7.0-A audit-only planning

Phase 7.0 renderer snapshot note:

- Phase 7.0-A audit is complete
- Phase 7.0-B renderer input snapshot contract implementation + focused tests is complete
- backend-only snapshot contract now exists with strict structural validation and immutable snapshot creation
- no Remotion install, no renderer execution, no file generation, and no download output were introduced
- next phase was Phase 7.0-D renderer input snapshot contract final sign-off

Phase 7.1 temp/output path policy note:

- Phase 7.1-A audit is complete
- Phase 7.1-B temp/output path policy helper implementation + focused tests is complete
- output path policy is backend-internal only with safe root-key derivation and traversal/injection rejection
- no file/directory creation, no artifact creation, no URL/download output, and no lifecycle mutation were introduced
- next phase is Phase 7.1-D temp/output path policy final sign-off

Phase 7.2 real file verification note:

- Phase 7.2-A audit is complete
- Phase 7.2-B real file verification helper implementation + focused tests is complete
- verification helper is backend-internal and read-only, and validates existence, regular-file target, non-empty size, and expected format
- verified metadata includes only safe artifact metadata fields and excludes local path/URL/download fields
- tests may use test-only temp files/directories and must clean up; production helper does not create/write/delete files
- this phase does not add Remotion install, renderer execution, production file output, artifact hosting, signed URLs, or download URLs
- next phase is Phase 7.2-D real file verification final sign-off, then Phase 7.3-A renderer failure mapping audit only

Phase 7.3 renderer failure mapping note:

- Phase 7.3-A audit is complete
- Phase 7.3-B renderer failure mapping helper implementation + focused tests is complete
- mapper is backend-internal only and normalizes raw renderer/runtime failures to safe structured failures
- artifact verification failure codes are preserved, timeout and abort are distinguished, and retryability policy is explicit
- public-safe sanitization strips stack/path/url/env/command/secret-like fields
- no renderer execution, file generation, artifact hosting, signed URLs, download URLs, lifecycle mutation, or frontend changes were introduced
- next phase is Phase 7.3-D renderer failure mapping final sign-off, then Phase 7.4-A single-process renderer execution harness audit only

Phase 7.4 single-process execution harness note:

- Phase 7.4-A audit is complete
- Phase 7.4-B harness contract + injected orchestrator helper + focused tests is complete
- harness remains backend-only and adapter-injected (no real renderer runtime)
- no route auto-execution from `POST /exports` was introduced
- no queue/scheduler/worker loop/database/durable persistence was introduced
- no hosting/signing/download URL behavior was introduced
- no fake artifacts/progress/cancellation behavior was introduced
- frontend behavior remains unchanged
- next phase is Phase 7.4-D single-process renderer execution harness final sign-off, then Phase 7.5-A Remotion dependency / renderer adapter audit only

Phase 7.5 Remotion adapter stub note:

- Phase 7.5-A audit is complete
- Phase 7.5-B Remotion adapter contract stub + focused tests is complete
- adapter stub is backend-only, harness-compatible, and explicit non-success (`ok: false`) while Remotion runtime remains unimplemented
- stub import is safe without Remotion installed
- no Remotion install/import, no `@remotion/renderer`, and no composition files were introduced
- no route auto-execution, queue/scheduler/worker loop, database/durable persistence, hosting/signing/download URLs, or frontend changes were introduced
- next phase is Phase 7.5-D Remotion adapter contract stub final sign-off, then Phase 7.6-A Remotion dependency install audit only

Phase 7.6 Remotion dependency install note:

- Phase 7.6-A audit is complete
- Phase 7.6-B dependency install only is complete
- dependencies added:
  - `remotion`
  - `@remotion/renderer`
- no Remotion imports, renderer runtime, adapter runtime implementation, composition files, route auto-execution, or frontend changes were introduced
- Phase 7.5 adapter expectations remain truthful:
  - dependencies may now exist
  - adapter stub still returns not-implemented failure
  - adapter stub still must not import Remotion runtime directly
- validation recorded: typecheck/build/focused backend checks passed, with clean git status after commit
- next phase is Phase 7.6-D Remotion dependency install final sign-off, then Phase 7.7-A Remotion import smoke test audit only

Phase 7.7 Remotion import smoke note:

- Phase 7.7-A audit is complete
- Phase 7.7-B import smoke test only is complete
- smoke scope is import-only:
  - dynamic import of `remotion`
  - dynamic import of `@remotion/renderer`
- smoke scope intentionally excludes runtime API execution and renderer output generation
- correction recorded:
  - this phase should not require asserting specific runtime exports (for example `bundle`)
  - runtime rendering API verification remains deferred
- adapter stub remains truthful and not implemented (`ok: false`)
- no composition files, route auto-execution, artifact metadata outputs, url/download/signed/public-url outputs, or frontend changes were introduced
- next phase is Phase 7.7-D Remotion import smoke test final sign-off, then Phase 7.8-A Remotion adapter implementation audit only

Phase 7.8 Remotion adapter mocked-runtime note:

- Phase 7.8-A audit is complete
- Phase 7.8-B adapter implementation with mocked renderer calls is complete
- adapter remains backend-only and harness-compatible
- optional mocked runtime injection is supported with explicit call sequencing:
  - `bundle`
  - `selectComposition`
  - `renderMedia`
- mocked success is adapter-call success only (not verified artifact success)
- no real renderer runtime execution, no composition files, and no route auto-execution were introduced
- no lifecycle mutation, no artifact metadata creation, no url/download/signed/public-url outputs, and no frontend changes were introduced
- failure diagnostics are sanitized with no stack/path/url/env/secret leakage
- next phase is Phase 7.8-D Remotion adapter implementation final sign-off, then Phase 7.9-A Remotion composition boundary audit only

Phase 7.9 Remotion composition boundary scaffold note:

- Phase 7.9-A audit is complete
- Phase 7.9-B composition boundary scaffold only is complete
- backend-only composition scaffold now exists under `backend/renderer/compositions/`
- scaffold accepts only snapshot-derived serializable props and renders deterministic placeholder timeline structures
- no renderer runtime API calls, no file/artifact output creation, no route auto-execution, and no frontend changes were introduced
- boundary checks ensure no imports from frontend store/service/agent layers or backend route/registry layers
- next phase is Phase 7.9-D Remotion composition boundary final sign-off, then Phase 8.0-A real renderer runtime execution audit only

Phase 8.0 runtime helper boundary note:

- Phase 8.0-A audit is complete
- Phase 8.0-B runtime helper boundary + adapter delegation is complete
- runtime helper boundary now exists in `backend/renderer/remotionRuntime.ts`
- adapter delegates runtime sequencing through backend runtime helper/injected runtime boundary
- this phase remains mocked-call only:
  - no real renderer runtime execution
  - no route auto-execution
  - no frontend changes
  - no artifact hosting/signed URLs/download URLs
  - no lifecycle mutation in runtime helper/adapter/composition
- next phase is Phase 8.0-D final sign-off
- later audited phases are still required for:
  - real Remotion runtime execution with proper composition selection and full VideoConfig handling
  - verified output production flow through artifact verification before success
  - explicit route/job execution trigger decisions
  - artifact hosting and downloadable URL issuance

Phase 8.1 bundler + runtime type boundary prep note:

- Phase 8.1-A audit is complete
- Phase 8.1-B bundler dependency + runtime type boundary prep is complete
- this phase is boundary/dependency prep only:
  - `@remotion/bundler` added
  - runtime helper type boundaries prepared for future real runtime integration
  - no real runtime execution enabled
- no route auto-execution, no frontend changes, and no artifact hosting/signed/download URL behavior were introduced
- lifecycle ownership remains harness/registry only
- next phase is Phase 8.1-D final sign-off
- later audited phases are still required for:
  - first controlled real render smoke execution
  - artifactVerification-backed verified output before success
  - explicit backend job execution trigger decisions
  - artifact hosting and downloadable URL issuance

### Phase 7: Production Optimization

- monitoring
- performance hardening
- operational polish

Status:

- not started

## Current Priority Order

1. preserve Phase 3.8 verification and backend-boundary clarity
2. keep backend durable queue and multi-device resume deferred until backend/infrastructure work
3. run Phase 7.9-D Remotion composition boundary final sign-off, then Phase 8.0-A real renderer runtime execution audit only
## Phase 8.2 status

- Phase 8.2-A: complete (audit only).
- Phase 8.2-B: complete (controlled real backend Remotion smoke, opt-in only).
- Phase 8.2-C: docs update only (this update).
- Next: Phase 8.2-D final sign-off.

### What Phase 8.2-B delivered

- First controlled real backend smoke path (test-only, opt-in).
- Real pipeline for opt-in smoke: bundle -> composition discovery/selection -> render -> file verification.
- Browser-mode stabilization via `chromeMode: "headless-shell"`.

### Still deferred after 8.2-B

- Route-triggered or auto renderer execution.
- Frontend integration changes.
- Real user media decoding pipeline.
- Production artifact hosting.
- Signed URL and download URL capability.
- Queue/scheduler/worker-loop/database durability expansions.

### Next planned audit after 8.2-D

- Phase 8.3-A — Renderer Adapter Real Runtime Integration Audit Only.

## Phase 8.3 status

- Phase 8.3-A: complete (adapter real-runtime integration audit).
- Phase 8.3-B: complete (adapter boundary aligned to real-smoke runtime entry/composition/props flow).
- Phase 8.3-C: docs update only (this update).
- Next: Phase 8.3-D final sign-off.

### What 8.3-B completed

- Adapter default runtime boundary alignment with backend composition entry.
- Adapter snapshot-to-composition-props conversion before runtime delegation.
- Delegation preserved: runtime API calls remain in runtime helper boundary.

### Still deferred after 8.3-B

- Harness/job execution expansion for production renderer flow.
- Route-triggered backend renderer execution.
- Production artifact hosting/signing/download URLs.
- Frontend integration with real backend lifecycle/render completion.

## Phase 8.4 status

- Phase 8.4-A: complete (harness real-runtime integration audit).
- Phase 8.4-B: complete (focused harness-level real-runtime integration test milestone).
- Phase 8.4-C: docs update only (this update).
- Next: Phase 8.4-D final sign-off.

### What 8.4-B delivered

- Harness-level integration test coverage for real adapter/runtime execution in opt-in mode.
- Verified boundary that harness-owned artifact verification gates success transition.
- Preserved route non-execution and backend-only scoped runtime testing.

### Still deferred after 8.4-B

- Backend render job trigger wiring for normal flow.
- Route-triggered backend renderer execution.
- Production artifact hosting/signing/download URL delivery.
- Frontend integration with real backend lifecycle/render completion.
- Durable persistence/queue/worker/scheduler expansion.

## Phase 8.5 status

- Phase 8.5-A: complete (backend execution trigger audit).
- Phase 8.5-B: complete (internal backend execution trigger milestone).
- Phase 8.5-C: docs update only (this update).
- Next: Phase 8.5-D final sign-off.

### What 8.5-B delivered

- Internal backend trigger boundary for harness execution (`executeRenderJob`).
- Focused test coverage for delegation, lifecycle neutrality at trigger layer, and route non-execution guarantees.

### Still deferred after 8.5-B

- Route-triggered backend execution (`POST /exports` execution wiring).
- Queue/worker/scheduler/database-backed durable execution.
- Production artifact hosting/signing/download URL delivery.
- Frontend integration with real backend lifecycle completion.
- Production scalability/security hardening phases.

## Phase 8.13 status

- Phase 8.13-A: complete (audit).
- Phase 8.13-B: complete (worker lifecycle app wiring).
- Phase 8.13-C: docs update only (this update).
- Next: Phase 8.13-D final sign-off.

### What 8.13-B delivered

- Worker lifecycle module: `backend/workers/renderWorkerLifecycle.ts`.
- Lifecycle factory `createRenderWorkerLifecycle(...)` with init/shutdown/isRunning/getStatus API.
- App.ts wiring using already-composed backendDeps (registry, rendererAdapter, pathPolicy).
- Lifecycle init called during app creation but remains harmless without env flags.
- Lifecycle stored internally as `app.locals.renderWorkerLifecycle` (internal/test/dev only).
- No public lifecycle/status route added.

### Preserved boundaries

- rendererAdapter/pathPolicy composed but NOT wired into exports router.
- POST /exports remains non-executing.
- POST /exports/:jobId/execute remains dev/test-gated with timeout.
- No server.ts changes, no process signal handlers, no graceful shutdown wiring.
- No route enqueue behavior yet.
- No durable queue/persistence yet.
- No cancellation yet.
- No frontend changes yet.
- Worker lifecycle depends on in-memory registry only.

### Still deferred after 8.13-B

- Route enqueue behavior (automatic execution on POST /exports).
- Durable queue/persistence (Redis/database-backed execution).
- Server graceful shutdown (SIGINT/SIGTERM handlers, server.close wiring).
- Frontend async worker integration.
- Production artifact hosting/signed URLs/download capability.
- Production auto-start without env flags.

## Phase 8.14 status

- Phase 8.14-A: complete (enqueue behavior audit).
- Phase 8.14-A2: complete (GET status truthfulness audit).
- Phase 8.14-B: complete (truthful GET status implementation).
- Phase 8.14-C: docs update only (this update).
- Next: Phase 8.14-D final sign-off.

### What 8.14-A found

- POST /exports already behaves as an enqueue boundary when worker flags are enabled.
- No route code change needed for enqueue behavior.
- GET /exports/:jobId was always returning "pending" — a truthfulness bug.

### What 8.14-B delivered

- Truthful GET /exports/:jobId status mapping in `backend/routes/exports.ts`.
- `mapRecordToPollResponse()` helper maps registry status to public types.
- `ExportPollResponseBody` updated to allow full `ExportPollResult` union.
- Status mapping: submitted/rendering/finalizing → pending, success → terminal_success, error/expired → terminal_failure.
- Success response: safe artifact metadata only (no paths/URLs).
- Failure response: message/code/jobId only, no failure.details (no leak risk).

### Preserved boundaries

- POST /exports unchanged (accepted_job, creates submitted job).
- POST /exports/:jobId/execute unchanged (dev/test-gated, 503/501).
- rendererAdapter/pathPolicy NOT wired into createExportRouter.
- No artifact hosting, signed URLs, or download URLs.
- No durable queue/persistence, cancellation, or frontend changes.
- Worker processing remains env-gated and in-memory only.

### Still deferred after 8.14-B

- Route enqueue response fields (not needed — POST /exports already enqueues).
- Durable queue/persistence (Redis/database-backed execution).
- Server graceful shutdown (SIGINT/SIGTERM handlers, server.close wiring).
- Frontend async worker integration.
- Production artifact hosting/signed URLs/download capability.
- Production auto-start without env flags.

## Phase 8.15 status

- Phase 8.15-A: complete (durable queue/persistence strategy audit).
- Phase 8.15-B: complete (registry interface boundary).
- Phase 8.15-C: docs update only (this update).
- Next: Phase 8.15-D final sign-off.

### What 8.15-A found

- Durable persistence not ready for real storage yet.
- Current InMemoryExportJobRegistry clean enough for interface boundary.
- Safest next step: interface separation only.
- Recommended: interface → JSON file → SQLite → Postgres progression.

### What 8.15-B delivered

- Registry interface/implementation separation.
- `backend/registry/exportJobRegistry.ts` owns interface/types.
- `backend/registry/inMemoryExportJobRegistry.ts` contains implementation.
- `createBackendDependencies` returns `registry: ExportJobRegistry` (interface type).
- Future durable persistence adapters can implement `ExportJobRegistry` without changing consumers.

### Preserved boundaries

- No real persistence/storage added.
- All registry behavior preserved (create, getById, getByRequestId, getByStatus, claim, mark*, transition).
- requestId idempotency still process-local only.
- Claims/leases still in-memory with TTL support.
- No route, worker, app, server, or frontend changes.

### Still deferred after 8.15-B

- No JSON/SQLite/Postgres/Redis adapter yet.
- No restart recovery semantics yet.
- No durable requestId idempotency across restarts yet.
- No durable worker claim/lease persistence yet.
- No durable artifact metadata persistence yet.
- Durable queue/persistence (Redis/database-backed execution).
- Server graceful shutdown (SIGINT/SIGTERM handlers, server.close wiring).
- Frontend async worker integration.
- Production artifact hosting/signed URLs/download capability.

## Phase 8.16 status

- Phase 8.16-A: complete (graceful shutdown/worker stop audit).
- Phase 8.16-B: complete (shutdown helper boundary).
- Phase 8.16-C: docs update only (this update).
- Next: Phase 8.16-D final sign-off.

### What 8.16-A found

- Worker lifecycle has shutdown() but no server coordination.
- Safe next step: create testable shutdown helper boundary first.

### What 8.16-B delivered

- Graceful shutdown helper: `backend/lifecycle/gracefulShutdown.ts`.
- `createGracefulShutdown(...)` returns shutdown/isShuttingDown/getStatus controller.
- Helper calls lifecycle.shutdown() and server.close() when provided.
- Helper is idempotent and safe.
- No SIGINT/SIGTERM handlers wired yet.

### Preserved boundaries

- No server.ts wiring added yet.
- No process.exit() calls added.
- No job registry state mutation.
- No render cancellation.
- No persistence/recovery.

### Still deferred after 8.16-B

- No server.ts shutdown wiring yet.
- No SIGINT/SIGTERM handlers yet.
- No process-level graceful shutdown yet.
- No bounded in-flight render wait/cancellation yet.
- Durable queue/persistence (Redis/database-backed execution).
- Frontend async worker integration.
- Production artifact hosting/signed URLs/download capability.
