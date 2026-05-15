# Phases

This file is the canonical phase map for the repository. If older prompts, notes, or large documents use different numbering, this file wins for future implementation work.

## Canonical Phase Map

### Phase 1 — Vision & Product Direction

Status:

- established

Scope:

- AI scene generation platform
- multi-provider orchestration
- real generation lifecycle
- production-oriented architecture

### Phase 2 — UI Exploration

Status:

- historical exploration phase

Scope:

- antigravity experiments
- Stitches design iterations
- scene queue interface
- generation cards
- provider visibility

### Phase 3 — Real Logic Layer

Status:

- active phase family

Purpose:

- move from UI-first experimentation into a real production logic layer

#### Phase 3.0 — UI System

Status:

- complete

#### Phase 3.1 — Zustand Global Store / Scene Lifecycle

Status:

- complete

#### Phase 3.2 — Global Store Stabilization

Status:

- complete

#### Phase 3.3 — Error Normalization / Async Pipeline

Status:

- mostly complete or integrated

#### Phase 3.4 — Queue + Providers

Status:

- complete

#### Phase 3.5 — Lifecycle Engine

Status:

- mostly complete

#### Phase 3.6 — Hydration & State Stability

Status:

- complete

Scope:

- explicit hydration state
- persisted-state sanitization for active scenes
- durable vs transient persistence boundaries
- selector stability
- queue re-entry safety after refresh

Verification sign-off:

- hydration/runtime browser sign-off passed
- H01-H10 Playwright matrix passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test:e2e` passed
- `npm run verify:phase36` passed

#### Phase 3.7 — Transport Truthfulness & Provider Realism

Status:

- complete

Scope:

- remove service-layer simulated success paths
- keep transport failures as true failures
- preserve current lifecycle rules
- tighten progress semantics so they do not imply fake backend truth

Verified in this phase:

- missing API base URL fails truthfully
- non-OK HTTP responses fail truthfully
- invalid response payloads fail truthfully
- transport exceptions fail truthfully
- fallback remains centralized in the agent/store flow
- lifecycle progress is labeled as app stage semantics, not provider telemetry
- Phase 3.6 hydration verification still passes

#### Phase 3.8 — Long-running Provider Patterns

Status:

- complete

Sub-phases:

- Phase 3.8A audit complete
- Phase 3.8B provider job contracts complete
- Phase 3.8C polling orchestration complete
- Phase 3.8C1 service submit/poll contracts and polling scaffold complete
- Phase 3.8C2 queue/store polling integration complete
- Phase 3.8C3 runtime hardening and UI status refinement complete
- Phase 3.8D persistence and resumable runtime design complete
- Phase 3.8D1 persisted provider job metadata and hydration classification complete
- Phase 3.8D2 automatic resume polling for valid persisted provider jobs complete
- Phase 3.8D3 resume hardening and UX finalization complete
- Phase 3.8E durable backend queue not started

Scope:

- polling-capable services
- durable provider job identity
- resumable orchestration contracts
- browser-local resume for valid persisted provider jobs
- explicit backend boundary for durable queue and server-owned orchestration

Verified in Phase 3.8B:

- provider job contract types exist for job identity, status, submission, poll results, terminal success, and provider failure
- a future-safe provider generation outcome union exists for immediate success, submitted jobs, and provider failure
- runtime behavior remains on the current single-request completion path
- polling remains deferred to Phase 3.8C
- persistence and refresh-safe resume remain deferred to later Phase 3.8D/E work

Verified in Phase 3.8C1:

- services expose submit/poll job contracts alongside the existing request/response path
- immediate success and accepted job branching exist below the queue/store layers
- polling agent scaffolding exists with timeout, abort, and transient failure policy structure
- queue/store runtime polling integration remains deferred to Phase 3.8C2
- persistence and refresh-safe resume remain deferred to Phase 3.8D/E work

Verified in Phase 3.8C2:

- queue/store runtime handles immediate success through the submit/poll orchestration path
- queue/store runtime handles accepted provider jobs that poll to terminal success
- queue/store runtime handles accepted provider jobs that poll to terminal failure
- lifecycle remains `idle -> queued -> generating -> success | error`
- hydration reset behavior remains unchanged and refresh-safe resume remains deferred

Verified in Phase 3.8C3:

- duplicate generate attempts do not submit duplicate accepted jobs
- accepted jobs remain in `generating` while polling and do not fallback after acceptance
- bounded transient poll failures retry within budget
- polling timeout becomes an explicit scene error
- queue concurrency remains bounded while accepted jobs are polling
- terminal success and terminal failure callbacks apply once per scene
- UI now labels long-running provider job states without implying provider percentage telemetry
- hydration reset behavior remains unchanged and refresh-safe resume remains deferred

Verified in Phase 3.8D1:

- durable provider job metadata now persists on scenes without persisting timers, controllers, or queue workers
- hydration classifies valid in-flight provider jobs as resume-needed without starting polling yet
- expired provider jobs become explicit stale errors during hydration
- corrupt provider job metadata fails safely during hydration
- non-resumable queued/generating scenes still follow the existing safe reset behavior
- automatic resume polling remains deferred to Phase 3.8D2

Verified in Phase 3.8D2:

- valid persisted provider jobs now auto-resume polling after hydration without submitting a new provider job
- resumed jobs reuse the existing provider job handle and existing polling flow
- first poll terminal success and first poll terminal failure both apply one terminal scene result after reload
- provider job not found after reload becomes an explicit scene error
- expired and corrupt persisted provider jobs still fail safely during hydration
- backend durability and resumable ownership beyond the browser remain deferred

Verified in Phase 3.8D3:

- retry after resumed failure clears old provider job ownership before submitting exactly one new provider job
- regenerate after resumed success clears old provider job ownership before submitting exactly one new provider job
- fingerprint mismatches fail safely and do not auto-resume or auto-submit
- resumed success, failure, not-found, expired, and resume-unavailable states now surface explicit render-only UI labels
- resume polling starts once per valid hydrated scene and terminal outcomes still apply once
- browser-local resume is now hardened, while backend durability and multi-device coordination remain deferred

Phase 3.8 final sign-off:

- browser-local long-running provider support is complete and verified
- services own submit/poll HTTP contracts
- agents own polling orchestration
- store owns lifecycle, persistence boundaries, and resumable provider job metadata
- components remain render/dispatch only
- backend durable queue, multi-device resume, server workers, remote cancellation, and webhook completion remain deferred

### Phase 4 — Timeline & Video System

Status:

- started (Phase 4.1 through Phase 4.6 planning complete)

Sub-phases:

- Phase 4.1 timeline domain types complete
- Phase 4.2 timeline store complete
- Phase 4.3 timeline UI complete
- Phase 4.4 sequencing/reorder complete
- Phase 4.5 playback simulation complete
- Phase 4.6 video/export orchestration planning and boundaries complete (implementation deferred)

Verified in Phase 4.4:

- timeline store now exposes `moveClipUp` and `moveClipDown` reorder actions
- timeline UI now exposes Move up/Move down controls that dispatch reorder actions only
- reorder normalization is store-owned and recomputes `order`, contiguous `startMs`, and `totalDurationMs`
- boundary reorder attempts are safe no-ops
- scene lifecycle and generation orchestration remain unchanged

Verified in Phase 4.5:

- timeline store now exposes manual playback actions (`playTimeline`, `pauseTimeline`, `seekTimeline`, `stepTimeline`, `stopTimeline`)
- playback selectors now expose active preview clip, progress, and manual control enablement
- timeline UI now exposes manual preview controls that render store state and dispatch playback actions only
- playback remains manual simulation only with no timers, no `requestAnimationFrame`, and no automatic playback loop
- no real media rendering, export behavior, or backend rendering queue behavior is implemented

Verified in Phase 4.6A:

- video/export orchestration boundaries are documented for future phases only
- Phase 4 timeline foundation is complete through manual preview simulation
- video/export implementation is not built
- backend rendering, render queues, workers, webhooks, and media processing remain deferred

### Phase 5 — Agent System

Status:

- in progress (Phase 5.6 complete)

Sub-phases:

- Phase 5.0A backend export architecture audit complete
- Phase 5.1 export/render job domain types complete (contracts only)
- Phase 5.2 export service contracts complete
- Phase 5.3 export agent orchestration scaffold complete
- Phase 5.4 export store integration complete
- Phase 5.5 export UI/status actions complete
- Phase 5.6 export resume/hardening complete

Phase 5.1 note:

- `src/types/exportJob.ts` defines export/render job contracts only
- export runtime behavior is not implemented
- backend rendering, render queue, workers, and webhooks remain deferred
- downloadable video output is not implemented

Phase 5.2 note:

- `src/services/exportService.ts` now defines submit/poll/artifact HTTP service contracts
- focused service tests exist in `tests/e2e/phase52-export-service.spec.ts`
- service behavior is contract-only (no orchestration loop, retries, store updates, or UI updates)
- export runtime wiring, backend rendering, render queue, workers, webhooks, and downloadable output remain deferred

Phase 5.3 note:

- `src/agents/exportAgent.ts` now provides `startExport`, `resolveExport`, and `pollExportUntilTerminal`
- focused export agent orchestration tests exist in `tests/e2e/phase53-export-agent.spec.ts`
- accepted-job orchestration has no post-acceptance fallback and no duplicate submit behavior
- timeout and transient failure handling remain truthful
- export runtime wiring, store integration, UI integration, backend rendering, render queue, workers, webhooks, and downloadable output remain deferred

Phase 5.4 note:

- `src/store/exportStore.ts` now exists as a separate export lifecycle store
- export lifecycle state, persistence, selectors, duplicate-submit guards, and hydration classification are implemented
- Phase 5.4 classifies resumable jobs only; it does not auto-resume polling
- export UI wiring, backend rendering, render queue, workers, webhooks, and downloadable output remain deferred

Phase 5.5 note:

- `src/components/TimelineExportPanel.tsx` now exists and is integrated in timeline UI
- export UI dispatches export requests and state-clearing actions through `exportStore` only
- focused export UI coverage exists in `tests/e2e/phase55-export-ui.spec.ts`
- resume label coverage exists for `resume_needed`, `resume_unavailable`, and `expired`
- backend rendering, render queue, workers, webhooks, and downloadable output remain deferred

Phase 5.6 note:

- `src/store/exportStore.ts` now supports manual `resumeExport` for valid `resume_needed` jobs using existing accepted handles only
- `src/components/TimelineExportPanel.tsx` now exposes a manual `Resume export` button for resumable jobs
- focused resume coverage exists in `tests/e2e/phase54-export-store.spec.ts` and `tests/e2e/phase55-export-ui.spec.ts`
- auto-resume polling for export jobs remains deferred
- backend rendering, render queue, workers, webhooks, remote cancellation, and downloadable output remain deferred

### Phase 6 — Backend & Infrastructure

Status:

- started (Phase 6.0-A planning complete; Phase 6.0-B docs sync complete; Phase 6.3-A/B local integration support complete)

Sub-phases:

- Phase 6.0-A backend/export implementation planning audit complete
- Phase 6.0-B backend/export architecture docs sync complete
- Phase 6.1-A backend contract scaffold audit complete
- Phase 6.1-B backend export contract scaffold complete
- Phase 6.1-C backend runtime scripts and focused backend contract tests complete
- Phase 6.2-A backend job registry/lifecycle audit complete
- Phase 6.2-B backend registry idempotency and truthful lifecycle complete
- Phase 6.3-A frontend/backend integration audit complete
- Phase 6.3-B frontend/backend local integration support complete
- Phase 6.4 contract/integration tests
- Phase 6.5-A renderer architecture decision audit complete
- Phase 6.5-B renderer architecture decision docs update complete
- Phase 6.5-C renderer prerequisite contract audit/planning complete
- Phase 6.5-D renderer prerequisite contract docs update complete
- Phase 6.6-A backend lifecycle state machine audit complete
- Phase 6.6-B backend lifecycle state machine implementation + tests complete
- Phase 6.6-D backend lifecycle state machine final sign-off complete
- Phase 6.7-A artifact metadata contract audit complete
- Phase 6.7-B artifact metadata contract implementation + tests complete
- Phase 6.7-D artifact metadata contract final sign-off complete
- Phase 6.8-A worker boundary / render execution contract audit complete
- Phase 6.8-B worker boundary claim contract implementation + tests complete
- Phase 6.8-D worker boundary claim contract final sign-off complete
- Phase 6.9-A backend renderer-readiness final audit complete
- Phase 6.9-C final Phase 6 manual sign-off (next)
- Phase 7.0-A Remotion renderer pilot audit only complete
- Phase 7.0-B renderer input snapshot contract implementation + tests complete
- Phase 7.0-D renderer input snapshot contract final sign-off complete
- Phase 7.1-A temp/output path policy audit only complete
- Phase 7.1-B temp/output path policy helper implementation + tests complete
- Phase 7.1-D temp/output path policy final sign-off (next)
- Phase 7.2-A real file verification policy audit only complete
- Phase 7.2-B real file verification helper implementation + tests complete
- Phase 7.2-D real file verification final sign-off complete
- Phase 7.3-A renderer failure mapping audit only complete
- Phase 7.3-B renderer failure mapping helper implementation + tests complete
- Phase 7.3-D renderer failure mapping final sign-off complete
- Phase 7.4-A single-process renderer execution harness audit only complete
- Phase 7.4-B single-process renderer execution harness contract + injected orchestrator helper + tests complete
- Phase 7.4-D single-process renderer execution harness final sign-off complete
- Phase 7.5-A Remotion dependency / renderer adapter audit only complete
- Phase 7.5-B Remotion adapter contract stub only + tests complete
- Phase 7.5-D Remotion adapter contract stub final sign-off complete
- Phase 7.6-A Remotion dependency install audit only complete
- Phase 7.6-B Remotion dependency install only complete
- Phase 7.6-D Remotion dependency install final sign-off complete
- Phase 7.7-A Remotion import smoke test audit only complete
- Phase 7.7-B Remotion import smoke test only complete
- Phase 7.7-D Remotion import smoke test final sign-off complete
- Phase 7.8-A Remotion adapter implementation audit only complete
- Phase 7.8-B Remotion adapter implementation with mocked renderer calls complete
- Phase 7.8-D Remotion adapter implementation final sign-off complete
- Phase 7.9-A Remotion composition boundary audit only complete
- Phase 7.9-B Remotion composition boundary scaffold only complete
- Phase 7.9-D Remotion composition boundary final sign-off complete
- Phase 8.0-A real renderer runtime execution audit only complete
- Phase 8.0-B Remotion runtime helper boundary + adapter delegation (mocked calls only) complete
- Phase 8.0-C docs update only complete
- Phase 8.0-D final sign-off complete
- Phase 8.1-A real Remotion runtime execution audit only complete
- Phase 8.1-B Remotion bundler dependency + runtime type boundary prep (no real render) complete
- Phase 8.1-C docs update only complete
- Phase 8.1-D final sign-off pending
- Phase 6.6 durable persistence planning

Phase 6 boundary note:

- recommended implementation path is an in-repo Node/Express contract-first backend scaffold
- backend rendering is not implemented yet
- render queue, workers, webhook completion, remote cancellation, and downloadable output remain deferred

Phase 6.1 note:

- backend scaffold now exists under `backend/` with:
  - `backend/app.ts`
  - `backend/server.ts`
  - `backend/routes/exports.ts`
  - `backend/validation/exportValidation.ts`
  - `backend/contracts/exportHttpTypes.ts`
  - `backend/errors/exportErrors.ts`
  - `backend/registry/exportJobRegistry.ts`
- backend runtime/test scripts now exist:
  - `backend:dev`
  - `backend:start`
  - `test:backend`
- focused backend contract tests now exist in `tests/e2e/phase61-backend-contract.spec.ts`
- local verification for Phase 6.1-C passed with backend contract tests
- no renderer, no workers, no queue infrastructure, no webhooks, no durable persistence, and no frontend integration yet

Phase 6.2 note:

- backend in-memory export registry now supports process-local `requestId` idempotency
- repeated `POST /exports` with the same `requestId` returns the same accepted job handle
- different `requestId` values create different accepted jobs
- known jobs remain truthful `pending/accepted` by default because no renderer exists yet
- no expiration timers or background lifecycle advancement were added
- artifacts route still returns `export_artifacts_unavailable` unless real artifacts exist
- focused backend lifecycle/idempotency coverage exists in `tests/e2e/phase62-backend-registry-lifecycle.spec.ts`
- backend script `test:backend:phase62` now exists for focused lifecycle/idempotency verification

Phase 6.3 note:

- local frontend/backend integration support now exists for development
- Vite dev proxy now routes `/exports` to `http://127.0.0.1:8787`
- export service default paths now align to backend scaffold routes:
  - submit default: `/exports`
  - poll default: `/exports`
  - artifacts default: `/exports`
