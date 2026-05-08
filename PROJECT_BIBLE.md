# PROJECT_BIBLE.md

This document is the single source of truth for engineering, product architecture, and implementation boundaries for the Free AI Mixer platform. It is intentionally technical. It defines what exists now, what is planned, what is forbidden, and how future work must be scoped so the platform does not drift.

This file does not override the codebase. When code and documentation disagree, the disagreement must be resolved by verification and an explicit update to either the implementation or this document. No future session should infer undocumented architecture or mark roadmap items as complete without code-level confirmation.

## 1. PROJECT VISION

### Platform Definition

Free AI Mixer is an AI scene generation platform for assembling cinematic visual scenes through a queue-driven generation workflow. The current product centers on creating still-image scene outputs with variation selection, but the long-term direction extends that same orchestration model into a timeline and video pipeline.

The system is not intended to be a prompt toy or a UI-first image gallery. It is intended to become a production-capable creator workflow for managing batches of scene generation jobs, provider routing, fallback handling, and future asset pipelines.

### Problem It Solves

Creators need a way to:

- queue multiple scene requests without manually managing every provider call
- preserve generation state across sessions
- retry failures deterministically
- switch providers without rewriting UI code
- evolve from isolated image generation into sequence, timeline, and video-oriented orchestration

Without a centralized architecture, scene generation products drift quickly into ad hoc component logic, duplicated async flows, and inconsistent state mutations. That leads to broken retries, undefined lifecycle behavior, and brittle provider integration.

### Target Users

Primary target users:

- solo creators generating concept scenes
- filmmakers and previsualization users building cinematic scene batches
- AI-native creative operators comparing outputs across providers
- future collaborative teams assembling multi-scene timelines

The current UI is lightweight, but the product direction is workflow-heavy. The intended user is someone managing creative throughput, not just creating one image at a time.

### Creative Workflow

The current workflow is:

1. author a scene draft
2. normalize the draft into a generation payload
3. create a scene record in global state
4. queue one or many scenes
5. run provider-backed generation through the agent and service layers
6. persist resulting metadata and outputs
7. allow retry or variation selection from the global store

The long-term workflow expands to:

1. generate scenes
2. organize scenes into a timeline
3. derive motion/video tasks
4. orchestrate soundtrack and pacing
5. export a project artifact

### AI Orchestration Goals

The orchestration layer exists to make provider calls predictable and replaceable. The goals are:

- maintain a deterministic scene lifecycle
- coordinate generation outside the UI layer
- support multi-provider routing
- enforce retry and fallback behavior centrally
- normalize provider responses to one shared scene model
- prepare the platform for future agent-driven creative systems

### Why Queue Architecture Matters

Queue architecture matters because generation is asynchronous, failure-prone, rate-limited, and increasingly multi-step. A queue is required to:

- prevent uncontrolled concurrent requests
- separate user intent from provider execution timing
- support future scheduling and prioritization
- preserve stable lifecycle transitions during retries and fallbacks
- allow later expansion into multi-stage pipelines

The queue is the operational backbone of the platform. It is not an optional convenience feature.

### Why Provider Abstraction Matters

Provider abstraction matters because the platform must not bind scene state or UI assumptions to one model vendor. Providers will differ in:

- request formats
- latency
- error behavior
- polling requirements
- output structure
- pricing and quota limits

Free AI Mixer must be able to switch, compare, and extend providers without redesigning the store or components.

### Long-Term Platform Direction

The long-term direction is a scalable creator workflow built around:

- cinematic scene generation
- multi-provider AI orchestration
- timeline and video pipeline orchestration
- an internal agent system for creative and operational tasks
- durable project state and future collaboration

The intended end state is not a single-page image generator. It is a creative orchestration platform.

## 2. CORE ARCHITECTURE

### Philosophy

The architecture is logic-first and state-first. UI exists to display and dispatch intent. All orchestration, lifecycle rules, and provider logic belong outside React components.

### Strict Separation

The system is divided into these responsibilities:

- UI layer: rendering, input capture, view dispatch
- store layer: global application state, lifecycle enforcement, persistence boundaries
- agents: payload preparation, fallback decisions, queue execution rules
- services: external API I/O and provider-specific transport logic
- orchestration: async job coordination, concurrency control, retries, provider flow
- provider abstraction: normalized contract so higher layers do not care about vendor-specific response details

### Why Zustand Was Selected

Zustand is appropriate here because the product needs:

- one global source of truth for scene state
- direct selector-based subscriptions
- low ceremony updates for queue-heavy data
- middleware support for persistence
- store access from non-component logic when orchestration expands

The current implementation already uses Zustand with `persist` middleware and selector-based component subscriptions.

### Why Lifecycle-Driven Architecture Is Used

Every scene must move through the same finite lifecycle:

