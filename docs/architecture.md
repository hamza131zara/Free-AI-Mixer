# Architecture

This file is the operational architecture reference for Free AI Mixer. It complements [PROJECT_BIBLE.md](../PROJECT_BIBLE.md) by turning the platform rules into implementation constraints for day-to-day work.

## Provider Capability And Free/Paid Policy Boundary

Launch Block 0 adds a frontend policy/model boundary for provider capabilities and Free/BYOK/Paid copy.

- Free workspace and mock/demo generation are available without real provider calls.
- BYOK means the user brings provider API keys and uses provider quota where available; BYOK does not create provider credits.
- Some image/video provider APIs may require separate provider billing, quota, model access, organization verification, or eligible account setup.
- Platform-paid generation is represented only as `platform_credits_not_configured` until billing/credits/subscriptions are implemented in a later audited block.
- UI copy may explain capability policy, but React components must not own provider execution, billing decisions, API key handling, or storage access.
- Real provider execution remains backend-gated and unchanged by this policy boundary.

## Production Auth And Supabase Persistence Boundary

Launch Block 1 establishes production auth and persistence readiness without enabling a production rollout.

- Protected backend routes must derive requester context from trusted JWT/session verification only.
- Frontend-supplied `x-user-id`, `x-workspace-id`, role, or workspace headers are not trusted authorization sources.
- Workspace roles normalize to owner, admin, member, and viewer; owner/admin is required for provider keys, generation jobs, projects, and generated artifact access.
- Generation, generated artifact access/preview, and project/history route factories can receive these production policy/persistence seams, but they fail closed when trusted auth, membership, or persistence dependencies are unavailable.
- Supabase persistence boundaries exist for app users, workspaces, workspace memberships, projects, generation jobs, generated artifact records, image generation history, provider key metadata, audit logs, and analytics events.
- A server-side Supabase repository-backed persistence writer can insert safe metadata for projects, generation jobs, generated artifact records, and image generation history when backend Supabase configuration and reviewed migration tables are present.
- Provider key persistence may include backend-only secret storage fields, but public summaries must remain redacted metadata only.
- Browser-local history fallback remains allowed only as an honest fallback when server persistence is unavailable.
- Migration drafts are manual local/staging artifacts. The app must not auto-apply remote production migrations.
- Frontend code must not directly access Supabase DB/storage or store raw JWTs, provider secrets, service-role values, encrypted payloads, secret refs, local paths, internal refs, base64, public URLs, signed URLs, or download URLs.

## Production Storage And Artifact Delivery Boundary

Launch Block 2 adds backend-mediated generated image storage/delivery foundations without enabling public, signed, or download URLs.

- Generated image production storage refs are backend-only metadata and must not be serialized to frontend responses, logs, docs examples, or browser state.
- Supabase production storage uses a private generated-artifacts bucket configured only through backend Supabase env.
- `FREE_AI_MIXER_PRODUCTION_ARTIFACT_DELIVERY_MODE=backend_mediated_stream` is required before generated artifact access can return a relative backend `previewPath`.
- The preview route may stream image bytes as an HTTP body only after trusted auth, workspace ownership, record resolution, storage-ref validation, object read, and image content-type checks.
- Frontend code may use only backend-relative preview paths; it must not call Supabase storage, show public/signed/download URLs, or add download behavior.
- Signed URL delivery files remain future/audited boundaries and are not enabled by Block 2.
- Video delivery/playback remains unavailable.

## Billing, Credits, And Subscriptions Boundary

Launch Block 3 adds a backend-owned billing/credits foundation without enabling live payments or platform-paid provider calls.

- Credit wallet, ledger, reservation, settlement, release, refund, usage-limit, subscription, billing-event, and provider-cost estimate boundaries now exist as backend/server-side contracts.
- `0006_launch_block3_billing_credits_subscriptions_draft.sql` is a manual review/apply migration draft only; the app must not auto-apply remote production migrations.
- Missing Supabase config, missing tables, missing wallet rows, or missing usage-limit rows must fail closed with `platform_credits_not_configured`, `wallet_unavailable`, or related unavailable states.
- Future platform-paid generation must reserve credits before a provider call and settle only after truthful success; failures must release or refund reservations.
- There is no live payment processor, no checkout, no webhook processing, no fake purchases, no fake balances, no fake subscriptions, and no automatic charges.
- BYOK remains separate: users pay provider costs through their own provider account/quota/billing, while Free AI Mixer platform credits are for future platform-paid usage.

## Real Provider Generation Boundary

Launch Block 4 separates BYOK real-provider generation from future platform-paid generation without enabling automated provider calls.

- OpenAI is the only executable real-provider adapter in this block.
- BYOK uses user-owned provider key, quota, billing, and model access; BYOK does not create provider credits.
- Platform-paid generation remains blocked with `platform_credits_not_configured` until platform-owned provider credentials, credit reservation, and billing readiness are separately configured.
- Google/Gemini/Imagen/Veo remain unavailable until separate audited adapter work exists.
- Real provider fetch must remain behind explicit runtime, route-mode, owner/admin, active validated key, vault, storage, provider-policy, and local/staging smoke gates.
- Codex/test automation must not use real keys or call providers; all automated provider execution coverage must mock provider fetches.
- Provider responses must remain sanitized metadata-only: no provider raw body, prompt, key, header, request ID, provider URL, base64, bytes, local path, internal ref, storage ref, public URL, signed URL, or download URL may be serialized.

## Core Rules

- Architecture first, UI second.
- Zustand is the global state system.
- API calls live in `/src/services`.
- AI logic and orchestration live in `/src/agents`.
- React components render and dispatch only.
- Scene lifecycle is enforced centrally.
- Do not simulate backend success in production architecture.

## Current Layer Map

```text
/src
  /agents
    exportAgent.ts
    sceneGenerationAgent.ts
    scenePollingAgent.ts
    sceneQueueAgent.ts
  /components
    SceneComposer.tsx
    SceneQueue.tsx
    SceneStatus.tsx
  /services
    sceneGenerationService.ts
    exportService.ts
  /store
    exportStore.ts
    sceneLifecycle.ts
    sceneSelectors.ts
    sceneStore.ts
    timelineStore.ts
  /types
    scene.ts
    providerJob.ts
    timeline.ts
    exportJob.ts
```

## Layer Responsibilities

### UI Layer

Files:

- `src/App.tsx`
- `src/components/*`
- `src/components/TimelinePanel.tsx`
- `src/components/TimelineHeader.tsx`
- `src/components/TimelineTrack.tsx`
- `src/components/TimelineClipItem.tsx`
- `src/components/TimelineSceneSource.tsx`
- `src/components/TimelinePlaybackControls.tsx`
- `src/components/TimelineExportPanel.tsx`

Allowed:

