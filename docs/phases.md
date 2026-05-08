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

- not started

Scope:

- remove service-layer simulated success paths
- keep transport failures as true failures
- preserve current lifecycle rules
- tighten progress semantics so they do not imply fake backend truth

#### Phase 3.8 — Long-running Provider Patterns

Status:

- not started

Scope:

- polling-capable services
- durable provider job identity
- resumable orchestration contracts

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
- Service-layer mock success remains a Phase 3.7 issue.
- Phase 3.6 hydration/runtime verification is complete.
