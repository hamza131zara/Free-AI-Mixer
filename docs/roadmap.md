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

- started (Phase 6.0-A backend/export planning audit complete; Phase 6.0-B docs/architecture sync complete; Phase 6.1-A/B/C backend scaffold and contract tests complete; Phase 6.2-A/B registry idempotency/lifecycle complete; Phase 6.3-A/B local frontend/backend integration support complete; Phase 6.5-A renderer architecture decision audit complete)

Recommended Phase 6 path:

- backend contract scaffold first
- truthful local job registry next
- frontend endpoint/config integration next
- contract/integration testing next
- renderer architecture decision after contract stability
- do not claim real video rendering or downloadable export output yet

Phase 6.3 integration note:

- local Vite proxy support is in place for `/exports -> http://127.0.0.1:8787`
- export service defaults align to backend scaffold `/exports` route family
- runtime config precedence and `VITE_EXPORT_*` fallback behavior remain preserved
- focused local integration test coverage exists in `tests/e2e/phase63-frontend-backend-integration.spec.ts`
- this does not imply renderer availability, artifact URLs, progress telemetry, cancellation authority, or downloadable output

Phase 6.5 renderer decision note:

- recommended future direction is a Remotion-first backend renderer pilot
- no renderer implementation exists yet
- no real video rendering or downloadable output exists yet
- artifact hosting/signed URLs are still deferred
- renderer rollout requires worker/queue boundaries first
- planned prerequisite lifecycle is `submitted -> rendering -> finalizing -> success | error | expired` (`queued` deferred)
- planned worker boundary is claim/render/finalize/success-or-error with backend-authoritative transitions
- metadata-only artifact API contract remains required (no raw blobs, no local paths)
- progress remains stage-only unless truthful renderer percent becomes available
- next phase was Phase 6.6-A backend lifecycle state machine audit only

Phase 6.6 lifecycle state machine note:

- Phase 6.6-A audit is complete
- Phase 6.6-B backend lifecycle state machine implementation + focused tests is complete
- backend lifecycle transition guards now exist in registry/contracts while route behavior remains contract-compatible
- frontend remains unchanged
- no renderer/worker/queue runtime, artifact hosting, or downloadable output was introduced
- next phase was Phase 6.6-D backend lifecycle state machine final sign-off

Phase 6.7 artifact metadata note:

- Phase 6.7-A audit is complete
- Phase 6.7-B artifact metadata contract implementation + focused tests is complete
- artifact metadata contract is backend-only and structural-only in this phase
- no real artifact files, hosting/signing URLs, or downloadable outputs exist yet
- routes remain truthful and keep artifacts unavailable unless real artifacts exist
- next phase was Phase 6.7-D artifact metadata contract final sign-off

Phase 6.8 worker boundary claim note:

- Phase 6.8-A audit is complete
- Phase 6.8-B worker boundary claim contract implementation + focused tests is complete
- worker boundary claim ownership exists in backend registry only (process-local/in-memory)
- no route mutation surface was added, and frontend remains unchanged
- this is not worker runtime, queue runtime, or renderer execution
- next phase was Phase 6.8-D worker boundary claim contract final sign-off

Phase 6.9 renderer-readiness note:

- Phase 6.9-A backend renderer-readiness audit is complete
- backend/export foundation is ready to move into Phase 7.0-A Remotion renderer pilot audit planning
- remaining implementation prerequisites are:
  - renderer input snapshot contract
  - media input reference normalization
  - temp/output directory policy
  - real file existence verification
  - artifact retention/cleanup policy
  - Remotion runtime/dependency execution wrapper
  - renderer failure mapping
  - single-process worker execution harness
- next phase is Phase 6.9-C final Phase 6 manual sign-off, then Phase 7.0-A audit-only planning

Phase 7.0 renderer snapshot note:

- Phase 7.0-A audit is complete
- Phase 7.0-B renderer input snapshot contract implementation + focused tests is complete
- backend-only snapshot contract now exists with strict structural validation and immutable snapshot creation
- no Remotion install, no renderer execution, no file generation, and no download output were introduced
- next phase was Phase 7.0-D renderer input snapshot contract final sign-off