- render store state
- collect user input
- dispatch store actions
- show lifecycle and error state
- render timeline editorial state and dispatch `timelineStore` actions
- read successful scenes for timeline eligibility and dispatch `sceneId` references only
- dispatch timeline reorder commands through store actions only (`moveClipUp` / `moveClipDown`)
- render manual playback preview state and dispatch playback actions through `timelineStore` only
- render export status state and dispatch export actions through `exportStore` only
- dispatch `resumeExport` through `exportStore` only for resumable export jobs

Forbidden:

- direct `fetch`
- provider fallback logic
- queue scheduling
- lifecycle transition logic
- local orchestration with `useEffect` or `useState`
- importing agents/services into timeline UI components
- importing `exportAgent` or `exportService` directly in export UI components
- mutating scene generation lifecycle from timeline UI components
- implementing drag/drop orchestration in components (deferred)
- implementing playback timers/RAF/loops in components
- reading `localStorage` directly in components for export state
- component-owned polling loops or auto-resume behavior for export jobs

### Store Layer

Files:

- `src/store/exportStore.ts`
- `src/store/sceneStore.ts`
- `src/store/timelineStore.ts`
- `src/store/sceneLifecycle.ts`
- `src/store/sceneSelectors.ts`

Responsibilities:

- hold the canonical scene state
- validate lifecycle transitions
- expose scene actions
- own persistence boundaries
- sanitize hydrated state
- gate actions until hydration is safe

Current verified store behavior:

- `hasHydrated` and `hydrationError` exist
- persisted `queued` scenes sanitize to `idle`
- persisted `generating` scenes without valid resumable provider job metadata sanitize to `idle`
- persisted `generating` scenes with valid provider job metadata may resume browser-local polling after hydration
- `selectedVariation` persists only if still valid against `result.variations`
- `isGeneratingAll` is transient runtime state and does not persist
- timeline orchestration state is isolated in `timelineStore` and does not change scene generation lifecycle
- timeline store may read `sceneStore` only to verify success-scene eligibility for clip insertion
- timeline store does not trigger scene generation and does not import agents/services
- export orchestration state is isolated in `exportStore` and does not change scene/timeline lifecycle
- export store may validate timeline export eligibility but does not mutate timeline/scene lifecycle
- export store calls `exportAgent` (not `exportService` directly) for submit orchestration
- export store owns manual resume action/state and calls `exportAgent` (not `exportService`) for resume polling
- export store implements duplicate-submit guards while export jobs are in-flight
- export store blocks duplicate resume/submit while export jobs are resolving/submitting
- export store persists durable export job metadata and hydration classification outcomes
- export store owns persisted export fallback/readiness behavior
- export store hydration currently classifies resumable jobs only; it does not auto-resume polling
- export store does not persist timers, controllers, or in-memory lock maps
- export store does not fabricate completion, progress, artifacts, or cancellation outcomes
- timeline clips persist `sceneId` references only; they do not duplicate scene payload/result/provider fields
- sequencing/reorder logic is store-owned (`moveClipUp` / `moveClipDown`)
- reorder normalization is store-owned and always recomputes clip `order`, contiguous `startMs`, and `totalDurationMs`
- playback simulation state is store-owned (`status`, `currentTimeMs`, `activeClipId`)
- manual playback simulation actions are store-owned (`playTimeline`, `pauseTimeline`, `seekTimeline`, `stepTimeline`, `stopTimeline`)
- playback clip/progress/control selectors are store-owned and deterministic

### Agent Layer

Files:

- `src/agents/exportAgent.ts`
- `src/agents/sceneGenerationAgent.ts`
- `src/agents/scenePollingAgent.ts`
- `src/agents/sceneQueueAgent.ts`

Responsibilities:

- own export orchestration contracts (`startExport`, `resolveExport`, `pollExportUntilTerminal`)
- normalize scene drafts into payloads
- choose provider order
- trigger fallback from Replicate to Gemini
- define long-running provider polling behavior below the store/component layers
- enforce queue concurrency
- prevent duplicate starts inside a queue pass
- emit app lifecycle stages without implying provider telemetry
- keep export orchestration out of components and services
- enforce no post-acceptance fallback for accepted export jobs
- enforce no duplicate export submission after an accepted job exists
- keep timeout and transient poll failure handling truthful
- never fabricate success, progress, artifacts, or cancellation outcomes

Phase 5.3 note:

- export agent scaffolding now exists and orchestrates service submit/poll contract outcomes
- export store integration is not wired yet
- export UI/runtime integration is not wired yet
- backend rendering, render queue, workers, and webhooks remain deferred

### Service Layer

Files:

- `src/services/sceneGenerationService.ts`
- `src/services/exportService.ts`

Responsibilities:

- make provider HTTP requests
- normalize immediate-success and terminal-success payloads to shared scene types
- own submit/poll HTTP communication for provider jobs
- own export submit/poll/artifact HTTP communication contracts
- surface transport-level and protocol-level errors truthfully
- keep AbortError truthful (do not convert aborts into fake success)
- do not own orchestration loops, retry policy, store updates, or UI updates
- do not fabricate completion, progress, artifacts, or cancellation outcomes

Phase 3.8B note:

- `src/types/providerJob.ts` defines future long-running provider job contracts only
- runtime service behavior remains request/response until Phase 3.8C
- polling is not implemented in this phase

Phase 3.8C1 note:

- services now expose submit/poll contracts for long-running provider jobs
- the existing `generateScene` request/response path remains active for the current runtime
- polling agent scaffolding exists, but queue/store runtime integration remains deferred to Phase 3.8C2

Phase 3.8C3 note:

- queue/store runtime now hardens accepted provider job handling with duplicate-submission guards
- polling timeouts and bounded transient poll failures resolve into explicit runtime outcomes
- components render provider job wording from store state only; they do not own polling
- persistence and refresh-safe resume remain deferred to later Phase 3.8D/E work

Phase 3.8D1 note:

- store persistence now supports durable provider job metadata for accepted long-running jobs
- hydration classifies persisted provider jobs into safe reset, resume-needed, expired, or resume-unavailable outcomes
- Phase 3.8D1 does not start polling after hydration; automatic resume remains deferred to Phase 3.8D2

Phase 3.8D3 note:

- valid persisted provider jobs now auto-resume polling after hydration through the store/agent/service flow
- retry after resumed failure and regenerate after resumed success both clear old provider job ownership before new submission
- fingerprint mismatches now fail safely instead of auto-resuming or auto-submitting
- resumed terminal outcomes expose explicit after-reload labels in the UI without moving orchestration into components
- browser-local resume is supported, but backend/server durability is not

## Lifecycle Contract

Canonical lifecycle:

```text
idle -> queued -> generating -> success | error
```

Valid retry/regenerate paths:

```text
error -> queued -> generating -> success | error
success -> queued -> generating -> success | error
```

Forbidden patterns:

- `idle -> success`
- `queued -> success`
- `success -> error`
- component-owned lifecycle mutation

## Persistence Boundaries

Durable state:

- `draft`
- `scenes`
- `result`
- valid `selectedVariation`
- terminal scene state
- persisted provider job metadata needed for browser-local resume classification and resume polling

Transient state:

- `isGeneratingAll`
- active queue execution
- active provider assignment for in-flight scenes
- active queue timestamps for in-flight scenes
- `AbortController` instances
- polling timers and delays
- in-memory duplicate-submit locks
- pre-hydration interaction state

Hydration rules:

- the app starts with `hasHydrated = false`
- interaction is blocked until persist restore completes
- hydration failure sets `hydrationError`
- valid persisted provider jobs may now be classified as resume-needed
- valid persisted provider jobs now auto-resume polling after hydration
- expired, corrupt, not-found, and fingerprint-mismatch jobs terminate safely and require explicit user action
- backend/server ownership is not reattached during hydration because no durable server queue exists yet

## Selector Rules

- Prefer shared selectors from `src/store/sceneSelectors.ts`.
- Keep selectors pure and deterministic.
- Use shallow selection only when the returned shape warrants it.
- Avoid object recreation in component bodies when the selector can own it.
- Preserve immutable array replacement in store updates because selector caching depends on it.

## Provider Rules

Current provider order:

1. `replicate`
2. `gemini`

Provider abstraction rules:

- provider differences stay below the store and component layers
- provider choice is a domain concern, not a UI concern
- provider response shape must normalize to shared scene types

Long-running provider contract rules:

- Phase 3.8B introduces provider job contract types only
- provider job IDs, pending states, and poll result shapes may now be modeled in the domain layer
- Phase 3.8C now owns submit/poll orchestration and accepted-job runtime handling
- queue/store runtime may expose long-running provider job wording while keeping lifecycle unchanged
- browser-local resumable hydration now exists for valid persisted provider jobs
- backend durability, cross-tab coordination, and remote cancellation still belong to later Phase 3.8E and backend phases

Backend boundary rules:

- browser-local persistence is the only supported resume substrate today
- no server-owned durable queue exists in this repository
- no multi-device or cross-tab lease coordination exists
- no remote provider cancellation contract is implemented
- no webhook or server-authoritative completion flow is implemented

## Progress Semantics

- UI stage messaging reflects app lifecycle milestones only.
- The app does not currently expose provider-reported completion percentages.
- Fallback messaging may indicate when the app moved from the primary attempt to the fallback attempt.
- Real provider telemetry, polling, and long-running job progress belong to Phase 3.8 or later.

## Non-Negotiable Constraints

- Do not replace Zustand.
- Do not move orchestration into components.
- Do not add fake progress systems.
- Do not introduce timeline or video domain work into the current scene-generation flow.
- Do not convert temporary workaround behavior into documented architecture.

## Timeline Domain Layer

- `src/types/timeline.ts` defines timeline editorial metadata only.
- Timeline clips reference generated scenes by `sceneId` only.
- Timeline types do not duplicate scene payload/result/provider data.
- Playback in this layer is preview/simulation state only.
- Playback is currently manual preview only: no timers, no `requestAnimationFrame`, no automatic playback loop.
- No real media rendering behavior exists in this layer.
- Video export/rendering and backend render queue orchestration remain deferred.

## Future Export Boundaries

- Timeline store owns editorial timeline and manual preview state only.
- `src/types/exportJob.ts` mirrors the Phase 3 provider-job contract pattern for future export/render jobs.
- Export job types are contracts only.
- Future export agents should own export orchestration flows.
- Future export services should own backend/render API communication.
- Components should only render export-request UI and dispatch actions in later phases.
- Components must not import `exportAgent`/`exportService` directly, and must not read `localStorage` directly for export state.
- Export UI has no polling loops and no auto-resume polling.
- Resume uses existing accepted export handles only and does not submit a new export job.
- No export runtime implementation exists yet.
- No backend render queue exists in the current implementation.
- No downloadable video output exists in the current implementation.
- No video file generation exists in the current implementation.
- Frontend must not fake export completion, progress, artifacts, or cancellation behavior.

## Phase 6 Backend Ownership Plan

- API handlers own request validation and HTTP responses.
- Job registry owns server-authoritative export job lifecycle state.
- Worker layer will own real rendering later.
- Artifact layer will own artifact metadata and URL issuance later.
- Frontend owns lifecycle display and artifact references only.
- `exportService` owns HTTP communication only.
- `exportAgent` owns orchestration/polling only.
- `exportStore` owns frontend export lifecycle/persistence only.
- Components render state and dispatch store actions only.
- Backend route handlers now exist for export contracts, but renderer execution remains deferred.

### Recommended Backend Path

- Build an in-repo Node/Express contract-first backend scaffold first.
- Contract-first means export endpoints exist before real renderer integration.
- Backend must not fake terminal success when renderer is absent.
- Without renderer, backend may return truthful `accepted_job`, `pending`, or `terminal_failure` (for example `renderer_unavailable`).

### Planned Export API Contracts

- `POST /exports`
- `GET /exports/:jobId`
- `GET /exports/:jobId/artifacts`

Contract response rules:

- JSON uses handles/results/failures/artifact refs only.
- No raw video/media blobs in JSON responses.
- No filesystem/internal paths in artifact refs.
- Percent progress is returned only when server-side telemetry can truthfully provide it.

Current scaffold behavior (Phase 6.1-B/C):

- `POST /exports` validates input and returns truthful `accepted_job` only.
- `GET /exports/:jobId` returns truthful `pending` for known jobs and `export_job_not_found` for unknown jobs.
- `GET /exports/:jobId/artifacts` returns `export_artifacts_unavailable` for known jobs without real artifacts and `export_job_not_found` for unknown jobs.
- Validation failures return normalized `invalid_export_request`.
- No terminal success, no fake artifacts, no fake download URLs, and no fake progress are produced by the scaffold.

Current scaffold behavior (Phase 6.2-A/B):

- In-memory export registry now supports process-local `requestId` idempotency.
- Repeated `POST /exports` with the same `requestId` returns the same accepted job handle instead of creating a duplicate job.
- `POST /exports` with a different `requestId` creates a different accepted job.
- Known jobs remain truthful `pending/accepted` by default because no renderer exists yet.
- No expiration timers, no background lifecycle progression, and no fake terminal success are introduced.
- Artifacts remain unavailable unless real artifacts exist; no fake refs/URLs/download outputs are produced.

Current frontend/backend local integration behavior (Phase 6.3-A/B):

- Local Vite development proxy routes `/exports` traffic to `http://127.0.0.1:8787`.
- `exportService` default paths align with backend scaffold contracts:
  - submit: `/exports`
  - poll: `/exports/:jobId`
  - artifacts: `/exports/:jobId/artifacts`
- Runtime config remains first-class:
  - `window.__FREE_AI_MIXER_RUNTIME_CONFIG__` first
  - `VITE_EXPORT_*` fallbacks second
