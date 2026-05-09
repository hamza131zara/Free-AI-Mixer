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
    sceneGenerationAgent.ts
    scenePollingAgent.ts
    sceneQueueAgent.ts
  /components
    SceneComposer.tsx
    SceneQueue.tsx
    SceneStatus.tsx
  /services
    sceneGenerationService.ts
  /store
    sceneLifecycle.ts
    sceneSelectors.ts
    sceneStore.ts
    timelineStore.ts
  /types
    scene.ts
    providerJob.ts
    timeline.ts
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

Allowed:

- render store state
- collect user input
- dispatch store actions
- show lifecycle and error state
- render timeline editorial state and dispatch `timelineStore` actions
- read successful scenes for timeline eligibility and dispatch `sceneId` references only
- dispatch timeline reorder commands through store actions only (`moveClipUp` / `moveClipDown`)
- render manual playback preview state and dispatch playback actions through `timelineStore` only

Forbidden:

- direct `fetch`
- provider fallback logic
- queue scheduling
- lifecycle transition logic
- local orchestration with `useEffect` or `useState`
- importing agents/services into timeline UI components
- mutating scene generation lifecycle from timeline UI components
- implementing drag/drop orchestration in components (deferred)
- implementing playback timers/RAF/loops in components

### Store Layer

Files:

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
- timeline clips persist `sceneId` references only; they do not duplicate scene payload/result/provider fields
- sequencing/reorder logic is store-owned (`moveClipUp` / `moveClipDown`)
- reorder normalization is store-owned and always recomputes clip `order`, contiguous `startMs`, and `totalDurationMs`
- playback simulation state is store-owned (`status`, `currentTimeMs`, `activeClipId`)
- manual playback simulation actions are store-owned (`playTimeline`, `pauseTimeline`, `seekTimeline`, `stepTimeline`, `stopTimeline`)
- playback clip/progress/control selectors are store-owned and deterministic

### Agent Layer

Files:

- `src/agents/sceneGenerationAgent.ts`
- `src/agents/scenePollingAgent.ts`
- `src/agents/sceneQueueAgent.ts`

Responsibilities:

- normalize scene drafts into payloads
- choose provider order
- trigger fallback from Replicate to Gemini
- define long-running provider polling behavior below the store/component layers
- enforce queue concurrency
- prevent duplicate starts inside a queue pass
- emit app lifecycle stages without implying provider telemetry

### Service Layer

Files:

- `src/services/sceneGenerationService.ts`

Responsibilities:

- make provider HTTP requests
- normalize immediate-success and terminal-success payloads to shared scene types
- own submit/poll HTTP communication for provider jobs
- surface transport-level and protocol-level errors truthfully

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
- Future export agents should own export orchestration flows.
- Future export services should own backend/render API communication.
- Components should only render export-request UI and dispatch actions in later phases.
- No backend render queue exists in the current implementation.
- No video file generation exists in the current implementation.
