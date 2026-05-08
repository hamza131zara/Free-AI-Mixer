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
  /types
    scene.ts
```

## Layer Responsibilities

### UI Layer

Files:

- `src/App.tsx`
- `src/components/*`

Allowed:

- render store state
- collect user input
- dispatch store actions
- show lifecycle and error state

Forbidden:

- direct `fetch`
- provider fallback logic
- queue scheduling
- lifecycle transition logic
- local orchestration with `useEffect` or `useState`

### Store Layer

Files:

- `src/store/sceneStore.ts`
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
- persisted `queued` and `generating` scenes sanitize to `idle`
- `selectedVariation` persists only if still valid against `result.variations`
- `isGeneratingAll` is transient runtime state and does not persist

### Agent Layer

Files:

- `src/agents/sceneGenerationAgent.ts`
- `src/agents/sceneQueueAgent.ts`

Responsibilities:

- normalize scene drafts into payloads
- choose provider order
- trigger fallback from Replicate to Gemini
- enforce queue concurrency
- prevent duplicate starts inside a queue pass
- emit app lifecycle stages without implying provider telemetry

### Service Layer

Files:

- `src/services/sceneGenerationService.ts`

Responsibilities:

- make provider HTTP requests
- normalize response shape to `GeneratedScene`
- surface transport-level errors

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

Transient state:

- `isGeneratingAll`
- active queue execution
- active provider assignment for in-flight scenes
- active queue timestamps for in-flight scenes
- pre-hydration interaction state

Hydration rules:

- the app starts with `hasHydrated = false`
- interaction is blocked until persist restore completes
- hydration failure sets `hydrationError`
- no scene is treated as safely resumable after refresh

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