- Missing-config behavior remains truthful and explicit.
- Service error normalization preserves normalized backend error codes when provided (`export_artifacts_unavailable`, `export_job_not_found`, `invalid_export_request`) and preserves `http_error` normalization for generic invalid/non-OK responses.
- Layer boundaries remain enforced:
  - `exportService` owns HTTP only
  - `exportAgent` owns orchestration/polling
  - `exportStore` owns lifecycle state/actions
  - `TimelineExportPanel` renders state and dispatches store actions only
- Focused contract coverage exists in `tests/e2e/phase63-frontend-backend-integration.spec.ts`.
- This phase does not introduce a renderer, downloadable output, artifact hosting URLs, or cancellation authority.

Renderer direction decision (Phase 6.5-A/B):

- Recommended future renderer direction is a Remotion-first backend renderer pilot.
- FFmpeg remains a strong long-term option, but direct FFmpeg-first and hybrid Remotion+FFmpeg rollout are deferred.
- Browser/screenshot capture is not recommended for production-quality rendering.
- Worker/queue boundaries must be in place before renderer implementation begins.
- Artifact records must be created only after real files are produced and verified.
- API responses must expose metadata refs only; no raw blobs and no local filesystem paths in export responses.
- Progress percent must be emitted only when backend renderer telemetry can truthfully compute it.
- Frontend component boundaries remain unchanged until backend can provide truthful real artifacts.

Renderer prerequisite contracts (Phase 6.5-C/D):

- Planned lifecycle contract: `submitted -> rendering -> finalizing -> success | error | expired`.
- `queued` remains deferred until a real backend queue exists.
- Planned worker lifecycle boundary:
  - `claim(jobId, workerId)`
  - `markRendering(jobId, workerId)`
  - `markFinalizing(jobId, workerId)`
  - `markSuccess(jobId, workerId, artifacts[])`
  - `markError(jobId, workerId, failure)`
- Lifecycle transitions must be backend-authoritative and must not be frontend-driven.
- Artifact records must exist only after real file production and verification.
- APIs must return metadata refs only, with no raw blobs and no local filesystem paths.
- Artifact URLs may appear only when hosting/signing is truly available later.
- Progress stage comes only from real backend milestones; percent is allowed only when truthfully computed by renderer telemetry.
- No timer-based progress and no frontend-generated progress are allowed.

Backend lifecycle state machine (Phase 6.6-A/B):

- Lifecycle state machine now exists in backend registry/contracts only.
- Implemented lifecycle statuses:
  - `submitted`
  - `rendering`
  - `finalizing`
  - `success`
  - `error`
  - `expired`
- Registry transition helpers now exist:
  - `canTransition(from, to)`
  - `transition(jobId, nextStatus, options?)`
- Terminal states are immutable.
- `success` requires structurally valid artifact metadata and cannot be reached by invalid transitions.
- Current route behavior remains compatible with existing contract-first `accepted_job`/`pending` behavior.
- Frontend architecture remains unchanged: no React orchestration changes.
- No renderer runtime, worker runtime, queue runtime, artifact hosting URLs, or downloadable outputs were introduced.

Artifact metadata contract (Phase 6.7-A/B):

- Artifact metadata contract is backend-only (contracts/registry) in this phase.
- Required fields:
  - `artifactId`
  - `jobId`
  - `kind`
  - `format`
  - `status`
  - `createdAt`
- Optional fields:
  - `sizeBytes`
  - `durationMs`
- Allowed statuses:
  - `unavailable`
  - `pending_verification`
  - `available`
  - `expired`
  - `failed`
- Unsafe fields are rejected:
  - `path`
  - `filePath`
  - `localPath`
  - `url`
  - `downloadUrl`
- Success still requires structurally valid artifact metadata.
- Contract remains structural-only: no real file verification, no hosting/signing, no download URLs.
- Route behavior remains truthful and unchanged for no-artifact runtime state.

Worker boundary claim contract (Phase 6.8-A/B):

- Worker claim/authorization contract exists in backend registry only.
- Claim metadata is process-local/in-memory only:
  - `claimedByWorkerId?`
  - `claimExpiresAt?`
  - `attemptCount`
  - `startedAt?`
- Registry worker-boundary methods exist for future execution ownership:
  - `claim(jobId, workerId, options?)`
  - `markRendering(jobId, workerId)`
  - `markFinalizing(jobId, workerId)`
  - `markSuccess(jobId, workerId, artifacts[])`
  - `markError(jobId, workerId, failure)`
- Only the claiming worker may execute worker lifecycle transitions.
- Terminal jobs cannot be claimed or transitioned through worker methods.
- Existing lifecycle and artifact guards remain enforced; `markSuccess` still requires valid artifact metadata.
- Route surface remains unchanged.
- Frontend architecture remains unchanged.
- This phase does not add worker runtime loops, queue runtime, renderer execution, or downloadable outputs.

Renderer-readiness audit status (Phase 6.9-A):

- Phase 6 backend/export foundation is ready to enter Phase 7 renderer pilot planning.
- Core boundaries are in place: lifecycle guards, artifact metadata guards, and worker claim ownership guards.
- No renderer implementation, worker runtime loop, queue runtime, artifact hosting/signing, or download outputs are implemented yet.
- Remaining prerequisites before implementation:
  - renderer input snapshot contract
  - media input reference normalization
  - temp/output directory policy
  - real file existence verification
  - artifact retention/cleanup policy
  - Remotion runtime/dependency execution wrapper
  - renderer failure mapping
  - single-process worker execution harness

Renderer input snapshot contract (Phase 7.0-A/B):

- Backend-only renderer input snapshot contract now exists in `backend/contracts/renderInputSnapshot.ts`.
- Core contract includes:
  - `jobId`
  - `timelineId`
  - `renderSettings`
  - `timelineSnapshot`
  - scene/media references
  - `outputTarget`
- Contract helpers:
  - `validateRenderInputSnapshot(input)`
  - `createRenderInputSnapshot(input)`
- Snapshot data is structural and immutable.
- Contract rejects:
  - empty clips
  - invalid clip timing
  - missing scene/media references
  - blob-like fields
  - url/download/public URL fields
  - path traversal in output target descriptors
- Contract does not start rendering, create files/artifacts, emit progress percent, create download URLs, or mutate lifecycle state.
- No frontend architecture changes were introduced in this phase.

Temp/output path policy helper (Phase 7.1-A/B):

