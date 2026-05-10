# Roadmap

This file is the concise delivery roadmap for Free AI Mixer. Detailed technical truth lives in [PROJECT_BIBLE.md](../PROJECT_BIBLE.md). Canonical phase numbering lives in [docs/phases.md](./phases.md).

## Current Direction

The platform is being built in this order:

1. establish product direction and production intent
2. preserve UI experimentation history without letting it drive architecture
3. stabilize the real logic layer
4. expand into timeline and video systems
5. expand into agent systems
6. expand into backend and infrastructure
7. optimize for production scale and reliability

## Roadmap Sequence

### Phase 1: Vision & Product Direction

- AI scene generation platform
- multi-provider orchestration
- real generation lifecycle
- production-oriented architecture

Status:

- established

### Phase 2: UI Exploration

- antigravity experiments
- Stitches design iterations
- scene queue interface
- generation cards
- provider visibility

Status:

- historical exploration phase

### Phase 3: Real Logic Layer

- Phase 3.0 UI System
- Phase 3.1 Zustand Global Store / Scene Lifecycle
- Phase 3.2 Global Store Stabilization
- Phase 3.3 Error Normalization / Async Pipeline
- Phase 3.4 Queue + Providers
- Phase 3.5 Lifecycle Engine
- Phase 3.6 Hydration & State Stability
- Phase 3.7 Transport Truthfulness & Provider Realism
- Phase 3.8 Long-running Provider Patterns

Status:

- complete through Phase 3.8

### Phase 4: Timeline & Video System

- sequence structures
- timeline orchestration
- scene ordering and video-oriented systems

Status:

- started (Phase 4.1 timeline domain types complete; Phase 4.2 timeline store complete; Phase 4.3 timeline UI complete; Phase 4.4 sequencing/reorder complete; Phase 4.5 playback simulation complete; Phase 4.6 video/export orchestration planning complete; export implementation deferred)

### Phase 5: Agent System

- AI director agents
- scene memory
- collaborative and workflow agents

Status:

- in progress (Phase 5.1 export/render job domain types complete; Phase 5.2 export service contracts complete; Phase 5.3 export agent scaffold complete; Phase 5.4 export store integration complete; Phase 5.5 export UI/status actions complete; Phase 5.6 export resume/hardening complete; runtime export still deferred)

### Phase 6: Backend & Infrastructure

- durable backend queue
- infrastructure services
- cloud execution paths

Status:

- started (Phase 6.0-A backend/export planning audit complete; Phase 6.0-B docs/architecture sync complete; Phase 6.1-A/B/C backend scaffold and contract tests complete)

Recommended Phase 6 path:

- backend contract scaffold first
- truthful local job registry next
- frontend endpoint/config integration next
- contract/integration testing next
- renderer architecture decision after contract stability
- do not claim real video rendering or downloadable export output yet

### Phase 7: Production Optimization

- monitoring
- performance hardening
- operational polish

Status:

- not started

## Current Priority Order

1. preserve Phase 3.8 verification and backend-boundary clarity
2. keep backend durable queue and multi-device resume deferred until backend/infrastructure work
3. run Phase 6.1-E backend scaffold final sign-off audit, then start Phase 6.2-A in-memory job lifecycle hardening audit