- runtime config precedence remains:
  - `window.__FREE_AI_MIXER_RUNTIME_CONFIG__` first
  - `VITE_EXPORT_*` fallback second
- missing-config failure behavior remains truthful
- normalized backend error preservation exists for `export_artifacts_unavailable`, `export_job_not_found`, and `invalid_export_request`
- generic invalid/non-OK HTTP responses still normalize to `http_error` when no normalized backend code is present
- focused local integration coverage exists in `tests/e2e/phase63-frontend-backend-integration.spec.ts`
- script `test:integration:phase63` exists for focused local integration verification
- this is local integration support only; real renderer/export output is still not implemented

Phase 6.5 note:

- renderer architecture decision audit is complete
- recommended future direction is a Remotion-first backend renderer pilot
- FFmpeg remains a strong long-term option and hybrid Remotion+FFmpeg remains deferred until artifact pipeline maturity
- no renderer implementation exists yet
- no real video rendering or downloadable output exists yet
- artifact records must only be created after real files are produced and verified
- export APIs must return metadata refs only (no raw blobs, no local filesystem paths)
- progress percent may appear only when the renderer can truthfully compute it
- worker/queue boundary is required before renderer implementation
- frontend remains unchanged until backend can provide truthful real artifacts
- planned lifecycle contract is `submitted -> rendering -> finalizing -> success | error | expired`
- `queued` is deferred until a real queue exists
- planned worker lifecycle boundary is:
  - `claim(jobId, workerId)`
  - `markRendering(jobId, workerId)`
  - `markFinalizing(jobId, workerId)`
  - `markSuccess(jobId, workerId, artifacts[])`
  - `markError(jobId, workerId, failure)`
- lifecycle transitions must remain backend-authoritative, never frontend-driven

Phase 6.6 note:

- backend lifecycle state-machine typing now exists in registry/contracts for:
  - `submitted`
  - `rendering`
  - `finalizing`
  - `success`
  - `error`
  - `expired`
- backend registry now exposes transition helpers:
  - `canTransition(from, to)`
  - `transition(jobId, nextStatus, options?)`
- terminal states are immutable
- `success` is guarded and requires structurally valid artifact metadata
- focused lifecycle state-machine tests now exist in `tests/e2e/phase66-backend-lifecycle-state-machine.spec.ts`
- focused backend script `test:backend:phase66` now exists
- route behavior remains compatible with existing `accepted_job`/`pending` flow
- frontend was unchanged in this phase
- no renderer, worker runtime, queue runtime, artifact hosting, or download URL implementation exists yet
- no fake progress percent, fake success, fake artifacts, or fake cancellation behavior was added

Phase 6.7 note:

- backend artifact metadata contract now exists in backend contracts/registry only
- required artifact metadata fields are:
  - `artifactId`
  - `jobId`
  - `kind`
  - `format`
  - `status`
  - `createdAt`
- optional artifact metadata fields are:
  - `sizeBytes`
  - `durationMs`
- allowed artifact statuses are:
  - `unavailable`
  - `pending_verification`
  - `available`
  - `expired`
  - `failed`
- registry artifact validation now rejects unsafe fields:
  - `path`
  - `filePath`
  - `localPath`
  - `url`
  - `downloadUrl`
- success remains blocked unless artifact metadata is structurally valid
- artifact metadata is structural-only in this phase; no real file verification exists yet
- frontend was unchanged and routes remain truthful with no-artifact behavior
- `GET /exports/:jobId/artifacts` remains unavailable unless real artifacts exist
- focused artifact contract tests now exist in `tests/e2e/phase67-artifact-metadata-contract.spec.ts`
- focused backend script `test:backend:phase67` now exists

Phase 6.8 note:

- worker boundary claim contract now exists in backend registry only
- claim metadata now includes:
  - `claimedByWorkerId?`
  - `claimExpiresAt?`
  - `attemptCount`
  - `startedAt?`
- worker-boundary registry methods now include:
  - `claim(jobId, workerId, options?)`
  - `markRendering(jobId, workerId)`
  - `markFinalizing(jobId, workerId)`
  - `markSuccess(jobId, workerId, artifacts[])`
  - `markError(jobId, workerId, failure)`
- only the claiming worker can perform worker lifecycle transitions
- terminal jobs cannot be claimed or transitioned through worker methods
- lifecycle and artifact validation guards remain enforced (`markSuccess` still requires valid artifact metadata)
- claim ownership is process-local/in-memory only
- route behavior remains unchanged
- frontend was unchanged
- this is not a real worker runtime, not a queue, and does not start renderer execution
- focused worker-boundary tests now exist in `tests/e2e/phase68-worker-boundary-claim-contract.spec.ts`
- focused backend script `test:backend:phase68` now exists

Phase 6.9 note:

- backend/export foundation is renderer-readiness-audited
- lifecycle/transition guards are ready for future render execution boundaries
- worker claim/ownership contract is sufficient for a future single-process renderer pilot boundary
- artifact metadata contract blocks fake outputs at contract level
- frontend boundaries remain clean and unchanged
- remaining prerequisites before renderer implementation are:
  - renderer input snapshot contract
  - media input reference normalization
  - temp/output directory policy
  - real file existence verification
  - artifact retention/cleanup policy
  - Remotion runtime/dependency execution wrapper
  - renderer failure mapping
  - single-process worker execution harness

Phase 7.0 note:

- renderer input snapshot contract now exists in `backend/contracts/renderInputSnapshot.ts`
- snapshot contract is backend-internal only and includes:
  - `jobId`
  - `timelineId`
  - `renderSettings`
  - `timelineSnapshot`
  - scene/media references
  - `outputTarget`
- snapshot creation/validation helpers now exist:
  - `validateRenderInputSnapshot(input)`
  - `createRenderInputSnapshot(input)`
- snapshot contract is structural and immutable
- empty clips, invalid clip timing, and missing scene/media refs are rejected
- raw blob-like fields are rejected
- url/download/public url fields are rejected
- path traversal in `outputTarget` is rejected
- snapshot helpers do not start rendering, create files/artifacts, add progress percent, create download URLs, or trigger lifecycle transitions
- focused contract tests now exist in `tests/e2e/phase70-renderer-input-snapshot-contract.spec.ts`
- focused backend script `test:backend:phase70` now exists

Phase 7.1 note:

- backend-only output path policy helper now exists in `backend/renderer/outputPathPolicy.ts`
- helper supports safe root keys:
  - `temp`
  - `output`