`idle -> queued -> generating -> success | error`

Lifecycle-driven architecture prevents hidden state combinations and clarifies responsibility:

- `idle`: created but not submitted
- `queued`: accepted by the queue but not yet actively generating
- `generating`: active provider work in progress
- `success`: terminal successful result
- `error`: terminal failed result

This model keeps retry and regeneration deterministic.

### Why Queues Are Centralized

Centralized queues prevent:

- components launching duplicate requests
- provider concurrency spikes
- inconsistent retry behavior
- state updates racing from multiple local handlers

The queue agent currently owns concurrent job scheduling with a maximum concurrency of `2`.

### Why React Components Must Remain Dumb

Components must remain dumb because UI re-renders are not a safe place to coordinate async generation behavior. Components may:

- read store selectors
- dispatch store actions
- render state

Components must not:

- construct provider fallbacks
- enforce lifecycle transitions
- manage queue concurrency
- translate transport errors into domain lifecycle mutations
- simulate backend progression

### Single Source of Truth

The canonical runtime state for scenes is the Zustand store in `src/store/sceneStore.ts`. Scene view models are derived from store state. Components do not own scene state.

### Deterministic State

Determinism means:

- every lifecycle mutation is explicit
- invalid transitions throw
- provider assignment happens through centralized orchestration
- scene records carry timestamps for queue and execution stages
- persistence sanitizes non-terminal in-flight scenes on hydration

### Async Orchestration

Async orchestration belongs in agents and store actions, not in JSX. The current flow is:

1. store action gathers jobs
2. queue agent marks jobs queued
3. queue agent starts up to `maxConcurrentJobs`
4. generation agent runs the primary provider
5. generation agent falls back to the secondary provider if needed
6. store receives success or error callbacks

### Persistence Boundaries

Persisted today:

- draft
- scenes

Not persisted today:

- `composerError`
- `isGeneratingAll`
- active in-flight generation state

Important current rule:

- scenes in `queued` or `generating` are sanitized back to `idle` during persistence/hydration

This is a safety choice that avoids resuming unknown in-flight work after refresh, but it also means the current system does not support resumable server-side jobs.

## 3. FOLDER STRUCTURE

### Current Verified Structure

Current source structure:

```text
/src
  App.tsx
  main.tsx
  styles.css
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

### Target Architecture Surface

The platform should organize around these folders:

- `/src`: application source root
- `/agents`: domain agents and orchestration agents
- `/services`: transport and API integration layer
- `/store`: Zustand stores, lifecycle rules, selectors
- `/components`: presentational and interaction components only
- `/types`: domain types and shared contracts
- `/lib`: framework-agnostic helpers and pure utilities
- `/hooks`: UI-facing hooks only when selectors/actions need composition
- `/styles`: shared visual tokens and style modules when styling grows beyond a single file
- `/timeline`: future timeline and sequencing domain
- `/providers`: future provider adapters or provider-specific contracts if service complexity increases

Not all target folders exist yet. Planned folders must not be populated speculatively.

### Allowed and Forbidden by Folder

#### `/src`

Allowed:

- application bootstrap
- root composition
- cross-cutting imports

Forbidden:

- unrelated experimental files
- duplicate state containers

#### `/agents`

Allowed:

- payload normalization
- provider ordering
- fallback logic
- queue execution logic
- future polling/orchestration agents

Forbidden:

- visual styling logic
- direct React component concerns
- local component state ownership

#### `/services`

Allowed:

- HTTP requests
- request serialization
- response parsing
- provider transport details
- service error normalization

Forbidden:

- mutating UI state directly
- reading from DOM
- rendering concerns

#### `/store`

Allowed:

- canonical scene state
- actions
- selectors
- lifecycle enforcement
- persistence configuration

Forbidden:

- raw fetch implementation
- provider-specific API body assembly when that belongs in services
- JSX or DOM logic

#### `/components`

Allowed:

- layout
- fields
- buttons
- accessibility attributes
- store action dispatch
- selector consumption

Forbidden:

- provider fallback logic
- lifecycle mutation logic
- queue scheduling
- fake async simulation

#### `/types`

Allowed:

- domain types
- shared contracts
- normalized interfaces

Forbidden:

- business logic
- side effects

#### `/lib`

Allowed:

- pure reusable helpers

Forbidden:

- store mutations
- service orchestration

#### `/hooks`

Allowed:

- UI convenience hooks that combine selectors or action bindings

Forbidden:

- creating alternate state systems
- hiding orchestration in hooks

#### `/styles`

Allowed:

- tokens
- theme contracts
- shared layout primitives

Forbidden:

- embedding product logic into style modules

#### `/timeline`

Allowed:

- future timeline domain models
- sequencing store/agents/services

Forbidden:

- scene generation provider logic mixed into timeline concerns

#### `/providers`

Allowed:

- future provider adapters
- provider-specific request/response normalization

Forbidden:

- direct component imports
- uncontrolled cross-provider branching inside UI

## 4. STATE MANAGEMENT (ZUSTAND PATTERNS)

### Store Philosophy

The store is the system of record for all scene state. Scene creation, queue transitions, retries, selection of variations, persistence sanitization, and aggregate generation entrypoints belong in the store layer.

### Current Store Responsibilities

The verified store currently owns:

- `draft`
- `scenes`
- `composerError`
- `isGeneratingAll`
- draft mutation
- draft-to-scene record creation
- single-scene generation dispatch
- retry dispatch
- variation selection
- scene removal
- clearing terminal scenes
- batch generation dispatch

### Selector Rules

Selectors must be stable and minimal.

Rules:

- subscribe to the smallest possible slice
- prefer selector functions from `sceneSelectors.ts`
- use shallow comparison for array/object view models when appropriate
- do not construct fresh objects inline in every component render if a selector can own that logic

Current verified usage:

- `useShallow(selectSceneViewModels)`
- `useShallow(selectQueueSummary)`

### Persistence Rules

Current persistence is implemented with Zustand `persist` and `createJSONStorage(() => localStorage)`.

Rules:

- only persist data that can be safely rehydrated
- do not persist transient execution flags that imply active remote work
- sanitize non-terminal lifecycles before persistence

Current sanitization behavior:

- `queued` and `generating` scenes are reset to `idle`
- progress is reset to `0`
- provider is cleared
- errors are cleared
- queue/execution timestamps are cleared

### Hydration Rules

Hydration must not recreate phantom in-progress jobs. Current behavior is safe but limited:

- hydration restores persisted scenes
- any in-flight work becomes `idle`
- batch generation state is reset
- composer error is reset

Implication:

- a refresh can lose awareness of an already-started backend job
- the current architecture assumes generation work is not resumable after refresh

### Lifecycle Enforcement

Lifecycle validity is enforced in `src/store/sceneLifecycle.ts`.

Valid transitions:

- `idle -> queued`
- `queued -> generating`
- `generating -> success`
- `generating -> error`
- `success -> queued`
- `error -> queued`

Forbidden transitions include:

- `idle -> generating`
- `idle -> success`
- `queued -> success`
- `success -> error`
- `error -> success`
- any transition to `idle` through runtime orchestration

### SceneLifecycle Examples

Valid example:

```text
idle -> queued -> generating -> success
```

Retry example:

```text
idle -> queued -> generating -> error -> queued -> generating -> success
```

Forbidden example:

```text
idle -> success
```

Forbidden example:

```text
generating -> queued
```

### Queue State Handling

The queue is represented through scene lifecycle and aggregate selectors, not through a separate persisted job ledger.

Current derived queue summary tracks:

- total scenes
- active jobs
- queued jobs
- lifecycle counts

### Shallow Selector Usage

Use shallow comparison when selectors return arrays or objects whose internal items are stable enough to compare by shallow reference.

Current examples:

- queue summary object
- scene view model array

### Avoiding Infinite Loops

Rules:

- do not trigger store writes from selector execution
- do not compute unstable derived objects inside component bodies when subscriptions depend on object identity
- do not run generation inside `useEffect` tied to broad store state

### Stable Selectors

Selectors should live in `sceneSelectors.ts` when reused. They should be deterministic and free of side effects.

### Memo Safety

The current selector module uses module-level caches keyed by the `scenes` array reference. This is acceptable only because scene updates replace the array. Future work must be careful not to mutate arrays in place, or cache correctness will break.

### Derived Selectors

Current derived selectors include:

- `selectCanAddScene`
- `selectCanGenerateAll`
- `selectCanClearTerminalScenes`
- `selectQueueSummary`
- `selectSceneViewModels`

## 5. SCENE DATA MODEL

### Core Types

Current verified types live in `src/types/scene.ts`.

#### `SceneLifecycle`

```ts
type SceneLifecycle = "idle" | "queued" | "generating" | "success" | "error";
```

This is the canonical state machine for every scene.

#### `SceneProvider`

```ts
type SceneProvider = "replicate" | "gemini";
```

This identifies which provider handled a scene generation attempt.

#### `SceneGenerationDraft`

```ts
type SceneGenerationDraft = {
  prompt: string;
  style: string;
  duration: string;
};
```

This is UI-authored input state before validation and normalization.

#### `SceneGenerationPayload`

```ts
type SceneGenerationPayload = {
  prompt: string;
  style?: string;
  duration?: number;
};
```

This is the normalized request contract passed to services.

#### `GeneratedScene`

```ts
type GeneratedScene = {
  image: string;
  variations: string[];
};
```

This is the normalized success payload returned by services and stored on the scene record.

#### `SceneGenerationError`

```ts
type SceneGenerationError = {
  message: string;
  code?: string;
  details?: unknown;
};
```

This is the normalized domain error shape.

#### `SceneRecord`

```ts
type SceneRecord = {
  id: string;
  lifecycle: SceneLifecycle;
  payload: SceneGenerationPayload;
  progress: number;
  provider?: SceneProvider;
  result?: GeneratedScene;
  selectedVariation?: string;
  error?: SceneGenerationError;
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
};
```

This is the canonical persisted scene entity.

### `selectedVariation`

`selectedVariation` stores the user-selected variant image URL when a scene has multiple variations. The displayed image currently resolves to:

- `selectedVariation` if present
- otherwise `result.image`

Rules:

- only store a variation that exists in `result.variations`
- selection is a store concern, not a component-local concern

### Provider Ownership

`provider` identifies the provider associated with the current attempt result. It is cleared when a scene is re-queued so the next attempt starts unassigned.

Important nuance:

- provider today represents the latest execution path, not a historical attempt ledger

### Timestamps

Current timestamp fields:

- `createdAt`: scene record creation time
- `queuedAt`: when scene entered queued state
- `startedAt`: when generation began
- `completedAt`: when terminal success or error was recorded

Rules:

- timestamps are ISO strings
- timestamps are mutated centrally during lifecycle transitions

### Progress Stages

`progress` is currently a numeric field, but its current implementation is not truly provider-derived. Today it is advanced by queue-agent milestones:

- `0` when queued
- `20` when marked generating
- `60` when provider starts
- `40` when fallback begins
- `90` before success
- `100` on success

This is not production-grade progress telemetry. It is milestone-based local progress. Future work must replace it with real provider-backed progress or reduce it to lifecycle-only status.

## 6. PROVIDER SYSTEM

### Current Providers

Current provider order:

- Primary: `replicate`
- Fallback: `gemini`

This ordering is implemented in `sceneGenerationAgent.ts`.

### Current Implementation Shape

The provider system currently consists of:

- one shared `HttpSceneGenerationService` class
- two configured service instances
- provider selection via `X-Scene-Provider` request header
- a generation agent that tries primary first, then fallback

There is not yet a dedicated `/providers` directory or provider-specific adapter classes.

### Why Provider Abstraction Exists

Provider abstraction exists to:

- prevent UI lock-in to one vendor
- normalize different provider responses into `GeneratedScene`
- centralize fallback logic
- preserve store contracts when services change

### Replicate Provider

Current role:

- first provider attempted for scene generation

Current technical reality:

- Replicate is not implemented as a dedicated adapter
- it uses the shared HTTP service with provider header `replicate`

### Gemini Provider

Current role:

- fallback provider when the primary attempt fails

Current technical reality:

- Gemini is not implemented as a dedicated adapter
- it uses the shared HTTP service with provider header `gemini`

### Provider Fallback Flow

Current verified flow:

1. generation agent starts primary service
2. if primary succeeds, return success
3. if primary aborts, rethrow abort and stop
4. if primary fails non-abort, emit fallback event
5. generation agent starts fallback service
6. if fallback succeeds, return success
7. if fallback fails non-abort, throw `SceneGenerationAgentError` with both error payloads serialized

### Retry Behavior

Current retry behavior exists at the scene level, not per-provider transport level.

Current verified rules:

- only scenes in `error` can be retried through `retryScene`
- retry transitions the scene back to `queued`
- retry runs the same primary-then-fallback provider flow again

There is no explicit service-level retry counter or exponential backoff yet.

### Failure Handling

Current failure handling is incomplete relative to production goals.

What exists:

- agent-level fallback from primary to secondary
- error normalization into `SceneGenerationError`
- abort propagation

What is not production-safe:

- the HTTP service falls back to mock scene generation on missing base URL
- the HTTP service falls back to mock scene generation on non-OK responses
- the HTTP service falls back to mock scene generation on invalid JSON shape
- the HTTP service falls back to mock scene generation on most caught transport errors

This behavior directly conflicts with the platform rule that backend behavior must not be simulated. It must be treated as temporary or incorrect behavior, not architecture.

### Provider Switching

Provider switching today is implicit through fallback events and provider assignment callbacks. There is no user-facing provider override yet.

### Normalized Responses

Current normalized response contract:

```ts
type GeneratedScene = {
  image: string;
  variations: string[];
};
```

All providers must eventually normalize into this shape or into a future expanded domain model approved here first.

### Polling Behavior

Current status:

- no provider polling loop exists
- the service assumes request/response generation completes within a single HTTP call

Future providers that require polling must implement that behavior inside services or provider adapters, never inside components.

### Queue Callbacks

Current queue agent emits these callback moments:

- `onQueued`
- `onGenerating`
- `onProgress`
- `onProviderChange`
- `onProviderFallback`
- `onSuccess`
- `onError`

These callbacks are the current bridge between orchestration and the store.

## 7. QUEUE SYSTEM

### Queue Model

The queue system is currently an in-memory concurrent runner managed by `DefaultSceneQueueAgent`.

It maintains:

- pending jobs array
- running jobs set
- fixed max concurrency

It does not yet maintain:

- persisted queue snapshots
- job prioritization
- cancellation UI
- resumable backend job handles

### Concurrency Limits

Current verified max concurrency:

- `2`

This limit exists in the queue agent constructor and is currently hard-coded at instantiation.

### Active Jobs

Active jobs are scenes in lifecycle `generating`.

### Queued Jobs

Queued jobs are scenes in lifecycle `queued`.

### Sequential Orchestration

The queue is not fully sequential. It is concurrency-limited parallel orchestration. The operational rule is:

- start up to `maxConcurrentJobs`
- when one finishes, start the next pending job

### Retry Pipeline

Current retry pipeline:

1. scene is in `error`
2. user invokes retry
3. store transitions scene to `queued`
4. queue agent runs the same generation flow again

### Regeneration Pipeline

Current regeneration pipeline is effectively:

- `success -> queued -> generating -> success | error`

This is available because `success -> queued` is a valid lifecycle transition and generated scenes expose `canGenerate` for both `idle` and `success`.

### Why Max Concurrent Jobs Exists

The concurrency cap exists to:

- reduce provider rate-limit pressure
- avoid browser/network saturation
- preserve responsiveness for the user
- create a predictable scheduling model

### Rate-Limit Prevention

The current architecture only partially addresses rate limits. The concurrency cap helps, but there is not yet:

- provider-specific throttling
- adaptive backoff
- request budget accounting

### Async Scheduling

Current scheduling uses `Promise.race` across running jobs to free a slot when any active job completes. This is simple and acceptable for the current scope.

### Queue Lifecycle Flow

```text
Scene created
-> idle
-> queued by store/queue agent
-> generating when a worker slot opens
-> success on normalized provider result
or
-> error on terminal failure
```

### Current Limitations

Current limitations that must be treated explicitly:

- no durable backend job IDs
- no resume after refresh
- no cancellation action
- progress is not real provider telemetry

## 8. UI SYSTEM

### Layout Philosophy

The current UI is a compact operator dashboard, not a consumer gallery. It is structured around:

- a header
- a status panel
- a composer panel
- a queue/result panel

### Current Verified UI Modules

- `SceneStatus`: queue metrics and clear-finished action
- `SceneComposer`: draft authoring and batch-start actions
- `SceneQueue`: scene cards, retry/generate/remove, variation selection

### Sidebar System

Current status:

- no sidebar system is implemented

Future direction:

- a sidebar may become the place for project context, filters, provider controls, and timeline navigation

### Scene Cards

Current scene cards display:

- lifecycle badge
- prompt
- style
- duration
- provider
- progress label
- error message
- selected output image
- available variations
- scene actions

### Status Indicators

Current status indicators are pill-based lifecycle labels and aggregate metric chips.

### Orchestration Dashboard

Current status:

- a lightweight orchestration dashboard exists in the form of `SceneStatus`
- it is not yet an operational dashboard with logs, job traces, or provider diagnostics

### Scene Queue

The queue UI is the main work surface today. It represents both pending jobs and completed outputs.

### Variation Selector

The variation selector is currently implemented as image buttons beneath the primary scene result.

### Cinematic Interface Direction

Target interface direction:

- cinematic, focused, and editorial rather than playful
- optimized for multi-scene workflows
- designed to eventually support timeline context and richer operational controls

Current reality:

- the interface is clean and functional
- the styling is not yet strongly cinematic

### Minimal Professional Aesthetic

Current style direction is restrained and professional:

- light background
- white surfaces
- low-radius cards
- muted semantic colors

### Enterprise AI Tooling Inspiration

The current UI already trends closer to operator tooling than consumer media apps. Future work should continue emphasizing clarity, state visibility, and throughput.

### Spacing System

Current observed spacing values include:

- app padding `32px`, mobile `18px`
- grid gaps `20px`, card gaps `14px`, field gaps `8px`
- control padding around `11px-18px`

There is not yet a formal tokenized spacing scale.

### Border Radius

Current observed radii:

- buttons and inputs `6px`
- cards `8px`
- pill elements `999px`

### Glassmorphism Usage

Current status:

- no glassmorphism is implemented

Rule:

- glassmorphism is optional and must not reduce state readability if introduced later

### Elevation Rules

Current elevation:

- panels use a soft shadow around `0 12px 30px rgba(31, 41, 55, 0.08)`
- scene cards remove the extra shadow inside the queue container

## 9. DESIGN TOKENS

This section records current verified visual standards, not aspirational redesign language.

### Typography

Current font stack:

```css
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Current hierarchy:

- eyebrow label: uppercase, small, bold
- page title: large responsive heading
- scene prompt: medium heading treatment
- metadata labels: compact uppercase
- body controls: inherited app font

Current weights in use:

- `700`
- `800`

### Colors

Current background colors:

- app background `#f4f6f8`

Current surface colors:

- white panel/card surface `#ffffff`
- muted chip surface `#f8fafc`
- image background `#111827`

Current accent colors:

- primary text/button `#1f2937`
- blue selected state `#1d4ed8`

Current semantic states:

- idle `#e2e8f0 / #334155`
- queued `#fef3c7 / #92400e`
- generating `#dbeafe / #1d4ed8`
- success `#dcfce7 / #166534`
- error `#fee2e2 / #b91c1c`

### Animations

Current status:

- no explicit animation system is implemented

Transition philosophy going forward:

- motion should clarify state change, never fake backend work
- async state should be reflected through lifecycle and confirmed provider events

### Icons

Current icon system:

- `lucide-react`

Usage rules:

- icons should represent actions, not decoration-only clutter
- action families should remain consistent across queue and status controls

### Buttons

Current button states:

- primary dark button
- secondary light button
- ghost button
- icon button
- disabled reduced opacity

Current hover/active system:

- not explicitly defined in CSS yet

Rule:

- future hover and active treatments must remain consistent with semantic importance and disabled clarity

## 10. PROMPT ENGINEERING RULES

### How Prompts Should Be Written for Codex

Prompts must be specific enough that architecture cannot be accidentally rewritten. Good prompts define:

- exact goal
- exact files or layers involved
- lifecycle constraints
- success criteria
- what must not change

### How Phases Must Be Scoped

Each prompt should target one architectural layer or one narrow feature slice. A prompt should not combine:

- provider refactor
- store redesign
- UI redesign
- persistence changes
- roadmap planning

unless the task is explicitly a coordinated architecture phase.

### How Implementation Tasks Are Separated

Preferred task shapes:

- add one store action
- replace mock transport with real service error handling
- add provider polling to service layer
- add one selector and wire one component
- document one verified subsystem

### What Not To Ask AI Tools

Do not ask for:

- vague “improve architecture” rewrites
- broad “make it production-ready” changes without acceptance criteria
- cross-layer rewrites without file boundaries
- UI-based workarounds for orchestration issues
- simulated backend responses when the architecture forbids them

### Bad Prompts

Bad prompt example:

- “Refactor the app to be better and more scalable.”

Bad prompt example:

- “Redesign the whole architecture and make the UI modern.”

Bad prompt example:

- “Fix generation by adding fake progress and placeholders.”