- Backend-only path policy helper exists in `backend/renderer/outputPathPolicy.ts`.
- Supports internal root keys: `temp` and `output`.
- Safely derives per-job output descriptors under configured backend roots.
- Allows only safe path segment characters (`a-z`, `A-Z`, `0-9`, `-`, `_`).
- Rejects traversal and injection patterns including:
  - `..`, `/`, `\`
  - absolute paths
  - Windows drive-letter and UNC forms
  - URL-like values
  - reserved Windows device names
  - trailing spaces/dots
- Enforces resolved path containment within selected root.
- Helper is non-executing policy logic only:
  - no file creation
  - no directory creation
  - no artifact creation
  - no URL/download URL generation
  - no lifecycle transitions
  - no API exposure of local paths

Real file verification helper (Phase 7.2-A/B):

- Backend-only verification helper exists in `backend/renderer/artifactVerification.ts`.
- Helper accepts backend-internal resolved output paths only and re-checks root containment before filesystem access.
- Verification is read-only (`fs.stat` checks only) and validates:
  - file exists
  - target is a regular file
  - file size is greater than zero
  - file extension matches expected format
- Verified artifact metadata is emitted only after checks pass and includes:
  - `artifactId`
  - `jobId`
  - `kind`
  - `format`
  - `status: available`
  - `createdAt`
  - `sizeBytes`
- Verified metadata excludes local path and URL fields:
  - `path`, `filePath`, `localPath`
  - `url`, `downloadUrl`, `publicUrl`, `signedUrl`
- Helper does not write/create/delete files, host artifacts, sign URLs, create download URLs, call `markSuccess`, trigger lifecycle transitions, add progress percent, or fabricate artifacts/success.
- Focused coverage exists in `tests/e2e/phase72-artifact-file-verification.spec.ts`.
- Test-only temp files/directories are allowed within test temp roots and are test-cleaned; production helper remains read-only.

Renderer failure mapping helper (Phase 7.3-A/B):

- Backend-only failure mapper exists in `backend/renderer/rendererFailureMapping.ts`.
- Mapper normalizes raw/future renderer/runtime errors into safe backend-internal failure objects.
- Failure code set includes:
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
- Supports renderer stages:
  - `snapshot`
  - `path`
  - `render`
  - `verify`
  - `finalize`
- Supports cause categories:
  - `validation`
  - `runtime`
  - `timeout`
  - `abort`
  - `io`
  - `verification`
- Retryability is policy-driven (timeout retryable; invalid snapshot/path/format mismatch non-retryable; artifact missing/empty/verification non-retryable for now).
- Public-safe sanitization strips stack traces, local paths, URL/download-like fields, env/command/argv fields, and secret/token/password-like values.
- Helper is side-effect free:
  - no renderer execution
  - no Remotion install
  - no file or directory creation
  - no artifact or URL/download output creation
  - no lifecycle mutation
  - no `markError` call
  - no fake progress/success/cancellation
- Focused coverage exists in `tests/e2e/phase73-renderer-failure-mapping.spec.ts`.

Single-process renderer execution harness (Phase 7.4-A/B):

- Backend-only harness exists in `backend/renderer/singleProcessRenderHarness.ts`.
- Harness is contract-first orchestration with injected adapter only.
- Harness may orchestrate:
  - `claim(jobId, workerId)`
  - render snapshot creation/validation
  - output-path resolution
  - `markRendering(jobId, workerId)`
  - injected adapter call
  - artifact verification
  - `markFinalizing(jobId, workerId)`
  - `markSuccess(jobId, workerId, artifacts)`
- Failure path:
  - catches snapshot/path/adapter/verification/finalization failures
  - maps via renderer failure mapper
  - sanitizes to public-safe failure
  - calls `markError` through worker-boundary ownership
  - never falls back to success
- Adapter boundary:
  - receives snapshot + resolved output path + optional abort signal
  - must not mutate lifecycle
  - must not emit URL/download URL outputs
  - must not return API-facing local paths
  - must not create verified metadata
  - must not call `markSuccess`/`markError`
- Harness/test boundaries:
  - test adapters may create temp files in test-only temp directories
  - tests clean up their own temp files/directories
  - production harness does not directly write/create/delete files/directories
- Explicit non-behaviors:
  - no Remotion install/import
  - no real renderer runtime
  - no auto-run from `POST /exports`
  - no queue/scheduler/worker loop
  - no database/durable persistence
  - no artifact hosting/signing/download URL outputs
  - no fake artifacts/progress/cancellation
  - no frontend architecture changes
- Focused coverage exists in `tests/e2e/phase74-single-process-render-harness.spec.ts`.

Remotion adapter contract stub (Phase 7.5-A/B):

- Backend-only adapter stub exists in `backend/renderer/remotionRendererAdapter.ts`.
- Adapter factory returns a `RendererAdapter`-compatible function for harness injection.
- Stub behavior is explicit and truthful:
  - always returns `ok: false`
  - includes not-implemented message
  - includes safe diagnostics only (`code`, `summary`, `retryable`, optional `workerId`)
- Stub boundary guarantees:
  - no Remotion install/import
  - no `@remotion/renderer` import
  - no composition files
  - no real renderer runtime execution
  - no lifecycle mutation
  - no `markSuccess`/`markError` calls
  - no file/directory writes
  - no artifact metadata creation
  - no URL/download/signed/public URL output
- Route behavior is unchanged; no auto-run from `POST /exports`.
- Frontend architecture remains unchanged.
- Focused coverage exists in `tests/e2e/phase75-remotion-adapter-contract.spec.ts`.

Remotion dependency install-only milestone (Phase 7.6-A/B):

- `remotion` and `@remotion/renderer` dependencies are installed as a dependency-only step.
- This milestone is dependency onboarding only:
  - no Remotion imports
  - no renderer runtime execution
  - no adapter runtime implementation
  - no composition files
  - no route auto-execution
  - no frontend architecture changes
- Phase 7.5 adapter contract expectations remain boundary-safe:
  - dependencies may exist
  - adapter stub remains truthful not-implemented
  - adapter stub still must not import Remotion runtime directly

Remotion import smoke test milestone (Phase 7.7-A/B):

- Backend-only smoke coverage exists in `tests/e2e/phase77-remotion-import-smoke.spec.ts`.
- Scope is import smoke only:
  - dynamic import of `remotion`
  - dynamic import of `@remotion/renderer`
  - no renderer runtime execution
- Adapter boundary remains unchanged:
  - adapter stub stays not implemented
  - adapter still returns `ok: false`
  - adapter implementation remains deferred
- Runtime API verification remains deferred:
  - smoke tests should not require specific runtime export assertions
  - runtime rendering calls are still forbidden in this phase
- Forbidden runtime calls include:
  - `renderMedia`
  - `bundle`
  - `selectComposition`
  - `getCompositions`
  - `openBrowser`
  - any output-writing renderer call
- Route/frontend boundaries remain unchanged:
  - no route auto-execution
  - no lifecycle mutation via smoke phase
  - no frontend architecture changes

Remotion adapter mocked-runtime implementation (Phase 7.8-A/B):

- Adapter remains backend-only in `backend/renderer/remotionRendererAdapter.ts`.
- `createRemotionRendererAdapter(...)` remains the primary factory and stays compatible with the harness `RendererAdapter` contract.
- Adapter now supports optional injected mocked runtime boundaries:
  - `bundle(...)`
  - `selectComposition(...)`
  - `renderMedia(...)`
- Injected runtime call order is explicit: `bundle -> selectComposition -> renderMedia`.
- Snapshot data is passed to mocked render boundaries; only backend-internal resolved output path is passed to mocked `renderMedia`.
- Adapter success here means adapter-call success only (not verified artifact success).
- Adapter still does not create artifact metadata, verify files, mutate lifecycle, or call `markSuccess`/`markError`.
- Adapter diagnostics remain sanitized and must not expose stack traces, local paths, urls/download-like fields, or command/env/secret-like values.
- When no runtime is injected, truthful not-implemented (`ok: false`) behavior remains intact.
- Focused mocked-runtime coverage exists in `tests/e2e/phase78-remotion-adapter-mocked-runtime.spec.ts`.
Real renderer runtime execution, composition files, route auto-execution, and frontend changes remain deferred.

Remotion composition boundary scaffold (Phase 7.9-A/B):

- Backend-only composition boundary scaffold exists under `backend/renderer/compositions/`.
- Composition inputs are strictly `RenderInputSnapshot`-derived serializable props.
- Scaffold renders deterministic placeholder timeline structure from clip timing/order data only.
- Composition boundary restrictions:
  - no imports from `src/store`, `src/services`, `src/agents`, backend routes, or backend registry
  - no renderer runtime API calls (`renderMedia`, `bundle`, `selectComposition`, `getCompositions`, `openBrowser`)
  - no `localStorage`/`window`/`document`/network usage
  - no artifact metadata or url/download field creation
  - no lifecycle mutation
- This phase remains scaffold-only:
  - no real renderer runtime execution
  - no composition-driven file output
  - no route auto-execution
  - no frontend architecture changes
- Focused boundary coverage exists in `tests/e2e/phase79-remotion-composition-boundary.spec.ts`.

Remotion runtime helper boundary and adapter delegation (Phase 8.0-A/B):

- Dedicated runtime helper boundary now exists in `backend/renderer/remotionRuntime.ts`.
- This helper is the backend-only Remotion runtime boundary for renderer runtime API wrapping.
- `backend/renderer/remotionRendererAdapter.ts` delegates runtime sequencing through this helper (or an injected runtime boundary in mocked phases).
- `backend/renderer/singleProcessRenderHarness.ts` and backend registry remain lifecycle owners:
  - claim/render/finalize/success/error transitions stay harness/registry-owned
  - runtime helper, adapter, and composition layers must not mutate lifecycle state
- Route layer remains non-executing for renderer runtime:
  - no auto-execution from `POST /exports`
  - no hidden queue/worker/scheduler loop
- Phase 8.0-B boundary remains mocked-call only:
  - no real renderer runtime execution is enabled yet
  - no artifact hosting/signed URL/download URL behavior is enabled
  - no frontend architecture changes were introduced

Remotion bundler dependency + runtime type boundary prep (Phase 8.1-B, after Phase 8.1-A audit):

- `@remotion/bundler` is now present as dependency/boundary preparation only.
- `backend/renderer/remotionRuntime.ts` remains the dedicated backend-only boundary for future Remotion bundler/runtime API integration.
- Runtime helper now carries safer future-facing module/type boundaries for renderer and bundler integration.
- Default runtime remains truthful and non-executing until a later audited phase explicitly enables controlled real runtime execution.
- Lifecycle ownership remains unchanged:
  - runtime/helper/adapter/composition must not mutate lifecycle
  - harness/registry remain the only lifecycle transition owners
- Route layer remains non-executing:
  - no auto-execution from `POST /exports`
  - no hidden worker loop/queue/scheduler introduced
## Phase 8.2 backend real-smoke boundary (test-only)

- Real Remotion smoke remains backend-only and opt-in.
- Runtime boundary stays in `backend/renderer/remotionRuntime.ts`.
- Adapter/runtime/composition boundaries remain lifecycle-neutral; harness/registry remain lifecycle owners.
- Route layer remains non-executing (no auto-run from `POST /exports`).

### Browser-mode stabilization note

- Initial smoke failures surfaced as `selectComposition` timeout.
- A `getCompositions` preflight was added for composition discovery diagnostics before selection.
- A browser logs scoping issue was corrected.
- Browser mode mismatch was resolved by using `chromeMode: "headless-shell"` to match the downloaded Remotion browser runtime.

### Preserved safety boundaries

- No frontend rendering/orchestration changes.
- No artifact hosting, signed URLs, or download URLs.
- No public local path exposure in API-safe outputs.
- No fake progress/success/artifacts/cancellation behavior.

## Phase 8.3 adapter real-runtime integration boundary

- `backend/renderer/remotionRendererAdapter.ts` remains an orchestration boundary that delegates runtime execution.
- Adapter default alignment now targets:
  - entry point: `backend/renderer/compositions/remotionEntry.tsx`
  - composition id: `FREE_MIXER_COMPOSITION_ID`
- Adapter converts `RenderInputSnapshot` to Free Mixer composition props before runtime delegation.
- Adapter does not pass raw render snapshot directly to real runtime input props.

### Ownership and safety

- Real Remotion API calls (`bundle`/composition selection/rendering) remain in `backend/renderer/remotionRuntime.ts`.
- Harness/registry remain lifecycle owners.
- Adapter/runtime/composition remain lifecycle-neutral (no mark* transitions).
- Adapter remains artifact-neutral:
  - no artifact verification
  - no artifact metadata creation
  - no hosting/signing/download URL behavior
- Route layer remains non-executing for renderer runtime.

## Phase 8.4 harness real-runtime integration boundary

- Harness can execute the real adapter/runtime path in focused backend tests when explicitly opted in.
- Opt-in control remains test-scoped (`FREE_AI_MIXER_RUN_REAL_RENDER_SMOKE=1`).
- Default test path remains non-rendering and fast.

### Ownership remains unchanged

- Harness/registry continue to own lifecycle transitions end-to-end.
- Output path resolution remains harness-owned via output path policy.
- Artifact verification remains harness-owned and must complete before success transition.
- Adapter success is execution success only; it is not equivalent to verified job success.

### Neutrality remains unchanged

- Adapter/runtime/composition remain lifecycle-neutral (no mark* transitions).
- Adapter remains artifact-neutral (no artifact verification, no metadata creation, no hosting/signing/download URLs).
- Route layer remains non-executing (`POST /exports` still does not execute renderer runtime).

## Phase 8.5 backend execution trigger boundary

- `backend/renderer/executeRenderJob.ts` is an internal/manual backend trigger boundary.
- It accepts explicit dependencies and delegates to `executeSingleProcessRender(...)`.
- It returns harness results unchanged and does not duplicate harness lifecycle logic.

### Ownership remains unchanged

- Trigger does not directly own lifecycle transitions.
- Trigger does not verify artifacts and does not create artifact metadata.
- Harness/registry remain lifecycle owners.
- Output path resolution and artifact verification remain harness-owned.

### Route/API status remains unchanged

- Routes remain non-executing for renderer runtime.
- `POST /exports` remains acceptance/metadata-only.
- No hosting/signing/download URL behavior is introduced.

## Phase 8.13 worker lifecycle app wiring boundary

- Worker lifecycle module now exists in `backend/workers/renderWorkerLifecycle.ts`.
- Lifecycle factory: `createRenderWorkerLifecycle(...)` returns controller with `init()`, `shutdown()`, `isRunning()`, `getStatus()`.
- Lifecycle chain: `createRenderWorkerStartup` → `createRenderWorkerLoop` → `drainRenderWorkerOnce` → `executeRenderJob` → harness/registry.
- App wiring in `backend/app.ts`:
  - Uses already-composed `backendDeps` (registry, rendererAdapter, pathPolicy)
  - Calls `lifecycle.init()` during app creation
  - Lifecycle stored as `app.locals.renderWorkerLifecycle` (internal/test/dev only)
  - `lifecycle.init()` is harmless when env flags are disabled
- Environment gates:
  - `FREE_AI_MIXER_ENABLE_WORKER_STARTUP=1` required to enable startup
  - `FREE_AI_MIXER_ENABLE_WORKER_LOOP=1` required to enable loop
  - `FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS` defaults to 2000 ms
- No public lifecycle/status route added.
- No `backend/server.ts` changes.
- No process signal handlers or graceful shutdown wiring.
- No route enqueue behavior added.

### Ownership and safety preserved

- Lifecycle API is internal/test/dev only; no public route exposes lifecycle state.
- `rendererAdapter` and `pathPolicy` are composed for lifecycle but NOT passed to `createExportRouter`.
- Execute route (`POST /exports/:jobId/execute`) still returns 501 without configured dependencies.
- `POST /exports` remains non-executing.
- No artifact hosting, signed URLs, or download URLs introduced.
- No local path leakage in API responses.
- Worker lifecycle depends on in-memory registry only; no durable queue/persistence.
- No cancellation or frontend async worker integration yet.

## Phase 8.14 truthful GET status boundary

- GET `/exports/:jobId` now maps actual registry status to truthful public poll responses.
- `ExportPollResponseBody` type updated to allow full `ExportPollResult` union (was pending-only).
- Status mapping:
  - `submitted`/`rendering`/`finalizing` → `kind: "pending"` with handle
  - `success` → `kind: "terminal_success"` with safe artifact metadata
  - `error`/`expired` → `kind: "terminal_failure"` with safe failure fields

### Success response safety

- `terminal_success` includes safe artifact metadata only:
  - `id` (artifactId), `status: "ready"`, optional `bytes` (sizeBytes), `completedAt`
- Excluded: local paths, filePath, path, url, downloadUrl, signedUrl, artifactUrl
- Artifact hosting and download URLs remain deferred

### Failure response safety

- `terminal_failure` returns only safe public fields:
  - `message`, `code`, `jobId`
- `failure.details` intentionally excluded to prevent leak risk
- No stack traces, local paths, URLs, or internal details

### Route boundaries preserved

- POST /exports unchanged (returns accepted_job, creates submitted job).
- POST /exports already acts as enqueue boundary when worker flags enabled.
- POST /exports/:jobId/execute unchanged (dev/test-gated, returns 503/501).
- rendererAdapter/pathPolicy still NOT wired into createExportRouter.
- No public lifecycle/status route added.
- No durable queue/persistence, cancellation, or frontend changes.

## Phase 8.15 registry interface boundary

- Registry interface/implementation separation exists (Phase 8.15-B).
- `backend/registry/exportJobRegistry.ts` owns:
  - `ExportJobRegistry` interface with all job lifecycle methods
  - Related types (`CreateExportJobInput`, `ExportJobClaimOptions`, `ExportJobTransitionOptions`)
  - `ExportJobTransitionError` class
  - `InMemoryExportJobRegistry` (re-exported for backwards compatibility)
- `backend/registry/inMemoryExportJobRegistry.ts` owns:
  - `InMemoryExportJobRegistry` class implementing `ExportJobRegistry`
  - All internal validation and helper functions
- `createBackendDependencies` returns `registry: ExportJobRegistry` (interface type).

### Interface boundary benefits

- Future durable persistence adapters can implement `ExportJobRegistry` interface.
- `createBackendDependencies` can inject different registry implementations.
- Clean separation between interface contract and storage implementation.
- All existing consumers continue to work unchanged.

### Current persistence state (in-memory only)

- Jobs stored in `Map<string, BackendExportJobRecord>` — lost on restart.
- requestId idempotency stored in `Map<string, string>` — lost on restart.
- Claims and claim TTL stored in memory — lost on restart.
- Artifact metadata stored in memory — lost on restart.
- Worker lifecycle is env-gated and in-memory only.

### Future storage options documented for later phases

- JSON file (`.free-ai-mixer-jobs.json`) — local dev, single instance, simplest.
- SQLite — single-instance production, self-contained, transactional.
- Postgres — multi-instance/cross-region, most robust, requires infra.
- Redis — caching layer + durability, requires Redis server.

### Recovery semantics deferred

- Submitted jobs after restart: re-queue for worker drain (future).
- Rendering/finalizing jobs after restart: expire (safe vs duplicate render risk).
- Jobs with expired claims after restart: treat as submitted (re-queue).
- Terminal jobs (success/error/expired): recovered, no re-processing needed.

## Phase 8.16 graceful shutdown helper boundary

- Graceful shutdown helper exists (Phase 8.16-B): `backend/lifecycle/gracefulShutdown.ts`.
- Factory function: `createGracefulShutdown(...)`.
- Helper API returns controller with:
  - `shutdown()` — idempotent shutdown
  - `isShuttingDown()` — current shutdown state
  - `getStatus()` — safe status object
- Helper accepts explicit dependencies:
  - `lifecycle` — lifecycle controller (required)
  - `server` — server-like object with `close()` (optional)
- Helper behavior:
  - Calls `lifecycle.shutdown()` to stop worker polling
  - Calls `server.close()` if provided
  - Idempotent (safe to call multiple times)
  - Works when lifecycle never started or env flags disabled
  - Status is safe (no local paths/URLs)

### What this helper does NOT do

- Does NOT register process signal handlers (SIGINT/SIGTERM)
- Does NOT call process.exit()
- Does NOT mutate job registry state
- Does NOT cancel in-flight renders
- Does NOT mark jobs as error/expired/cancelled
- Does NOT add persistence/recovery

### Current shutdown model (helper boundary only)

- Helper provides a safe coordination layer for future server.ts wiring.
- Real process signal handling is deferred.
- Graceful shutdown stops future polling through lifecycle.shutdown.
- In-flight renders are not interrupted.
- Job state recovery is deferred until durable persistence exists.

### Server.ts wiring (Phase 8.17-B complete)

- Phase 8.17-B implemented server.ts shutdown wiring.
- backend/server.ts exports startServer(...) factory function.
- startServer(...) creates app, starts server, wires lifecycle shutdown.
- startServer(...) registers SIGINT/SIGTERM handlers when registerSignals: true.
- startServer(...) returns controller with app/server/shutdown/isShuttingDown/getStatus/cleanupSignalHandlers.
- backend/server.ts no longer auto-starts when imported.
- No process.exit() added.
- No job state mutation on shutdown.
- Shutdown stops polling/server intake but does not recover jobs after restart.

### Recovery Policy Boundary (Phase 8.18-B complete)

- Phase 8.18-B added restart recovery policy boundary.
- backend/registry/exportJobRecoveryPolicy.ts defines safe recovery rules:
  - submitted stays submitted
  - rendering/finalizing recover to submitted (worker died, claim expired)
  - success/error/expired remain terminal
  - claims cleared for recovered jobs
  - attemptCount and identity preserved
- Policy is clone-based (no mutation of input records)
- No filesystem I/O, no registry mutations, no path leakage
- Used by JSON persistence adapter for on-load recovery

### JSON File Persistence Adapter (Phase 8.19-B complete)

- Phase 8.19-B added JSON file persistence adapter.
- backend/registry/jsonFileExportJobRegistry.ts implements ExportJobRegistry.
- Delegation pattern: JSON adapter wraps InMemoryExportJobRegistry for lifecycle logic.
- InMemoryExportJobRegistry remains source of truth for transitions, validation, state guards.
- Env-gated: FREE_AI_MIXER_PERSISTENCE_ENABLED (disabled by default).
- Optional: FREE_AI_MIXER_PERSISTENCE_FILE_PATH.
- Default: .free-ai-mixer-jobs.json in process.cwd().
- Atomic writes: temp file + rename.
- RequestId idempotency survives restart.
- Recovery-on-load uses Phase 8.18 policy.
- Sanitized persistence: no failure.details, no artifact paths/URLs.

### Persistence Runtime Local Smoke (Phase 8.20-B complete)

- Phase 8.20-B added focused runtime/local smoke test.
- tests/e2e/phase820-persistence-runtime-smoke.spec.ts verifies persistence through real HTTP flow.
- Test uses app.listen on ephemeral port + fetch against real routes.
- Does not use Express app.request as HTTP client.
- Verifies POST /exports creates job and writes persistence file.
- Verifies recreated app can GET truthful pending status.
- Verifies requestId idempotency survives restart.
- Verifies persisted JSON has no path/URL leakage.
- Worker and route execution disabled during smoke.
- No production persistence runtime mode yet.

### Production DB Adapter Strategy (Phase 8.21-A complete)

- Phase 8.21-A documented production DB adapter strategy.
- ExportJobRegistry interface is correct DB adapter boundary.
- Future DB adapter must implement ExportJobRegistry directly.
- DB adapter must NOT delegate lifecycle to InMemoryExportJobRegistry.
- DB adapter must implement lifecycle logic transactionally in DB (SELECT FOR UPDATE, optimistic locking).
- Recommended: PostgreSQL via PostgresExportJobRegistry.
- Recommended future env: FREE_AI_MIXER_DB_PROVIDER, DATABASE_URL, etc.
- JSON persistence stays dev/local only.
- DB schema: jobs table with unique requestId, claimExpiresAt, status transitions.
- DB must sanitize failure (message/code only) and artifact fields (no paths/URLs).
- Recovery: SELECT jobs WHERE status IN (rendering, finalizing) AND claimExpiresAt < NOW().

## Mock generation workspace boundary (Phase 166)

- The Mixer generation workspace is currently a safe mock/local generation surface.
- Prompt-to-image calls backend `/generation/jobs` only and displays safe metadata returned by the backend.
- Successful mock image metadata can be saved in browser-local history; local image preview is backend-mediated only when explicitly enabled.
- Prompt-to-video calls the backend video boundary, but video generation fails closed with `video_artifact_storage_unavailable` until verified video artifact storage exists.
- The frontend must not access provider APIs, Supabase/storage, artifact roots, local paths, internal refs, base64, bytes, public URLs, signed URLs, or download URLs directly.
- Real provider generation, production artifact delivery, browser download, export integration, and credits/billing mutation remain separate audited phases.

## Generated image access registry boundary (Phase 170)

- Generated image artifacts now have a backend-only registry boundary for process-memory lookup by `jobId` and `artifactId`.
- The registry may retain safe artifact metadata plus backend-only internal storage refs after mock image storage succeeds.
- The generation-specific access route can identify registered artifacts, but it still returns descriptor-disabled JSON with `deliveryStatus: unavailable`.
- Internal refs, local paths, storage refs, image bytes, base64 payloads, public URLs, signed URLs, download URLs, and stream URLs must never be serialized to frontend responses.
- Real preview delivery requires a later audited backend-mediated stream/descriptor phase with explicit auth, workspace ownership, path containment, content-type, cache, and abuse controls.

## Backend-mediated generated image preview (Phase 172)

- Local generated image preview is served only by the generation-specific backend preview route.
- The preview route is gated by `FREE_AI_MIXER_GENERATION_ENABLE_LOCAL_IMAGE_PREVIEW=1`.
- The preview route may return image bytes as the HTTP response body after registry lookup, auth/workspace checks, root containment validation, file checks, and safe image content-type enforcement.
- The preview route is not a download route and must not emit `Content-Disposition: attachment`.
- The frontend may render only the relative backend preview route in an image element; it must not display public URLs, signed URLs, download URLs, local paths, internal refs, storage refs, base64, or raw bytes in app state.
- Video preview/playback remains unavailable until a separate verified video artifact storage and delivery phase.
- Production artifact delivery still requires a future audited storage/RLS/signed-delivery design.
## Launch Block 5 video generation boundary

- Real video generation is modeled as a backend-only fail-closed foundation.
- Future video providers use not-configured adapter contracts for submit, poll, cancel, and readiness checks; no provider endpoints or fetch URLs are wired.
- Video lifecycle transitions are explicit, and `metadata_ready` is allowed only after verified artifact metadata exists.
- Generated video verification currently returns `video_artifact_verification_unavailable`, and generated video storage returns `video_artifact_storage_unavailable`.
- No public/signed/download URLs, local paths, internal refs, storage refs, base64, video bytes, playback route, or direct frontend storage access are part of this boundary.

## Launch Block 6 production deployment boundary

- Production deployment readiness is reported through safe enum/status checks only.
- The backend exposes `/monitoring/deployment-readiness` without secrets, raw env values, provider calls, DB writes, or migration execution.
- Production CORS is explicit and uses `FREE_AI_MIXER_ALLOWED_ORIGINS`; wildcard production origins are not approved.
- Frontend env remains allowlisted for public client values only. Service-role keys, provider keys, billing secrets, webhook secrets, and SMTP secrets are backend-only.
- Real providers, platform-paid generation, video providers, public URLs, signed URLs, and downloads remain disabled unless a later audited block enables them.