- helper safely derives per-job temp/output paths under configured backend roots
- helper enforces safe path segment characters (`a-z`, `A-Z`, `0-9`, `-`, `_`)
- helper rejects traversal/path injection:
  - `..`
  - `/`
  - `\`
  - absolute paths
  - Windows drive-letter paths
  - UNC paths
  - URL-like values
  - reserved Windows device names
  - trailing spaces/dots
- helper enforces resolved-path containment under selected root
- helper does not create files, directories, artifacts, URLs/download URLs, lifecycle transitions, or API path exposure
- focused path policy tests now exist in `tests/e2e/phase71-output-path-policy.spec.ts`
- focused backend script `test:backend:phase71` now exists

Phase 7.2 note:

- backend-only artifact file verification helper now exists in `backend/renderer/artifactVerification.ts`
- helper accepts backend-internal `ResolvedRenderOutputPath` only
- helper re-checks root containment before filesystem access
- helper uses read-only `fs.stat` verification only
- helper verifies file exists, target is regular file, size is greater than zero, and extension matches expected format
- verified artifact metadata is built only after verification passes
- verified metadata includes:
  - `artifactId`
  - `jobId`
  - `kind`
  - `format`
  - `status: available`
  - `createdAt`
  - `sizeBytes`
- verified metadata excludes:
  - `path`
  - `filePath`
  - `localPath`
  - `url`
  - `downloadUrl`
  - `publicUrl`
  - `signedUrl`
- helper does not write files, create directories, delete files, host artifacts, sign URLs, create download URLs, trigger lifecycle transitions, call `markSuccess`, add progress percent, or fake artifacts/success
- focused verification tests now exist in `tests/e2e/phase72-artifact-file-verification.spec.ts`
- focused backend script `test:backend:phase72` now exists
- test-only temp files/directories are allowed in tests and must be self-cleaned; production helper remains read-only

Phase 7.3 note:

- backend-only renderer failure mapper now exists in `backend/renderer/rendererFailureMapping.ts`
- helper/types now include:
  - `RendererFailureCode`
  - `RendererFailureStage`
  - `RendererFailureCauseCategory`
  - `RendererMappedFailure`
  - `RendererFailureInput`
  - `mapRendererFailure(...)`
  - `toPublicSafeRendererFailure(...)`
  - `sanitizeRendererFailureDetails(...)`
  - `isTimeoutError(...)`
  - `isAbortError(...)`
- supported failure codes:
  - `input_snapshot_invalid`
  - `output_path_invalid`
  - `renderer_execution_failed`
  - `renderer_timed_out`
  - `renderer_cancelled_or_aborted`
  - `output_write_failed`
  - `artifact_verification_failed`
  - `artifact_file_missing`
  - `artifact_file_empty`
  - `artifact_format_mismatch`
- mapper is backend-internal only and maps raw/future renderer/runtime errors to normalized safe failures
- artifact verification failure codes are preserved
- timeout and cancellation/abort are mapped distinctly
- supported stages:
  - `snapshot`
  - `path`
  - `render`
  - `verify`
  - `finalize`
- supported cause categories:
  - `validation`
  - `runtime`
  - `timeout`
  - `abort`
  - `io`
  - `verification`
- retryability policy is encoded:
  - timeout retryable
  - unknown/transient runtime may be retryable
  - invalid snapshot/path/format mismatch non-retryable
  - artifact missing/empty/verification non-retryable for now
- public-safe sanitizer strips stack traces, local paths, urls/download-like fields, command args, env vars, secret/token/password-like values, and raw renderer logs
- helper does not run renderer, install Remotion, create files/directories/artifacts/urls/download urls, mutate lifecycle, call `markError`, or fake progress/success/cancellation
- focused mapper tests now exist in `tests/e2e/phase73-renderer-failure-mapping.spec.ts`
- focused backend script `test:backend:phase73` now exists

Phase 7.4 note:

- backend-only single-process render harness now exists in `backend/renderer/singleProcessRenderHarness.ts`
- harness types/helpers now include:
  - `SingleProcessRenderHarnessInput`
  - `SingleProcessRenderHarnessResult`
  - `RendererAdapterInput`
  - `RendererAdapterResult`
  - `RendererAdapter`
  - `executeSingleProcessRender(...)`
- successful harness flow:
  1. `claim(jobId, workerId)`
  2. create/validate render input snapshot
  3. resolve output path
  4. `markRendering(jobId, workerId)`
  5. call injected renderer adapter
  6. verify rendered artifact file
  7. `markFinalizing(jobId, workerId)`
  8. `markSuccess(jobId, workerId, verified artifact metadata)`
  9. return safe internal result
- failure harness flow:
  1. catch snapshot/path/adapter/verification/finalization errors
  2. map via renderer failure mapping
  3. sanitize public-safe failure
  4. `markError` through registry worker boundary
  5. return safe failure result
  6. never fallback to success
- adapter boundary:
  - adapter is injected
  - adapter receives snapshot + resolved output path + optional abort signal
  - adapter must not mutate lifecycle
  - adapter must not create urls/download urls
  - adapter must not return public local paths
  - adapter must not create verified metadata
  - adapter must not call `markSuccess`/`markError`
- test-only behavior:
  - phase 7.4 tests use injected test adapters
  - test adapters may create temp files in test-only temp directories
  - tests clean up temp files/directories
  - production harness does not directly write/create/delete files/directories
- non-behaviors:
  - no Remotion install/import
  - no real renderer runtime
  - no auto-run from `POST /exports`
  - no queue/scheduler/worker loop
  - no database/durable persistence
  - no artifact hosting
  - no signed/download url generation
  - no fake artifacts/progress/cancellation
  - no frontend changes
- focused harness tests now exist in `tests/e2e/phase74-single-process-render-harness.spec.ts`
- focused backend script `test:backend:phase74` now exists

Phase 7.5 note:

- backend-only Remotion adapter contract stub now exists in `backend/renderer/remotionRendererAdapter.ts`
- exports include:
  - `RemotionRendererAdapterOptions`
  - `remotionRendererAdapterNotImplementedCode`
  - `createRemotionRendererAdapter(...)`
- adapter factory returns a `RendererAdapter`-compatible function
- stub always returns truthful non-success:
  - `ok: false`
  - explicit not-implemented message
- stub is safe to import without Remotion installed
- diagnostics remain safe-only:
  - `code`
  - `summary`
  - `retryable`
  - optional `workerId`
- stub never returns `ok: true`
- stub does not expose local paths
- stub does not create url/download/signed/public url fields
- stub does not create artifact metadata
- stub does not mutate lifecycle
- stub does not call `markSuccess` or `markError`
- stub does not write files or create directories
- non-behaviors in this phase:
  - no Remotion install
  - no Remotion import
  - no `@remotion/renderer` import
  - no Remotion composition files
  - no renderer runtime execution
  - no auto-run from `POST /exports`
  - no queue/scheduler/worker loop
  - no database/durable persistence
  - no artifact hosting
  - no signed/download url creation
  - no fake artifacts/success/progress/cancellation
  - no frontend changes
- focused adapter contract tests now exist in `tests/e2e/phase75-remotion-adapter-contract.spec.ts`
- focused backend script `test:backend:phase75` now exists

Phase 7.6 note:

- dependency-install milestone is complete for:
  - `remotion`
  - `@remotion/renderer`
- only dependency files were updated in this milestone (`package.json`, `package-lock.json`)
- no Remotion imports were added
- no renderer runtime was added
- no adapter implementation was added
- no Remotion composition files were added
- no route auto-execution was added
- no frontend changes were added
- Phase 7.5 adapter test expectations were safely updated for this milestone:
  - dependencies may now exist
  - adapter stub must still not import Remotion runtime directly
  - adapter stub must still return truthful not-implemented failure
- validation recorded:
  - typecheck passed
  - build passed
  - focused backend checks passed
  - git status clean after commit

Phase 7.7 note:

- backend-only Remotion import smoke test now exists in `tests/e2e/phase77-remotion-import-smoke.spec.ts`
- focused backend script `test:backend:phase77` now exists
- smoke test behavior:
  1. dynamically imports `remotion`
  2. dynamically imports `@remotion/renderer`
  3. confirms imports work without running renderer runtime APIs
  4. keeps adapter stub truthful and not implemented (`ok: false`)
  5. confirms no Remotion composition files are added
  6. confirms no route auto-execution is added
  7. confirms no artifact metadata or url/download/signed/public-url fields are created
  8. confirms no lifecycle transition is triggered
- important correction:
  - phase 7.7-B is import smoke only
  - phase 7.7-B should not require asserting specific runtime exports (for example `bundle`) from `@remotion/renderer`
  - runtime rendering API verification remains deferred
- forbidden runtime calls in this phase include:
  - `renderMedia`
  - `bundle`
  - `selectComposition`
  - `getCompositions`
  - `openBrowser`
  - any output-writing renderer call
- non-behaviors:
  - no renderer runtime execution
  - no file/directory creation
  - no Remotion composition files
  - no adapter implementation
  - no route changes and no auto-run from `POST /exports`
  - no queue/scheduler/worker loop
  - no database/durable persistence
  - no artifact hosting or signed/download urls
  - no fake artifacts/success/progress/cancellation
  - no frontend changes

Phase 7.8 note:

- backend-only Remotion adapter implementation now exists in `backend/renderer/remotionRendererAdapter.ts`
- mocked runtime injection support is now implemented
- focused mocked-runtime tests now exist in `tests/e2e/phase78-remotion-adapter-mocked-runtime.spec.ts`
- focused backend script `test:backend:phase78` now exists
- adapter behavior:
  1. `createRemotionRendererAdapter(...)` remains the main factory
  2. adapter remains compatible with the existing `RendererAdapter` contract
  3. adapter supports optional injected Remotion-like runtime via options
  4. mocked runtime contract supports `bundle(...)`, `selectComposition(...)`, and `renderMedia(...)`
  5. when runtime is injected, call order is `bundle -> selectComposition -> renderMedia`
  6. snapshot data is passed into the mocked render boundary
  7. backend-internal resolved output path is passed only to mocked `renderMedia`
  8. adapter returns minimal safe internal result
  9. truthful not-implemented behavior is preserved when no runtime is injected
- safety boundaries:
  - mocked success means adapter-call success only
  - mocked success is not verified artifact success
  - adapter does not create artifact metadata
  - adapter does not verify files
  - adapter does not call `markSuccess`/`markError`
  - adapter does not mutate lifecycle
  - adapter does not expose local paths publicly
  - adapter does not create url/download/signed/public-url fields
  - adapter does not create fake progress percent
- failure behavior:
  - bundle/select/render failures return safe `ok: false`
  - failure diagnostics are sanitized
  - stack traces, local paths, urls, download-like values, command/env/secret-like values are not exposed
- test scope:
  - phase 7.8 tests use mocked injected runtime functions only
  - no real Remotion runtime API calls are executed
  - no real `renderMedia`, `bundle`, `selectComposition`, `getCompositions`, or `openBrowser` calls are executed
  - no composition files are required
  - no production files are created
  - phase 7.7 import smoke tests and phase 7.5 adapter tests remain compatible
- non-behaviors:
  - no real renderer execution
  - no composition files
  - no frontend component reuse
  - no Zustand/store/hooks in renderer path
  - no route changes and no auto-run from `POST /exports`
  - no queue/scheduler/worker loop
  - no database/durable persistence
  - no artifact hosting/signed urls/download urls
  - no fake terminal success/artifacts/progress/cancellation
  - no frontend changes

Phase 7.9 note:

- backend-only Remotion composition boundary scaffold now exists under:
  - `backend/renderer/compositions/compositionProps.ts`
  - `backend/renderer/compositions/freeMixerComposition.ts`
- focused backend composition-boundary tests now exist in:
  - `tests/e2e/phase79-remotion-composition-boundary.spec.ts`
- focused backend script now exists:
  - `test:backend:phase79`
- composition scaffold behavior:
  1. accepts `RenderInputSnapshot`-derived serializable props only
  2. renders deterministic placeholder timeline structure from clip timing/order data
  3. does not depend on frontend stores/hooks/services/agents/routes/registry
  4. does not call renderer runtime APIs (`renderMedia`, `bundle`, `selectComposition`, `getCompositions`, `openBrowser`)
  5. does not create files, verify files, create artifacts, or create url/download fields
  6. does not mutate lifecycle
- safety boundaries:
  - no frontend component reuse
  - no Zustand/store/hooks in renderer path
  - no route changes and no auto-run from `POST /exports`
  - no queue/scheduler/worker loop
  - no database/durable persistence
  - no artifact hosting/signed urls/download urls
  - no fake success/progress/artifacts/cancellation
- no real renderer runtime execution in this phase

Phase 8.0 note:

- `backend/renderer/remotionRuntime.ts` now exists as the dedicated backend-only Remotion runtime helper boundary
- `backend/renderer/remotionRendererAdapter.ts` now delegates runtime sequencing through the runtime helper or injected runtime boundary
- focused runtime-boundary coverage now exists in `tests/e2e/phase80-remotion-runtime-boundary.spec.ts`
- focused backend script now exists:
  - `test:backend:phase80`
- Phase 8.0-B remains mocked-call only:
  - no real renderer runtime execution is enabled yet
  - no route auto-execution is enabled
  - no frontend changes were introduced
  - no artifact hosting, signed URLs, or download URLs were introduced
  - no lifecycle mutation was introduced in runtime helper, adapter, or composition
- lifecycle ownership remains in harness/registry only

Phase 8.1 note:

- `@remotion/bundler` dependency was added as boundary/dependency prep only
- runtime helper boundary in `backend/renderer/remotionRuntime.ts` now includes safer type boundaries for future bundler/runtime integration
- focused boundary test now exists in `tests/e2e/phase81-remotion-bundler-boundary.spec.ts`
- focused backend script now exists:
  - `test:backend:phase81`
- Phase 8.1-B remains non-executing for real Remotion runtime:
  - no real `bundle`, `selectComposition`, or `renderMedia` execution is enabled
  - no route auto-execution is enabled
  - no frontend changes were introduced
  - no artifact hosting, signed URLs, or download URLs were introduced
  - no lifecycle mutation was introduced in runtime helper, adapter, or composition
- lifecycle ownership remains in harness/registry only

### Phase 7 — Production Optimization

Status:

- not started

## Enforcement

- Phase 3.6 is hydration and state stability.
- Phase 3.7 is transport truthfulness and provider realism.
- Phase 3.8 is long-running provider patterns.
- Phase 4 is timeline and video.
- Provider telemetry beyond app lifecycle stages belongs to Phase 3.8 or later.
- Phase 3.6 hydration/runtime verification is complete.
- Phase 3.8B defines contracts only; it does not change runtime orchestration.
## Phase 8.2-C — Real Remotion Smoke Docs Update

- Phase 8.2-A (audit) is complete.
- Phase 8.2-B (controlled real Remotion smoke) is complete, verified, and committed.
- Commit message: `feat(phase-8.2): add controlled real remotion smoke`.
- Phase 8.2-C is docs-only and records the milestone details below.
- Phase 8.2-D (final sign-off) remains the next sign-off step.

### Phase 8.2-B milestone summary

- Added opt-in real smoke test: `tests/e2e/phase82-remotion-real-smoke.spec.ts`.
- Added/updated runtime smoke boundary: `backend/renderer/remotionRuntime.ts`.
- Added backend Remotion entry boundary: `backend/renderer/compositions/remotionEntry.tsx`.
- Added package script: `test:backend:phase82`.
- Real rendering is still not enabled for normal app flow or routes.

### Real smoke behavior

- Opt-in only via `FREE_AI_MIXER_RUN_REAL_RENDER_SMOKE=1`.
- Default Phase 82 test mode safely skips real smoke.
- Opt-in path performs real: `bundle` -> `getCompositions` preflight -> `selectComposition` -> `renderMedia`.
- Output is written only to test temp output paths.
- Success requires real file verification via artifact verification.
- Runtime/helper/composition do not call `markSuccess` or `markError`.

## Phase 8.3-C — Renderer Adapter Real Runtime Integration Docs Update

- Phase 8.3-A (audit) is complete.
- Phase 8.3-B (adapter runtime boundary integration) is complete and committed.
- Commit message: `feat(phase-8.3): integrate adapter real runtime boundary`.
- Phase 8.3-C is docs-only (this update).
- Phase 8.3-D (final sign-off) remains pending.

### Phase 8.3-B boundary alignment summary

- Adapter default entry point aligns to `backend/renderer/compositions/remotionEntry.tsx`.
- Adapter default composition id aligns to `FREE_MIXER_COMPOSITION_ID`.
- Adapter converts `RenderInputSnapshot` into composition props before runtime delegation.
- Adapter no longer passes raw snapshot as runtime input props.
- Real Remotion API calls remain in `backend/renderer/remotionRuntime.ts`.

### Phase 8.3 boundaries preserved

- Routes remain non-executing for renderer runtime (`POST /exports` is not wired).
- Adapter remains lifecycle-neutral (no `markRendering`/`markFinalizing`/`markSuccess`/`markError`).
- Adapter remains artifact-neutral (no verification, no metadata creation, no hosting/signing/download URLs).
- Download capability is still not available.

## Phase 8.4-C — Harness Real Runtime Integration Docs Update

- Phase 8.4-A (audit) is complete.
- Phase 8.4-B (harness real runtime integration test milestone) is complete and committed.
- Commit message: `feat(phase-8.4): add harness real runtime integration test`.
- Phase 8.4-C is docs-only (this update).
- Phase 8.4-D (final sign-off) remains pending.

### Phase 8.4-B summary

- Added focused backend test: `tests/e2e/phase84-harness-real-runtime.spec.ts`.
- Added focused script: `test:backend:phase84`.
- Default phase84 path remains fast; real render path is opt-in via `FREE_AI_MIXER_RUN_REAL_RENDER_SMOKE=1`.
- Opt-in path validates harness + real adapter/runtime execution with real artifact verification before success transition.

### Boundaries preserved

- Harness/registry own lifecycle transitions (`claim`, `markRendering`, `markFinalizing`, `markSuccess`, `markError`).
- Adapter/runtime/composition remain lifecycle-neutral (no mark* calls).
- Adapter remains artifact-neutral (no verification, no metadata creation, no hosting/signing/download URL behavior).
- Routes remain non-executing for renderer runtime; `POST /exports` is not wired to execution.
- Download capability is still not available.

## Phase 8.5-C — Backend Execution Trigger Docs Update

- Phase 8.5-A (audit) is complete.
- Phase 8.5-B (backend internal execution trigger) is complete and committed.
- Commit message: `feat(phase-8.5): add backend execution trigger`.
- Phase 8.5-C is docs-only (this update).
- Phase 8.5-D (final sign-off) remains pending.

### Phase 8.5-B summary

- Added internal backend trigger module: `backend/renderer/executeRenderJob.ts`.
- Added focused test: `tests/e2e/phase85-backend-execution-trigger.spec.ts`.
- Added focused script: `test:backend:phase85`.
- `executeRenderJob(...)` delegates directly to `executeSingleProcessRender(...)` and returns the harness result unchanged.

### Boundaries preserved

- `executeRenderJob` does not directly call lifecycle transitions.
- Harness/registry remain lifecycle owners.
- Output path resolution and artifact verification remain harness-owned.
- `POST /exports` remains non-executing.
- Download capability is still not available.

## Phase 8.6-C — Backend Route Execution Trigger Docs Update

- Phase 8.6-A (audit) is complete.
- Phase 8.6-B (dev/test-gated route execution trigger) is complete and committed.
- Commit message: `feat(phase-8.6): add backend route execution trigger boundary`.
- Phase 8.6-C is docs-only (this update).
- Phase 8.6-D (final sign-off) remains pending.

### Phase 8.6-B summary

- Added dev/test-gated route execution trigger: `POST /exports/:jobId/execute`.
- Route execution is gated by environment variable: `FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1`.
- When env flag is missing, trigger route returns 503 with clear disabled message.
- When enabled but `rendererAdapter`/`pathPolicy` not configured, returns 501.
- When configured, route delegates to `executeRenderJob` (which delegates to harness).
- `POST /exports` remains non-executing (unchanged from Phase 8.5).
- Added focused test: `tests/e2e/phase86-backend-route-execution-trigger.spec.ts`.
- TypeScript import fix applied: `RenderOutputPathPolicy` imported from correct module.

### Boundaries preserved

- Route does not directly call `registry.markSuccess`, `registry.markError`, or lifecycle mutation methods.
- Lifecycle ownership remains inside `executeRenderJob` / `executeSingleProcessRender` / harness / registry.
- No local filesystem path is returned in API responses.
- No artifact hosting or download URLs.
- No queue/worker/scheduler implementation.
- No POST /exports auto-execution.
- No frontend changes.
- Synchronous HTTP execution remains a known deferred limitation (route blocks request until complete).

## Phase 8.7-C — Route Execution Timeout Guard Docs Update

- Phase 8.7-A (audit) is complete.
- Phase 8.7-B (route timeout guard) is complete and committed.
- Commit message: `feat(phase-8.7): add route execution timeout guard`.
- Phase 8.7-C is docs-only (this update).
- Phase 8.7-D (final sign-off) remains pending.

### Phase 8.7-B summary

- Added timeout protection to the dev/test-gated execute route: `POST /exports/:jobId/execute`.
- Added timeout environment variable: `FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS`.
- Default timeout: `120000` ms (120 seconds).
- Invalid, missing, or unsafe timeout values fall back to the default.
- Route execution is raced against timeout using `Promise.race`.
- If `executeRenderJob` finishes before timeout, existing success/failure response behavior remains.
- If timeout wins, route returns truthful HTTP 504 with safe JSON.
- Timeout response does not claim cancellation — it says "the job may still be running; poll the job state for the latest lifecycle status."
- Timeout response does not expose local paths, artifact metadata, download URLs, signed URLs, or fake progress.
- Route remains gated by `FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1`.
- Added focused test: `tests/e2e/phase87-route-execution-timeout.spec.ts`.

### 120000 ms explanation

- 120 seconds is acceptable for now because this route is dev/test-gated and synchronous.
- This is a defensive safety limit, not a production UX target.
- Future async worker phases should make route responses fast and move render execution to background processing.
- Current synchronous execution can still block until timeout or completion.

### Boundaries preserved

- Route does not directly call lifecycle mutation methods.
- Lifecycle ownership remains inside `executeRenderJob` / `executeSingleProcessRender` / harness / registry.
- No local filesystem path is returned in 504 response.
- No artifact metadata, download URLs, or signed URLs in 504 response.
- No worker loop, queue, scheduler, or cancellation implementation.
- POST /exports remains unchanged and non-executing.
- No frontend changes.

## Phase 8.8-C — Worker Helper Boundary Docs Update

- Phase 8.8-A (audit) is complete.
- Phase 8.8-B (worker helper boundary) is complete and committed.
- Commit message: `feat(phase-8.8): add worker helper boundary`.
- Phase 8.8-C is docs-only (this update).
- Phase 8.8-D (final sign-off) remains pending.

### Phase 8.8-B summary

- Added first worker helper boundary: `backend/workers/renderWorker.ts`.
- Added manual one-shot worker drain helper: `drainRenderWorkerOnce(...)`.
- Added minimal read-only registry job listing support: `registry.getByStatus(status)`.
- Added focused test: `tests/e2e/phase88-worker-helper.spec.ts`.
- Worker helper finds eligible submitted jobs via `registry.getByStatus("submitted")`.
- Worker helper delegates execution to `executeRenderJob`, not direct harness calls.
- Worker helper does NOT directly call `executeSingleProcessRender`.
- Worker helper does NOT directly call registry mutation methods.
- Lifecycle ownership remains inside `executeRenderJob` / `executeSingleProcessRender` / harness / registry.
- Artifact verification before success remains preserved.
- Output path policy remains the path leakage boundary.
- Worker summary does not expose local paths, filePath, URLs, artifact URLs, download URLs, or signed URLs.
- Duplicate execution safety relies on existing registry claim mechanism.

### Boundaries preserved

- No app.ts wiring — worker does not auto-start.
- No auto-start worker loop.
- No interval polling loop.
- No queue persistence.
- No Redis/database queue.
- No cancellation.
- No frontend changes.
- POST /exports remains non-executing.
- POST /exports/:jobId/execute remains dev/test-gated and synchronous with timeout guard.
- Route behavior is unchanged — worker helper is manual one-shot drain only.

## Phase 8.9-C — Test-Controlled Worker Loop Helper Docs Update

- Phase 8.9-A (audit) is complete.
- Phase 8.9-B (test-controlled worker loop helper) is complete and committed.
- Commit message: `feat(phase-8.9): add test-controlled worker loop helper`.
- Phase 8.9-C is docs-only (this update).
- Phase 8.9-D (final sign-off) remains pending.

### Phase 8.9-B summary

- Added test-controlled worker loop helper: `createRenderWorkerLoop(...)`.
- Loop returns controller with `start()`, `stop()`, `isRunning()`, `getStatus()` methods.
- Loop is disabled by default and requires `FREE_AI_MIXER_ENABLE_WORKER_LOOP=1` to start.
- Default poll interval is `2000` ms via `FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS`.
- Loop reuses existing `drainRenderWorkerOnce(...)` for job processing.
- Loop contains per-tick errors so one drain failure does not crash the loop.
- Loop prevents overlapping drain calls via `draining` flag.
- `start()` is idempotent — calling twice does not create duplicate intervals.
- `stop()` clears interval and is idempotent.
- Added focused test: `tests/e2e/phase89-worker-loop.spec.ts`.

### Boundaries preserved

- Loop does NOT directly call `executeSingleProcessRender`.
- Loop does NOT directly call registry mutation methods.
- Lifecycle ownership remains inside `executeRenderJob` / `executeSingleProcessRender` / harness / registry.
- No app.ts wiring — worker does not auto-start on server startup.
- No backend/server.ts changes.
- Route behavior is unchanged — POST /exports remains non-executing, POST /exports/:jobId/execute remains dev/test-gated.
- Loop status does not expose local paths, filePath, URLs, download URLs, or signed URLs.

## Phase 8.10-C — Worker Startup Factory Boundary Docs Update

- Phase 8.10-A (audit) is complete.
- Phase 8.10-B (worker startup factory boundary) is complete and committed.
- Commit message: `feat(phase-8.10): add worker startup factory boundary`.
- Phase 8.10-C is docs-only (this update).
- Phase 8.10-D (final sign-off) remains pending.

### Phase 8.10-B summary

- Added worker startup factory boundary: `backend/workers/renderWorkerStartup.ts`.
- Added startup factory function: `createRenderWorkerStartup(...)`.
- Startup factory returns controller with `start()`, `stop()`, `isRunning()`, `getStatus()` methods.
- Startup factory does NOT auto-start on creation — manual start required.
- Startup factory is gated by `FREE_AI_MIXER_ENABLE_WORKER_STARTUP=1`.
- Runtime loop also requires `FREE_AI_MIXER_ENABLE_WORKER_LOOP=1`.
- Default poll interval remains `2000` ms via `FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS`.
- Startup factory wraps/reuses `createRenderWorkerLoop(...)` — does NOT duplicate loop logic.
- Startup factory does NOT call `setInterval`, `drainRenderWorkerOnce`, or `executeRenderJob` directly.
- Added focused test: `tests/e2e/phase810-worker-startup.spec.ts`.

### Boundaries preserved

- Startup factory does NOT directly call `executeSingleProcessRender`.
- Startup factory does NOT directly call registry mutation methods.
- Lifecycle ownership remains in `createRenderWorkerLoop` → `drainRenderWorkerOnce` → `executeRenderJob` → harness/registry.
- No app.ts wiring — worker startup factory is not wired to server startup.
- No server.ts changes.
- Route behavior is unchanged — POST /exports remains non-executing, POST /exports/:jobId/execute remains synchronous with timeout.
- No route enqueue behavior.
- Startup status does not expose local paths, filePath, URLs, download URLs, or signed URLs.

## Phase 8.12-C — Backend Dependency Composition Module Docs Update

Status:

- Phase 8.12-A (audit) is complete.
- Phase 8.12-B (backend dependency composition module) is complete and committed.
- Phase 8.12-C is docs-only (this update).
- Phase 8.12-D (final sign-off) remains pending.

### Phase 8.12-B summary

- Added backend dependency composition boundary: `backend/composition/backendDependencies.ts`.
- Added composition function: `createBackendDependencies()`.
- `createBackendDependencies()` returns:
  - `registry`: InMemoryExportJobRegistry instance
  - `rendererAdapter`: createRemotionRendererAdapter({ runtime: undefined }) — safe no-op default
  - `pathPolicy`: RenderOutputPathPolicy using backend-local temp/output roots
- pathPolicy uses `process.cwd()`-based roots: `.free-ai-mixer-temp` and `.free-ai-mixer-output`.
- Added focused test: `tests/e2e/phase812-backend-dependencies.spec.ts`.

### Intentional boundary: dependencies composed but NOT wired to router

- rendererAdapter and pathPolicy are composed but NOT passed into createExportRouter in this phase.
- app.ts passes only `dependencies.registry` into createExportRouter.
- This preserves existing execute-route behavior: POST /exports/:jobId/execute returns 501 (not-configured) when dependencies are missing.
- No route behavior change — POST /exports remains non-executing.

### Boundaries preserved

- backend/routes/exports.ts was NOT changed.
- backend/server.ts was NOT changed.
- No worker lifecycle wiring added.
- No createRenderWorkerStartup call from app.ts.
- No createRenderWorkerLoop call from app.ts.
- No graceful shutdown integration.
- No process signal handlers.
- No route enqueue behavior.
- No queue persistence.
- No cancellation.
- No frontend changes.
- No artifact hosting.
- No download URLs.
- No signed URLs.
- No local path leakage in public route responses.

### Phase 8.11-B was safely stopped

- Phase 8.11-B correctly stopped because app.ts lacked rendererAdapter/pathPolicy.
- Phase 8.12-A audit found dependency composition was ready.
- Phase 8.12-B created a small composition module without changing route behavior.

### Deferred items tracked in known-issues.md

- rendererAdapter/pathPolicy composed but not wired into exports router yet.
- Worker lifecycle still not wired into app.ts.
- No graceful shutdown integration yet.
- No production auto-start yet.
- No route enqueue behavior yet.
- No durable queue/persistence yet.
- No cancellation yet.
- No frontend async worker integration yet.
- process.cwd()-based roots are acceptable for dev/test but may need env override before production.

## Phase 8.13-C — Worker Lifecycle App Wiring Docs Update

Status:

- Phase 8.13-A (audit) is complete.
- Phase 8.13-B (worker lifecycle app wiring) is complete and committed.
- Phase 8.13-C is docs-only (this update).
- Phase 8.13-D (final sign-off) remains pending.

### Phase 8.13-B summary

- Added worker lifecycle module: `backend/workers/renderWorkerLifecycle.ts`.
- Added lifecycle factory function: `createRenderWorkerLifecycle(...)`.
- Lifecycle API returns controller with:
  - `init()` — initializes worker startup factory
  - `shutdown()` — stops worker loop and releases resources
  - `isRunning()` — returns boolean running state
  - `getStatus()` — returns detailed status object
- Lifecycle chain: `createRenderWorkerLifecycle` → `createRenderWorkerStartup` → `createRenderWorkerLoop` → `drainRenderWorkerOnce` → `executeRenderJob` → `executeSingleProcessRender` → harness/registry.
- App wiring added in `backend/app.ts`:
  - Uses already-composed `backendDeps` (registry, rendererAdapter, pathPolicy)
  - Calls `lifecycle.init()` during app creation
  - Lifecycle is stored internally: `app.locals.renderWorkerLifecycle = lifecycle`
- Lifecycle remains internal/test/dev accessible only.
- No public lifecycle route or status endpoint added.

### Environment gates preserved

- `FREE_AI_MIXER_ENABLE_WORKER_STARTUP=1` is still required to enable worker startup.
- `FREE_AI_MIXER_ENABLE_WORKER_LOOP=1` is still required to enable worker loop.
- `FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS` still defaults to 2000 ms.
- `lifecycle.init()` is harmless when env flags are disabled (no-op).

### Intentional boundary: rendererAdapter/pathPolicy NOT wired to exports router

- `backend/app.ts` passes only `backendDeps.registry` into `createExportRouter`.
- `rendererAdapter` and `pathPolicy` are composed for lifecycle but NOT passed into exports router.
- `backend/routes/exports.ts` was NOT changed.
- `POST /exports` remains non-executing.
- `POST /exports/:jobId/execute` remains dev/test-gated with timeout protection.
- No route response shape changed.

### Boundaries preserved

- `backend/server.ts` was NOT changed.
- No process signal handlers added.
- No `server.close` graceful shutdown wiring added.
- No durable queue/persistence added.
- No Redis/database queue added.
- No scheduler added.
- No cancellation added.
- No frontend changes added.
- No artifact hosting added.
- No download URLs added.
- No signed URLs added.
- No local path exposure in public route responses.
- No fake progress/success/artifacts added.

### Phase 8.12 test update note

- Phase 8.12 originally required app.ts to not start worker lifecycle.
- Phase 8.13-B intentionally added lifecycle app wiring.
- Phase 8.12 test was updated to preserve the lower-level boundary instead:
  - app.ts must NOT directly call `createRenderWorkerStartup`, `createRenderWorkerLoop`, or `drainRenderWorkerOnce`.
  - app.ts must still NOT pass `rendererAdapter`/`pathPolicy` into `createExportRouter`.

### Deferred items (unchanged from 8.12)

- No server.ts shutdown wiring yet.
- No SIGINT/SIGTERM handlers yet.
- No route enqueue behavior yet.
- No durable queue/persistence yet.
- No cancellation yet.
- No frontend async worker integration yet.
- Worker lifecycle depends on env gates and in-memory registry only.
- rendererAdapter/pathPolicy are composed for lifecycle but still intentionally not wired into exports router.

## Phase 8.14-C — Truthful GET Status Docs Update

Status:

- Phase 8.14-A (enqueue behavior audit) is complete.
- Phase 8.14-A2 (GET status truthfulness audit) is complete.
- Phase 8.14-B (truthful GET status implementation) is complete and committed.
- Phase 8.14-C is docs-only (this update).
- Phase 8.14-D (final sign-off) remains pending.

### Phase 8.14-A finding: POST /exports already acts as enqueue boundary

- POST /exports creates a job with status "submitted" in the registry.
- Worker lifecycle drains submitted jobs when enabled via env flags.
- POST /exports does NOT claim rendering started, progress, success, or return artifacts.
- POST /exports already behaves as an enqueue entrypoint when worker flags are enabled.
- No route code change was needed for enqueue behavior.

### Phase 8.14-A2 finding: GET status was a truthfulness bug

- GET /exports/:jobId previously always returned `kind: "pending"`.
- This was misleading when registry status was success, error, or expired.
- Phase 8.14-B fixed GET to return truthful status mapping.

### Phase 8.14-B implementation summary

- Added `mapRecordToPollResponse()` helper in `backend/routes/exports.ts`.
- Updated `backend/contracts/exportHttpTypes.ts` — `ExportPollResponseBody` now allows full `ExportPollResult` union.
- GET status now maps registry status truthfully.

### GET status mapping

- `submitted`, `rendering`, `finalizing` → `kind: "pending"` with handle
- `success` → `kind: "terminal_success"` with result and artifact metadata
- `error` → `kind: "terminal_failure"` with failure message and code
- `expired` → `kind: "terminal_failure"` with expired message and code

### Success response safety

- `terminal_success` returns safe artifact metadata only:
  - `id` (from artifactId)
  - `status: "ready"`
  - `bytes` (optional, from sizeBytes)
  - `completedAt`
- No local file paths, filePath, path, url, downloadUrl, or signedUrl.
- Artifact hosting and download URLs remain deferred.

### Failure response safety

- `terminal_failure` returns only safe public fields:
  - `message`
  - `code`
  - `jobId`
- `failure.details` is intentionally NOT returned to prevent leak risk.
- No stack traces, local paths, URLs, or internal details.

### Route boundaries preserved

- POST /exports remains unchanged (returns accepted_job, creates submitted job).
- POST /exports/:jobId/execute remains dev/test-gated:
  - Returns 503 when `FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION` is not set.
  - Returns 501 when enabled but rendererAdapter/pathPolicy not configured in router.
- rendererAdapter/pathPolicy are still NOT passed into createExportRouter.
- backend/app.ts and backend/server.ts were not changed.
- No public lifecycle/status route added.
- No artifact hosting, signed URLs, or download URLs added.
- No frontend changes added.
- No durable queue/persistence added.
- No cancellation added.

### Worker/enqueue boundary (unchanged from 8.13)

- Worker processing remains env-gated:
  - `FREE_AI_MIXER_ENABLE_WORKER_STARTUP=1` required.
  - `FREE_AI_MIXER_ENABLE_WORKER_LOOP=1` required.
- Worker lifecycle remains in-memory only.
- Durable queue/persistence remains deferred.
- Frontend async worker integration remains deferred.

### Phase 8.14 test additions

- Added `tests/e2e/phase814-get-status-truthful.spec.ts` (10 tests).
- Tests verify truthful status mapping, no path leakage, no failure.details in terminal_failure.
- All focused tests pass along with regression coverage for phase63/813/812/810/89/88/87/86/85.

## Phase 8.15-C — Registry Interface Boundary Docs Update

Status:

- Phase 8.15-A (durable queue/persistence strategy audit) is complete.
- Phase 8.15-B (registry interface boundary) is complete and committed.
- Phase 8.15-C is docs-only (this update).
- Phase 8.15-D (final sign-off) remains pending.

### Phase 8.15-A finding: durable persistence not ready for real storage yet

- Current InMemoryExportJobRegistry is clean enough to serve as one implementation behind a registry interface.
- The safest next step is interface separation only — no real storage.
- Recommended progression: interface boundary → JSON file → SQLite → Postgres (if multi-instance needed).
- No JSON/SQLite/Postgres/Redis in this phase.

### Phase 8.15-B implementation summary

- Refactored registry structure into interface/implementation separation.
- `backend/registry/exportJobRegistry.ts` now exports only:
  - `ExportJobRegistry` interface
  - Related types (`CreateExportJobInput`, `ExportJobTransitionOptions`, `ExportJobClaimOptions`)
  - `ExportJobTransitionError` class
  - `validateArtifactMetadata` helper (re-exported)
  - `InMemoryExportJobRegistry` (re-exported for backwards compatibility)
- `backend/registry/inMemoryExportJobRegistry.ts` now contains:
  - `InMemoryExportJobRegistry` class implementing `ExportJobRegistry`
  - All internal validation and helper functions
- `backend/composition/backendDependencies.ts` now:
  - Imports `InMemoryExportJobRegistry` from the implementation file
  - Returns `registry: ExportJobRegistry` (interface type, not concrete class)

### Interface boundary benefits

- Future durable persistence adapters can implement `ExportJobRegistry` without changing consumers.
- `createBackendDependencies` can inject different registry implementations.
- Clean separation between interface contract and storage implementation.

### What was NOT added

- No JSON file persistence.
- No SQLite, Postgres, or Redis.
- No filesystem job storage.
- No recovery semantics or startup recovery.
- No idempotency persistence across restarts.
- No durable claim/lease persistence.
- No artifact metadata persistence to disk.
- No route, worker, app, server, or frontend changes.

### Current state (still in-memory only)

- requestId idempotency is process-local only.
- Claims and claim TTL are in-memory only.
- Submitted/rendering/finalizing jobs do not survive server restart.
- Artifact metadata is in-memory only.
- Worker lifecycle is env-gated and in-memory only.

### Phase 8.15 test additions

- Added `tests/e2e/phase815-registry-interface.spec.ts` (15 tests).
- Tests verify interface/implementation separation, behavior preservation, no storage code added.
- All focused tests pass along with regression coverage for phase814/813/812/89/88.

### Deferred items (unchanged scope)

- No JSON/SQLite/Postgres/Redis adapter yet.
- No restart recovery semantics yet.
- No durable requestId idempotency yet.
- No durable worker claim/lease persistence yet.
- No durable artifact metadata persistence yet.
- No graceful shutdown yet.
- No cancellation yet.

## Phase 8.16-C — Graceful Shutdown Helper Docs Update

Status:

- Phase 8.16-A (graceful shutdown/worker stop audit) is complete.
- Phase 8.16-B (shutdown helper boundary) is complete and committed.
- Phase 8.16-C is docs-only (this update).
- Phase 8.16-D (final sign-off) remains pending.

### Phase 8.16-A finding: worker lifecycle has shutdown but no server coordination

- `renderWorkerLifecycle.shutdown()` already exists and stops worker loop.
- shutdown() is synchronous, idempotent, and safe.
- No HTTP server shutdown coordination existed.
- No process signal handlers existed.
- Safe next step: create a testable shutdown helper boundary first.

### Phase 8.16-B implementation summary

- Added graceful shutdown helper: `backend/lifecycle/gracefulShutdown.ts`.
- Added factory function: `createGracefulShutdown(...)`.
- Shutdown helper API returns controller with:
  - `shutdown()` — idempotent shutdown
  - `isShuttingDown()` — current shutdown state
  - `getStatus()` — safe status object
- Helper accepts explicit dependencies:
  - `lifecycle` — lifecycle controller
  - `server` (optional) — server-like object with `close()`
- Helper behavior:
  - Calls `lifecycle.shutdown()` to stop worker polling
  - Calls `server.close()` if server provided
  - Tolerates missing server or never-running lifecycle
  - Supports callback-style server.close
  - Status is safe (no local paths/URLs)

### What was NOT added

- No backend/server.ts wiring added yet.
- No process.on("SIGINT") handler.
- No process.on("SIGTERM") handler.
- No process.exit() call.
- No public shutdown/status route.
- No job registry state mutation on shutdown.
- No jobs marked error/expired/cancelled on shutdown.
- No render cancellation.
- No bounded in-flight render wait.
- No persistence/recovery.

### Current shutdown model (helper boundary only)

- Graceful shutdown helper provides a safe coordination layer.
- Future server.ts wiring should use this helper.
- Real process signal handling remains deferred.
- Graceful shutdown currently stops future polling through lifecycle.shutdown.
- In-flight renders are not cancelled.
- Job state recovery remains deferred until durable persistence/recovery design exists.

### Phase 8.16 test additions

- Added `tests/e2e/phase816-graceful-shutdown.spec.ts` (12 tests).
- Tests verify shutdown helper API, idempotency, no process handlers, no registry mutations.
- All focused tests pass along with regression coverage for phase815/813.

### Deferred items (unchanged scope)

- No server.ts shutdown wiring yet.
- No SIGINT/SIGTERM handlers yet.
- No process-level graceful shutdown yet.
- No bounded in-flight render wait/cancellation yet.
- No durable recovery semantics yet.
- No persistence-backed shutdown recovery yet.
- No cancellation yet.

## Phase 8.17-C — Server Shutdown Wiring Docs Update

Status:

- Phase 8.17-A (server shutdown wiring audit) is complete.
- Phase 8.17-B (server shutdown wiring implementation) is complete and committed.
- Phase 8.17-C is docs-only (this update).
- Phase 8.17-D (final sign-off) remains pending.

### Phase 8.17-A finding: server.ts needs shutdown coordination

- backend/server.ts had no graceful shutdown coordination.
- No SIGINT/SIGTERM handlers existed.
- Importing server.ts would auto-start port 8787.
- Safe next step: export startServer(...) with proper shutdown wiring.

### Phase 8.17-B implementation summary

- Updated backend/server.ts with startServer(...) factory.
- startServer(...) creates Express app using createApp().
- startServer(...) starts HTTP server on configurable port.
- startServer(...) uses app.locals.renderWorkerLifecycle.
- startServer(...) creates graceful shutdown coordination using createGracefulShutdown(...).
- startServer(...) registers SIGINT/SIGTERM handlers when registerSignals: true.
- startServer(...) returns controller with:
  - app
  - server
  - shutdown()
  - isShuttingDown()
  - getStatus()
  - cleanupSignalHandlers()
- backend/server.ts no longer auto-starts when imported by tests.
- Only startServer(...) calls app.listen.

### Signal handler behavior

- SIGINT/SIGTERM wiring handled through server startup.
- Signal handlers call shutdown() on gracefulShutdown controller.
- cleanupSignalHandlers() exists for test cleanup.
- Duplicate handler registration prevented via registeredSignals Set.
- Tests use port: 0 and registerSignals: false for safe isolation.

### What was NOT added

- No process.exit() call.
- No public shutdown/status route.
- No route behavior changed.
- No backend/app.ts changes.
- No worker internals changed.
- No registry behavior changed.
- No job state mutation on shutdown.
- No jobs marked error/expired/cancelled on shutdown.
- No render cancellation.
- No bounded in-flight render wait.
- No persistence/recovery.

### Phase 8.17 test additions

- Added tests/e2e/phase817-server-shutdown-wiring.spec.ts (11 tests).
- Tests verify startServer API, lifecycle shutdown, idempotency, signal cleanup.
- Tests use port: 0 for OS-assigned ephemeral port.
- All focused tests pass along with regression coverage for phase816/813.

### Deferred items (unchanged scope)

- No process.exit() yet.
- No public shutdown/status route yet.
- No bounded in-flight render wait/cancellation yet.
- No durable recovery semantics yet.
- No persistence-backed shutdown recovery yet.
- Shutdown stops polling/server intake but does not recover jobs after restart.
- No artifact hosting/download/signed URLs.
- No frontend changes.

## Phase 8.18-C — Recovery Policy Boundary Docs Update

Status:

- Phase 8.18-A (restart recovery/persistence adapter audit) is complete.
- Phase 8.18-B (recovery policy boundary implementation) is complete and committed.
- Phase 8.18-C is docs-only (this update).
- Phase 8.18-D (final sign-off) remains pending.

### Phase 8.18-A finding: restart recovery is high-risk without recovery policy

- Restart recovery is not ready for full JSON adapter implementation.
- ExportJobRegistry interface boundary is ready for persistence adapter.
- But first a recovery policy boundary is needed so future adapters use the same safe rules.
- No real storage in Phase 8.18-B.
- No startup recovery in Phase 8.18-B.
- No filesystem writes in Phase 8.18-B.
- Safe next step: add recovery policy boundary only.

### Phase 8.18-B implementation summary

- Added restart recovery policy module: backend/registry/exportJobRecoveryPolicy.ts.
- Added recovery policy APIs:
  - recoverExportJobRecord(record, options?) — applies recovery rules to single record
  - recoverExportJobRecords(records, options?) — applies recovery rules to batch
  - getRecoverableRecords(records) — filters non-terminal records
  - getTerminalRecords(records) — filters terminal records
- Recovery rules implemented:
  - submitted stays submitted (already recoverable)
  - rendering recovers to submitted (worker died, claim expired)
  - finalizing recovers to submitted (worker died, claim expired)
  - success remains success (terminal)
  - error remains error (terminal)
  - expired remains expired (terminal)
- recovered rendering/finalizing records clear claimedByWorkerId and claimExpiresAt
- attemptCount is preserved
- requestId/jobId/timelineId/renderSettings are preserved
- original records are not mutated (clone-based)
- RecoveredExportJobRecord result includes record, recovered flag, and reason

### What was NOT added

- No JSON persistence adapter.
- No filesystem storage.
- No SQLite/Postgres/Redis.
- No env flags.
- No startup recovery logic.
- No graceful shutdown persistence flush.
- No route behavior changes.
- No worker behavior changes.
- No app.ts changes.
- No server.ts changes.
- No registry implementation changes.
- No cancellation.
- No artifact hosting/download URLs.

### Safety boundaries preserved

- Recovery policy does not import fs.
- Recovery policy does not write files.
- Recovery policy does not import routes/workers/app/server.
- Recovery policy does not call registry lifecycle mutation methods.
- Recovery policy does not introduce failure.details.
- Recovery policy does not expose local paths/filePath/url/artifactUrl/downloadUrl/signedUrl.

### Phase 8.18 test additions

- Added tests/e2e/phase818-recovery-policy.spec.ts (18 tests).
- Tests verify recovery rules for all status transitions.
- Tests verify no filesystem I/O, no registry mutations, no path leakage.
- Tests verify clone-based behavior (original records not mutated).
- All focused tests pass.

### Deferred items (unchanged scope)

- No JSON persistence adapter yet.
- No startup recovery yet.
- No persistence flush on graceful shutdown yet.
- No durable requestId idempotency yet.
- No durable claim/lease persistence yet.
- No artifact metadata persistence yet.
- No cancellation yet.
- Future JSON persistence adapter should use this recovery policy.

## Phase 8.19-C — JSON File Persistence Adapter Docs Update

Status:

- Phase 8.19-A (JSON persistence adapter audit) is complete.
- Phase 8.19-B (JSON persistence adapter implementation) is complete and committed.
- Phase 8.19-C is docs-only (this update).
- Phase 8.19-D (final sign-off) remains pending.

### Phase 8.19-A finding: JSON adapter is safe and ready

- ExportJobRegistry interface is ready for persistence adapter.
- Phase 8.18 recovery policy provides safe recovery semantics.
- App startup order allows recovery before worker polling.
- JSON file is simplest local/dev persistence without external dependencies.
- Safe next step: add JSON file persistence adapter behind interface.

### Phase 8.19-B implementation summary

- Added JSON file persistence adapter: backend/registry/jsonFileExportJobRegistry.ts.
- JsonFileExportJobRegistry implements ExportJobRegistry interface.
- Delegation pattern: JSON adapter wraps InMemoryExportJobRegistry for lifecycle/state-machine logic.
- InMemoryExportJobRegistry remains source of truth for transitions, validation, state guards.
- JSON adapter handles persistence, hydration, recovery, snapshotting, atomic writes.

### Environment flags

- FREE_AI_MIXER_PERSISTENCE_ENABLED — enable with "true" (disabled by default).
- FREE_AI_MIXER_PERSISTENCE_FILE_PATH — optional custom file path override.
- Default persistence file: .free-ai-mixer-jobs.json in process.cwd().

### JSON schema

- version: 1
- jobs: BackendExportJobRecord[]
- requestIdToJobId: Record<string, string>
- updatedAt: ISO string

### Persistence behavior

- Loads JSON file on initialization when enabled.
- Uses versioned JSON schema.
- Persists jobs and requestId mapping.
- Atomic writes: write temp file, then rename to final file.
- Persists after each registry mutation (create, claim, markRendering, markFinalizing, markSuccess, markError, transition).
- RequestId idempotency survives restart through getByRequestId.

### Recovery-on-load

Uses Phase 8.18 recovery policy on load:
- submitted stays submitted.
- rendering recovers to submitted (worker died, claim expired).
- finalizing recovers to submitted (worker died, claim expired).
- success remains success.
- error remains error.
- expired remains expired.
- recovered rendering/finalizing records clear claimedByWorkerId and claimExpiresAt.
- attemptCount preserved.

### Safety sanitization

- No failure.details persisted — only message and code.
- Artifact metadata sanitized — only safe fields persisted:
  artifactId, jobId, kind, format, status, createdAt, sizeBytes, durationMs.
- No local path/filePath/path/url/artifactUrl/downloadUrl/signedUrl persisted.
- No artifact hosting added.
- No download URLs added.

### What was NOT added

- No production database adapter (Postgres, Redis, SQLite).
- No multi-process locking.
- No large-scale query/indexing support.
- No artifact hosting/download persistence.
- No cancellation.
- No frontend async persistence UX.
- No route behavior changes.
- No worker behavior changes.
- No app.ts changes.
- No server.ts changes.
- No gracefulShutdown.ts changes.
- No frontend changes.

### Phase 8.19 test additions

- Added tests/e2e/phase819-json-persistence.spec.ts (25 tests).
- Tests verify create/getById/getByRequestId/getByStatus.
- Tests verify requestId idempotency surviving restart.
- Tests verify claim/markRendering/markFinalizing/markSuccess/markError persistence.
- Tests verify recovery-on-load using Phase 8.18 policy.
- Tests verify sanitized failure/artifact persistence.
- Tests verify atomic write temp-file behavior.
- Tests verify .gitignore entries.
- Tests verify env-gated registry selection.
- All focused tests pass.

### Deferred items (unchanged scope)

- JSON persistence is local/dev only for now.
- No production DB adapter yet.
- No multi-process locking yet.
- No large-scale query/indexing support yet.
- No artifact hosting/download persistence yet.
- No cancellation yet.
- No frontend async persistence UX yet.

## Phase 8.20-C — Persistence Runtime Local Smoke Test Docs Update

Status:

- Phase 8.20-A (persistence runtime integration audit) is complete.
- Phase 8.20-B (persistence runtime local smoke test) is complete and committed.
- Phase 8.20-C is docs-only (this update).
- Phase 8.20-D (final sign-off) remains pending.

### Phase 8.20-A finding: persistence adapter is ready for runtime smoke

- JsonFileExportJobRegistry is already wired through createBackendDependencies.
- createApp already uses createBackendDependencies.
- Routes already use the registry.
- GET /exports/:jobId already maps status truthfully.
- No route/app/server/worker changes are needed.
- Safe next step: add focused runtime/local smoke test.

### Phase 8.20-B implementation summary

- Added runtime/local smoke test: tests/e2e/phase820-persistence-runtime-smoke.spec.ts.
- Test uses real HTTP server (app.listen on ephemeral port) + fetch.
- Test does NOT use Express app.request as HTTP client.
- Test env setup:
  - FREE_AI_MIXER_PERSISTENCE_ENABLED=true
  - FREE_AI_MIXER_PERSISTENCE_FILE_PATH=<test temp file>
  - FREE_AI_MIXER_ENABLE_WORKER_STARTUP not set (worker disabled)
  - FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION not set (execution disabled)
- Test verifies POST /exports creates accepted_job and writes persistence file.
- Test verifies persisted JSON structure: version, jobs, requestIdToJobId, updatedAt.
- Test verifies recreated app with same persistence file can GET truthful pending status.
- Test verifies requestId idempotency survives recreated app.
- Test verifies persistence disabled by default when env flag missing.
- Test verifies route execution not triggered during smoke.
- Test verifies worker lifecycle does not process jobs during smoke.
- Test verifies recovered rendering job returns truthful pending via recovery policy.
- Test cleanup: env vars restored, temp files deleted after each test.

### What was NOT added

- No backend implementation changes.
- No route behavior changes.
- No worker behavior changes.
- No app.ts/server.ts changes.
- No frontend changes.
- No artifact hosting/download URLs.
- No local path leakage.

### Phase 8.20 test additions

- Added tests/e2e/phase820-persistence-runtime-smoke.spec.ts (8 tests).
- Tests use real HTTP flow with fetch against ephemeral local server.
- Tests verify persistence through createApp + route endpoints.
- Tests verify no path/URL leakage in persisted JSON.
- All focused tests pass.

### Deferred items (unchanged scope)

- No production DB adapter yet.
- No multi-process locking yet.
- No production persistence runtime mode yet.
- No artifact hosting/download persistence yet.
- No frontend async persistence UX yet.
- No cancellation yet.

## Phase 8.21-C — Production DB Adapter Strategy Docs Update

Status:

- Phase 8.21-A (production DB adapter strategy audit) is complete.
- Phase 8.21-B (DB adapter strategy docs) is complete and committed.
- Phase 8.21-C is docs-only (this update).
- Phase 8.21-D (final sign-off) remains pending.

### Phase 8.21-A finding: DB adapter requires separate design

- Production DB is not ready for implementation.
- ExportJobRegistry interface is correct adapter boundary.
- Future DB adapter must implement ExportJobRegistry directly.
- DB adapter must NOT delegate lifecycle logic to InMemoryExportJobRegistry.
- DB adapter must implement lifecycle/state-machine logic transactionally in DB.
- JSON persistence stays dev/local only for now.
- Safe next step: document DB adapter strategy without real implementation.

### Recommended production DB direction

- PostgreSQL via PostgresExportJobRegistry implementing ExportJobRegistry directly.
- SQLite is risky for multi-process concurrency.
- JSON stays dev-only fallback.

### Recommended future env/config shape

- FREE_AI_MIXER_DB_PROVIDER=json|postgres (default: json)
- FREE_AI_MIXER_DB_ENABLED=true (enable DB mode)
- DATABASE_URL (Postgres connection string)
- FREE_AI_MIXER_DB_POOL_SIZE (optional connection pool config)
- FREE_AI_MIXER_DB_SSL (optional SSL config)

### Recommended DB schema concepts

- jobs table: jobId (UUID PK), requestId (unique), timelineId, status, attemptCount, claimedByWorkerId, claimExpiresAt, createdAt, updatedAt, completedAt, startedAt, renderingAt, finalizingAt, expiredAt, renderSettings (JSONB), failure (JSONB safe), artifacts (JSONB safe)
- artifacts table (optional): artifactId, jobId (FK), kind, format, status, sizeBytes, durationMs, createdAt
- Indexes: requestId (unique), status, claimedByWorkerId, claimExpiresAt
- No local path/filePath/URL columns

### Recommended transaction/concurrency strategy

- claim() uses SELECT FOR UPDATE to prevent race conditions
- Status transitions use optimistic locking (WHERE status = expected)
- claimExpiresAt tracked in DB, not just in-memory
- Only one worker can claim a job at a time
- Expired claims recovered via scheduled job or startup recovery

### Recovery strategy for DB mode

- On startup: SELECT jobs WHERE status IN (rendering, finalizing) AND claimExpiresAt < NOW()
- Transition recovered jobs to submitted, clear claimedByWorkerId, claimExpiresAt
- Use same Phase 8.18 recovery policy (implemented in SQL)

### RequestId/idempotency for DB

- requestId column has UNIQUE constraint
- create() uses INSERT ... ON CONFLICT DO UPDATE RETURNING
- Route-level getByRequestId check remains

### Safety boundaries for DB mode

- failure.details never persisted (only message + code)
- No path/filePath/URL columns in DB schema
- Artifacts sanitized before DB write
- markSuccess only after artifact verification
- Terminal states protected from accidental mutation

### What was NOT added

- No real DB adapter implementation.
- No DB packages (Prisma/Drizzle/Supabase/Postgres).
- No migrations.
- No DB connections.
- No schema changes.
- No JSON-to-DB migration.
- No production persistence runtime mode.
- No frontend changes.

### Deferred items (unchanged scope)

- Production DB adapter not implemented yet.
- No DB packages installed yet.
- No schema migrations yet.
- No multi-process locking yet.
- No production persistence runtime mode yet.
- No artifact hosting/download persistence yet.
- No frontend async persistence UX yet.
- JSON persistence remains dev/local only.

## Phase 8.22-B — Frontend Export Status Refresh Service Boundary

### What was added

Frontend export status refresh service boundary now exists:

- `src/store/exportStore.ts` exports `refreshExportStatus` action
- `refreshExportStatus(timelineId)` polls backend GET /exports/:jobId
- Uses existing `pollExportJob` from `src/services/exportService.ts`
- Applies result via `applyExportPollEvent` to update store state
- Returns updated `ExportTimelineState` or `undefined`
- Works with persisted jobs that have `handle.jobId` or `requestId`
- No polling loop, no automatic refresh — only manual trigger

### Frontend refresh boundary contract

```typescript
interface ExportStoreState {
  refreshExportStatus: (
    timelineId: TimelineId,
    options?: { signal?: AbortSignal },
  ) => Promise<ExportTimelineState | undefined>;
}
```

### Frontend refresh usage pattern

```typescript
// Manual refresh button click handler
const handleRefresh = async () => {
  const updated = await exportStore.getState().refreshExportStatus(timelineId);
  // Store updated, UI re-renders with latest status
};
```

### What was NOT added

- No automatic polling loop in frontend.
- No polling interval/timer implementation.
- No WebSocket/SSE real-time updates.
- No retry with backoff logic.
- No background refresh while app is in background.
- No shared worker or service worker integration.
- No optimistic UI updates before confirmation.
- No batch refresh for multiple timelines.

### Test coverage

`tests/e2e/phase822-frontend-refresh.spec.ts` verifies:
- Backend returns truthful status for persisted job (GET /exports/:jobId)
- Frontend refresh polls backend and receives valid response
- Persisted job survives backend restart (recreated app reads same file)
- Refresh works for job with handle.jobId and for reconstructed handles
- 4/4 tests passing

### Safety boundaries

- `refreshExportStatus` always uses `pollExportJob` from exportService
- No local paths/URLs exposed in frontend state
- Status mapping respects backend contract (pending/success/failure)
- No fake success/progress before actual backend confirmation
- Resume state classification happens after status refresh

## Phase 8.23-B — Persisted Export Handle Storage Boundary

### What was added

Minimal versioned frontend storage for export handles:

- `src/services/exportHandleStorage.ts` — export handle storage boundary
- `tests/e2e/phase823-export-handle-storage.spec.ts` — 15 focused tests

### Storage format

Key: `free-ai-mixer-export-handles`

```typescript
interface PersistedStore {
  version: 1;
  handles: PersistedExportHandle[];
  updatedAt: string;
}