### Good Prompts

Good prompt example:

- “Replace mock fallback behavior in `src/services/sceneGenerationService.ts` with explicit `SceneGenerationServiceError` returns. Do not change store lifecycle rules. Success criteria: `npm run build` and `npm run typecheck` pass.”

Good prompt example:

- “Add a provider polling service for long-running jobs in `/services` and `/agents`. Components must remain unchanged except for reading status from selectors.”

Good prompt example:

- “Document the verified queue lifecycle and persistence sanitization in `PROJECT_BIBLE.md` without inventing unimplemented backend features.”

## 11. ENGINEERING CONVENTIONS

### Naming Conventions

Rules:

- types and interfaces: PascalCase
- React components: PascalCase
- store selectors and helpers: `selectX`, `isX`, `toX`
- service instances: descriptive camelCase
- file names: current repo uses camelCase or PascalCase by role and should stay consistent within each layer

### File Naming

Current pattern:

- components: `SceneComposer.tsx`, `SceneQueue.tsx`
- store files: `sceneStore.ts`, `sceneSelectors.ts`
- agents/services/types: camelCase domain files

Rule:

- prefer domain-first names
- avoid generic names like `utils.ts` when intent is specific

### Component Structure

Components should:

- read selectors
- bind store actions
- render declaratively

Components should not:

- call `fetch`
- validate lifecycle transitions
- maintain shadow copies of scene data

### Typing Rules

Rules:

- TypeScript only
- no `any`
- domain contracts live in `/types`
- unknown external data must be validated before use

### Async Rules

Rules:

- async orchestration belongs in store actions, agents, and services
- abort signals must propagate through async chains
- progress must come from real provider state or explicit lifecycle state

### Error Handling

Rules:

- normalize service and agent errors into `SceneGenerationError`
- retain provider/error metadata where useful
- never swallow failures by pretending success

Current violation to fix:

- service-level mock fallback currently converts failure cases into successful mock scenes

