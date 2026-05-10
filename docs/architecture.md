# Architecture

This file is the operational architecture reference for Free AI Mixer. It complements [PROJECT_BIBLE.md](../PROJECT_BIBLE.md) by turning the platform rules into implementation constraints for day-to-day work.

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