interface PersistedExportHandle {
  timelineId: string;
  jobId: string;
  requestId: string;
  submittedAt: string;
  lastCheckedAt?: string;
}
```

### Safe persisted fields

- `timelineId` — timeline identifier
- `jobId` — backend job identifier for reconnect
- `requestId` — request identifier
- `submittedAt` — submission timestamp
- `lastCheckedAt` — optional, avoids immediate re-poll

### Fields that must never be persisted

The following are explicitly stripped by the `sanitizeHandle` allowlist:

- local paths, `filePath`, `path`, `url`, `artifactUrl`, `downloadUrl`, `signedUrl`
- `failure.details`, stack traces, provider credentials
- raw artifact blobs, backend internals, progress percentages

### Storage helper API

```typescript
saveExportHandle(handle: PersistedExportHandle): void
getExportHandle(timelineId: string): PersistedExportHandle | undefined
getAllExportHandles(): PersistedExportHandle[]
removeExportHandle(timelineId: string): void
clearAllExportHandles(): void
```

### Safety behaviors

- `localStorage` availability checked via `globalThis.localStorage` with try/catch guard
- Corrupt JSON is handled safely — returns `[]`, clears storage
- Unknown version is handled safely — returns `[]`, clears storage
- Missing required fields are ignored — handle not persisted
- Unsafe extra fields are silently stripped — not rejected
- All functions are safe-no-op when localStorage unavailable

### Test coverage

`tests/e2e/phase823-export-handle-storage.spec.ts` verifies:
- Save/get/remove/clear operations
- Upsert by timelineId
- Corrupt JSON handling
- Unknown version handling
- Missing required fields handling
- Unsafe fields stripped and not persisted
- localStorage unavailable handling
- No polling/download logic in source
- No backend/component file changes

### What was NOT added

- No automatic reconnect on load yet
- No UI reconnect button yet
- No automatic polling loop
- No React component polling
- No artifact hosting/download URLs
- No cancellation logic
- No production DB adapter
- No multi-tab coordination

### Deferred items

- Reconnect UX (loading handle + calling refreshExportStatus) not wired yet
- UI component to trigger reconnect not added yet
- Automatic polling remains deferred
- Artifact hosting/download URLs remain deferred

## Phase 8.24-B — Manual Reconnect Store Action

### What was added

Store-only manual reconnect that loads persisted handle and triggers a single refresh:

- `src/store/exportStore.ts` — added `reconnectExport(timelineId, options?)` action
- `tests/e2e/phase824-reconnect.spec.ts` — 11 focused tests

### reconnectExport behavior

```typescript
reconnectExport: async (timelineId, options) => {
  // 1. Load persisted handle from exportHandleStorage
  const persisted = getExportHandle(timelineId);
  if (!persisted) return undefined;

  // 2. Seed minimal ExportTimelineState for refreshExportStatus
  const initialState: ExportTimelineState = {
    timelineId,
    requestId: persisted.requestId,
    lifecycle: "submitted",
    handle: {
      provider: "backend_render",
      requestId: persisted.requestId,
      jobId: persisted.jobId,
      status: "submitted",
    },
    submittedAt: persisted.submittedAt,
    lastPolledAt: new Date().toISOString(),
    resumeState: "none",
  };

  // 3. Write to store
  set((state) => ({
    jobsByTimelineId: {
      ...state.jobsByTimelineId,
      [timelineId]: initialState,
    },
  }));

  // 4. Call refreshExportStatus once (single poll, not polling loop)
  const result = await get().refreshExportStatus(timelineId, options);

  // 5. Update lastCheckedAt in localStorage on success
  if (result) {
    saveExportHandle({
      ...persisted,
      lastCheckedAt: new Date().toISOString(),
    });
  }

  return result;
}
```

### Key behaviors

- Returns `undefined` if no persisted handle exists
- Seeds store with minimal state before calling refresh
- Calls `refreshExportStatus` exactly once — no polling loop
- Updates `lastCheckedAt` in localStorage after successful refresh
- Handles corrupt localStorage, network errors, and 404 gracefully
- Does not fake progress, success, artifacts, or downloads

### Test coverage

`tests/e2e/phase824-reconnect.spec.ts` verifies:
- Returns undefined when no persisted handle exists
- Loads persisted handle and seeds store
- Seeds minimal state without fake progress
- Calls refreshExportStatus once (fetch called exactly once)
- Updates lastCheckedAt after successful refresh
- Handles corrupt localStorage safely
- Handles backend 404 gracefully without throwing
- Handles network errors without throwing
- Does not add polling loop (exactly 1 fetch call)
- Source does not contain setInterval/setTimeout

### What was NOT added

- No UI reconnect button
- No automatic reconnect on app load
- No automatic polling loop
- No artifact hosting/download URLs
- No backend changes
- No route changes
- No worker changes
- No fake progress/success/artifacts/downloads

### Deferred items

- Reconnect button/UI not added yet
- Automatic reconnect on app load deferred
- Automatic polling remains deferred
- Artifact hosting/download URLs remain deferred

## Phase 8.25-B — Manual Reconnect UI Button

### What was added

Manual reconnect UI button that dispatches store action only:

- `src/store/exportStore.ts` — added `selectHasPersistedHandle` selector
- `src/components/TimelineExportPanel.tsx` — added reconnect button
- `tests/e2e/phase825-reconnect-ui.spec.ts` — 13 focused tests

### selectHasPersistedHandle selector

```typescript
export const selectHasPersistedHandle = (
  state: ExportStoreState,
  timelineId: TimelineId,
): boolean => {
  const handle = getExportHandle(timelineId);
  return !!handle;
};
```

Reads from exportHandleStorage — no state mutation, no backend call.

### Button behavior

- Shows "Reconnect export" when:
  - timelineId exists
  - persisted handle exists for that timeline
  - no current export store state exists for that timeline
  - not currently resolving
- Shows "Reconnecting..." while resolving
- Disabled while `isResolvingByTimelineId[timelineId]` is true

### Button code

```tsx
const showReconnectButton =
  !!timelineId &&
  hasPersistedHandle &&
  !hasExportStateForTimeline &&
  !isResolving;