### Persistence Conventions

Rules:

- persist only rehydratable state
- sanitize in-flight work
- do not hide lifecycle changes during hydration

### Additional Non-Negotiable Rules

- no fake timers for production orchestration
- no UI-driven orchestration
- no hidden lifecycle mutations
- no direct service mutation of store state
- no logic-first redesigns inside components

## 12. PHASE ROADMAP

The roadmap below distinguishes between intent and completion. A phase is not complete until verified in code.

### PHASE 1

Objective:

- establish the core scene generation architecture

Required systems:

- TypeScript app shell
- Zustand store
- scene lifecycle enforcement
- scene draft to payload conversion
- basic queue UI

Success criteria:

- scenes can be created
- scenes have explicit lifecycle state
- UI reads from the global store

Blockers:

- none

Dependencies:

- foundational project bootstrap

Current status:

- largely complete

### PHASE 2

Objective:

- introduce batch queue orchestration and persistence

Required systems:

- concurrent queue runner
- persisted scene records
- retry path
- terminal scene cleanup

Success criteria:

- multiple scenes can be queued and processed
- concurrency is capped
- refresh does not leave phantom active jobs

Blockers:

- no durable backend job resumption

Dependencies:

- Phase 1 store and lifecycle foundation

Current status:

- partially complete

### PHASE 3

Objective:

- stabilize provider abstraction and real transport behavior

Required systems:

- explicit service errors
- normalized provider contracts
- fallback orchestration
- removal of simulated success behavior

Success criteria:

- failed provider responses remain failures
- fallback behavior is visible and deterministic
- no backend simulation in production path

Blockers:

- current mock fallback behavior

Dependencies:

- queue and generation agent already in place

Current status:

- not complete

### PHASE 3.5

Objective:

- add provider-aware telemetry and observability hooks

Required systems:

- provider attempt metadata
- structured logs
- clearer progress semantics

Success criteria:

- operator can understand which provider ran and why fallback occurred

Blockers:

- current progress is milestone-based and not real telemetry

Dependencies:

- Phase 3 provider cleanup

Current status:

- not complete

### PHASE 3.6

Objective:

- harden hydration and state stability for production reliability

Required systems:

- explicit hydration strategy
- safe persisted-state sanitization
- selector stability
- queue re-entry protection

Success criteria:

- refresh and reload do not corrupt lifecycle state
- queued and generating scenes sanitize safely to `idle`
- browser/runtime verification confirms reload integrity

Blockers:

- none after hydration/runtime verification sign-off

Dependencies:

- current store, queue, and persistence foundation

Current status:

- complete

### PHASE 3.7

Objective:

- stabilize transport truthfulness and provider realism

Required systems:

- explicit service failures
- truthful provider transport behavior
- removal of simulated success behavior
- clearer progress semantics

Success criteria:

- failed provider responses remain failures
- invalid responses do not surface as successful generated scenes
- provider behavior is trustworthy enough for later orchestration work

Blockers:

- current mock fallback behavior
- milestone-based progress that is not real provider telemetry

Dependencies:

- Phase 3.6 hydration and state stability

Current status:

- not complete

### PHASE 3.8

Objective:

- support long-running provider execution patterns

Required systems:

- polling-capable services
- resumable job contracts
- backend job ID storage

Success criteria:

- providers that do not complete in one request can still be orchestrated cleanly

Blockers:

- no job identity or resume support

Dependencies:

- Phase 3.7 transport correctness

Current status:

- not complete

### PHASE 4

Objective:

- evolve scenes into a timeline-aware sequencing system

Required systems:

- timeline domain
- ordering metadata
- scene-to-sequence composition

Success criteria:

- generated scenes can be organized as narrative or production sequences

Blockers:

- timeline module does not exist yet

Dependencies:

- stable scene generation foundation

Current status:

- not started

### PHASE 5

Objective:

- extend from scene generation into a complete multi-modal creator platform

Required systems:

- video rendering orchestration
- soundtrack systems
- export pipeline
- collaboration/versioning
- advanced agent workflows

Success criteria:

- platform supports end-to-end project output beyond isolated image scenes

Blockers:

- major backend and orchestration systems not implemented yet

Dependencies:

- Phases 3 through 4

Current status:

- not started

## 13. KNOWN ISSUES

### Hydration Edge Cases

- refresh resets `queued` and `generating` scenes to `idle`
- this avoids phantom in-flight UI state but can desynchronize from real backend work if a backend job was actually running

### Persistence Risks

- large result payloads stored in localStorage may eventually become a storage pressure issue
- there is no persistence versioning or migration layer yet

### Provider Latency

- current model assumes request/response completion
- no latency instrumentation or timeout policy is formalized

### Fallback Timing

