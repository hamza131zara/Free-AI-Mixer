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

- not-configured provider implementation (completed in Phase 9-J)
- route access audit/implementation
- local dev backend stream route
- production signed URL provider
- frontend artifact access service
- frontend download UI
- auth/authorization for artifact access

---

## Phase 9-J — Not-Configured Artifact Access Provider Implementation

Status:

- complete

Scope:

- backend-only implementation
- no route behavior changes
- no dependency wiring
- no storage provider implementation

### Phase 9-J completion summary

- Created `backend/artifacts/notConfiguredArtifactAccessProvider.ts`
- Added `createNotConfiguredArtifactAccessProvider` factory
- Factory returns `ArtifactAccessProvider`-compliant object with `getArtifactAccess` method
- `getArtifactAccess` returns truthful `artifact_access_unavailable` response:
  - `kind: "artifact_access_unavailable"`
  - `reason: "artifact_access_not_configured"`
  - `message: "Artifact access is not configured. A storage provider must be configured before artifacts can be accessed."`
- Response does NOT include `url` or `access` descriptor
- Tests added: `tests/e2e/phase9-not-configured-provider.spec.ts` (15 tests)

### What was NOT added

- No route wiring
- No dependency composition wiring
- No storage provider implementation
- No signed URL generation
- No local file serving
- No URL in response
- No access descriptor in response
- No renderer/harness/runtime imports
- No fs/path imports
- No frontend changes

### Deferred items

- route access audit/implementation (completed in Phase 10-B)
- provider dependency wiring to app/router
- local dev backend stream route
- production signed URL provider
- frontend artifact access service
- frontend download UI
- auth/authorization for artifact access

---

## Phase 10-B — Artifact Access Route Implementation

Status:

- complete

Scope:

- backend-only implementation
- access route only
- no storage provider
- no signed URL generation
- no file serving

### Phase 10-B completion summary

- Updated `backend/routes/exports.ts`
- Added new route: `GET /exports/:jobId/artifacts/:artifactId/access`
- Added optional `artifactAccessProvider?: ArtifactAccessProvider` to `ExportRouterOptions`
- Route defaults to `createNotConfiguredArtifactAccessProvider()` when no provider injected
- No app.ts wiring added
- No dependency composition wiring added
- Tests added: `tests/e2e/phase10-artifact-access-route.spec.ts` (16 tests)

### Route validation behavior

- Unknown job → `{ kind: "artifact_access_unavailable", reason: "job_not_found" }`
- Non-successful job → `{ kind: "artifact_access_unavailable", reason: "job_not_successful" }`
- Unknown artifact → `{ kind: "artifact_access_unavailable", reason: "artifact_not_found" }`
- Not-ready artifact → `{ kind: "artifact_access_unavailable", reason: "artifact_not_ready" }`
- Successful ready artifact with default provider → `{ kind: "artifact_access_unavailable", reason: "artifact_access_not_configured" }`
- Provider errors safely map to `artifact_access_not_configured` (no stack/details leak)

### Provider fallback behavior

- Uses injected provider if provided via `ExportRouterOptions.artifactAccessProvider`
- Defaults to `createNotConfiguredArtifactAccessProvider()` when not injected
- Returns truthful "not configured" response, not fake access

### What was NOT added

- No real download/hosting capability
- No signed URL generation
- No local file streaming/serving
- No frontend download UI
- No app/dependency auto-wiring
- No storage provider implementation

### Existing routes unchanged

- `POST /exports` — unchanged
- `GET /exports/:jobId` — unchanged
- `GET /exports/:jobId/artifacts` — unchanged

### Test updates

- Old Phase 9 regression tests updated to match audited Phase 10 route wiring
- Phase 9 tests now assert safety boundaries instead of asserting route remains untouched

### Deferred items

- route provider dependency wiring to app/router
- local dev backend stream provider (prerequisite added in Phase 11-B)
- production signed URL provider
- frontend artifact access service
- frontend download UI
- auth/authorization for artifact access
- artifact access expiration/revocation
- storage provider selection

---

## Phase 11-B — Internal Artifact Storage Reference Boundary

Status:

- complete

Scope:

- internal backend type-only
- contract-boundary only
- no provider implementation
- no route changes

### Phase 11-B completion summary

- Created `backend/artifacts/internalArtifactStorageRef.ts`
- Added `InternalArtifactStorageRef` interface:
  - `filePath: string` — absolute file path to artifact
  - `rootPath: string` — root path for security validation
  - `jobSegment: string` — job segment identifier
  - `directoryPath: string` — directory containing artifact
- Added safety comments documenting internal-only rules:
  - Must NOT be exported from contracts
  - Must NOT be returned to frontend
  - Must NOT be stored in BackendArtifactMetadata
  - Must NOT be persisted in JSON registry
- Tests added: `tests/e2e/phase11-internal-artifact-storage-ref.spec.ts` (10 tests)

### Public vs internal artifact data separation

- `BackendArtifactMetadata` remains public-safe (no path fields)
- `InternalArtifactStorageRef` is internal-only (internal use only)
- Registry stores only `BackendArtifactMetadata[]`
- JSON persistence stores only safe metadata

### What was NOT added

- No path fields in BackendArtifactMetadata
- No storageKey in public metadata
- No provider implementation
- No stream route
- No app/dependency wiring

### Prerequisite for future work

- Local dev stream provider requires InternalArtifactStorageRef to locate files
- Path-root validation will use this type
- Stream route will use provider to serve files

### Deferred items

- local dev stream provider implementation (completed in Phase 11-F)
- backend stream route
- provider wiring to app/router
- path-root validation implementation
- production signed URL provider
- frontend artifact access service
- frontend download UI

---

## Phase 11-F — Local Dev Stream Provider Implementation

Status:

- complete

Scope:

- backend-only implementation
- provider only
- no route wiring
- no stream route
- no app wiring

### Phase 11-F completion summary

- Created `backend/artifacts/localDevArtifactAccessProvider.ts`
- Added `LocalDevProviderOptions` interface with injected functions:
  - `resolveArtifactStorageRef` — lookup internal storage ref from job/artifact
  - `streamUrlForArtifact` — generate backend route URL for streaming
  - `isPathWithinRoot` — validate file path is within allowed root
- Added `createLocalDevArtifactAccessProvider(options)` factory
- Provider implements `ArtifactAccessProvider` interface
- Added URL safety validation (`isSafeBackendRouteUrl`)
- Tests added: `tests/e2e/phase11-local-dev-provider.spec.ts` (20 tests)

### Provider behavior

Returns `artifact_access_ready` with `access.kind: local_dev_stream` when:
- Internal storage ref exists
- Path is within allowed root
- Verified artifact metadata exists
- Stream URL is safe (backend route, not file path)

Returns `artifact_access_unavailable` when:
- Storage ref missing → reason: `artifact_not_found`
- Artifact metadata missing → reason: `artifact_not_found`
- Path outside allowed root → reason: `artifact_not_ready`
- Stream URL unsafe → reason: `artifact_not_ready`

### URL/path safety rules