{showReconnectButton ? (
  <button
    type="button"
    onClick={() => {
      if (!timelineId) return;
      void reconnectExport(timelineId);
    }}
    disabled={isResolving}
  >
    {isResolving ? "Reconnecting..." : "Reconnect export"}
  </button>
) : null}
```

### Test coverage

`tests/e2e/phase825-reconnect-ui.spec.ts` verifies:
- Store exposes reconnectExport and selectHasPersistedHandle
- selectHasPersistedHandle returns true when persisted handle exists
- selectHasPersistedHandle returns false when no persisted handle exists
- selectHasPersistedHandle handles corrupt localStorage safely
- TimelineExportPanel source contains reconnect button copy
- TimelineExportPanel dispatches reconnectExport from button action
- TimelineExportPanel does not import storage or service layers directly
- TimelineExportPanel does not auto-reconnect on mount
- exportStore source does not contain setInterval/setTimeout polling
- TimelineExportPanel source does not contain setInterval/setTimeout polling
- Backend files remain outside Phase 8.25-B scope

### What was NOT added

- No automatic reconnect on app load
- No automatic polling loop
- No component-level exportHandleStorage import
- No component-level exportService import
- No fake progress/success/artifacts/downloads
- No download URL UI
- No backend/route/worker changes

### Deferred items

- Automatic reconnect on app load deferred
- Automatic polling remains deferred
- Artifact hosting/download URLs remain deferred

---

## Phase 9-B — Artifact Access Contract Types Only

Status:

- complete

Scope:

- architecture-safe implementation
- contract/types only
- backend contract boundary only
- no route behavior changes
- no storage provider implementation

### Phase 9-B completion summary

- Updated `backend/contracts/exportHttpTypes.ts`
- Added `BackendArtifactAccessKind` type:
  - `signed_url` — production signed/expiring URL (not implemented)
  - `backend_stream` — backend route URL for streaming (not implemented)
  - `local_dev_stream` — local dev backend stream (not implemented)
- Added `BackendArtifactAccessDescriptor` interface
- Added `BackendArtifactAccessReadyResponse` type
- Added `BackendArtifactAccessUnavailableResponse` type with reason enum
- Added `BackendArtifactAccessResponse` union type
- Added safety comments:
  - `url` must only be backend-issued
  - `url` must never be a local filesystem path
  - `url` must never be frontend-generated
  - production `signed_url` must be signed/expiring
  - `backend_stream`/`local_dev_stream` must use backend route URL, not file path
- Tests added: `tests/e2e/phase9-artifact-access-contract.spec.ts` (10 tests)

### What was NOT added

- No storage provider implementation
- No signed URL generation
- No backend stream route
- No local dev stream route
- No download UI
- No frontend changes
- No route behavior changes
- No filePath/localPath/outputPath/absolutePath/filesystemPath fields
- No downloadUrl field
- BackendArtifactMetadata remains metadata-only (no url/path fields)
- GET /exports/:jobId/artifacts still returns 501

### Deferred items

- ArtifactStorageProvider boundary
- local dev backend stream route
- production signed URL provider
- frontend artifact access service
- frontend download UI
- auth/authorization for artifact access

---

## Phase 9-F — Artifact Access Provider Interface Only

Status:

- complete

Scope:

- architecture-safe implementation
- backend provider interface only
- contract-boundary implementation only
- no route behavior changes
- no storage provider implementation

### Phase 9-F completion summary

- Created `backend/artifacts/artifactAccessProvider.ts`
- Added `ArtifactAccessRequest` interface:
  - `jobId: string` — safe identifier only
  - `artifactId: string` — safe identifier only
  - `artifact?: BackendArtifactMetadata` — verified metadata from registry, not user input
- Added `ArtifactAccessProvider` interface with `getArtifactAccess()` method
- Returns `Promise<BackendArtifactAccessResponse>` (from Phase 9-B contract)
- Added safety comments:
  - Must not contain local filesystem paths
  - Must not contain storage credentials
  - Must not mutate job lifecycle
  - Must not call renderer/runtime/harness
  - Any url in response must be backend-issued through BackendArtifactAccessResponse
  - Local dev stream and expiring URL implementations are deferred
- Tests added: `tests/e2e/phase9-artifact-access-provider-boundary.spec.ts` (13 tests)

### What was NOT added

- No provider implementation (not-configured, local dev, production)
- No route wiring
- No signed URL generation
- No local file serving
- No storageKey added to BackendArtifactMetadata
- No filePath/localPath/outputPath/absolutePath/filesystemPath fields
- No downloadUrl
- No renderer/harness/runtime imports
- No frontend changes

### Lifecycle-neutral rule

- ArtifactAccessProvider must NOT call registry.markSuccess/markError/transition
- Provider is access-only, not lifecycle-mutating
- Registry remains the source of truth for job status

### Renderer-neutral rule

- ArtifactAccessProvider must NOT import backend/renderer files
- Provider must NOT call renderer adapter, harness, or runtime
- Renderer produces artifacts; provider serves access

### Route-neutral rule

- ArtifactAccessProvider must NOT import backend/routes files
- Provider is standalone interface, route integration deferred to later phase

### Deferred items

- not-configured provider implementation
- route access audit/implementation
- local dev backend stream route
- production signed URL provider
- frontend artifact access service
- frontend download UI
- auth/authorization for artifact access