- fallback timing is opaque beyond provider change callbacks
- current progress numbers around fallback do not represent actual provider state

### Queue Race Conditions

- `isGeneratingAll` prevents overlapping batch runs, but the system does not yet expose cancellation or a durable job registry
- cache correctness in selectors depends on immutable array replacement

### React Rendering Risks

- selector caching is module-scoped and relies on current mutation patterns remaining immutable
- future careless inline selector creation or broad subscriptions could increase rerenders

### Future Stabilization Tasks

- remove mock scene generation from production code path
- introduce explicit service failure handling
- add structured logging
- formalize provider timeout and retry policy
- decide whether resumable jobs are required
- version persisted store state

## 14. DEPLOYMENT STRATEGY

### Localhost Workflow

Current workflow:

- install dependencies
- configure Vite environment variables if a real API exists
- run local development server

Current environment variables:

- `VITE_SCENE_API_BASE_URL`
- `VITE_SCENE_GENERATION_PATH`

### Vercel Deployment

Current status:

- Vercel-specific configuration is not present in the repository

Expected deployment model:

- static frontend deployed to Vercel
- API base URL injected by environment variables

This must remain configuration-driven. Deployment must not require source edits to switch environments.

### Environment Variables

Required currently:

- `VITE_SCENE_API_BASE_URL`
- `VITE_SCENE_GENERATION_PATH`

Future likely variables:

- provider-specific API endpoints
- analytics/logging endpoints
- feature flags for provider rollout

These future variables are not yet verified in code.

### API Configuration

Current client behavior:

- posts to `${baseUrl}${generationPath}`
- sends JSON payload
- sends provider through `X-Scene-Provider`

### Production Secrets

Rules:

- client must not embed provider secrets directly
- production secrets belong behind a backend boundary

Current code does not expose provider secrets, but it also does not include a backend implementation in this repository.

### Logging Strategy

Current logging:

- console logging in store, agent, service, and mock paths

Production goal:

- structured operational logging with provider attempt context and queue/job identifiers

### Monitoring Goals

Future monitoring should cover:

- provider failure rate
- fallback rate
- queue throughput
- average generation latency
- hydration recovery failures

### Future Backend Architecture Ideas

These are ideas, not completed systems:

- dedicated backend orchestrator for provider calls
- durable queue with job IDs
- webhook or polling support for long-running providers
- asset persistence outside localStorage

## 15. FUTURE SYSTEMS

The modules below are planned directions and are not complete unless explicitly verified elsewhere.

### Timeline Engine

Purpose:

- arrange scenes into ordered narrative or shot structures

### Video Rendering

Purpose:

- transform scene outputs and timing data into rendered motion deliverables

### Soundtrack Orchestration

Purpose:

- attach music, timing, and mood layers to scene sequences

### AI Director Agents

Purpose:

- coordinate prompt refinement, continuity checks, and scene sequencing assistance

### Scene Memory

Purpose:

- retain creative context and continuity constraints across multiple scene generations

### Collaborative Workspace

Purpose:

- support multiple contributors on the same project

### Export Pipeline

Purpose:

- produce packaged outputs for delivery, editing, or downstream production tools

### Project Versioning

Purpose:

- track project state evolution, generation attempts, and rollback points

### Cloud Rendering

Purpose:

- offload heavy generation or rendering tasks to a backend compute layer

### Agent Marketplace

Purpose:

- allow modular creative and operational agents to be attached to the platform over time

## CURRENT VERIFIED STATUS

### Complete

- TypeScript Vite frontend foundation exists
- Zustand is the global scene state system
- scene lifecycle enforcement exists and invalid transitions throw
- scene creation from a validated draft exists
- queue orchestration with max concurrency `2` exists
- provider fallback ordering is implemented at the agent layer
- batch generation and retry flows exist
- scene variation selection exists
- persisted store hydration exists

### Partially Complete

- provider abstraction exists, but only through a shared HTTP service plus provider header routing
- orchestration dashboard exists, but only as lightweight summary metrics
- progress tracking exists, but is milestone-based rather than true provider telemetry
- persistence is safe for refreshes, but not robust for resumable backend jobs
- design system exists as concrete CSS conventions, but not as a formal token framework

### Unstable or Architecturally Misaligned

- service layer currently simulates successful generation through mock scene responses
- non-OK API responses and invalid payloads do not surface as true failures
- the codebase currently violates the “do not simulate backend behavior” rule
- there is no polling support for long-running provider jobs
- there is no durable queue or resumable job identity

### Requires Verification

- whether the configured external API already exists and matches the expected response shape
- whether provider fallback semantics are appropriate for real production transport failures
- whether localStorage persistence is sufficient for the intended workload
- whether current selector caching remains safe as the store grows
- whether Vercel is the intended deployment target for the frontend only, or part of a larger backend plan
