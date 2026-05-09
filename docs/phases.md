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

- active

Sub-phases:

- Phase 3.8A audit complete
- Phase 3.8B provider job contracts complete
- Phase 3.8C polling orchestration active
- Phase 3.8C1 service submit/poll contracts and polling scaffold complete
- Phase 3.8C2 queue/store polling integration complete
- Phase 3.8C3 runtime hardening and UI status refinement complete
- Phase 3.8D persistence and resumable runtime design active
- Phase 3.8D1 persisted provider job metadata and hydration classification complete
- Phase 3.8D2 automatic resume polling for valid persisted provider jobs complete
- Phase 3.8D3 resume hardening and UX finalization complete
- Phase 3.8E durable backend queue not started

Scope:

- polling-capable services
- durable provider job identity
- resumable orchestration contracts

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

### Phase 4 — Timeline & Video System

Status:

- not started

### Phase 5 — Agent System

Status:

- not started

### Phase 6 — Backend & Infrastructure

Status:

- not started

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
