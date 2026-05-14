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