- Stream URL must be safe backend route (starts with `/exports/`)
- Rejects `file://` URLs
- Rejects Windows paths (`C:\`)
- Rejects path traversal (`..`)
- Rejects backslashes
- Never returns `filePath`, `rootPath`, `directoryPath`, `storageKey` in response

### What was NOT added

- No stream route implementation
- No route wiring
- No app/dependency wiring
- No file serving/streaming
- No file existence checking
- No frontend changes

### Deferred items

- backend stream route audit/implementation (prerequisite added in Phase 11-J)
- provider wiring to app/router
- file existence check at stream time
- production signed URL provider
- frontend artifact access service
- frontend download UI

---

## Phase 11-J — Artifact Storage Ref Resolver Boundary

Status:

- complete

Scope:

- internal backend type/interface only
- resolver boundary only
- no stream route implementation
- no file serving

### Phase 11-J completion summary

- Created `backend/artifacts/artifactStorageRefResolver.ts`
- Added `ArtifactStorageRefResolver` interface:
  - `resolve(jobId: string, artifactId: string): InternalArtifactStorageRef | undefined`
- Updated `backend/routes/exports.ts` with optional router option:
  - `artifactStorageRefResolver?: ArtifactStorageRefResolver`
- Tests added: `tests/e2e/phase11-artifact-storage-ref-resolver.spec.ts` (14 tests)

### Resolver behavior

- Maps backend-controlled jobId/artifactId to internal storage reference
- Returns `InternalArtifactStorageRef` or `undefined` if not found
- Internal-only, never exported in public contracts

### What was NOT added

- No stream route implementation
- No file serving
- No fs/path imports in route
- No app/dependency wiring

### Prerequisite for future work

- Stream route requires `ArtifactStorageRefResolver` to locate files
- Stream route will use resolver then validate path-root and file existence at stream time

----

## Phase 11-M — Backend Stream Route Implementation

Status:

- complete

Scope:

- backend route implementation only
- stream route with path validation
- no app wiring
- no frontend changes

### Phase 11-M completion summary

- Updated `backend/routes/exports.ts` with stream route:
  - Added `import { promises as fs } from "node:fs"` and `import path from "node:path"`
  - Added `GET /exports/:jobId/artifacts/:artifactId/stream` route handler
  - Optional `artifactStorageRefResolver` in router options (test-injected only)
  - 501 if resolver not configured
  - Job/artifact validation (404 for not found, non-success, not-ready)
  - Path safety via `fs.realpath` + `path.relative` root containment validation
  - File existence and `isFile()` check at stream time
  - Headers: Content-Type (format-based), Content-Disposition (safe filename), Cache-Control no-store, X-Content-Type-Options nosniff
  - Uses `response.sendFile` for streaming after validation
- Tests added: `tests/e2e/phase11-stream-route.spec.ts` (19 tests)

### Stream route behavior

**Dependency Injection:**
- Uses injected `ArtifactStorageRefResolver` to map jobId + artifactId to `InternalArtifactStorageRef`
- Dependency is test-injected only via router options — no app/server wiring yet

**Validation Pipeline:**
1. Returns 501 if `artifactStorageRefResolver` not configured
2. Returns 404 if job not found or status not "success"
3. Returns 404 if artifact not found or status not "available"
4. Resolves storage ref via `artifactStorageRefResolver.resolve(jobId, artifactId)`
5. Calls `fs.realpath()` on both filePath and rootPath to resolve symlinks
6. Uses `path.relative(rootPath, filePath)` to validate file is inside root
7. Returns 403 if path escapes root (path traversal or symlink escape attempt)
8. Calls `fs.stat()` and verifies `stat.isFile()` — returns 404 if missing, 403 if directory
9. On success: streams file using `response.sendFile()` after all validations pass

**Safe Headers:**
- Content-Type: based on artifact format (mp4→video/mp4, webm→video/webm, default→application/octet-stream)
- Content-Disposition: `attachment; filename="<sanitized-artifact-id>.<format>"`
- Cache-Control: no-store
- X-Content-Type-Options: nosniff

**Error Response Codes (no local path leakage):**
- `stream_not_configured` — resolver not injected (501)
- `job_not_found` — job doesn't exist or not successful (404)
- `artifact_not_found` — artifact doesn't exist or not available (404)
- `forbidden` — path traversal or directory accessed (403)
- `not_found` — file missing on disk (404)
- `internal_error` — realpath/stat failure (500)

All error responses use generic codes and messages — no file paths, root paths, or storage refs exposed.

### What was NOT added

- No app/dependency wiring (resolver injection via app/server)
- No static file serving (uses response.sendFile only)
- No production signed URL generation
- No frontend artifact access service
- No frontend download UI
- No signed/expiring URL provider

### Deferred items

- App/env provider wiring for stream route (resolver injection at app level)
- Auth/authorization for artifact access
- Production signed URL provider (for non-local-dev deployments)
- Frontend artifact access service
- Frontend download UI
- Production storage provider selection
- Artifact access expiration/revocation

----

## Phase 12-B — Internal In-Memory Artifact Storage Ref Store

Status:

- complete

Scope:

- backend internal component only
- store boundary only
- no app wiring
- no provider/resolver wiring
- no renderer/harness registration
- no frontend changes

### Phase 12-B completion summary

- Created `backend/artifacts/inMemoryArtifactStorageRefStore.ts`
- Added `ArtifactStorageRefStore` interface:
  - `set(jobId, artifactId, ref)` — store internal ref
  - `get(jobId, artifactId)` — retrieve ref or undefined
  - `has(jobId, artifactId)` — check existence
  - `delete(jobId, artifactId?)` — delete single or all for job
  - `clear()` — clear all refs
- Added `createInMemoryArtifactStorageRefStore` factory
- Store maps jobId + artifactId → InternalArtifactStorageRef
- Store uses private Map storage (Map<string, Map<string, InternalArtifactStorageRef>>)
- Store is process-memory only (no persistence)
- Tests added: `tests/e2e/phase12-in-memory-ref-store.spec.ts` (23 tests)

### Store behavior

- Process-memory only (Map-based, no serialization)
- Starts empty on process start
- No JSON persistence (local paths never leave process memory)
- No file existence validation (stream route owns that)
- No path safety validation (stream route owns that)
- On process restart: store is cleared, jobs become unavailable for streaming (acceptable)

### What was NOT added

- No app/server wiring
- No provider/resolver wiring to store
- No renderer/harness ref registration
- No route changes (stream route still waits for resolver)
- No frontend changes

### Deferred items

- Render harness ref registration (Phase 12-F - now implemented)
- Resolver wiring to ref store (Phase 12-G)
- Provider wiring (Phase 12-H)
- Env-gated local dev enablement (Phase 12-I)
- App/server wiring (Phase 12-I)
- Frontend artifact access service
- Frontend download UI
- Production signed URL provider
- Production storage provider selection
- Auth/authorization for artifact access

----

## Phase 12-F — Render Harness Verified Artifact Ref Registration Callback

Status:

- complete

Scope:

- backend renderer harness implementation only
- optional callback injection
- no store wiring
- no app/server/provider/resolver wiring
- no frontend changes

### Phase 12-F completion summary

- Updated `backend/renderer/singleProcessRenderHarness.ts`
- Added `VerifiedArtifactRefPayload` interface:
  - `jobId: string`
  - `artifactId: string` (from verified artifact)
  - `artifact: BackendArtifactMetadata` (safe public metadata)
  - `storageRef: InternalArtifactStorageRef` (internal paths)
- Added optional `onVerifiedArtifactRef` callback to `SingleProcessRenderHarnessInput`
- Callback is called only after `verifyRenderedArtifact` succeeds
- InternalArtifactStorageRef constructed from `resolvedOutputPath`:
  - `filePath`, `rootPath`, `jobSegment`, `directoryPath`
- Callback wrapped in try/catch (best-effort, non-blocking)
- Callback failure does not block `markFinalizing` or `markSuccess`
- Callback is NOT called on: adapter failure, verification failure, render error
- Harness does not import `inMemoryArtifactStorageRefStore` (store-implementation-neutral)
- Tests added: `tests/e2e/phase12-harness-ref-registration.spec.ts` (18 tests)

### Callback lifecycle ordering

1. Render executes successfully
2. Output path resolves
3. Renderer adapter runs
4. Artifact verification succeeds (`verification.ok === true`)
5. **Callback registration** (best-effort)
6. markFinalizing
7. markSuccess
8. Return success result

### What was NOT added

- No store/dependency wiring to harness
- No resolver/provider wiring to app
- No app/server changes
- No route behavior changes
- No public contract changes
- No JSON persistence of local paths
- No file serving changes

### Deferred items

- Wire callback to in-memory ref store (Phase 12-J - now implemented)
- BackendDependencies store ownership (Phase 12-J - now implemented)
- Resolver wiring to ref store (Phase 12-K)
- Provider wiring (Phase 12-K)
- Env-gated local dev enablement (Phase 12-L)
- App/server wiring (Phase 12-L)
- Frontend artifact access service
- Frontend download UI
- Production signed URL provider
- Production storage provider selection
- Auth/authorization for artifact access

----

## Phase 12-J — Backend Store Wiring / Ref Registration Callback Connection

Status:

- complete

Scope:

- backend-internal component only
- store ownership + callback passthrough
- no app/server/route/provider/resolver wiring
- no frontend changes

### Phase 12-J completion summary

- Updated `backend/composition/backendDependencies.ts`
- Added `artifactStorageRefStore: ArtifactStorageRefStore` to `BackendDependencies`
- Added `onVerifiedArtifactRef: (payload) => void` to `BackendDependencies`
- `createBackendDependencies()` creates one in-memory store instance
- `onVerifiedArtifactRef` callback:
  - Stores `payload.storageRef` by `jobId` + `artifactId`
  - Wrapped in try/catch (best-effort, non-blocking)
  - No logging, no path leakage
- Updated `backend/renderer/executeRenderJob.ts`
- Added optional `onVerifiedArtifactRef` to `ExecuteRenderJobInput`
- `executeRenderJob` passes callback through to `executeSingleProcessRender`
- Tests added: `tests/e2e/phase12-store-wiring.spec.ts` (17 tests)

### Store ownership behavior

- `backendDependencies.artifactStorageRefStore` is internal-only
- Process-memory only (Map-based)
- Created once at `createBackendDependencies()` call
- Cleared on process restart (acceptable - jobs unavailable)
- Never exported from public contracts

### Callback passthrough behavior

- `executeRenderJob` accepts optional `onVerifiedArtifactRef`
- If provided, forwarded to harness
- If undefined, harness callback is undefined → no registration
- Caller decides whether to pass callback

### Lifecycle ordering

1. Render executes → verification succeeds
2. Harness calls `onVerifiedArtifactRef(payload)`
3. `backendDependencies.onVerifiedArtifactRef` receives payload
4. `artifactStorageRefStore.set(jobId, artifactId, storageRef)`
5. `markFinalizing` → `markSuccess`
6. Stream route later can query store via resolver (future phase)

### What was NOT added

- No renderWorker callback wiring
- No route execution callback wiring
- No resolver wiring to store
- No provider wiring
- No env gating
- No app/server wiring
- No route options injection
- No frontend changes

### Deferred items

- RenderWorker callback wiring (Phase 12-R - now implemented)
- Route execution callback wiring (Phase 12-V - now implemented)
- Resolver wiring to ref store (Phase 12-N - now implemented)
- Provider wiring (Phase 12-O)
- Env-gated local dev enablement (Phase 12-P)
- App/server route option wiring (Phase 12-P)
- Frontend artifact access service
- Frontend download UI
- Production signed URL provider
- Production storage provider selection
- Auth/authorization for artifact access

----

## Phase 12-N — Resolver Wiring / Ref Store Query Implementation

Status:

- complete

Scope:

- backend-internal resolver ownership only
- no app/server/route/provider/env wiring
- no frontend changes

### Phase 12-N completion summary

- Updated `backend/composition/backendDependencies.ts`
- Added `artifactStorageRefResolver: ArtifactStorageRefResolver` to `BackendDependencies`
- Resolver implementation:
  - Calls `artifactStorageRefStore.get(jobId, artifactId)`
  - Returns `InternalArtifactStorageRef | undefined`
  - No filesystem access
  - No registry inspection
  - No path validation
  - Synchronous query
- Tests added: `tests/e2e/phase12-resolver-wiring.spec.ts` (16 tests)

### Resolver behavior

- Queries in-memory store only
- Returns undefined for missing refs
- No path guessing or validation
- No file existence checks
- Stream route remains final authority for realpath/root/stat validation

### API behavior

- Unchanged in this phase
- `createExportRouter` not passed resolver (app.ts unchanged)
- Stream route returns 501 (not configured) as before
- Access route returns artifact_access_unavailable as before
- Provider remains not-configured

## Phase 12-R — Worker Callback Wiring

Status:

- complete

Scope:

- Wire onVerifiedArtifactRef callback through render worker lifecycle
- BackendDependencies provides callback to createRenderWorkerLifecycle
- No route/provider/env wiring in this phase

### Phase 12-R completion summary

- Updated `backend/app.ts`:
  - Passes `backendDeps.onVerifiedArtifactRef` to `createRenderWorkerLifecycle`
- Updated `backend/workers/renderWorker.ts`:
  - Added `onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void` to `RenderWorkerOptions`
  - Passes callback to `executeRenderJob`
- Updated `backend/workers/renderWorkerStartup.ts`:
  - Passes callback through to worker loop via options spread
- Updated `backend/workers/renderWorkerLifecycle.ts`:
  - Added `onVerifiedArtifactRef` parameter to `createRenderWorkerLifecycle`
  - Passes callback to `createRenderWorkerStartup`
- Tests added: `tests/e2e/phase12-worker-callback-wiring.spec.ts` (16 tests)
- Updated tests in `phase12-store-wiring.spec.ts` and `phase12-resolver-wiring.spec.ts` to reflect worker callback now exists

### Callback flow

```
backendDeps.onVerifiedArtifactRef (best-effort callback)
    ↓
app.ts → createRenderWorkerLifecycle(onVerifiedArtifactRef)
    ↓
createRenderWorkerStartup → createRenderWorkerLoop → drainRenderWorkerOnce
    ↓
renderWorker → executeRenderJob
    ↓
singleProcessRenderHarness({ onVerifiedArtifactRef })
    ↓
[Render completes successfully]
    ↓
Artifact verification succeeds (path safety checks pass)
    ↓
onVerifiedArtifactRef(payload) called
    ↓
backendDependencies.onVerifiedArtifactRef(payload)
    ↓
artifactStorageRefStore.set(jobId, artifactId, storageRef)
```

### Callback characteristics

- **Internal only**: `backendDeps.onVerifiedArtifactRef` is passed only to `createRenderWorkerLifecycle`, not to `createExportRouter`
- **Post-verification**: Callback fires only after artifact verification succeeds in the harness
- **Best-effort**: Callback is wrapped in try/catch in backendDependencies - failures are logged but non-blocking
- **No route wiring**: Route execution does not use this callback (deferred to future phase)
- **No resolver injection**: `artifactStorageRefResolver` exists in backendDependencies but is not injected into router

### Store population behavior

- **Successful renders**: After artifact verification passes, `artifactStorageRefStore.set(jobId, artifactId, storageRef)` stores the internal storage reference
- **Failed renders**: If render fails or verification fails, callback is never called - no ref is registered
- **Process-memory**: Store is in-memory only, not persisted to disk or JSON

### API behavior (unchanged)

- Stream route (`GET /exports/:jobId/artifacts/:artifactId/stream`) returns 501 (not configured)
- Access route (`GET /exports/:jobId/artifacts/:artifactId/access`) returns `artifact_access_unavailable`
- `createExportRouter` not passed resolver or provider options
- No env gating (`FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM` not added)

### What was NOT added

- No route execution callback wiring (callback stays internal to worker lifecycle)
- No `createExportRouter` resolver/provider injection (resolver exists but not wired)
- No local dev artifact access provider
- No env-gated local dev enablement
- No frontend artifact access service
- No frontend download UI
- No production signed URL provider
- No production storage provider selection
- No auth/authorization for artifact access
- No JSON persistence of local paths

### Deferred items

- Route execution callback wiring (Phase 12-V - now implemented)
- Provider wiring (Phase 12-O)
- Env-gated local dev enablement (Phase 12-P)
- App/server route option wiring (Phase 12-P)
- Frontend artifact access service
- Frontend download UI
- Production signed URL provider
- Production storage provider selection
- Auth/authorization for artifact access

## Phase 12-V — Route Execution Callback Wiring

Status:

- complete

Scope:

- Wire onVerifiedArtifactRef callback from POST /exports/:jobId/execute into executeRenderJob
- app.ts passes backendDeps.onVerifiedArtifactRef to createExportRouter
- No provider/resolver route injection in this phase

### Phase 12-V completion summary

- Updated `backend/routes/exports.ts`:
  - Added `onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void` to `ExportRouterOptions`
  - POST /exports/:jobId/execute passes `options?.onVerifiedArtifactRef` to `executeRenderJob`
- Updated `backend/app.ts`:
  - Passes `backendDeps.onVerifiedArtifactRef` to `createExportRouter`
- Tests added: `tests/e2e/phase12-route-execution-callback-wiring.spec.ts` (16 tests)
- Updated tests in `phase12-harness-ref-registration.spec.ts`, `phase12-in-memory-ref-store.spec.ts`, `phase12-resolver-wiring.spec.ts`, `phase12-store-wiring.spec.ts`, `phase12-worker-callback-wiring.spec.ts` to reflect route execution callback now wired

### Callback flow

```
backendDeps.onVerifiedArtifactRef (best-effort callback)
    ↓
app.ts → createExportRouter({ onVerifiedArtifactRef: backendDeps.onVerifiedArtifactRef })
    ↓
POST /exports/:jobId/execute → executeRenderJob({ onVerifiedArtifactRef: options?.onVerifiedArtifactRef })
    ↓
singleProcessRenderHarness({ onVerifiedArtifactRef })
    ↓
[Render completes successfully]
    ↓
Artifact verification succeeds (path safety checks pass)
    ↓
onVerifiedArtifactRef(payload) called
    ↓
backendDependencies.onVerifiedArtifactRef(payload)
    ↓
artifactStorageRefStore.set(jobId, artifactId, storageRef)
```

### Route execution gating

- POST /exports/:jobId/execute remains dev/test-gated by `FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION`
- Setting must be "1" to enable route execution
- Existing timeout and worker limits remain unchanged

### Store population behavior

- **Successful route-triggered renders**: After artifact verification passes, route execution populates `artifactStorageRefStore`
- **Failed route-triggered renders**: If render fails or verification fails, callback is never called - no ref is registered
- Both worker-triggered and route-triggered renders use the same callback mechanism

### API behavior (unchanged)

- Stream route (`GET /exports/:jobId/artifacts/:artifactId/stream`) returns 501 (not configured)
- Access route (`GET /exports/:jobId/artifacts/:artifactId/access`) returns `artifact_access_unavailable`
- `createExportRouter` is passed `onVerifiedArtifactRef` but NOT `artifactStorageRefResolver` or `artifactAccessProvider`
- No env gating (`FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM` not added)

### What was NOT added

- No `artifactStorageRefResolver` route injection (resolver exists but not wired to router)
- No `artifactAccessProvider` wiring (provider remains not-configured)
- No env-gated local dev stream enablement
- No frontend artifact access service
- No frontend download UI
- No production signed URL provider
- No production storage provider selection
- No auth/authorization for artifact access
- No JSON persistence of local paths

### Deferred items

- Resolver route injection (Phase 12-Z - now implemented)
- Provider wiring (Phase 12-O or later)
- Frontend artifact access service
- Frontend download UI
- Production signed URL provider
- Production storage provider selection
- Auth/authorization for artifact access

## Phase 12-Z — Env-Gated Artifact Resolver Route Injection

Status:

- complete

Scope:

- Wire artifactStorageRefResolver into createExportRouter only when env-gated
- Default behavior remains disabled (stream route returns 501)
- No artifactAccessProvider wiring in this phase

### Phase 12-Z completion summary

- Updated `backend/app.ts`:
  - Added `isLocalDevArtifactStreamEnabled()` helper
  - Returns `true` only when `FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1"`
  - Added `exportRouterOptions` variable with conditional resolver injection
  - `onVerifiedArtifactRef` always passed
  - `artifactStorageRefResolver` passed only when env enabled
- Tests added: `tests/e2e/phase12-resolver-route-injection.spec.ts` (18 tests)
- Updated older Phase 12 tests to reflect Phase 12-Z behavior

### Env-gating behavior

```
app.ts
  ↓
isLocalDevArtifactStreamEnabled() checks FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1"
  ↓
exportRouterOptions:
  - onVerifiedArtifactRef: backendDeps.onVerifiedArtifactRef (always)
  - artifactStorageRefResolver: backendDeps.artifactStorageRefResolver (conditional)
  ↓
createExportRouter(backendDeps.registry, exportRouterOptions)
  ↓
Stream route:
  - If resolver exists: resolves refs from artifactStorageRefStore
  - If resolver missing: returns 501 stream_not_configured
```

### Default behavior (env disabled or unset)

- `isLocalDevArtifactStreamEnabled()` returns `false`
- `exportRouterOptions` does NOT include `artifactStorageRefResolver`
- Stream route returns: `501 { code: "stream_not_configured", message: "..." }`
- Access route returns: `artifact_access_unavailable`

### Enabled behavior (FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM=1)

- `isLocalDevArtifactStreamEnabled()` returns `true`
- `exportRouterOptions` includes `artifactStorageRefResolver`
- Stream route can resolve refs from `artifactStorageRefStore`
- Both worker-triggered and route-triggered renders populate the store

### Stream route validation (unchanged)

Stream route remains final authority for path safety:

1. Job exists → 404 (masqueraded)
2. Job status is "success" → 404 (masqueraded)
3. Artifact exists → 404
4. Artifact status is "available" → 404
5. Resolver returns `InternalArtifactStorageRef` → 404 if missing
6. `fs.realpath(rootPath)` → 500 on failure
7. `fs.realpath(filePath)` → 500 on failure
8. Root containment check (`path.relative`) → 403 if escapes
9. `fs.stat(filePath).isFile()` → 403 if not file
10. `sendFile()` called only after all validations pass

### Path leakage prevention

- Error responses use generic codes: `stream_not_configured`, `job_not_found`, `artifact_not_found`, `forbidden`, `internal_error`
- No `filePath`, `rootPath`, `directoryPath`, `jobSegment` in any error response

### What was NOT added

- No `artifactAccessProvider` wiring (provider remains not-configured)
- No auth/authorization
- No production signed URL provider
- No production storage provider selection
- No frontend artifact access service
- No frontend download UI
- No JSON persistence of local paths

### Deferred items

- Provider wiring (Phase 12-O or later)
- Frontend artifact access service
- Frontend download UI
- Production signed URL provider
- Production storage provider selection
- Auth/authorization for artifact access

## Phase 13-B — Env-Gated Local Dev Artifact Access Provider Wiring

Status:

- complete

Scope:

- backend app wiring only
- env-gated local-dev artifact access provider injection
- no route validation changes
- no frontend changes
- no public contract changes

### Phase 13-B completion summary

- Updated `backend/app.ts`
- `createLocalDevArtifactAccessProvider` is injected into `createExportRouter` only when:
  - `FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1"`
- `artifactStorageRefResolver` and `artifactAccessProvider` now share the same local-dev env gate
- `onVerifiedArtifactRef` remains always passed
- Default behavior remains disabled and not-configured

### Default behavior (env disabled or unset)

- `artifactAccessProvider` is not passed
- `artifactStorageRefResolver` is not passed
- access route falls back to `createNotConfiguredArtifactAccessProvider`
- stream route remains `stream_not_configured`

### Enabled behavior (FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM=1)

- `artifactStorageRefResolver` is injected
- `artifactAccessProvider` is injected
- `GET /exports/:jobId/artifacts/:artifactId/access` can return a safe `local_dev_stream` descriptor
- descriptor URL points to `/exports/:jobId/artifacts/:artifactId/stream`
- access route returns descriptor metadata only
- stream route remains the final validation authority

### Safety boundaries

- `local_dev_stream` access is local-dev only and opt-in
- No local filesystem paths are exposed in API responses
- No signed URLs were added
- No production storage provider was added
- No frontend artifact access or download UI was added
- No auth/authorization was added
- This phase does not claim production-ready download behavior

## Phase 14-B — Artifact Route Param Validation Fix / Local Dev Access Behavior Smoke

Status:

- complete

Scope:

- backend route behavior smoke only
- artifact route param validation fix
- no frontend changes
- no public contract changes

### Phase 14-B completion summary

- Added focused backend behavior smoke coverage in `tests/e2e/phase14-local-dev-artifact-access-behavior-smoke.spec.ts`
- Smoke uses `createExportRouter` directly
- Disabled behavior is verified:
  - `/access` remains `artifact_access_unavailable` / `artifact_access_not_configured`
  - `/stream` remains `501 stream_not_configured`
- Enabled behavior is verified:
  - `/access` can return a safe `local_dev_stream` descriptor
  - descriptor points to backend stream route
  - descriptor does not expose local filesystem paths
- Stream route remains the final validation authority
- Fixed artifact route param validation by parsing only `jobId` into the strict `jobId` parser for:
  - `GET /exports/:jobId/artifacts/:artifactId/access`
  - `GET /exports/:jobId/artifacts/:artifactId/stream`
- Strict schema remains preserved; validation was not loosened

### Safety boundaries

- No local filesystem paths are exposed in descriptor JSON
- No signed URLs were added
- No production storage provider was added
- No frontend artifact access or download UI was added
- No auth/authorization was added
- No real file streaming success case was added in this phase

## Phase 15-B â€” Positive Local Dev Artifact Stream File Smoke

Status:

- complete

Scope:

- backend stream behavior smoke only
- positive local-dev file streaming coverage
- no frontend changes
- no public contract changes

### Phase 15-B completion summary

- Added focused backend smoke coverage in `tests/e2e/phase15-positive-local-dev-stream-smoke.spec.ts`
- Smoke uses `createExportRouter` directly
- Test seeds `InMemoryExportJobRegistry` with one terminal-success job and one available `mp4` artifact
- Test creates a real temp root directory under OS temp and a real temp file inside a safe job segment directory
- Injected `artifactStorageRefResolver` returns a real `InternalArtifactStorageRef`
- `GET /exports/:jobId/artifacts/:artifactId/stream` now has positive smoke coverage for successful file-byte delivery
- Response header coverage verifies:
  - `Content-Type` includes `video/mp4`
  - `Content-Disposition` includes attachment
  - `Cache-Control` is `no-store`
  - `X-Content-Type-Options` is `nosniff`
- No Remotion or renderer runtime is involved

### Safety boundaries

- Stream route validation path remains in use for the positive smoke
- No frontend artifact access or download UI was added
- No auth/authorization was added
- No signed URLs were added
- No production storage provider was added
- This phase does not claim production-ready download behavior

## Phase 16-B - Frontend Artifact Access Service Only

Status:

- complete

Scope:

- frontend service-layer artifact access only
- frontend-local typed parsing only
- no UI changes
- no store integration
- no backend changes

### Phase 16-B completion summary

- Added frontend artifact access service function `getExportArtifactAccess(jobId, artifactId, options?)`
- Implemented in `src/services/exportService.ts`
- Service calls `GET /exports/:jobId/artifacts/:artifactId/access` only
- Service does not call `/stream`
- Service does not trigger browser download or navigation side effects
- Added frontend-local typed result model in `src/types/exportJob.ts`
- `artifact_access_unavailable` remains truthful and is not converted into ready state
- Invalid payloads, non-OK HTTP responses, and transport exceptions are handled truthfully
- Focused mocked-fetch export service tests passed

### Safety boundaries

- No frontend download UI was added
- No `TimelineExportPanel` changes were made
- No `exportStore` integration was added
- No direct `/stream` fetch or navigation was added
- No auth/authorization was added
- No signed URLs were added
- No production storage provider was added
- `local_dev_stream` remains local-dev-only and is not treated as production-ready

## Phase 17-B - Export Store Artifact Access State/Actions Only

Status:

- complete

Scope:

- frontend store-layer artifact access orchestration only
- volatile per-artifact access state only
- no UI changes
- no backend changes

### Phase 17-B completion summary

- `src/store/exportStore.ts` now tracks volatile per-artifact access state keyed by `artifactId`
- Added `requestExportArtifactAccess(timelineId, artifactId, options?)`
- Added `clearExportArtifactAccess(timelineId, artifactId?)`
- Added `selectExportArtifactAccess(...)`, `selectExportArtifactAccessStatus(...)`, and `selectExportArtifactAccessError(...)`
- Store action calls `getExportArtifactAccess(jobId, artifactId)` only
- Store action does not call `/stream`
- Store action does not trigger browser download or navigation side effects
- Ready, unavailable, and failure states remain truthful
- `AbortError` remains truthful and is rethrown
- Artifact access state is volatile only and is not persisted
- Stale artifact access state clears when export result state changes
- Focused export store tests passed

### Safety boundaries

- No frontend download UI was added
- No direct `/stream` fetch or navigation was added
- No backend changes were made
- No auth/authorization was added
- No signed URLs were added
- No production storage provider was added
- `local_dev_stream` remains local-dev-only and is not treated as production-ready

## Phase 18-B - Frontend Artifact Access UI Boundary Only

Status:

- complete

Scope:

- frontend artifact access UI boundary only
- store-dispatch rendering only
- no download/navigation behavior
- no backend changes

### Phase 18-B completion summary

- `TimelineExportPanel` now renders per-artifact artifact access UI
- Added `Check artifact access` control per artifact
- UI dispatches `requestExportArtifactAccess(timelineId, artifactId)` through `exportStore` only
- UI renders loading, ready, unavailable, and error states truthfully
- `local_dev_stream` is shown only as local-dev access state
- Component does not call services directly
- Component does not construct `/stream` URLs
- No browser download or navigation behavior was added
- No `Download` wording was added
- Focused UI tests passed
- Focused Phase 5.5 UI verification requires a fresh build first because `vite preview` serves `dist`

### Safety boundaries

- No direct `/stream` fetch or navigation was added
- No `window.open`, `location.href`, or anchor-click download behavior was added
- No backend changes were made
- No auth/authorization was added
- No signed URLs were added
- No production storage provider was added
- `local_dev_stream` remains local-dev-only and is not treated as production-ready

## Phase 19-C - Export Job Ownership Contract Boundary

Status:

- complete

Scope:

- backend export job ownership boundary only
- registry idempotency scoping only
- no auth middleware
- no frontend changes

### Phase 19-C completion summary

- Added explicit export job ownership boundary
- Backend export job records now include `ownerId` and `workspaceId`
- Registry create boundary now accepts optional owner scope
- Registry requestId idempotency is now owner/workspace-aware
- `getByRequestId(...)` now supports owner scope
- In-memory registry stores and returns ownership metadata
- The same requestId can resolve independently across different owner/workspace scopes
- Current route behavior remains preserved through a default local/dev owner scope
- Focused backend registry lifecycle tests passed

### Safety boundaries

- No auth middleware was added
- No route authorization enforcement was added
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added
- `local_dev_stream` remains local-dev-only and is not treated as production-ready

## Phase 20-B - Internal Requester Context Boundary Only

Status:

- complete

Scope:

- backend internal requester boundary only
- explicit local/dev fallback requester context only
- no auth middleware
- no route authorization enforcement

### Phase 20-B completion summary

- Added internal requester context boundary in `backend/requester/exportRequesterContext.ts`
- Added `ExportRequesterContext`
- Added explicit local/dev fallback requester context helpers:
  - `createLocalDevFallbackExportRequesterContext()`
  - `resolveExportRequesterContext(request)`
  - `isLocalDevFallbackExportRequesterContext(...)`
- Local/dev fallback currently returns:
  - `ownerId: "local-dev-owner"`
  - `workspaceId: "local-dev-workspace"`
  - `authMode: "local_dev_fallback"`
- Added owner-aware registry lookup `getByIdForOwner(jobId, ownerScope)`
- `JsonFileExportJobRegistry` now also supports `getByIdForOwner(...)`
- Ownership-blind `getById(jobId)` remains available for internal and worker flows
- Requester-facing routes now resolve fallback requester context internally
- `POST /exports` scopes `getByRequestId(...)` and `create(...)` through the fallback requester context
- `GET /exports/:jobId`, `/artifacts`, `/access`, `/stream`, and `/execute` now use `getByIdForOwner(...)` with fallback requester context
- Current unauthenticated route behavior remains preserved
- Focused tests, typecheck, and build passed

### Safety boundaries

- Requester context remains internal-only and is not part of public frontend/backend HTTP contracts
- No auth middleware was added
- No real requester/session/cookie/bearer-token extraction was added
- No route authorization enforcement was added
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added
- Local/dev fallback is compatibility-only and must not be mistaken for production auth

## Phase 21-B - Route Requester Resolver Injection / Owner-Aware Authorization Behavior Only

Status:

- complete

Scope:

- backend route requester resolver seam only
- owner-aware requester-facing route behavior only
- no real auth middleware
- no frontend changes

### Phase 21-B completion summary

- `createExportRouter(...)` now accepts optional `requesterContextResolver` in `ExportRouterOptions`
- Default requester resolver remains `resolveExportRequesterContext(...)`, preserving local/dev fallback behavior
- Added `ExportRequesterContextResolver` type in `backend/requester/exportRequesterContext.ts`
- Requester-facing route behavior is now injectable and testable with fake requester contexts
- Routes continue using owner-aware `getByIdForOwner(...)`
- Not-owned requester-facing behavior now collapses to non-revealing not-found or unavailable behavior:
  - `GET /exports/:jobId` behaves like job not found
  - `GET /exports/:jobId/artifacts` behaves like job not found
  - `/access` returns `artifact_access_unavailable` with `job_not_found` semantics
  - `/stream` returns `404 job_not_found`
- `/stream` checks ownership before artifact lookup and before resolver/filesystem work
- `artifactStorageRefResolver` is not called for not-owned stream requests
- Focused route authorization boundary tests passed
- Phase 6.2 source assertion was updated to reflect the requester resolver seam

### Safety boundaries

- No real auth middleware was added
- No real requester/session/cookie/bearer-token extraction was added
- No production route authorization using real requester identity was added yet
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added
- Injected fake requester contexts are test-only scaffolding and must not be mistaken for real auth

## Phase 22-B - Authenticated Requester Context Mode / Interface Boundary Only

Status:

- complete

Scope:

- backend requester auth-mode boundary only
- future-safe requester context types only
- no real auth extraction
- no route behavior changes

### Phase 22-B completion summary

- `ExportRequesterContext` is now a future-safe auth-mode boundary
- Supported requester auth modes now include:
  - `local_dev_fallback`
  - `authenticated_session`
  - `authenticated_token`
- Authenticated session/token requester contexts can now be represented as internal types
- `local_dev_fallback` remains explicit and compatibility-only
- Default requester resolver still returns `local_dev_fallback`
- Added requester context helpers/types in `backend/requester/exportRequesterContext.ts` for authenticated session/token context construction and type narrowing
- No real auth/session/cookie/bearer-token extraction was added
- No auth middleware was added
- No route behavior was changed
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added
- Focused requester context boundary tests passed

### Safety boundaries

- Authenticated session/token requester modes are type/interface boundaries only
- `local_dev_fallback` remains explicit and must not be treated as production auth
- No real requester identity extraction exists yet
- No real route authorization using authenticated requester identity exists yet
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 24-A - Account / Workspace / Auth Contract Boundary Only

Status:

- complete

Scope:

- backend-only account/workspace/auth contract boundary only
- future ownership/security contract shapes only
- no auth middleware
- no route behavior changes

### Phase 24-A completion summary

- Added backend-only account/workspace/auth contract boundary in `backend/auth/accountContracts.ts`
- Added minimal future-safe contracts for user/account identity, workspace, workspace membership, and workspace roles
- Explicit workspace roles are now modeled as:
  - `owner`
  - `admin`
  - `editor`
  - `viewer`
- Added authenticated requester identity mapping contract boundaries
- Provider key ownership contract is workspace-scoped
- Credit ledger ownership contract is workspace-scoped
- Artifact access and artifact storage metadata ownership contracts include workspace/job ownership
- Focused backend account/workspace/auth contract tests passed
- No real auth middleware was added
- No real session/cookie/bearer-token parsing was added
- No frontend auth UI was added
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

### Safety boundaries

- Account/workspace/auth contracts are boundary definitions only and do not imply implemented accounts or persistence
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No real requester identity extraction exists yet
- No billing/credits, BYOK encryption/storage, or route authorization implementation was added
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 25-B - Account / Workspace / Ledger / Artifact Repository Boundary Only

Status:

- complete

Scope:

- backend repository boundary only
- workspace-scoped persistence interfaces only
- no database implementation
- no route behavior changes

### Phase 25-B completion summary

- Added consolidated backend repository boundary module in `backend/repositories/repositoryContracts.ts`
- Added users/accounts repository boundary
- Added workspace repository boundary
- Added workspace membership repository boundary
- Added provider key repository boundary
- Added credit ledger repository boundary
- Added artifact record repository boundary
- Added storage ref/object metadata repository boundary
- Provider keys remain workspace-scoped
- Credit ledger entries and mutations remain workspace-scoped
- Artifact and storage records include workspace/job/artifact ownership
- Signed URL readiness now exists only as a future boundary shape
- Focused backend repository boundary tests passed
- No database implementation was added
- No Supabase client was added
- No SQL or migrations were added
- No auth middleware was added
- No frontend changes were added
- No signed URL generation was added
- No production storage provider was added

### Safety boundaries

- Repository contracts are interface boundaries only and do not imply persistence implementation
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No database persistence, BYOK encryption/storage, billing/credits implementation, or route authorization implementation was added
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 26-B - Supabase / Postgres SQL Schema Draft Only

Status:

- complete

Scope:

- backend SQL schema draft only
- Postgres/Supabase naming and constraint planning only
- no runtime database implementation
- no route behavior changes

### Phase 26-B completion summary

- Added SQL schema draft file `backend/db/schema/phase26-initial-supabase-postgres-schema.sql`
- Added focused schema text coverage in `tests/e2e/phase26-schema-draft.spec.ts`
- Draft includes the following tables:
  - `app_users`
  - `workspaces`
  - `workspace_memberships`
  - `export_jobs`
  - `artifact_records`
  - `storage_refs`
  - `provider_keys`
  - `credit_ledger`
- `app_users` includes unique auth provider/subject mapping
- `workspaces` include `created_by_user_id` ownership
- `workspace_memberships` include explicit owner/admin/editor/viewer role constraints and active/invited/disabled status constraints
- `export_jobs` include workspace/owner/request idempotency and ownership alignment
- `artifact_records` remain separate from `export_jobs`
- `storage_refs` remain separate from `artifact_records`
- `provider_keys` include encrypted payload placeholder only and no plaintext secret fields
- `credit_ledger` uses an append-only reserve/charge/refund/grant/adjustment shape with partial idempotency indexing
- No local filesystem path columns were added
- No durable signed URL columns were added
- Schema remains draft-only and was not executed
- No Supabase client or package install was added
- No database adapter or repository implementation was added
- No auth middleware was added
- No frontend changes were added
- No signed URL generation was added
- No production storage provider was added
- Focused schema draft tests passed

### Safety boundaries

- SQL schema is a draft boundary only and does not imply live database persistence
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- `app_users` to `auth.users` identity mapping remains undecided
- `export_jobs` may need later lifecycle and worker-claim parity expansion
- RLS policies remain deferred
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 27-B - Migration Folder Structure / Initial SQL Migration Draft Only

Status:

- complete

Scope:

- backend migration draft structure only
- migration-style SQL planning only
- no runtime database implementation
- no route behavior changes

### Phase 27-B completion summary

- Added migration folder structure under `backend/db/migrations/`
- Added initial migration-style SQL draft file `backend/db/migrations/0001_initial_supabase_postgres_schema.sql`
- Added focused migration draft text coverage in `tests/e2e/phase27-migration-draft.spec.ts`
- Migration draft includes the following tables:
  - `app_users`
  - `workspaces`
  - `workspace_memberships`
  - `export_jobs`
  - `artifact_records`
  - `storage_refs`
  - `provider_keys`
  - `credit_ledger`
- Ownership and idempotency constraints from the Phase 26 schema draft were preserved
- `provider_keys` preserve encrypted payload placeholder only and no plaintext secret fields
- `credit_ledger` preserves append-only reserve/charge/refund/grant/adjustment semantics
- Artifact and storage separation remains preserved
- No local filesystem path columns were added
- No durable signed URL column was added
- Migration remains draft-only and was not executed
- Supabase CLI and package setup remain deferred
- Supabase client runtime remains deferred
- Database adapter and repository implementation remain deferred
- Auth middleware remains deferred
- RLS policies remain deferred
- Frontend download or navigation behavior remains unchanged
- Focused migration draft tests passed

### Safety boundaries

- Migration SQL is a repository draft only and does not imply executed or live database persistence
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- `app_users` to `auth.users` identity mapping remains undecided
- `export_jobs` may need later lifecycle and worker-claim parity expansion
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 28-B - Supabase Environment / Config Contract Boundary Only

Status:

- complete

Scope:

- backend-only Supabase config boundary only
- dependency-free env/config parsing only
- no runtime Supabase client
- no route behavior changes

### Phase 28-B completion summary

- Added backend-only dependency-free Supabase config boundary in `backend/config/supabaseConfig.ts`
- Added explicit Supabase env key constants
- Added pure `parseSupabaseConfig(env)` parser
- Added `readSupabaseConfigFromEnv()` wrapper
- Added public/frontend-safe projection helper
- Config is disabled by default when env is missing
- Disabled mode does not throw and does not imply fake DB enablement
- Database mode only becomes valid when `FREE_AI_MIXER_ENABLE_SUPABASE_DB === "1"`
- Enabled database mode requires backend-only values when active
- `FREE_AI_MIXER_DB_PROVIDER` must be `supabase` when database mode is enabled
- Service-role key remains backend-only
- Public projection excludes service-role key, database URL, migration flags, and backend secrets
- VITE-style service-role exposure is rejected as invalid
- No Supabase package install was added
- No runtime Supabase client was added
- No migration execution was added
- No database adapter was added
- No auth middleware was added
- No route, frontend, download, or storage runtime behavior was changed
- Focused Supabase config tests passed
- Typecheck and build passed after the narrowing fix

### Safety boundaries

- Supabase config is a contract boundary only and does not imply live database runtime
- `FREE_AI_MIXER_DATABASE_URL` remains optional pending later adapter decisions
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 29-B - Supabase Client Factory Contract Boundary Only

Status:

- complete

Scope:

- backend-only Supabase client factory contract only
- no SDK install
- no runtime client creation
- no route behavior changes

### Phase 29-B completion summary

- Added backend-only Supabase client factory contract boundary in `backend/db/supabaseClientFactory.ts`
- Added unavailable client result shape
- Added future admin client handle shape
- Added client factory result shape
- Disabled config now maps to truthful unavailable/no-client result
- Invalid config now maps to truthful unavailable/no-client result
- Enabled valid config now maps to truthful `sdk_not_installed` future-handle state
- No live Supabase SDK client was created
- No `@supabase/supabase-js` package install was added
- No database connection was added
- No migration execution was added
- No database adapter or repository implementation was added
- No auth middleware or requester integration was added
- No route, frontend, download, or storage runtime behavior was changed
- Service-role key is not exposed through the public result shape
- Focused Supabase client factory tests passed

### Safety boundaries

- Supabase client factory is a contract boundary only and does not imply runtime SDK availability
- `sdk_not_installed` future-handle state must not be treated as a live Supabase client
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 30-B - Install `@supabase/supabase-js` / Backend-Only Runtime Client Factory Boundary

Status:

- complete

Scope:

- backend-only Supabase runtime client boundary only
- SDK install only
- no adapters or auth wiring
- no route behavior changes

### Phase 30-B completion summary

- Installed `@supabase/supabase-js`
- Updated `package.json` and `package-lock.json`
- Upgraded `backend/db/supabaseClientFactory.ts` from placeholder-only contract behavior to a backend-only runtime client boundary
- Disabled config still returns truthful unavailable/no-client result
- Invalid config still returns truthful unavailable/no-client result
- Enabled valid config now returns truthful `sdk_installed` factory state
- Backend-only admin SDK client handle can now be created
- No anon/browser/public client was added
- No DB probe or connection-readiness claim was added
- No migration execution was added
- No database adapter or repository implementation was added
- No auth middleware or requester integration was added
- No route, frontend, download, or storage runtime behavior was changed
- Service-role key is not exposed through the public result shape
- Phase 28 regression coverage was updated to remain Phase-30-aware after SDK install
- Focused Phase 30, Phase 29, and Phase 28 tests passed
- Typecheck and build passed before commit

### Safety boundaries

- Runtime SDK client boundary does not imply database persistence readiness
- Runtime SDK client boundary does not imply migration readiness
- Runtime SDK client boundary does not imply auth/requester readiness
- Runtime SDK client boundary does not imply storage or signed URL readiness
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 31-B - Migration Command / Script Boundary Only

Status:

- complete

Scope:

- backend-only migration workflow boundary only
- future command naming and safety rules only
- no migration execution
- no route behavior changes

### Phase 31-B completion summary

- Added backend-only migration workflow boundary in `backend/db/migrationWorkflow.ts`
- Reserved and described future manual local migration command naming
- Reserved and described future manual remote migration command naming
- Workflow boundary is explicitly non-executing
- No `package.json` migration scripts were added
- No Supabase CLI execution was added
- No migration execution was added
- No real credentials or project refs were added
- No app startup migration behavior was added
- No route migration behavior was added
- No Supabase client factory migration behavior was added
- No database adapter or repository implementation was added
- No auth middleware or requester integration was added
- No route, frontend, download, or storage runtime behavior was changed
- Phase 27 regression coverage was updated to remain Phase-30/31-aware after SDK install
- Focused Phase 31, Phase 30, Phase 29, Phase 28, and Phase 27 tests passed
- Typecheck and build passed before commit

### Safety boundaries

- Migration workflow boundary does not imply executed migrations or an active CLI workflow
- Real migration execution remains manual-only and deferred to a separately audited phase
- Reserved local and remote migration command names must not be treated as active scripts yet
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 32-B - Export Jobs Repository Adapter Only, Unwired

Status:

- complete

Scope:

- backend-only export_jobs repository adapter only
- unwired Supabase/Postgres adapter boundary only
- fake-client testing only
- no route behavior changes

### Phase 32-B completion summary

- Added unwired backend-only export_jobs repository adapter in `backend/repositories/supabaseExportJobsRepository.ts`
- Added and updated repository contract seam for export job persistence alignment
- Adapter accepts an injected Supabase-like client dependency shape
- Focused tests use fake and mocked client behavior only
- Mapping and ownership semantics are preserved for:
  - `jobId`
  - `requestId`
  - `ownerId`
  - `workspaceId`
  - `timelineId`
  - `status`
  - `attemptCount`
  - `renderSettings`
  - failure code/message fields
  - available timestamps
- Request idempotency scope is preserved using `workspaceId + ownerId + requestId`
- No live database was required
- No real credentials were required
- No migration execution was added
- No route or app startup wiring was added
- No auth or requester wiring was added
- No frontend changes were added
- No artifact, storage, billing, or credit runtime behavior was added
- TypeScript failure-field mismatch was fixed by aligning export job failure mapping with the current failure contract and not inventing `failure.retryable`
- Focused Phase 32, Phase 31, Phase 30, and Phase 25 tests passed
- Typecheck and build passed before commit

### Safety boundaries

- Export jobs repository adapter is unwired and must not be treated as active database persistence
- Adapter boundary does not imply executed migrations or live database readiness
- In-memory and JSON-backed runtime behavior remain the active default
- `export_jobs` lifecycle and worker-claim parity may need later schema or adapter refinement
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 33-B - Account / Workspace / Membership Repository Adapters Only, Unwired

Status:

- complete

Scope:

- backend-only account/workspace/membership repository adapters only
- unwired Supabase/Postgres adapter boundary only
- fake-client testing only
- no route behavior changes

### Phase 33-B completion summary

- Added unwired backend-only account/workspace/membership repository adapter in `backend/repositories/supabaseAccountWorkspaceRepository.ts`
- Added and updated repository contract seam for account/workspace persistence alignment
- Adapter accepts an injected Supabase-like client dependency shape
- Focused tests use fake and mocked client behavior only
- `app_users` mapping is preserved for:
  - `id`
  - `auth_provider` / `authProvider`
  - `auth_subject` / `authSubject`
  - `email`
  - `created_at` / `createdAt`
  - `updated_at` / `updatedAt`
- `workspaces` mapping is preserved for:
  - `id`
  - `name`
  - `created_by_user_id` / `createdByUserId`
  - `created_at` / `createdAt`
  - `updated_at` / `updatedAt`
  - `deleted_at` / `deletedAt`
- `workspace_memberships` mapping is preserved for:
  - `workspace_id` / `workspaceId`
  - `user_id` / `userId`
  - `role`
  - `status`
  - `created_at` / `createdAt`
  - `updated_at` / `updatedAt`
- Membership lookup scope is preserved using `workspaceId + userId`
- Workspace ownership semantics are preserved through `createdByUserId`
- No live database was required
- No real credentials were required
- No migration execution was added
- No route or app startup wiring was added
- No auth or requester wiring was added
- No frontend changes were added
- No provider key persistence was added
- No artifact, storage, billing, or credit runtime behavior was added
- Membership status naming risk remains for later normalization between `suspended` and `disabled`
- Focused Phase 33, Phase 32, Phase 30, and Phase 25 tests passed
- Typecheck and build passed before commit

### Safety boundaries

- Account/workspace/membership repository adapters are unwired and must not be treated as active persistence
- Adapter boundary does not imply executed migrations or live database readiness
- In-memory and JSON-backed runtime behavior remain the active default
- Auth middleware and production requester resolver remain deferred
- Membership status naming between `suspended` and `disabled` still needs later normalization at schema or contract level
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 34-B - Backend Repository Composition Boundary Only

Status:

- complete

Scope:

- backend-only repository composition boundary only
- disabled-by-default DB-backed composition selection only
- no route behavior changes
- no startup DB dependency

### Phase 34-B completion summary

- Added backend-only repository composition boundary in `backend/composition/repositoryComposition.ts`
- Updated `backend/composition/backendDependencies.ts` to expose internal `repositoryComposition`
- Composition is disabled by default
- DB-backed composition is selected only when Supabase config is explicitly enabled and valid
- Available DB-backed composition exposes lazy repository factory functions only
- Disabled or invalid config does not claim DB readiness
- No live database was required
- No real credentials were required
- No migration execution was added
- No route wiring was added
- No app startup runtime DB dependency was added
- No auth or requester wiring was added
- No frontend changes were added
- No storage, signed URL, provider key, billing, or credit runtime behavior was added
- Existing runtime behavior remains unchanged
- Focused Phase 34, Phase 33, Phase 32, and Phase 30 tests passed
- Typecheck and build passed before commit

### Safety boundaries

- Repository composition boundary does not imply active persistence or live DB readiness
- Available DB-backed composition only means lazy adapter selection is possible
- Route DB integration remains deferred
- App startup DB dependency remains deferred
- Migration execution remains deferred
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 35-B - Test-Only Route / Repository Integration Harness

Status:

- complete

Scope:

- test-only route/repository compatibility proof only
- no production route DB wiring
- no app startup DB dependency
- no route behavior changes

### Phase 35-B completion summary

- Added focused test-only route/repository integration harness in `tests/e2e/phase35-route-repository-harness.spec.ts`
- No production source code was changed
- No production route behavior was changed
- Current `POST /exports` behavior is preserved
- Current `GET /exports/:jobId` behavior is preserved
- Fake repository-shaped harness remains test-only
- No production route DB wiring was added
- No app startup DB dependency was added
- No migration execution was added
- No real database credentials were required
- No auth, requester, frontend, storage, signed URL, billing, or credit runtime wiring was added
- Focused Phase 35, Phase 34, Phase 32, and Phase 10 tests passed
- Typecheck and build passed before commit

### Safety boundaries

- Test-only route/repository harness does not imply production route DB integration
- Routes still use existing local and in-memory runtime behavior
- DB adapters remain unwired from production routes
- Migrations remain unexecuted and deferred
- `POST /exports` and `GET /exports/:jobId` are the only route semantics covered by this harness
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 36-B - Local Supabase Migration Preflight Boundary Only

Status:

- complete

Scope:

- local-only migration preflight boundary only
- manual validation requirements only
- no migration execution
- no route behavior changes

### Phase 36-B completion summary

- Updated `backend/db/migrationWorkflow.ts` with a local-only migration preflight boundary
- Added `localMigrationPreflightBoundary`
- Added `getLocalMigrationPreflightBoundary()`
- Explicitly selected `backend/db/migrations/0001_initial_supabase_postgres_schema.sql`
- Modeled manual local validation requirements only
- Added clean git status, local-only mode, no-remote-target, and no-production-credentials safety gates
- Modeled local-dev-only reset and rollback expectations
- No Supabase CLI spawning was added
- No migration execution was added
- No app startup migration behavior was added
- No route migration behavior was added
- No Supabase client factory migration behavior was added
- No route, auth, requester, frontend, storage, signed URL, billing, or credit runtime wiring was added
- Preflight boundary does not prove Supabase CLI availability, Docker readiness, or local DB readiness
- Focused Phase 36, Phase 35, Phase 31, and Phase 30 tests passed
- Typecheck and build passed before commit

### Safety boundaries

- Local migration preflight boundary does not imply executed migrations or successful local migration validation
- Local migration preflight boundary is manual-only and local-only
- Remote and production migration execution remain deferred
- Route DB integration remains deferred until local migration validation is completed in a later phase
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 37-B - Local Supabase CLI / Docker Readiness Boundary Only

Status:

- complete

Scope:

- local-only CLI and Docker readiness boundary only
- descriptive manual readiness modeling only
- no CLI, Docker, or migration execution
- no route behavior changes

### Phase 37-B completion summary

- Updated `backend/db/migrationWorkflow.ts` with a local-only CLI/Docker readiness boundary
- Added `localCliDockerReadinessBoundary`
- Added `getLocalCliDockerReadinessBoundary()`
- Documented future manual command names only:
  - `supabase --version`
  - `supabase status`
  - `supabase start`
  - `supabase stop`
  - `supabase db reset`
  - `docker --version`
  - `docker info`
- CLI readiness remains unverified by default
- Docker readiness remains unverified by default
- No process spawning was added
- No Supabase CLI execution was added
- No Docker execution was added
- No migration execution was added
- No `package.json` scripts were added
- No remote project link or target default was added
- No production credentials were added
- No app startup execution was added
- No route execution was added
- No Supabase client factory execution was added
- No route, auth, requester, frontend, storage, signed URL, billing, or credit runtime wiring was added
- Phase 31 and Phase 36 regression coverage was updated to allow descriptive manual command text while still blocking execution and process spawning
- Focused Phase 37, Phase 36, Phase 31, and Phase 30 tests passed
- Typecheck and build passed before commit

### Safety boundaries

- Local CLI/Docker readiness boundary does not imply verified Supabase CLI availability
- Local CLI/Docker readiness boundary does not imply verified Docker readiness
- Local CLI/Docker readiness boundary does not imply executed migrations or successful local validation
- Future manual commands remain separately audited before use
- Remote and production migration execution remain deferred
- `local_dev_fallback` remains compatibility-only and must not be treated as production auth
- No frontend download or navigation behavior was added
- No signed URLs were added
- No production storage provider was added

## Phase 41-D - Contract-Aligned SQL Hardening Only

Status:

- complete

Scope:

- SQL-only hardening for existing Supabase/Postgres draft files only
- no runtime code changes
- no Supabase CLI execution
- no route or app wiring

### Phase 41-D completion summary

- Updated `backend/db/migrations/0001_initial_supabase_postgres_schema.sql`
- Updated `backend/db/schema/phase26-initial-supabase-postgres-schema.sql`
- Added `export_jobs_status_check` using existing backend lifecycle statuses only:
  - `queued`
  - `submitted`
  - `rendering`
  - `finalizing`
  - `success`
  - `error`
  - `expired`
- Changed `artifact_records` identity from unique-only to composite primary key:
  - `primary key (job_id, artifact_id)`
- Added focused source-inspection coverage in `tests/e2e/phase41-sql-contract-hardening.spec.ts`
- Focused Phase 41 SQL contract hardening test passed
- Typecheck and build passed
- No Supabase CLI commands were run
- No local Supabase Docker was used
- No remote project link was added
- No migration execution was added
- No runtime DB wiring was added
- No auth, RLS, requester, frontend, storage, or signed URL runtime behavior was added

### Safety boundaries

- Contract-aligned SQL hardening does not imply active database integration
- Contract-aligned SQL hardening does not imply local Supabase Docker readiness
- Contract-aligned SQL hardening does not imply remote migration workflow readiness
- Artifact status, kind, and format checks remain deferred
- `artifact_record_id`, `gen_random_uuid()`, and `pgcrypto` remain deferred
- `credit_ledger.amount_delta bigint` remains deferred
- `storage_refs` object uniqueness hardening remains deferred
- `updated_at` trigger automation remains deferred

## Phase 41-E - Remote SQL Editor Validation Only

Status:

- complete

Scope:

- fresh remote Supabase cloud project validation only
- Supabase Dashboard SQL Editor only
- no Supabase CLI link/push/reset/migration workflow
- no runtime integration changes

### Phase 41-E completion summary

- Used `backend/db/migrations/0001_initial_supabase_postgres_schema.sql` as the remote validation source of truth
- Ran SQL manually in a fresh Supabase cloud project via the Dashboard SQL Editor
- Verified 8 expected public tables were created:
  - `app_users`
  - `workspaces`
  - `workspace_memberships`
  - `export_jobs`
  - `artifact_records`
  - `storage_refs`
  - `provider_keys`
  - `credit_ledger`
- Constraint verification returned 34 rows
- Verified `export_jobs_status_check` exists
- Verified `artifact_records_pkey` exists
- Supabase SQL Editor Results confirmed DDL success
- SQL Editor Explain tab may show syntax errors for DDL, but Results plus verification queries confirmed successful execution
- No local Supabase Docker was used
- No `supabase link`, `supabase db push`, `supabase db reset`, or `supabase migration up` was run
- No app runtime DB wiring was added
- No auth, RLS, requester, frontend, storage, or signed URL runtime behavior was added

### Safety boundaries

- Remote SQL Editor validation does not imply production DB integration is active
- Remote SQL Editor validation does not imply route DB integration is active
- Remote SQL Editor validation does not imply auth, requester, or RLS enforcement is active
- Remote SQL Editor validation does not imply Supabase CLI migration workflow readiness
- Remote SQL Editor validation does not imply local Supabase Docker readiness

## Phase 42-B - Opt-In Remote Supabase Connection Smoke Test Only

Status:

- complete

Scope:

- backend-only remote Supabase connection smoke test only
- read-only query validation only
- opt-in test execution only
- no runtime route or app wiring

### Phase 42-B completion summary

- Added `tests/e2e/phase42-remote-supabase-connection-smoke.spec.ts`
- Smoke test is backend-only and imports existing boundaries only:
  - `backend/config/supabaseConfig.ts`
  - `backend/db/supabaseClientFactory.ts`
- Smoke test is skipped by default unless `FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE=1`
- Opt-in smoke requires:
  - `FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE=1`
  - `FREE_AI_MIXER_ENABLE_SUPABASE_DB=1`
  - `FREE_AI_MIXER_DB_PROVIDER=supabase`
  - `FREE_AI_MIXER_SUPABASE_URL`
  - `FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`
- Smoke test uses backend-only service-role client creation through the existing client factory
- Smoke test runs read-only query validation against `app_users` only:
  - `select("id").limit(1)`
- Successful empty result is treated as success
- Smoke test does not use anon key
- Smoke test does not call repository adapters
- Smoke test does not insert, update, delete, upsert, or call RPC
- Smoke test does not wire routes, app runtime, or backend dependency composition
- Focused Phase 42 smoke test passed in default mode by skipping the live remote path
- Typecheck and build passed

### Safety boundaries

- Opt-in remote connection smoke does not imply production DB integration is active
- Opt-in remote connection smoke does not imply route DB integration is active
- Opt-in remote connection smoke does not imply repository adapter runtime validation is complete
- Opt-in remote connection smoke does not imply auth, requester, or RLS enforcement is active
- Service-role key remains backend-only and must not be exposed to frontend or committed files
- Remote smoke remains optional and must not be required for normal local or CI test runs

## Phase 42-C - Manual Opt-In Remote Supabase Connection Smoke Success

Status:

- complete

Scope:

- manual backend-only remote smoke execution only
- read-only remote query validation only
- local shell env usage only
- no runtime route or app wiring

### Phase 42-C completion summary

- User set required env vars locally in PowerShell only
- Ran:
  - `npm run test:e2e -- tests/e2e/phase42-remote-supabase-connection-smoke.spec.ts`
- Result:
  - `2 passed`
- Opt-in smoke successfully connected through the existing backend config and client factory boundaries
- Smoke query against `app_users` succeeded in read-only mode
- Env vars and secrets were cleared after the manual smoke
- No service-role key was committed
- No `.env` or `.env.example` changes were made
- No local Supabase Docker was used
- No `supabase link`, `supabase db push`, `supabase db reset`, or `supabase migration up` was run
- No app runtime DB persistence was activated
- No route DB wiring was added
- No repository adapter runtime wiring was added
- No auth, RLS, requester, frontend, storage, or signed URL runtime behavior was added

### Safety boundaries

- Manual opt-in remote smoke success does not imply production DB integration is active
- Manual opt-in remote smoke success does not imply route DB integration is active
- Manual opt-in remote smoke success does not imply repository adapter remote write/read behavior is validated
- Manual opt-in remote smoke success does not imply auth, requester, or RLS enforcement is active
- Manual opt-in remote smoke success does not imply local Supabase Docker readiness

## Phase 43-B - Opt-In Remote Account/Workspace Repository Smoke Test Only

Status:

- complete

Scope:

- backend-only remote repository adapter smoke only
- read-only adapter validation only
- opt-in test execution only
- no runtime route or app wiring

### Phase 43-B completion summary

- Added `tests/e2e/phase43-remote-account-workspace-repository-smoke.spec.ts`
- Smoke test is backend-only and imports existing boundaries only:
  - `backend/config/supabaseConfig.ts`
  - `backend/db/supabaseClientFactory.ts`
  - `backend/repositories/supabaseAccountWorkspaceRepository.ts`
- Smoke test is skipped by default unless `FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE=1`
- Opt-in smoke requires:
  - `FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE=1`
  - `FREE_AI_MIXER_ENABLE_SUPABASE_DB=1`
  - `FREE_AI_MIXER_DB_PROVIDER=supabase`
  - `FREE_AI_MIXER_SUPABASE_URL`
  - `FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`
- Smoke test creates backend-only service-role client through the existing client factory
- Smoke test instantiates `SupabaseAccountWorkspaceRepository` directly
- Smoke test does not use `SupabaseExportJobsRepository`
- Smoke test does not use `repositoryComposition`
- Smoke test does not wire routes, app runtime, or backend dependency composition
- Smoke test is read-only only and does not insert, update, delete, upsert, or call RPC
- Smoke test does not use anon or publishable key
- Initial real remote attempt proved remote Supabase was reached, but failed because synthetic ids were non-UUID strings against UUID columns
- Phase 43-B fix updated missing ids to UUID-shaped nonexistent values:
  - `00000000-0000-4000-8000-000000043001`
  - `00000000-0000-4000-8000-000000043002`
- Synthetic auth subject remained text-only
- Focused Phase 43 test passed in default mode by skipping the live remote path
- Typecheck and build passed

### Safety boundaries

- Opt-in remote account/workspace repository smoke does not imply production DB integration is active
- Opt-in remote account/workspace repository smoke does not imply route DB integration is active
- Opt-in remote account/workspace repository smoke does not imply repository write/read/delete cleanup behavior is validated
- Opt-in remote account/workspace repository smoke does not imply `SupabaseExportJobsRepository` remote behavior is validated
- Opt-in remote account/workspace repository smoke does not imply auth, requester, or RLS enforcement is active
- Service-role key remains backend-only and must not be exposed to frontend or committed files
- Remote repository smoke remains optional and must not be required for normal local or CI test runs

## Phase 43-C - Manual Opt-In Remote Account/Workspace Repository Smoke Success

Status:

- complete

Scope:

- manual backend-only remote repository smoke execution only
- read-only adapter validation only
- local shell env usage only
- no runtime route or app wiring

### Phase 43-C completion summary

- User set required env vars locally in PowerShell only
- Ran:
  - `npm run test:e2e -- tests/e2e/phase43-remote-account-workspace-repository-smoke.spec.ts`
- Result:
  - `2 passed`
- Opt-in smoke successfully connected through the existing backend config and client factory boundaries
- Read-only repository calls against `SupabaseAccountWorkspaceRepository` succeeded using UUID-shaped nonexistent ids for UUID columns
- Env vars and secrets were cleared after the manual smoke
- `git status` was clean after the manual smoke
- No service-role key was committed
- No `.env` or `.env.example` changes were made
- No local Supabase Docker was used
- No `supabase link`, `supabase db push`, `supabase db reset`, or `supabase migration up` was run
- No app runtime DB persistence was activated
- No route DB wiring was added
- No repository composition runtime wiring was added
- No auth, RLS, requester, frontend, storage, or signed URL runtime behavior was added

### Safety boundaries

- Manual opt-in remote account/workspace repository smoke success does not imply production DB integration is active
- Manual opt-in remote account/workspace repository smoke success does not imply route DB integration is active
- Manual opt-in remote account/workspace repository smoke success does not imply repository write/read/delete cleanup behavior is validated
- Manual opt-in remote account/workspace repository smoke success does not imply `SupabaseExportJobsRepository` remote behavior is validated
- Manual opt-in remote account/workspace repository smoke success does not imply auth, requester, or RLS enforcement is active
- Manual opt-in remote account/workspace repository smoke success does not imply local Supabase Docker readiness

## Phase 44-B - Opt-In Remote Export Jobs Repository Smoke Test Only

Status:

- complete

Scope:

- backend-only remote export jobs repository smoke only
- controlled write/read/update/exact-id cleanup validation only
- opt-in test execution only
- no runtime route or app wiring

### Phase 44-B completion summary

- Added `tests/e2e/phase44-remote-export-jobs-repository-smoke.spec.ts`
- Smoke test is backend-only and imports existing boundaries only:
  - `backend/config/supabaseConfig.ts`
  - `backend/db/supabaseClientFactory.ts`
  - `backend/repositories/supabaseExportJobsRepository.ts`
- Smoke test is skipped by default unless `FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE=1`
- Opt-in smoke requires:
  - `FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE=1`
  - `FREE_AI_MIXER_ENABLE_SUPABASE_DB=1`
  - `FREE_AI_MIXER_DB_PROVIDER=supabase`
  - `FREE_AI_MIXER_SUPABASE_URL`
  - `FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`
- Smoke test creates backend-only service-role client through the existing client factory
- Smoke test instantiates `SupabaseExportJobsRepository` directly
- Smoke test inserts prerequisite `app_users` and `workspaces` rows directly through the admin client
- Smoke test calls:
  - `upsertJob(...)`
  - `getByJobId(...)`
  - `getByIdempotencyScope(...)`
- Smoke test validates conflict-update behavior by calling `upsertJob(...)` again with the same `workspaceId + ownerId + requestId` scope
- Smoke test cleans up by exact ids only in this order:
  - `export_jobs` first
  - `workspaces` second
  - `app_users` third
- Smoke test does not use routes, app startup, `backendDependencies`, or `repositoryComposition`
- Smoke test does not use anon or publishable key
- Smoke test does not use Supabase CLI
- Smoke test does not wire runtime DB persistence
- First real remote run proved remote Supabase was reached, but failed because equivalent UTC timestamps were returned with `+00:00` instead of `Z`
- Phase 44-B fix updated timestamp assertions to compare semantically by normalized UTC value
- Exact assertions remained for:
  - `jobId`
  - `requestId`
  - `timelineId`
  - `ownerId`
  - `workspaceId`
  - `status`
  - `attemptCount`
- Focused Phase 44 test passed in default mode by skipping the live remote path
- Typecheck and build passed

### Safety boundaries

- Opt-in remote export jobs repository smoke does not imply production DB integration is active
- Opt-in remote export jobs repository smoke does not imply route DB integration is active
- Opt-in remote export jobs repository smoke does not imply repository composition runtime DB wiring is active
- Opt-in remote export jobs repository smoke validates controlled repository write/read/update/exact-id cleanup only
- Opt-in remote export jobs repository smoke does not imply auth, requester, or RLS enforcement is active
- Service-role key remains backend-only and must not be exposed to frontend or committed files
- Remote export jobs repository smoke remains optional and must not be required for normal local or CI test runs

## Phase 44-C - Manual Opt-In Remote Export Jobs Repository Smoke Success

Status:

- complete

Scope:

- manual backend-only remote repository smoke execution only
- controlled write/read/update/exact-id cleanup validation only
- local shell env usage only
- no runtime route or app wiring

### Phase 44-C completion summary

- User set required env vars locally in PowerShell only
- Ran:
  - `npm run test:e2e -- tests/e2e/phase44-remote-export-jobs-repository-smoke.spec.ts`
- Result:
  - `2 passed`
- Opt-in smoke successfully connected through the existing backend config and client factory boundaries
- Controlled `SupabaseExportJobsRepository` write/read/update behavior succeeded against the remote validated schema
- Exact-id cleanup succeeded for prerequisite and export job rows
- Env vars and secrets were cleared after the manual smoke
- `git status` was clean after the manual smoke
- No service-role key was committed
- No `.env` or `.env.example` changes were made
- No local Supabase Docker was used
- No `supabase link`, `supabase db push`, `supabase db reset`, or `supabase migration up` was run
- No app runtime DB persistence was activated
- No route DB wiring was added
- No repository composition runtime wiring was added
- No auth, RLS, requester, frontend, storage, or signed URL runtime behavior was added

### Safety boundaries

- Manual opt-in remote export jobs repository smoke success does not imply production DB integration is active
- Manual opt-in remote export jobs repository smoke success does not imply route DB integration is active
- Manual opt-in remote export jobs repository smoke success does not imply repository composition runtime DB wiring is active
- Manual opt-in remote export jobs repository smoke success validates controlled repository write/read/update/exact-id cleanup only
- Manual opt-in remote export jobs repository smoke success does not imply auth, requester, or RLS enforcement is active
- Manual opt-in remote export jobs repository smoke success does not imply local Supabase Docker readiness

## Phase 45-A - Repository Composition Runtime DB Wiring Audit Only

Status:

- complete

Scope:

- audit only for repository composition and runtime dependency boundaries
- no route DB wiring
- no runtime DB persistence activation
- no Supabase CLI or local Docker usage

### Phase 45-A audit summary

- Confirmed `repositoryComposition` already exists as a backend-only boundary
- Confirmed `createBackendDependencies()` already exposes `repositoryComposition`
- Confirmed routes and workers still use `ExportJobRegistry`
- Confirmed `SupabaseExportJobsRepository` is not a drop-in replacement for `ExportJobRegistry`
- Confirmed runtime route DB wiring is not safe yet
- Confirmed safest next step is test-only proof that repository composition remains isolated from route/runtime behavior

### Safety boundaries

- Repository composition audit does not imply route DB wiring is active
- Repository composition audit does not imply runtime DB persistence is active
- Repository composition audit does not imply auth, requester, or RLS enforcement is active
- Repository composition audit does not imply local Supabase Docker readiness

## Phase 45-B - Repository Composition Runtime Boundary Test Only

Status:

- complete

Scope:

- test-only repository composition runtime boundary verification
- default offline/in-memory behavior verification only
- no route DB wiring
- no runtime DB persistence activation

### Phase 45-B completion summary

- Added `tests/e2e/phase45-repository-composition-runtime-boundary.spec.ts`
- Test proves default backend dependency creation stays offline/in-memory when Supabase env is absent
- Test proves `readSupabaseConfigFromEnv()` resolves `enabled=false` and `valid=true` when Supabase env is cleared
- Test proves `createBackendDependencies()` returns:
  - disabled `repositoryComposition`
  - in-memory registry boundary
- Test proves `createRepositoryComposition()` remains disabled without Supabase env
- Test proves `createApp()` succeeds with no Supabase env vars and no runtime DB requirement
- Source inspection proves:
  - routes still receive `registry`
  - no `SupabaseExportJobsRepository` import in route/app wiring
  - no `SupabaseAccountWorkspaceRepository` import in route/app wiring
  - no `repositoryComposition` route wiring
  - worker lifecycle still depends on `ExportJobRegistry`
- Source inspection proves:
  - no service-role env logging
  - no Supabase CLI command usage
- Focused Phase 45 runtime boundary test passed
- Typecheck and build passed

### Safety boundaries

- Repository composition runtime boundary coverage does not imply route DB wiring is active
- Repository composition runtime boundary coverage does not imply repository composition runtime DB wiring is active
- Repository composition runtime boundary coverage does not imply runtime DB persistence is active
- Repository composition runtime boundary coverage does not imply auth, requester, or RLS enforcement is active
- Default app startup remains offline/in-memory unless a later phase explicitly wires runtime DB behavior

## Phase 46-A - ExportJobRegistry Persistence Adapter Audit Only

Status:

- complete

Scope:

- audit only for future Supabase-backed `ExportJobRegistry` adapter boundary
- no route DB wiring
- no worker DB wiring
- no runtime DB persistence activation

### Phase 46-A audit summary

- Confirmed export routes and workers depend on `ExportJobRegistry`
- Confirmed `SupabaseExportJobsRepository` is not a drop-in replacement for `ExportJobRegistry`
- Confirmed runtime DB wiring is not safe yet
- Confirmed a Supabase-backed `ExportJobRegistry` adapter boundary is required before any route/worker integration

### Safety boundaries

- ExportJobRegistry adapter audit does not imply route DB wiring is active
- ExportJobRegistry adapter audit does not imply worker DB wiring is active
- ExportJobRegistry adapter audit does not imply runtime DB persistence is active
- ExportJobRegistry adapter audit does not imply auth, requester, or RLS enforcement is active

## Phase 46-B - Supabase ExportJobRegistry Adapter Boundary Test Only

Status:

- complete

Scope:

- adapter boundary scaffold only
- focused offline/import-safe boundary verification only
- no route DB wiring
- no worker DB wiring
- no runtime DB persistence activation

### Phase 46-B completion summary

- Added `backend/registry/supabaseExportJobRegistry.ts`
- Added `tests/e2e/phase46-supabase-export-job-registry-boundary.spec.ts`
- Added `SupabaseExportJobRegistry` as a future adapter boundary
- Added `createSupabaseExportJobRegistry(...)`
- Added `supabaseExportJobRegistryBoundary` metadata
- Boundary is constructor-injected
- Boundary does not create a DB client at import time
- Boundary does not require env vars at import time
- Boundary is fail-closed:
  - `ExportJobRegistry` methods throw clear not-wired errors instead of faking lifecycle behavior
- Boundary metadata preserves required future behavior:
  - lifecycle/state-machine preservation
  - owner/workspace/requestId idempotency
  - worker claim/TTL semantics
  - conditional transitions
  - artifact sanitization
  - failure sanitization
- Tests prove:
  - adapter module imports offline with Supabase env vars cleared
  - no env/runtime DB dependency is created at import time
  - boundary metadata is present and `wired: false`
  - every registry method fails closed instead of returning fake success
  - source inspection proves:
    - no routes/app/server/composition imports
    - no Supabase CLI command usage
    - no service-role env logging
    - no `createClient(...)`
    - no config/env reads at import time
  - source inspection proves app/routes/workers are still not wired to `SupabaseExportJobRegistry`
  - routes still use `registry`
  - workers still use `ExportJobRegistry`
- Focused Phase 46 adapter boundary test passed
- Typecheck and build passed

### Safety boundaries

- SupabaseExportJobRegistry boundary coverage does not imply route DB wiring is active
- SupabaseExportJobRegistry boundary coverage does not imply worker DB wiring is active
- SupabaseExportJobRegistry boundary coverage does not imply runtime DB persistence is active
- SupabaseExportJobRegistry boundary exists but remains fail-closed and not wired
- Auth, requester, and RLS enforcement remain deferred

## Phase 47-A - Supabase ExportJobRegistry Adapter Implementation Audit Only

Status:

- complete

Scope:

- audit only for safe read-only `SupabaseExportJobRegistry` method mapping
- no route DB wiring
- no worker DB wiring
- no runtime DB persistence activation

### Phase 47-A audit summary

- Confirmed `SupabaseExportJobRegistry` can safely implement read-only mappings first
- Confirmed safe first methods are:
  - `getById`
  - `getByIdForOwner`
  - `getByRequestId` only when `ownerScope` is provided
- Confirmed mutating/lifecycle methods must remain fail-closed:
  - `create`
  - `getByStatus`
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
  - `transition`
- Confirmed no route/worker/runtime DB wiring is safe in this phase
- Confirmed no remote DB calls should be required in default tests

### Safety boundaries

- ExportJobRegistry read-only audit does not imply route DB wiring is active
- ExportJobRegistry read-only audit does not imply worker DB wiring is active
- ExportJobRegistry read-only audit does not imply runtime DB persistence is active
- ExportJobRegistry read-only audit does not imply auth, requester, or RLS enforcement is active

## Phase 47-B - Supabase ExportJobRegistry Read-Only Method Mapping

Status:

- complete

Scope:

- read-only adapter mapping only
- focused offline fake-repository verification only
- no route DB wiring
- no worker DB wiring
- no runtime DB persistence activation

### Phase 47-B completion summary

- Updated `backend/registry/supabaseExportJobRegistry.ts`
- Added `tests/e2e/phase47-supabase-export-job-registry-method-mapping.spec.ts`
- `getById(jobId)` now delegates to `jobsRepository.getByJobId(jobId)`
- `getByIdForOwner(jobId, ownerScope)` now:
  - reads by `jobId`
  - returns the job only when `ownerId` and `workspaceId` match `ownerScope`
  - returns `undefined` on ownership mismatch
- `getByRequestId(requestId, ownerScope?)` now:
  - delegates to `jobsRepository.getByIdempotencyScope(...)` only when `ownerScope` exists
  - fails closed when `ownerScope` is missing
- Mutating/lifecycle methods remain fail-closed:
  - `create`
  - `getByStatus`
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
  - `transition`
- Adapter remains constructor-injected and import-safe
- Adapter still does not create a DB client at import time
- Adapter still does not read env vars at import time
- Adapter still does not log service-role keys
- Adapter still does not use Supabase CLI
- Source inspection proves app/routes/workers are not wired to `SupabaseExportJobRegistry`
- Focused Phase 47 method mapping test passed
- Typecheck and build passed

### Safety boundaries

- SupabaseExportJobRegistry read-only mapping does not imply route DB wiring is active
- SupabaseExportJobRegistry read-only mapping does not imply worker DB wiring is active
- SupabaseExportJobRegistry read-only mapping does not imply runtime DB persistence is active
- SupabaseExportJobRegistry now has read-only mappings only; lifecycle mutation behavior remains deferred
- Auth, requester, and RLS enforcement remain deferred

## Phase 48-A - Supabase Registry Async/Runtime Wiring Audit Only

Status:

- complete

Scope:

- audit only for sync/async registry boundary before any runtime Supabase wiring
- no route DB wiring
- no worker DB wiring
- no runtime DB persistence activation

### Phase 48-A audit summary

- Confirmed `ExportJobRegistry` is fully synchronous today
- Confirmed `SupabaseExportJobsRepository` is async and Promise-based
- Confirmed routes call registry methods synchronously
- Confirmed workers and render harness call registry lifecycle methods synchronously
- Confirmed `SupabaseExportJobRegistry` guards the mismatch and must not fake sync behavior around async DB calls
- Confirmed runtime route/worker DB wiring is not safe yet
- Confirmed a real async registry refactor would affect routes, workers, harness, registry implementations, and many tests

### Safety boundaries

- Async registry audit does not imply route DB wiring is active
- Async registry audit does not imply worker DB wiring is active
- Async registry audit does not imply runtime DB persistence is active
- Async registry audit does not imply auth, requester, or RLS enforcement is active

## Phase 48-B - ExportJobRegistry Async Boundary Test Only

Status:

- complete

Scope:

- test-only source-inspection coverage only
- no route DB wiring
- no worker DB wiring
- no runtime DB persistence activation

### Phase 48-B completion summary

- Added `tests/e2e/phase48-export-job-registry-async-boundary.spec.ts`
- Verified `ExportJobRegistry` method signatures remain synchronous
- Verified `SupabaseExportJobsRepository` methods are async and Promise-based
- Verified `SupabaseExportJobRegistry` has a fail-closed guard for Promise-backed repository results
- Verified `backend/routes/exports.ts` still calls registry methods synchronously
- Verified `backend/workers/renderWorker.ts` still assumes synchronous `getByStatus`
- Verified `backend/renderer/singleProcessRenderHarness.ts` still assumes synchronous:
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
- Verified app/routes/workers are not wired to `SupabaseExportJobRegistry`
- Verified no route DB wiring exists
- Verified no worker DB wiring exists
- Verified no fake sync wrapper around async Supabase calls exists
- Verified no remote env requirement exists
- Verified no Supabase CLI usage exists
- Verified no service-role key logging exists
- Focused Phase 48 async boundary test passed
- Typecheck and build passed

### Safety boundaries

- ExportJobRegistry async boundary coverage does not imply route DB wiring is active
- ExportJobRegistry async boundary coverage does not imply worker DB wiring is active
- ExportJobRegistry async boundary coverage does not imply runtime DB persistence is active
- Full async registry contract refactor remains deferred
- SupabaseExportJobRegistry must not fake sync behavior over async DB calls
- Auth, requester, and RLS enforcement remain deferred

## Phase 49-B - ExportJobRegistry Async Contract Refactor

Status:

- complete

Scope:

- async registry contract refactor only
- no Supabase runtime wiring
- no route DB wiring
- no worker DB wiring
- no runtime DB persistence activation

### Phase 49-B completion summary

- Converted `ExportJobRegistry` from synchronous methods to Promise-based async methods:
  - `create`
  - `getById`
  - `getByIdForOwner`
  - `getByRequestId`
  - `getByStatus`
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
  - `transition`
- Updated `InMemoryExportJobRegistry` to implement the async contract while preserving lifecycle and state-machine behavior exactly
- Updated `JsonFileExportJobRegistry` to implement the async contract while preserving current persistence behavior
- Updated `SupabaseExportJobRegistry` to implement the async contract
- Confirmed awaitable Supabase read-only methods:
  - `getById`
  - `getByIdForOwner`
  - owner-scoped `getByRequestId`
- Confirmed Supabase lifecycle and mutating methods remain fail-closed:
  - `create`
  - `getByStatus`
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
  - `transition`
- Updated `backend/routes/exports.ts` to await registry methods in:
  - `POST /exports`
  - `GET /exports/:jobId`
  - `GET /exports/:jobId/artifacts`
  - `GET /exports/:jobId/artifacts/:artifactId/access`
  - `GET /exports/:jobId/artifacts/:artifactId/stream`
  - `POST /exports/:jobId/execute`
- Updated `backend/workers/renderWorker.ts` to await `registry.getByStatus("submitted")`
- Updated `backend/renderer/singleProcessRenderHarness.ts` to await lifecycle registry methods
- Updated `mapAndMarkError(...)` to async as required by async `markError(...)`
- No Supabase route wiring was added
- No Supabase worker wiring was added
- No runtime DB persistence was activated
- No app, composition, repository, DB, frontend, or env changes were required

### Verification

- `phase46`: 2 passed
- `phase47`: 2 passed
- `phase48`: 1 passed
- `phase62`: 10 passed
- `phase66`: 7 passed
- `phase68`: 11 passed
- `phase74`: 8 passed
- `typecheck`: passed
- `build`: passed

### Safety boundaries

- Async registry contract refactor does not imply Supabase runtime DB wiring is active
- Async registry contract refactor does not imply route DB wiring is active
- Async registry contract refactor does not imply worker DB wiring is active
- Async registry contract refactor does not imply runtime DB persistence is active
- Supabase lifecycle mutation behavior remains deferred until atomic DB behavior exists

## Phase 50-B - Supabase Registry Create/Idempotency Boundary Guard

Status:

- complete

Scope:

- boundary guard only
- no Supabase runtime wiring
- no route DB wiring
- no worker DB wiring
- no app dependency wiring
- no runtime DB persistence activation

### Phase 50-B completion summary

- Added `tests/e2e/phase50-supabase-registry-create-idempotency-boundary.spec.ts`
- Confirmed `SupabaseExportJobRegistry.create(...)` remains fail-closed
- Confirmed unsafe `upsertJob`-based create behavior was not added
- Confirmed `SupabaseExportJobRegistry.create(...)` does not call `jobsRepository.upsertJob`
- Confirmed owner-scoped `getByRequestId(...)` remains the only safe idempotency read path
- Confirmed unscoped `getByRequestId(...)` remains fail-closed
- Confirmed lifecycle and mutating methods remain fail-closed:
  - `getByStatus`
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
  - `transition`
- Confirmed no route DB wiring exists
- Confirmed no worker DB wiring exists
- Confirmed no backend dependency wiring to `SupabaseExportJobRegistry` exists
- Confirmed no Supabase CLI usage or service-role key logging exists in inspected source paths
- No runtime DB wiring was added

### Verification

- `phase50`: 2 passed
- `phase47`: 2 passed
- `phase48`: 1 passed
- `typecheck`: passed
- `build`: passed

### Safety boundaries

- Create and idempotency runtime persistence remain deferred
- Unsafe broad `upsertJob` create behavior remains blocked
- No route, worker, or app dependency wiring to `SupabaseExportJobRegistry` was added
- Supabase runtime DB wiring remains deferred

## Phase 51-B - Supabase Export Jobs createIfAbsent Repository Primitive

Status:

- complete

Scope:

- repository-only create/idempotency primitive
- no registry create implementation
- no runtime DB wiring
- no route DB wiring
- no worker DB wiring
- no app or composition wiring
- no schema or migration changes

### Phase 51-B completion summary

- Added repository-level `createIfAbsent(...)` primitive to `BackendExportJobsRepository`
- Added `BackendExportJobCreateIfAbsentResult` union with truthful result states:
  - `created`
  - `existing`
  - `conflict`
- Added conflict reasons:
  - `job_id_mismatch`
  - `non_create_safe_difference`
- Implemented `SupabaseExportJobsRepository.createIfAbsent(...)`
- Confirmed `createIfAbsent(...)` tries a direct insert first
- Confirmed broad `upsertJob(...)` semantics are not reused as create success
- Confirmed first insert returns `created`
- Confirmed same idempotency scope with the same logical create payload returns `existing`
- Confirmed same scope with a different `jobId` returns `conflict: job_id_mismatch`
- Confirmed same scope with incompatible create-time fields returns `conflict: non_create_safe_difference`
- Confirmed unrelated DB errors still throw
- No `SupabaseExportJobRegistry.create(...)` implementation was added
- No runtime DB wiring was added
- No route, worker, app, or composition wiring was added
- No schema or migration changes were made

### Verification

- `phase51`: 2 passed
- `phase50`: 2 passed
- `typecheck`: passed
- `build`: passed

### Safety boundaries

- Repository-level `createIfAbsent(...)` does not imply `SupabaseExportJobRegistry.create(...)` is wired
- Repository-level `createIfAbsent(...)` does not imply runtime DB persistence is active
- Route and worker DB wiring remain deferred
- `getByStatus`, claim/lease behavior, and lifecycle DB transitions remain deferred

## Phase 52-B - SupabaseExportJobRegistry Create Adapter Implementation

Status:

- complete

Scope:

- adapter-level `create(...)` implementation only
- no runtime DB wiring
- no route DB wiring
- no worker DB wiring
- no app or composition wiring
- no repository or schema changes

### Phase 52-B completion summary

- Implemented `SupabaseExportJobRegistry.create(...)` at the adapter level only
- Confirmed `create(...)` now uses `jobsRepository.createIfAbsent(...)`
- Mapped `createIfAbsent(...)` results truthfully:
  - `created` returns `result.record`
  - `existing` returns `result.record`
  - `conflict` throws a clear `Error`
- Confirmed conflict behavior distinguishes:
  - `job_id_mismatch`
  - `non_create_safe_difference`
- Confirmed `create(...)` builds a canonical submitted export job record matching local create semantics:
  - generated `jobId`
  - `requestId`
  - `timelineId`
  - `ownerId`
  - `workspaceId`
  - `status = submitted`
  - `attemptCount = 0`
  - `createdAt`
  - `updatedAt`
  - `renderSettings`
- Confirmed lifecycle, artifact, and failure fields are not fabricated during create
- Confirmed blocked lifecycle and mutating methods still remain fail-closed:
  - `getByStatus`
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
  - `transition`
- No runtime DB wiring was added
- No route, worker, app, or composition wiring was added
- No repository or schema changes were made

### Verification

- `phase52`: 2 passed
- `phase50`: 2 passed
- `phase47`: 2 passed
- `typecheck`: passed
- `build`: passed

### Safety boundaries

- `SupabaseExportJobRegistry.create(...)` adapter support does not imply runtime DB persistence is active
- Route and worker DB wiring remain deferred
- `getByStatus` and any real `listByStatus` support remain deferred
- Claim/lease behavior and lifecycle DB transitions remain deferred

## Phase 53-B - Supabase Runtime Registry Read/Create Boundary Guard

Status:

- complete

Scope:

- runtime boundary guard only
- no Supabase runtime registry wiring
- no route DB wiring
- no worker DB wiring
- no app or composition activation changes
- no runtime DB persistence activation

### Phase 53-B completion summary

- Added `tests/e2e/phase53-supabase-runtime-registry-read-create-boundary.spec.ts`
- Confirmed `createBackendDependencies()` still instantiates a local registry by default
- Confirmed `repositoryComposition` availability does not imply runtime registry wiring
- Confirmed `createExportRouter(...)` still receives one shared registry for:
  - submit routes
  - read routes
  - execute route
  - artifact routes
- Confirmed execute flow still depends on blocked lifecycle methods in `SupabaseExportJobRegistry`:
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
- Confirmed worker draining still depends on `getByStatus("submitted")`
- Confirmed no app or runtime `SupabaseExportJobRegistry` wiring exists
- Confirmed no remote env is required
- Confirmed no Supabase CLI usage or service-role key logging exists in inspected paths
- No runtime wiring was added

### Verification

- `phase53`: 2 passed
- `phase52`: 2 passed
- `phase50`: 2 passed
- `typecheck`: passed
- `build`: passed

### Safety boundaries

- Supabase runtime registry read/create wiring remains deferred
- Route and worker DB wiring remain deferred
- Execute route DB-backed lifecycle remains deferred
- `getByStatus` and any real `listByStatus` support remain deferred
- Claim/lease behavior and lifecycle DB transitions remain deferred

## Phase 54-B - Supabase Export Jobs listByStatus Repository Primitive

Status:

- complete

Scope:

- repository-level `listByStatus(...)` primitive only
- optional limit support
- no registry `getByStatus(...)` implementation
- no worker, route, app, or composition wiring
- no claim/lease or lifecycle DB behavior
- no schema or migration changes

### Phase 54-B completion summary

- Added repository-level `listByStatus(status, options?)` primitive to `BackendExportJobsRepository`
- Added optional `limit` support
- Implemented `SupabaseExportJobsRepository.listByStatus(...)`
- Confirmed it filters by `status`
- Confirmed deterministic ordering:
  - `submitted_at asc`
  - `created_at asc`
  - `job_id asc`
- Confirmed full `BackendExportJobRecord[]` reconstruction
- Confirmed repository-only scope was preserved
- No `SupabaseExportJobRegistry.getByStatus(...)` implementation was added
- No worker, route, app, or composition wiring was added
- No claim/lease or lifecycle DB behavior was added
- No schema or migration changes were made

### Verification

- `phase54`: 2 passed
- `typecheck`: passed
- `build`: passed

### Safety boundaries

- Repository-level `listByStatus(...)` does not imply runtime worker DB wiring is active
- `SupabaseExportJobRegistry.getByStatus(...)` remains deferred
- Claim/lease behavior and lifecycle DB transitions remain deferred

## Phase 55-B - SupabaseExportJobRegistry getByStatus Adapter Implementation

Status:

- complete

Scope:

- adapter-level `getByStatus(...)` implementation only
- direct repository delegation only
- all-status support
- no worker, route, app, or composition wiring
- no repository, DB, schema, or frontend changes

### Phase 55-B completion summary

- Implemented `SupabaseExportJobRegistry.getByStatus(status)` at the adapter level only
- Confirmed `getByStatus(...)` delegates directly to `jobsRepository.listByStatus(status)`
- Confirmed support for all statuses, not submitted-only
- Confirmed no adapter-side ordering, filtering, or limit behavior was added
- Confirmed the repository remains the source of ordering and record reconstruction
- Confirmed blocked lifecycle methods still remain fail-closed:
  - `claim`
  - `markRendering`
  - `markFinalizing`
  - `markSuccess`
  - `markError`
  - `transition`
- No worker wiring was added
- No route, app, or composition wiring was added
- No repository, DB, schema, or frontend changes were made

### Verification

- `phase55`: 2 passed
- `phase53`: 2 passed
- `typecheck`: passed
- `build`: passed

### Safety boundaries

- `SupabaseExportJobRegistry.getByStatus(...)` adapter support does not imply worker readiness
- Worker DB wiring remains deferred
- Claim/lease behavior and lifecycle DB transitions remain deferred