Phase 7.1 temp/output path policy note:

- Phase 7.1-A audit is complete
- Phase 7.1-B temp/output path policy helper implementation + focused tests is complete
- output path policy is backend-internal only with safe root-key derivation and traversal/injection rejection
- no file/directory creation, no artifact creation, no URL/download output, and no lifecycle mutation were introduced
- next phase is Phase 7.1-D temp/output path policy final sign-off

Phase 7.2 real file verification note:

- Phase 7.2-A audit is complete
- Phase 7.2-B real file verification helper implementation + focused tests is complete
- verification helper is backend-internal and read-only, and validates existence, regular-file target, non-empty size, and expected format
- verified metadata includes only safe artifact metadata fields and excludes local path/URL/download fields
- tests may use test-only temp files/directories and must clean up; production helper does not create/write/delete files
- this phase does not add Remotion install, renderer execution, production file output, artifact hosting, signed URLs, or download URLs
- next phase is Phase 7.2-D real file verification final sign-off, then Phase 7.3-A renderer failure mapping audit only

Phase 7.3 renderer failure mapping note:

- Phase 7.3-A audit is complete
- Phase 7.3-B renderer failure mapping helper implementation + focused tests is complete
- mapper is backend-internal only and normalizes raw renderer/runtime failures to safe structured failures
- artifact verification failure codes are preserved, timeout and abort are distinguished, and retryability policy is explicit
- public-safe sanitization strips stack/path/url/env/command/secret-like fields
- no renderer execution, file generation, artifact hosting, signed URLs, download URLs, lifecycle mutation, or frontend changes were introduced
- next phase is Phase 7.3-D renderer failure mapping final sign-off, then Phase 7.4-A single-process renderer execution harness audit only

Phase 7.4 single-process execution harness note:

- Phase 7.4-A audit is complete
- Phase 7.4-B harness contract + injected orchestrator helper + focused tests is complete
- harness remains backend-only and adapter-injected (no real renderer runtime)
- no route auto-execution from `POST /exports` was introduced
- no queue/scheduler/worker loop/database/durable persistence was introduced
- no hosting/signing/download URL behavior was introduced
- no fake artifacts/progress/cancellation behavior was introduced
- frontend behavior remains unchanged
- next phase is Phase 7.4-D single-process renderer execution harness final sign-off, then Phase 7.5-A Remotion dependency / renderer adapter audit only

Phase 7.5 Remotion adapter stub note:

- Phase 7.5-A audit is complete
- Phase 7.5-B Remotion adapter contract stub + focused tests is complete
- adapter stub is backend-only, harness-compatible, and explicit non-success (`ok: false`) while Remotion runtime remains unimplemented
- stub import is safe without Remotion installed
- no Remotion install/import, no `@remotion/renderer`, and no composition files were introduced
- no route auto-execution, queue/scheduler/worker loop, database/durable persistence, hosting/signing/download URLs, or frontend changes were introduced
- next phase is Phase 7.5-D Remotion adapter contract stub final sign-off, then Phase 7.6-A Remotion dependency install audit only

Phase 7.6 Remotion dependency install note:

- Phase 7.6-A audit is complete
- Phase 7.6-B dependency install only is complete
- dependencies added:
  - `remotion`
  - `@remotion/renderer`
- no Remotion imports, renderer runtime, adapter runtime implementation, composition files, route auto-execution, or frontend changes were introduced
- Phase 7.5 adapter expectations remain truthful:
  - dependencies may now exist
  - adapter stub still returns not-implemented failure
  - adapter stub still must not import Remotion runtime directly
- validation recorded: typecheck/build/focused backend checks passed, with clean git status after commit
- next phase is Phase 7.6-D Remotion dependency install final sign-off, then Phase 7.7-A Remotion import smoke test audit only

### Phase 7: Production Optimization

- monitoring
- performance hardening
- operational polish

Status:

- not started

## Current Priority Order

1. preserve Phase 3.8 verification and backend-boundary clarity
2. keep backend durable queue and multi-device resume deferred until backend/infrastructure work
3. run Phase 7.6-D Remotion dependency install final sign-off, then Phase 7.7-A Remotion import smoke test audit only
