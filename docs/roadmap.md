# Roadmap

This file is the concise delivery roadmap for Free AI Mixer. Detailed technical truth lives in [PROJECT_BIBLE.md](../PROJECT_BIBLE.md). Canonical phase numbering lives in [docs/phases.md](./phases.md).

## Launch Block Roadmap

Remaining go-live work is organized into eight launch blocks:

1. Block 0 - Provider Capability + Free/Paid Policy
2. Block 1 - Production Auth + Supabase Persistence
3. Block 2 - Production Storage + Artifact Delivery
4. Block 3 - Billing / Credits / Subscriptions
5. Block 4 - Real Provider Generation
6. Block 5 - Real Video Generation
7. Block 6 - Production Deployment
8. Block 7 - Final Launch QA / Private Beta / Public Launch

Block 0 policy:

- Free workspace and mock/demo generation are available.
- BYOK means users bring their own provider API keys and use provider quota where available.
- BYOK does not create free provider credits, and image/video provider APIs may require separate provider billing or eligible account access.
- Paid Free AI Mixer credits/subscriptions are a future Block 3 boundary for users who do not want to manage provider keys.
- Real provider generation, real video generation, production storage delivery, billing, deployment, and launch remain separate audited blocks.

## Launch Block 1 - Production Auth + Supabase Persistence

Block 1 is complete as a production-readiness foundation without remotely applying production migrations:

- backend requester context must come from trusted JWT/session boundaries only
- arbitrary frontend user/workspace headers must not authorize protected routes
- owner/admin policy applies to provider keys, generation jobs, projects, and generated artifact access
- generation, generated artifact access/preview, and project/history routes now accept fail-closed production auth and persistence seams where safely wired
- repository-backed Supabase persistence writer support exists for safe project, generation job, generated artifact, and image history metadata
- Supabase persistence drafts cover app users, workspaces, memberships, projects, generation jobs, generated artifact records, image generation history, provider key metadata, audit logs, and analytics events
- browser-local history fallback remains honest when server persistence is unavailable
- durable persistence still requires Supabase backend env plus manually reviewed/applied migration tables
- migration drafts require manual local/staging review; no remote production migration auto-apply is allowed
- no real provider calls, API key validation calls, billing, public URLs, signed URLs, download URLs, or direct frontend Supabase DB/storage access are introduced

## Launch Block 2 - Production Storage + Artifact Delivery

Block 2 adds the backend-mediated production storage and artifact delivery foundation:

- generated image production storage refs are backend-only and must never appear in public JSON
- Supabase private-bucket generated image upload/read boundaries exist behind backend service configuration
- generated artifact access may return only a relative backend `previewPath` descriptor when `FREE_AI_MIXER_PRODUCTION_ARTIFACT_DELIVERY_MODE=backend_mediated_stream`
- preview bytes are served only by the generation-specific backend route after auth, ownership, persistence, storage-ref, content-type, and object-read checks
- signed URLs, public URLs, download URLs, direct frontend Supabase storage, and export-route reuse remain unavailable
- Block 2 storage migration and private bucket setup require manual review/apply; no remote production migration auto-apply is allowed
- video artifact delivery remains unavailable until a separate audited block

## Launch Block 3 - Billing / Credits / Subscriptions

Block 3 adds the platform-paid billing foundation while keeping live payments unavailable:

- credit wallet, ledger, reservation, settlement, release, refund, usage-limit, subscription, billing-event, and provider-cost estimate boundaries exist
- `0006_launch_block3_billing_credits_subscriptions_draft.sql` is draft/manual only and must be reviewed before any local/staging/production apply
- `/credits/status` can report backend-derived wallet readiness, but missing config/tables/wallets remain truthful unavailable states
- `/billing/plans` still exposes draft plans only; there is no live payment processor, no checkout, no webhook processing, no fake purchases, no fake balances, no fake subscriptions, and no automatic charges
- future Block 4 platform-paid provider generation must reserve credits before provider calls and settle/release/refund after the final outcome
- BYOK remains separate from platform-paid credits: BYOK users use their own provider quota/billing and do not receive guaranteed provider credits
- no real provider calls, API key validation, Stripe/Paddle live checkout, billing mutation, public/signed/download URLs, or fake paid success are introduced

## Launch Block 4 - Real Provider Generation

Block 4 adds the real-provider generation policy boundary while keeping provider calls out of automation:

- OpenAI is the only executable real-provider adapter in this block
- BYOK uses user-owned provider key/quota/billing and requires an active validated backend-stored provider key
- platform-paid generation remains blocked with `platform_credits_not_configured` until platform-owned provider credentials and credit reservation are separately configured
- Google/Gemini/Imagen/Veo remain unavailable until separate audited adapter work
- automated tests must mock provider fetches; Codex/test automation must not use real keys or call providers
- manual real-provider smoke remains backend-only, one controlled attempt, user-owned key only, and requires provider billing/quota/model access
- no video provider execution, public/signed/download URLs, fake provider success, or provider raw data exposure is introduced

## Phase 18 Recommendation

Admin Analytics + Platform Metrics should stay in a future readiness-only audit
phase until all of the following are real and verified:
- production auth with verified `platform_admin` identity
- real app user and workspace database truth
- real event logging and aggregation
- real credits, billing, generation, export, and artifact ownership data

Do not ship fake dashboard counts, fake trend cards, or synthetic platform
health metrics before those prerequisites exist.

## Phase 20 Recommendation

Event logging and audit trails should stay in a future readiness-only boundary
until all of the following are real and verified:
- production auth and backend-derived actor identity
- platform-admin enforcement for privileged audit access
- privacy-reviewed event taxonomy and retention policy
- backend-owned persistence for analytics events and append-only audit records
- real runtime truth for generation, export, credits, billing, and storage events

Do not persist fake events, synthetic security records, or placeholder success
events before those prerequisites exist.

## Phase 21 Recommendation

Event and audit persistence should stay in a schema-strategy-only phase until
all of the following are real and verified:
- separate `analytics_events` and `audit_log` persistence strategy
- default-deny RLS and backend-only access rules
- append-only audit semantics
- privacy-reviewed retention rules
- route and worker hook rollout audits

Do not add migrations, route integration, runtime persistence, or real admin
analytics in the schema-strategy phase.

## Phase 22 Recommendation

Database and persistence rollout should stay in a migration-draft-only phase
until all of the following are real and verified:
- separate `analytics_events` and `audit_log` draft migration text exists
- default-deny RLS is defined without permissive client access
- runtime recorders remain no-op by default
- repository adapter rollout is still deferred
- route and worker event hooks remain deferred

Do not execute migrations, wire persistence into runtime, or activate admin
analytics in the migration-draft phase.

## Phase 23A Recommendation

Backend JWT verification should roll out as an isolated boundary phase before
any broader auth or workspace runtime work:
- backend JWT verification boundary may become real and env-gated
- default tests should use mocked or local JWKS only
- frontend Supabase auth client remains deferred
- workspace membership lookup remains deferred
- protected-route enforcement rollout remains deferred

Do not enable frontend auth runtime, workspace authorization, route protection,
or platform-admin runtime in the JWT-boundary-only phase.

## Phase 23B Recommendation

Requester-context enrichment should roll out as a backend-only bridge phase:
- verified JWT proves identity only
- app-user mapping comes from backend repository lookup
- workspace authority comes from backend membership lookup only
- `/auth/session` may reflect backend-derived identity and workspace state
- route enforcement rollout remains deferred

Do not add frontend Supabase auth, do not trust workspace claims or headers, and
do not enable platform-role lookup or protected-route enforcement in the
requester-context bridge phase.

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

Phase 7.7 Remotion import smoke note:

- Phase 7.7-A audit is complete
- Phase 7.7-B import smoke test only is complete
- smoke scope is import-only:
  - dynamic import of `remotion`
  - dynamic import of `@remotion/renderer`
- smoke scope intentionally excludes runtime API execution and renderer output generation
- correction recorded:
  - this phase should not require asserting specific runtime exports (for example `bundle`)
  - runtime rendering API verification remains deferred
- adapter stub remains truthful and not implemented (`ok: false`)
- no composition files, route auto-execution, artifact metadata outputs, url/download/signed/public-url outputs, or frontend changes were introduced
- next phase is Phase 7.7-D Remotion import smoke test final sign-off, then Phase 7.8-A Remotion adapter implementation audit only

Phase 7.8 Remotion adapter mocked-runtime note:

- Phase 7.8-A audit is complete
- Phase 7.8-B adapter implementation with mocked renderer calls is complete
- adapter remains backend-only and harness-compatible
- optional mocked runtime injection is supported with explicit call sequencing:
  - `bundle`
  - `selectComposition`
  - `renderMedia`
- mocked success is adapter-call success only (not verified artifact success)
- no real renderer runtime execution, no composition files, and no route auto-execution were introduced
- no lifecycle mutation, no artifact metadata creation, no url/download/signed/public-url outputs, and no frontend changes were introduced
- failure diagnostics are sanitized with no stack/path/url/env/secret leakage
- next phase is Phase 7.8-D Remotion adapter implementation final sign-off, then Phase 7.9-A Remotion composition boundary audit only

Phase 7.9 Remotion composition boundary scaffold note:

- Phase 7.9-A audit is complete
- Phase 7.9-B composition boundary scaffold only is complete
- backend-only composition scaffold now exists under `backend/renderer/compositions/`
- scaffold accepts only snapshot-derived serializable props and renders deterministic placeholder timeline structures
- no renderer runtime API calls, no file/artifact output creation, no route auto-execution, and no frontend changes were introduced
- boundary checks ensure no imports from frontend store/service/agent layers or backend route/registry layers
- next phase is Phase 7.9-D Remotion composition boundary final sign-off, then Phase 8.0-A real renderer runtime execution audit only

Phase 8.0 runtime helper boundary note:

- Phase 8.0-A audit is complete
- Phase 8.0-B runtime helper boundary + adapter delegation is complete
- runtime helper boundary now exists in `backend/renderer/remotionRuntime.ts`
- adapter delegates runtime sequencing through backend runtime helper/injected runtime boundary
- this phase remains mocked-call only:
  - no real renderer runtime execution
  - no route auto-execution
  - no frontend changes
  - no artifact hosting/signed URLs/download URLs
  - no lifecycle mutation in runtime helper/adapter/composition
- next phase is Phase 8.0-D final sign-off
- later audited phases are still required for:
  - real Remotion runtime execution with proper composition selection and full VideoConfig handling
  - verified output production flow through artifact verification before success
  - explicit route/job execution trigger decisions
  - artifact hosting and downloadable URL issuance

Phase 8.1 bundler + runtime type boundary prep note:

- Phase 8.1-A audit is complete
- Phase 8.1-B bundler dependency + runtime type boundary prep is complete
- this phase is boundary/dependency prep only:
  - `@remotion/bundler` added
  - runtime helper type boundaries prepared for future real runtime integration
  - no real runtime execution enabled
- no route auto-execution, no frontend changes, and no artifact hosting/signed/download URL behavior were introduced
- lifecycle ownership remains harness/registry only
- next phase is Phase 8.1-D final sign-off
- later audited phases are still required for:
  - first controlled real render smoke execution
  - artifactVerification-backed verified output before success
  - explicit backend job execution trigger decisions
  - artifact hosting and downloadable URL issuance

### Phase 7: Production Optimization

- monitoring
- performance hardening
- operational polish

Status:

- not started

## Current Priority Order

1. preserve Phase 3.8 verification and backend-boundary clarity
2. keep backend durable queue and multi-device resume deferred until backend/infrastructure work
3. run Phase 7.9-D Remotion composition boundary final sign-off, then Phase 8.0-A real renderer runtime execution audit only
## Phase 8.2 status

- Phase 8.2-A: complete (audit only).
- Phase 8.2-B: complete (controlled real backend Remotion smoke, opt-in only).
- Phase 8.2-C: docs update only (this update).
- Next: Phase 8.2-D final sign-off.

### What Phase 8.2-B delivered

- First controlled real backend smoke path (test-only, opt-in).
- Real pipeline for opt-in smoke: bundle -> composition discovery/selection -> render -> file verification.
- Browser-mode stabilization via `chromeMode: "headless-shell"`.

### Still deferred after 8.2-B

- Route-triggered or auto renderer execution.
- Frontend integration changes.
- Real user media decoding pipeline.
- Production artifact hosting.
- Signed URL and download URL capability.
- Queue/scheduler/worker-loop/database durability expansions.

### Next planned audit after 8.2-D

- Phase 8.3-A — Renderer Adapter Real Runtime Integration Audit Only.

## Phase 8.3 status

- Phase 8.3-A: complete (adapter real-runtime integration audit).
- Phase 8.3-B: complete (adapter boundary aligned to real-smoke runtime entry/composition/props flow).
- Phase 8.3-C: docs update only (this update).
- Next: Phase 8.3-D final sign-off.

### What 8.3-B completed

- Adapter default runtime boundary alignment with backend composition entry.
- Adapter snapshot-to-composition-props conversion before runtime delegation.
- Delegation preserved: runtime API calls remain in runtime helper boundary.

### Still deferred after 8.3-B

- Harness/job execution expansion for production renderer flow.
- Route-triggered backend renderer execution.
- Production artifact hosting/signing/download URLs.
- Frontend integration with real backend lifecycle/render completion.

## Phase 8.4 status

- Phase 8.4-A: complete (harness real-runtime integration audit).
- Phase 8.4-B: complete (focused harness-level real-runtime integration test milestone).
- Phase 8.4-C: docs update only (this update).
- Next: Phase 8.4-D final sign-off.

### What 8.4-B delivered

- Harness-level integration test coverage for real adapter/runtime execution in opt-in mode.
- Verified boundary that harness-owned artifact verification gates success transition.
- Preserved route non-execution and backend-only scoped runtime testing.

### Still deferred after 8.4-B

- Backend render job trigger wiring for normal flow.
- Route-triggered backend renderer execution.
- Production artifact hosting/signing/download URL delivery.
- Frontend integration with real backend lifecycle/render completion.
- Durable persistence/queue/worker/scheduler expansion.

## Phase 8.5 status

- Phase 8.5-A: complete (backend execution trigger audit).
- Phase 8.5-B: complete (internal backend execution trigger milestone).
- Phase 8.5-C: docs update only (this update).
- Next: Phase 8.5-D final sign-off.

### What 8.5-B delivered

- Internal backend trigger boundary for harness execution (`executeRenderJob`).
- Focused test coverage for delegation, lifecycle neutrality at trigger layer, and route non-execution guarantees.

### Still deferred after 8.5-B

- Route-triggered backend execution (`POST /exports` execution wiring).
- Queue/worker/scheduler/database-backed durable execution.
- Production artifact hosting/signing/download URL delivery.
- Frontend integration with real backend lifecycle completion.
- Production scalability/security hardening phases.

## Phase 8.13 status

- Phase 8.13-A: complete (audit).
- Phase 8.13-B: complete (worker lifecycle app wiring).
- Phase 8.13-C: docs update only (this update).
- Next: Phase 8.13-D final sign-off.

### What 8.13-B delivered

- Worker lifecycle module: `backend/workers/renderWorkerLifecycle.ts`.
- Lifecycle factory `createRenderWorkerLifecycle(...)` with init/shutdown/isRunning/getStatus API.
- App.ts wiring using already-composed backendDeps (registry, rendererAdapter, pathPolicy).
- Lifecycle init called during app creation but remains harmless without env flags.
- Lifecycle stored internally as `app.locals.renderWorkerLifecycle` (internal/test/dev only).
- No public lifecycle/status route added.

### Preserved boundaries

- rendererAdapter/pathPolicy composed but NOT wired into exports router.
- POST /exports remains non-executing.
- POST /exports/:jobId/execute remains dev/test-gated with timeout.
- No server.ts changes, no process signal handlers, no graceful shutdown wiring.
- No route enqueue behavior yet.
- No durable queue/persistence yet.
- No cancellation yet.
- No frontend changes yet.
- Worker lifecycle depends on in-memory registry only.

### Still deferred after 8.13-B

- Route enqueue behavior (automatic execution on POST /exports).
- Durable queue/persistence (Redis/database-backed execution).
- Server graceful shutdown (SIGINT/SIGTERM handlers, server.close wiring).
- Frontend async worker integration.
- Production artifact hosting/signed URLs/download capability.
- Production auto-start without env flags.

## Phase 25 status

- Phase 25: complete when the real auth runtime smoke/runbook pack is signed off.
- Scope: docs/runbook, `.env.example` comments, and one opt-in real auth smoke spec only.
- No runtime behavior changes are included in Phase 25.

### What Phase 25 adds

- `docs/real-auth-runtime-smoke-runbook.md` documents real auth setup, required env, smoke execution, safe failure states, and manual recovery guidance.
- `tests/e2e/phase25-real-auth-runtime-smoke.spec.ts` is disabled by default and runs only when `FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE=1`.
- The smoke is run through the existing `test:e2e` script with the Phase 25 spec path; no extra npm script is required.

### Preserved boundaries

- No auth route behavior changes.
- No `/account/bootstrap` behavior changes.
- No Login or Signup behavior changes.
- No bearer attachment expansion.
- No migrations.
- No real signup automation.
- No automatic remote data cleanup.
- No generation/export/billing/credits-ledger/admin/event/audit/analytics runtime expansion.

### Still deferred after Phase 25

- Active workspace selection.
- OAuth.
- Transactional bootstrap hardening.
- Event/audit persistence wiring.
- Admin analytics activation.
- Vite bundle-size/performance hardening.

## Phase 27 status

- Phase 27: complete when the password reset and account recovery UX pack is signed off.
- Scope: Supabase Auth password reset/update wrapper methods, forgot-password and reset-password pages, dashboard account status/retry UX, and focused regression coverage.
- No backend route, database, bearer-scope, generation, export, billing, credits-ledger, admin, event/audit, or analytics runtime changes are included.

### What Phase 27 adds

- `/forgot-password` requests Supabase Auth reset instructions with neutral account-enumeration-safe copy.
- `/reset-password` updates the password through the Supabase recovery session, signs out, and asks the user to sign in again.
- Login links to account recovery.
- Dashboard shows backend-derived account/session/workspace setup status and supports manual session refresh plus account bootstrap retry.
- Multiple-active-workspace UX remains blocked but clearer; active workspace selection is still deferred.

### Preserved boundaries

- No reset tokens, access tokens, raw Supabase users, or raw Supabase sessions are stored in app state.
- Frontend Supabase usage remains auth-only with no DB/storage access.
- Service-role keys remain backend-only.
- Backend `/auth/session` remains canonical for authenticated app state.
- `/account/bootstrap` response does not directly grant app authentication without a follow-up session refresh.

### Still deferred after Phase 27

- Active workspace selection.
- OAuth.
- Transactional bootstrap hardening.
- Event/audit persistence wiring.
- Admin analytics activation.
- Vite bundle-size/performance hardening.

## Phase 28 status

- Phase 28: complete when the controlled private beta readiness docs/checklist pack is signed off.
- Scope: docs-only controlled private beta checklist, tester instructions, manual QA commands, password reset redirect notes, operational recovery notes, beta disable/rollback guidance, and beta security checklist.
- No runtime behavior changes are included in Phase 28.

### What Phase 28 adds

- `docs/private-beta-readiness-checklist.md` documents controlled beta readiness for 3-5 trusted testers only.
- The checklist clarifies what is ready, what remains unavailable, tester expectations, manual QA, operational recovery, and rollback/disable guidance.
- `docs/real-auth-runtime-smoke-runbook.md` now documents password reset redirect setup and no longer treats password reset UX as deferred.

### Still deferred after Phase 28

- Active workspace selection and team/invite/multi-workspace UX.
- OAuth.
- Real billing, checkout, webhooks, credits ledger, and credit mutation runtime.
- BYOK/provider key storage.
- Generation/export runtime expansion and public artifact delivery.
- Event/audit persistence wiring.
- Admin analytics.
- Broader beta and public launch.

## Phase 31 status

- Phase 31: complete when the BYOK provider key storage strategy doc is signed off.
- Scope: docs-only BYOK/provider key storage strategy, threat model, future backend-only route contracts, authorization rules, storage/vault options, redaction rules, and future test requirements.
- No runtime behavior changes are included in Phase 31.

### What Phase 31 adds

- `docs/byok-provider-key-storage-strategy.md` documents the future provider key storage contract.
- The strategy confirms Provider Settings remains a safe non-live authenticated boundary page.
- The strategy requires backend-only encryption/decryption, backend workspace authorization, masked frontend responses, and no frontend provider key storage or direct provider calls.

### Still deferred after Phase 31

- Live BYOK/provider key storage.
- Encrypted vault runtime.
- Provider SDK/API verification.
- Provider key UI input fields.
- Provider settings routes/mutations becoming live.
- Migrations for live provider key persistence.
- Active workspace selection.
- Real credits, billing, checkout, credit ledger, and credit mutation runtime.
- Generation/export runtime integration with provider keys.
- Event/audit persistence wiring.

## Merged Phase 34 status

- Merged Phase 34: complete when the BYOK pre-live security boundary coverage is signed off.
- Scope: focused boundary coverage for provider settings mutation fail-closed behavior, BYOK/provider-secret redaction, frontend source boundaries, and runtime non-expansion.
- Provider settings mutation routes remain fail-closed.
- The not-configured provider secret vault cannot produce fake success.
- BYOK/provider-secret redaction now covers `provider_raw_error` and `providerrawerror`.
- Frontend remains safe: no raw provider key input UI, no frontend Supabase/storage key access, and no browser storage for provider keys.

### Preserved boundaries after Merged Phase 34

- No live BYOK storage was added.
- No migrations were added.
- No provider SDK/API calls were added.
- No fake connected or verified provider state was added.
- No credits, billing, generation, export, admin, event, or audit runtime behavior changed.

## Phase 35 status

- Phase 35: complete when the auth email, custom SMTP, and tester onboarding docs/copy pack is signed off.
- Scope: docs and tester-facing copy only.
- No auth runtime logic, backend routes, migrations, Supabase configuration automation, SMTP credentials, generation/export, credits, billing, BYOK, event/audit, or analytics behavior changes are included.

### What Phase 35 adds

- `docs/auth-email-custom-smtp-onboarding.md` documents manual Supabase custom SMTP setup readiness, redirect allow-list requirements, email rate-limit guidance, newest-email-only behavior, tokenized-link safety, dedicated tester account guidance, and revocation/rollback notes.
- Private beta and real auth smoke docs now clarify that custom SMTP is needed before broader tester onboarding and that built-in Supabase email delivery can rate-limit repeated signup/password reset testing.
- Auth pages include static copy guidance for confirmed-user login, sparse email requests, spam/junk/promotions folder checks, newest verification/recovery email use, expired/reused/wrong-port links, non-instant delivery expectations, and tokenized-link safety.
- Phase 35 does not claim production auth email is fully configured unless the environment-specific Supabase Auth email or custom SMTP setup has been manually verified.

### Still deferred after Phase 35

- Real SMTP configuration automation.
- OTP/code confirmation flow.
- Automated signup or password reset smoke.
- Active workspace selection.
- OAuth.
- Public launch.
- Real billing, credits ledger, provider key storage, generation/export account runtime, event/audit persistence, and analytics.

## Phase 36 status

- Phase 36: complete when the controlled private beta staging and go/no-go docs pack is signed off.
- Scope: docs-only go/no-go matrix, staging readiness checklist, local dry-run checklist, tester invitation checklist, product honesty checklist, security/privacy checklist, and rollback guidance.
- No frontend code, backend code, tests, auth logic, deployment config, SMTP configuration, provider/BYOK runtime, credits, billing, generation/export, event/audit, analytics, or public launch behavior changes are included.

### What Phase 36 adds

- `docs/private-beta-go-no-go-checklist.md` defines readiness for local/manual dry run, one internal smoke user, 3-5 trusted testers, 5-15 testers, and public/open beta.
- The checklist records staging requirements, redirect allow-list expectations, real auth smoke usage, tester invitation controls, product honesty gates, security/privacy gates, and disable/rollback guidance.

### Still deferred after Phase 36

- Real deployment configuration.
- Custom SMTP configuration in Supabase.
- Broader tester onboarding beyond 3-5 trusted testers.
- Public/open beta.
- OTP/code confirmation.
- Active workspace selection.
- OAuth.
- Real billing, credits ledger, provider key storage, generation/export account runtime, event/audit persistence, and analytics.

## Phase 37 status

- Phase 37: complete when the private beta publish readiness smoke pack is signed off.
- Scope: one focused smoke/regression test plus docs notes only.
- The smoke verifies public shell loading, protected-route honesty, auth email/custom SMTP copy, non-live credits/provider settings/project/export/admin boundaries, no fake artifact delivery, source-boundary safety, and continued public-launch blocking.
- No live auth changes, SMTP credentials, migrations, BYOK storage, credits/billing mutation, provider SDK/API calls, generation/export/render runtime changes, artifact delivery behavior, fake success state, or public launch approval are included.

### Still deferred after Phase 37

- Manual staging go/no-go execution.
- Custom SMTP configuration in Supabase.
- Broader tester onboarding beyond the controlled private beta gate.
- Public/open beta.
- Live credits, billing, BYOK storage, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and deployment hardening.

## Phase 38 status

- Phase 38: complete when the staging deployment readiness pack is signed off.
- Scope: one focused staging readiness smoke, staging readiness documentation, and roadmap/known-issues/phase notes.
- The pack validates production build script readiness, backend-safe public shell behavior, protected-page honesty, documented staging env names without real values, no service-role exposure, no frontend Supabase DB/storage access, no fake public-launch or fully-live claims, and continued non-live boundaries for BYOK, credits/billing, export/artifact delivery, and admin analytics.
- No deployment, real env values, SMTP credentials, migrations, live BYOK storage, credits/billing mutation, provider SDK/API calls, auth runtime changes, backend route changes, generation/export/render runtime changes, artifact delivery behavior, fake success state, or public launch approval are included.

### Still deferred after Phase 38

- Actual staging deployment and environment configuration.
- Manual custom SMTP verification.
- Manual real auth smoke against staging.
- Broader tester onboarding.
- Public/open beta.
- Live BYOK, credits, billing, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and production launch approval.

## Phase 39 status

- Phase 39: complete when the staging publish dry-run safety pack is signed off.
- Scope: one focused safety regression, placeholder-only staging env documentation, staging dry-run checklist updates, and roadmap/known-issues/phase notes.
- The pack validates required staging env names without real values, frontend-public versus backend-server-only env boundaries, manual smoke/checklist gates, private beta go/no-go gating, custom SMTP manual verification, non-live BYOK/credits/billing/export/admin boundaries, no frontend Supabase DB/storage access, no secret-looking committed values, and unchanged build/typecheck posture.
- No deployment, real env values, SMTP credentials, service-role keys, migrations, auth runtime changes, backend route changes, live BYOK storage, credits/billing mutation, provider SDK/API calls, generation/export/render runtime changes, artifact delivery/download behavior, fake success state, or public launch approval are included.

### Still deferred after Phase 39

- Actual staging deployment.
- Real staging secret configuration in a deployment provider.
- Manual custom SMTP verification.
- Manual real auth smoke against staging.
- Tester invitation execution.
- Public/open beta.
- Live BYOK, credits, billing, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and production launch approval.

## Phase 40 status

- Phase 40: complete when the staging manual smoke runbook and tester invite pack is signed off.
- Scope: docs and focused docs regression coverage only.
- The pack adds a manual staging smoke runbook, controlled tester invite guidance, known-limitations language, stop/rollback criteria, and secret-free/non-launch checks.
- No deployment, real env values, SMTP credentials, service-role keys, migrations, auth runtime changes, backend route changes, live BYOK storage, credits/billing mutation, provider SDK/API calls, generation/export/render runtime changes, artifact delivery/download behavior, fake success state, frontend UI behavior, or public launch approval are included.

### Still deferred after Phase 40

- Manual execution of the staging smoke.
- Actual tester invitations.
- Manual custom SMTP verification.
- Real staging auth smoke execution.
- Public/open beta.
- Live BYOK, credits, billing, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and production launch approval.

## Phase 41 status

- Phase 41: complete when the private beta tester feedback intake pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack adds approved feedback channel guidance, a structured tester feedback template, triage categories, stop/rollback criteria, communication flow, known limitation reminders, and manual review rules before feedback becomes implementation work.
- Feedback intake is private beta operations support, not public support launch.
- No app runtime, backend routes, feedback API, database tables, live email sending, fake in-app submission success, deployment config, secrets, BYOK, credits/billing, generation/export, artifact delivery, admin, event/audit, or analytics behavior changes are included.

### Still deferred after Phase 41

- Actual tester invitation execution.
- Public support launch.
- In-app feedback submission.
- Feedback API routes and persistence.
- Live BYOK, credits, billing, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and production launch approval.

## Phase 42 status

- Phase 42: complete when the private beta issue triage and patch planning pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack defines manual issue classification, severity levels, triage categories, stop/rollback criteria, patch planning templates, grouping rules, and audit-first handling for risky issues.
- Feedback intake still does not automatically become implementation.
- Patch planning does not create fake issue tracker state, fake resolved status, patch automation, deployment automation, backend routes, databases, or public launch approval.

### Still deferred after Phase 42

- Actual patch implementation from tester feedback.
- Automated issue tracker integration.
- In-app feedback or issue submission.
- Issue tracker API routes and persistence.
- Public support launch.
- Live BYOK, credits, billing, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and production launch approval.

## Phase 43 status

- Phase 43: complete when the private beta release-candidate checklist pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack defines the manual RC gate for controlled tester review only, including staging smoke, typecheck, build, post181 launch QA smoke, Phase 37/38/39/40/41/42 readiness, custom SMTP/email delivery verification, tester invite readiness, feedback intake readiness, issue triage readiness, security/privacy gates, product honesty gates, stop/rollback criteria, and a manual go/no-go/hold decision template.
- Private beta RC is not public launch.
- No release automation, fake RC-approved status, fake deployment, fake tester onboarding success, backend routes, databases, or public launch approval are included.

### Still deferred after Phase 43

- Manual RC decision execution.
- Actual tester invitation execution.
- Release automation.
- Public/open beta.
- Live BYOK, credits, billing, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and production launch approval.

## Phase 44 status

- Phase 44: complete when the private beta launch control and tester access gate pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack defines manual launch control, approved tester list and approved staging account requirements, launch checklist, tester access gate rules, stop/rollback criteria, and communication templates.
- Private beta launch control is manual and reviewed.
- Private beta is not public launch.
- No invite automation, waitlist automation, fake tester access success, invite/waitlist/tester access API routes, tester database, release automation, live email, or public launch approval are included.

### Still deferred after Phase 44

- Actual tester invitation execution.
- Automated invite/waitlist/tester access systems.
- Public/open beta.
- Live BYOK, credits, billing, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and production launch approval.

## Phase 45 status

- Phase 45: complete when the controlled tester account dry-run pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack defines a manual dry-run process for one approved staging/private beta tester account before inviting real testers.
- The dry run covers account creation/approval, email delivery status, login/logout, password reset when SMTP is verified, dashboard/account bootstrap, protected routes, credits/status honesty, provider settings/BYOK fail-closed state, projects/history honesty, export/artifact honesty, admin/readiness-only state, feedback intake, and access pause/revoke path.
- No tester database, invite API, waitlist API, auth runtime change, fake tester account success, live email sending, deployment, or public launch approval are included.
- No live email sending is included.

## Phase 46 status

- Phase 46: complete when the private beta final manual launch runbook pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack defines the final controlled, manual, reviewer-approved private beta launch procedure before inviting approved testers.
- The runbook requires clean git status, recorded commit hash, typecheck, build, post181 QA, Phase 37-45 readiness checks, staging manual smoke, RC checklist, launch control checklist, controlled tester account dry-run, custom SMTP/email delivery verification or documented limitation, tester invite pack, feedback intake, and issue triage/patch planning readiness.
- The launch sequence confirms staging/private-beta URL, approved tester group, approved staging tester accounts, limited invite send after a go decision, first tester login monitoring, auth/email monitoring, feedback intake monitoring, and pause behavior when stop criteria triggers.
- No deployment automation, release automation, invite API, waitlist API, tester database, auth runtime change, fake private-beta launched status, live email sending, deployment, or public launch approval are included.
- No live email sending is included.

## Phase 47 status

- Phase 47: complete when the private beta launch decision record pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack defines a manual, reviewer-owned launch decision record for go/no-go/hold.
- The decision record requires git status, commit hash, staging URL, tester group, typecheck, build, post181 QA, Phase 37-46 readiness, staging manual smoke, RC checklist, controlled tester dry-run, SMTP/email verification or documented limitation, feedback intake readiness, issue triage/patch planning readiness, known limitations, and stop/rollback owner.
- The decision record stores decisions in docs/manual tracker only and must not store secrets, private tokens, env values, tokenized auth links, passwords, service-role keys, SMTP credentials, provider keys, JWTs, or webhook secrets.
- No deployment automation, release automation, invite API, waitlist API, tester database, auth runtime change, fake launched/approved state, live email sending, deployment, or public launch approval are included.
- No live email sending is included.

## Phase 48 status

- Phase 48: complete when the private beta first tester monitoring pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack defines manual, reviewer-owned first tester monitoring for approved staging/private beta testers only.
- The monitoring checklist covers launch decision record, staging URL, commit hash, approved tester account, manually sent tester invite, first login, auth/session behavior, email/custom SMTP issues, protected route access, credits/status honesty, BYOK/provider settings fail-closed behavior, project/history honesty, export/artifact honesty, admin/readiness-only boundaries, and feedback intake readiness.
- The first 24-hour cadence covers first tester login check, same-day feedback review, immediate blocker/security triage, daily triage summary, and hold/pause decision if needed.
- No analytics runtime, monitoring backend, database table, dashboard UI, API route, fake metrics, fake dashboards, fake monitoring status, live email sending, deployment, or public launch approval are included.
- No live email sending is included.

## Phase 49 status

- Phase 49: complete when the private beta first tester feedback review pack is signed off.
- Scope: docs plus focused regression coverage only.
- The pack defines manual, reviewer-owned first tester feedback review before feedback becomes patch planning.
- The review checklist covers approved tester confirmation, staging/private-beta URL, commit hash, feedback source/channel, screenshot/log redaction, severity, category, affected page/feature, reproduction steps, separation of risky auth/security/storage/BYOK/billing/export issues from docs/copy issues, patch plan choice, and stop/pause recommendation.
- Review categories include security/privacy, auth/session, email/SMTP, credits/billing honesty, BYOK/provider settings, generation/mixer, export/artifact honesty, admin/readiness, UI/UX, and docs/copy.
- Severity levels include blocker, critical, high, medium, low, and docs/copy only.
- No issue tracker API, feedback API, analytics runtime, database table, dashboard UI, fake metric state, fake resolved status, fake issue tracker, live email sending, deployment, or public launch approval are included.
- No fake metric state is included.
- No fake resolved status is included.
- No live email sending is included.

### Still deferred after Phase 49

- Actual tester invitation execution.
- Automated invite/waitlist/tester access systems.
- Automated analytics/monitoring runtime.
- In-app monitoring dashboards or metric collection.
- Issue tracker APIs, feedback APIs, fake resolved state, and automatic patch planning.
- Public/open beta.
- Live BYOK, credits, billing, generation/export account runtime, production artifact delivery, admin analytics, event/audit persistence, and production launch approval.

## Phase 8.14 status

- Phase 8.14-A: complete (enqueue behavior audit).
- Phase 8.14-A2: complete (GET status truthfulness audit).
- Phase 8.14-B: complete (truthful GET status implementation).
- Phase 8.14-C: docs update only (this update).
- Next: Phase 8.14-D final sign-off.

### What 8.14-A found

- POST /exports already behaves as an enqueue boundary when worker flags are enabled.
- No route code change needed for enqueue behavior.
- GET /exports/:jobId was always returning "pending" — a truthfulness bug.

### What 8.14-B delivered

- Truthful GET /exports/:jobId status mapping in `backend/routes/exports.ts`.
- `mapRecordToPollResponse()` helper maps registry status to public types.
- `ExportPollResponseBody` updated to allow full `ExportPollResult` union.
- Status mapping: submitted/rendering/finalizing → pending, success → terminal_success, error/expired → terminal_failure.
- Success response: safe artifact metadata only (no paths/URLs).
- Failure response: message/code/jobId only, no failure.details (no leak risk).

### Preserved boundaries

- POST /exports unchanged (accepted_job, creates submitted job).
- POST /exports/:jobId/execute unchanged (dev/test-gated, 503/501).
- rendererAdapter/pathPolicy NOT wired into createExportRouter.
- No artifact hosting, signed URLs, or download URLs.
- No durable queue/persistence, cancellation, or frontend changes.
- Worker processing remains env-gated and in-memory only.

### Still deferred after 8.14-B

- Route enqueue response fields (not needed — POST /exports already enqueues).
- Durable queue/persistence (Redis/database-backed execution).
- Server graceful shutdown (SIGINT/SIGTERM handlers, server.close wiring).
- Frontend async worker integration.
- Production artifact hosting/signed URLs/download capability.
- Production auto-start without env flags.

## Phase 8.15 status

- Phase 8.15-A: complete (durable queue/persistence strategy audit).
- Phase 8.15-B: complete (registry interface boundary).
- Phase 8.15-C: docs update only (this update).
- Next: Phase 8.15-D final sign-off.

### What 8.15-A found

- Durable persistence not ready for real storage yet.
- Current InMemoryExportJobRegistry clean enough for interface boundary.
- Safest next step: interface separation only.
- Recommended: interface → JSON file → SQLite → Postgres progression.

### What 8.15-B delivered

- Registry interface/implementation separation.
- `backend/registry/exportJobRegistry.ts` owns interface/types.
- `backend/registry/inMemoryExportJobRegistry.ts` contains implementation.
- `createBackendDependencies` returns `registry: ExportJobRegistry` (interface type).
- Future durable persistence adapters can implement `ExportJobRegistry` without changing consumers.

### Preserved boundaries

- No real persistence/storage added.
- All registry behavior preserved (create, getById, getByRequestId, getByStatus, claim, mark*, transition).
- requestId idempotency still process-local only.
- Claims/leases still in-memory with TTL support.
- No route, worker, app, server, or frontend changes.

### Still deferred after 8.15-B

- No JSON/SQLite/Postgres/Redis adapter yet.
- No restart recovery semantics yet.
- No durable requestId idempotency across restarts yet.
- No durable worker claim/lease persistence yet.
- No durable artifact metadata persistence yet.
- Durable queue/persistence (Redis/database-backed execution).
- Server graceful shutdown (SIGINT/SIGTERM handlers, server.close wiring).
- Frontend async worker integration.
- Production artifact hosting/signed URLs/download capability.

## Phase 8.16 status

- Phase 8.16-A: complete (graceful shutdown/worker stop audit).
- Phase 8.16-B: complete (shutdown helper boundary).
- Phase 8.16-C: docs update only (this update).
- Next: Phase 8.16-D final sign-off.

### What 8.16-A found

- Worker lifecycle has shutdown() but no server coordination.
- Safe next step: create testable shutdown helper boundary first.

### What 8.16-B delivered

- Graceful shutdown helper: `backend/lifecycle/gracefulShutdown.ts`.
- `createGracefulShutdown(...)` returns shutdown/isShuttingDown/getStatus controller.
- Helper calls lifecycle.shutdown() and server.close() when provided.
- Helper is idempotent and safe.
- No SIGINT/SIGTERM handlers wired yet.

### Preserved boundaries

- No server.ts wiring added yet.
- No process.exit() calls added.
- No job registry state mutation.
- No render cancellation.
- No persistence/recovery.

### Still deferred after 8.16-B

- No server.ts shutdown wiring yet.
- No SIGINT/SIGTERM handlers yet.
- No process-level graceful shutdown yet.
- No bounded in-flight render wait/cancellation yet.
- Durable queue/persistence (Redis/database-backed execution).
- Frontend async worker integration.
- Production artifact hosting/signed URLs/download capability.

## Phase 57 status

- Phase 57: backend-only BYOK provider key contract and repository/vault storage boundary pack.
- Scope: provider key request/response contracts, vault operation result contracts, repository create/replace/revoke/list contracts, redacted storage result unions, docs, and focused boundary tests.
- No frontend API key input, live vault, live provider storage, provider SDK/API call, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.
- Provider Settings remains readiness-only until a future phase wires a configured backend vault and repository under workspace owner/admin authorization.

## Phase 59 status

- Phase 59: backend-only BYOK provider key schema draft and Supabase repository adapter boundary pack.
- Scope: draft provider key schema refinement migration, schema mirror, Supabase provider key repository adapter boundary, redacted create/replace/revoke/list behavior, conflict handling for one active workspace/provider key, and focused boundary tests.
- Provider Settings routes remain fail-closed and unwired to live provider key storage.
- No migration execution, frontend API key input, live vault encryption, provider SDK/API call, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.
- Live BYOK remains deferred until a later approved phase wires a configured backend vault, repository, workspace owner/admin authorization, route behavior, and frontend UX under no-secret-leak coverage.

## Phase 61 status

- Phase 61: backend-only BYOK local encryption vault boundary pack.
- Scope: Node crypto `AES-256-GCM` local/staging encrypted-payload vault, backend-only config parsing/validation, direct encrypt/decrypt/store/rotate/revoke tests, wrong-key/tamper fail-closed coverage, and route/frontend source-boundary checks.
- Provider Settings routes remain fail-closed and unwired to live provider key storage.
- No frontend API key input, route wiring, migration execution, provider SDK/API call, test-connection implementation, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.
- Live BYOK remains deferred until a later approved phase wires auth/workspace-authorized routes to the configured vault and repository with browser-safe redacted responses only.

## Phase 63 status

- Phase 63: backend-only BYOK vault/repository composition boundary pack.
- Scope: provider key repository composition, backend dependency vault composition, not-configured default vault, valid-env local encrypted vault composition, explicit provider-key route-live gate parsing, and optional Provider Settings dependency shape.
- Provider Settings mutation routes remain unavailable/fail-closed even when vault and repository dependencies exist.
- No frontend API key input, live route mutation behavior, migration execution, provider SDK/API call, test-connection implementation, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.
- Live BYOK remains deferred until a later approved phase implements route add/replace/revoke behavior under backend auth, workspace owner/admin authorization, configured vault/repository dependencies, and browser-safe redacted responses only.

## Phase 65 status

- Phase 65: backend-only BYOK provider key route wiring pack.
- Scope: Provider Settings create, replace, and revoke route wiring behind `FREE_AI_MIXER_BYOK_PROVIDER_KEYS_RUNTIME_ENABLED`.
- Live mutation behavior requires backend-authenticated session, backend-derived workspace context, workspace owner/admin authorization, configured provider secret vault, and composed provider key repository.
- Responses remain redacted and browser-safe for stored, replaced, revoked, conflict, invalid request/provider, not found, forbidden, sign-in-required, and unavailable outcomes.
- Test connection remains unavailable.
- No frontend API key input, browser provider-key storage, migration execution, provider SDK/API call, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.

## Phase 68 status

- Phase 68: BYOK provider keys executable local/staging schema prep pack.
- Scope: promote the provider key schema draft into executable/idempotent local and staging prep SQL, keep the schema mirror aligned, and add focused static coverage for schema/repository alignment.
- The schema prep includes repository-required provider key metadata columns, backend-only encrypted payload or external secret reference handles, unique active workspace/provider indexing, sanitized verification error code shape, lifecycle timestamps, default-deny RLS, and comments forbidding plaintext keys and raw provider errors.
- No migration execution, frontend API key input, provider settings route behavior change, provider SDK/API call, test connection, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.
- Live BYOK remains gated by separate manual local/staging schema application, backend runtime smoke, and a later approved frontend input phase.

## Phase 70 status

- Phase 70: BYOK provider keys local/staging schema apply runbook and verification pack.
- Scope: add a local/staging-only runbook for applying `backend/db/migrations/0003_provider_keys_schema_draft.sql` and verifying table shape, RLS, zero policies, and required indexes without selecting `encrypted_payload` or `secret_ref` values.
- The runbook requires clean git status, confirmed local/staging target, existing `app_users` and `workspaces`, backend-only service-role handling, and production no-go review.
- No migration execution, schema apply, frontend API key input, provider settings route behavior change, provider SDK/API call, test connection, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.
- Live BYOK remains gated by a separately performed and verified local/staging schema apply, then backend-only route runtime smoke with fake placeholder keys.

## Phase 79 status

- Phase 79: BYOK local browser fake-key smoke regression pack.
- Scope: add deterministic Playwright coverage for the browser Provider Settings save/replace/remove fake-key flow plus a local/staging-only browser smoke runbook.
- The regression locks authenticated Provider Settings access shape, provider selector/input presence, input clearing, redacted stored/replaced summaries, revoked controls returning to save/add state, disabled test connection, no browser persistence of fake keys, and no fake connected/verified/test-passed wording.
- The runbook documents local Supabase, backend, and frontend startup expectations; fake-key-only browser steps; DevTools persistence checks; and safe DB verification without selecting `encrypted_payload` or `secret_ref` values.
- No backend behavior change, real provider key, provider SDK/API call, test connection, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.

## Phase 81 status

- Phase 81: BYOK provider validation contract boundary pack.
- Scope: add a backend-only provider validation adapter contract, not-configured fail-closed adapter, validation result union, repository validation-state update contract, and focused route/source/redaction tests.
- Provider validation remains disabled. `/provider-settings/connections/:providerId/test` still returns unavailable after auth/owner-admin checks because no live validation executor is wired.
- No real provider API call, real provider key, frontend provider SDK call, test connection activation, fake connected/verified/test-passed state, raw provider error exposure, credits/billing mutation, or generation/export integration is included.

## Phase 83 status

- Phase 83: BYOK provider validation mock runtime wiring pack.
- Scope: wire `/provider-settings/connections/:providerId/test` to a backend-only validation executor behind `FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED`.
- The route requires backend auth, backend-derived workspace context, owner/admin authorization, provider key repository, ready vault, active stored provider key lookup, validation gate, and injected/mock adapter readiness.
- The mock adapter is deterministic and local-only: no provider SDKs, no `fetch`, no external endpoints, no real provider keys, and no platform key fallback.
- Validation updates only safe metadata fields and returns redacted connection summaries.
- Default/production behavior remains fail-closed; frontend Test Connection remains unavailable.
- No real provider API call, provider SDK import, real provider key, fake connected/verified/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.

## Phase 87 status

- Phase 87: BYOK mock validation adapter composition for local browser smoke.
- Scope: compose the mock/local validation adapter only when `FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED=1` and `FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER=mock_local` are both set.
- Default and production behavior remain not-configured/fail-closed, so runtime gate alone cannot create validation success.
- The local browser smoke runbook now documents the two-env requirement, fake-key-only browser flow, safe DB checks, and cleanup.
- No frontend changes, real provider API calls, provider SDK/import/fetch, real provider keys, fake connected/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.

## Phase 90 status

- Phase 90: BYOK OpenAI minimal real validation adapter boundary pack.
- Scope: add a backend-only OpenAI minimal validation adapter that can be composed only when validation runtime, `FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER=openai_minimal`, `FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ALLOW_REAL_PROVIDER_CALLS=1`, repository, and vault readiness are all present.
- The adapter uses backend `fetch` only against `GET https://api.openai.com/v1/models`, with timeout handling and safe status mapping.
- Automated tests mock remote provider calls and require no real provider keys.
- Default behavior remains not-configured/fail-closed, and `mock_local` behavior remains unchanged.
- No frontend changes, provider SDK import, generation/upload/model execution endpoint, platform key fallback, fake connected/test-passed state, credits/billing mutation, generation/export integration, or public launch behavior is included.

## Phase 94 status

- Phase 94: real provider generation contract boundary pack.
- Scope: add backend-only contracts for a future stored-key image generation adapter, safe generation input/result unions, safe artifact metadata, sanitized failure mapping, and future generation env gate names.
- `/generation/jobs` remains disabled and `vendorCallsEnabled` remains false.
- OpenAI BYOK validation readiness must not be treated as generation readiness.
- No real provider API call, provider SDK import, frontend change, fake success/progress/artifact, credits/billing mutation, generation execution, export integration, or public launch behavior is included.

## Phase 96 status

- Phase 96: OpenAI image generation adapter boundary pack.
- Scope: add a backend-only OpenAI Images API adapter boundary for future stored-key image generation.
- The adapter targets `POST https://api.openai.com/v1/images/generations` with `gpt-image-2`, one image, default safe size, and mocked remote-call tests only.
- A provider 2xx response remains non-deliverable and maps to `artifact_storage_unavailable` because generated artifact storage is not approved.
- `/generation/jobs` remains disabled and `vendorCallsEnabled` remains false.
- No real provider call, provider SDK import, frontend change, fake success/progress/artifact, generated asset URL, credits/billing mutation, export route behavior, or public launch behavior is included.

## Phase 98 status

- Phase 98: generated image artifact storage boundary pack.
- Scope: add backend-only verification and local/staging storage contracts for future provider-generated image bytes.
- Verification supports PNG, JPEG, and WEBP magic-byte checks, max byte size, positive size, content-type/format matching, and SHA-256 metadata.
- Local storage is backend-controlled, temp-file-first, atomically renamed after verification, and returns only safe metadata plus an internal storage ref.
- `/generation/jobs` remains disabled, `vendorCallsEnabled` remains false, and OpenAI 2xx output still maps to `artifact_storage_unavailable`.
- No real provider call, frontend change, public/signed URL delivery, generated-image stream route, fake success/progress/artifact, credits/billing mutation, export route behavior, or public launch behavior is included.

## Phase 100 status

- Phase 100: OpenAI image adapter generated artifact storage integration pack.
- Scope: let the backend-only OpenAI image adapter optionally verify mocked `b64_json` output and store it through explicitly injected generated-image artifact storage.
- Safe generated results are possible only in direct adapter tests after verified bytes and successful local storage; route runtime remains disabled.
- Provider URL output is rejected and not fetched.
- `/generation/jobs` remains disabled, `vendorCallsEnabled` remains false, and the adapter is not composed into backend dependencies.
- No real provider call, frontend change, public/signed URL delivery, generated-image stream route, fake progress, credits/billing mutation, export route behavior, or public launch behavior is included.

## Phase 102 status

- Phase 102: generation runtime composition readiness boundary pack.
- Scope: parse future generation runtime gates and expose fail-closed backend dependency readiness metadata.
- The readiness boundary can recognize `openai_image_minimal` only as metadata; it does not route-wire the adapter or storage.
- `/generation/jobs` remains disabled and `vendorCallsEnabled` remains false in all gate combinations.
- No real provider call, frontend change, generated delivery route, fake success/progress/artifact, credits/billing mutation, export route behavior, or public launch behavior is included.

## Phase 104 status

- Phase 104: generation route execution contract and preconditions boundary pack.
- Scope: define future image-only `/generation/jobs` request/response contracts, prompt validation, server-side active validated BYOK key lookup, owner/admin preconditions, and fail-closed rate/idempotency/single-flight/cost readiness.
- The route remains hard-disabled and does not call provider adapters or generated-image artifact storage.
- Future success is metadata-only with delivery unavailable until a separate delivery phase is approved.
- No real provider call, frontend change, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, export route behavior, or public launch behavior is included.

## Phase 106 status

- Phase 106: generation route fail-closed dependency injection boundary pack.
- Scope: let `createGenerationRouter` accept optional future generation dependencies while keeping route execution disabled.
- Backend dependencies expose generation runtime config/readiness metadata, but `app.ts` keeps production generation route wiring hard-disabled.
- `/generation/jobs` still returns `generation_runtime_disabled`, `vendorCallsEnabled` remains false, and no injected dependency is called.
- No real provider call, frontend change, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, export route behavior, or public launch behavior is included.

## Phase 108 status

- Phase 108: generation route preconditions-only gate boundary pack.
- Scope: add `FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE` with `disabled` default and a `preconditions_only` route mode for local/staging precondition evaluation.
- In `preconditions_only`, `/generation/jobs` validates the safe image request shape, backend-authenticated workspace context, owner/admin membership, generation gates, fail-closed execution controls, and server-side active validated OpenAI BYOK key readiness.
- Even when preconditions pass, the route returns `generation_execution_blocked`, keeps `vendorCallsEnabled: false`, and reports no attempted providers.
- BYOK decrypt, adapter execution, generated-image storage, provider calls, artifact creation, frontend changes, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, and export route behavior remain blocked.

## Phase 111 status

- Phase 111: generation preconditions app dependency wiring pack.
- Scope: wire app-level generation precondition dependencies into `createGenerationRouter`: runtime config/readiness, route access resolver, provider-key repository, workspace membership repository, and fail-closed execution-control readiness.
- `FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY=1` can make preflight control readiness test-ready for local/staging precondition smoke only.
- The app still does not pass provider secret vault, OpenAI image adapter, generated-image storage, or any executable provider path into generation routing.
- `/generation/jobs` can now evaluate full preconditions in `preconditions_only`, but still returns `generation_execution_blocked` when all modeled checks pass.
- BYOK decrypt, adapter execution, generated-image storage, provider calls, artifact creation, frontend changes, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, and export route behavior remain blocked.

## Phase 114 status

- Phase 114: generation route adapter mock-only execution boundary pack.
- Scope: add `adapter_mock_only` handling for `/generation/jobs` behind the explicit `FREE_AI_MIXER_GENERATION_MOCK_EXECUTION_ADAPTER=mock_local` selector.
- The route still runs the Phase 112 preconditions first: safe request shape, backend-authenticated workspace context, owner/admin membership, generation gates, preflight controls, and server-side active validated OpenAI BYOK key readiness.
- Only an injected deterministic mock executor can run, and only after all preconditions pass. The response remains a rejection with `generation_mock_execution_blocked`, `vendorCallsEnabled: false`, and `attemptedProviderIds: ["openai"]`.
- The app does not route-wire the real OpenAI image adapter, generated-image storage, or provider secret vault into generation execution.
- BYOK decrypt, real adapter execution, generated-image storage, provider calls, artifact creation, frontend changes, public/signed URL delivery, fake generated success/progress/artifacts, credits/billing mutation, and export route behavior remain blocked.

## Phase 117 status

- Phase 117: BYOK decrypt plus mocked OpenAI adapter route execution boundary pack.
- Scope: add `openai_adapter_mock_only` handling for `/generation/jobs` behind `FREE_AI_MIXER_GENERATION_OPENAI_ADAPTER_FETCH_MODE=mock_only` and `FREE_AI_MIXER_GENERATION_BYOK_DECRYPT_FOR_MOCK_EXECUTION=1`.
- The route still runs all request/auth/workspace/owner-admin/gate/control/active-key preconditions first.
- After preconditions pass, the route may require vault readiness, decrypt the stored OpenAI BYOK key, and call `createOpenAiImageGenerationAdapter` only with an injected mocked `fetchImpl`.
- No generated-image storage is injected, so mocked OpenAI 2xx output maps to `artifact_storage_unavailable` and remains a rejected/non-success response with `vendorCallsEnabled: false`.
- Real OpenAI calls, `globalThis.fetch`, generated-image storage, artifact creation, frontend changes, public/signed URL delivery, fake generated success/progress/artifacts, credits/billing mutation, and export route behavior remain blocked.

## Phase 120 status

- Phase 120: OpenAI mock adapter generated-image local storage route boundary pack.
- Scope: add `openai_adapter_mock_storage_only` handling for `/generation/jobs` behind explicit mock fetch, BYOK decrypt, preflight-control, and local/staging generated-image storage gates.
- The route still runs all request/auth/workspace/owner-admin/gate/control/active-key preconditions before vault readiness, BYOK decrypt, mocked adapter execution, image verification, or local storage write.
- Valid mocked OpenAI output can be verified and stored locally through a backend-controlled root, then returned as safe metadata only with `deliveryStatus: unavailable` and `vendorCallsEnabled: false`.
- Delivery remains unavailable: no public URL, signed URL, download URL, stream route, frontend generation path, or export integration was added.
- Real provider generation remains blocked; local storage roots and internal refs must remain backend-only and should be cleaned up after manual smoke.
- No real provider call, frontend change, fake user-facing success/progress/downloadable artifact, credits/billing mutation, export route behavior, or public launch behavior is included.

## Phase 123 status

- Phase 123: OpenAI real provider local-only route execution boundary pack.
- Scope: add `real_provider_local_only` handling for `/generation/jobs` behind explicit runtime, provider-adapter, allow-real-calls, preflight-control, local/staging storage, and real-local smoke approval gates.
- The route requires local/staging generated-image storage before provider fetch can occur.
- The OpenAI adapter fetch path is injectable; focused tests mock all provider responses and no real OpenAI smoke is included.
- Mocked real-local 2xx responses can verify/store image bytes and return safe metadata only with `deliveryStatus: unavailable`; provider failures map to sanitized backend responses.
- A separate manual real-provider smoke audit is required before any real OpenAI call.
- Delivery remains unavailable, frontend generation remains blocked, public/signed/download URLs remain blocked, export integration remains blocked, credits/billing remain blocked, and production launch remains blocked.

## Phase 126 status

- Phase 126: OpenAI real smoke failure diagnostics boundary pack.
- Scope: add sanitized diagnostic categories for `real_provider_local_only` and OpenAI image adapter failures after the Phase 124 failed real-provider smoke.
- Rejected generation responses may include only safe enum fields such as `diagnosticCode` and `failureCategory`.
- Diagnostics cover provider response shape issues, unsupported provider URL output, missing `b64_json`, malformed JSON, artifact verification failure, storage write failure, provider fetch failure, provider 5xx, unexpected provider status, missing real-local gate, storage not ready, vault not ready, and vault decrypt failure.
- Automated tests mock all provider responses; no real OpenAI retry or real generation was performed.
- Frontend generation, public/signed/download URLs, export integration, credits/billing mutation, fake user-facing generated success/progress/downloadable artifacts, and production launch remain blocked.

## Phase 129 status

- Phase 129: BYOK OpenAI validation safe diagnostics boundary pack.
- Scope: add sanitized diagnostic categories for provider validation failures after the Phase 127 safe failed real OpenAI validation attempt.
- Provider validation responses may include only enum-only `diagnosticCode` and `failureCategory` fields.
- Diagnostics cover validation timeout, provider fetch failure, provider 5xx, provider rate limit, invalid credentials, unexpected provider status, missing stored key, adapter not ready, and vault decrypt failure.
- Automated tests mock provider responses and network failures; no real OpenAI validation retry or real generation retry was performed.
- Frontend changes, public/signed/download URLs, export integration, credits/billing mutation, fake user-facing success/progress/artifacts, and production launch remain blocked.

## Phase 166 status

- Phase 166: mock generation workspace final QA and docs pack.
- The current safe generation milestone is mock/local only:
  - mock image generation returns backend-verified safe metadata
  - prompt-to-image UI stores successful metadata in browser-local history only
  - mock video generation remains fail-closed with `video_artifact_storage_unavailable`
- Real provider generation is paused until API billing/quota access is available and a separate audited retry phase is approved.
- Generated image preview is backend-mediated/local-only after Phase 171 and remains gated by `FREE_AI_MIXER_GENERATION_ENABLE_LOCAL_IMAGE_PREVIEW=1`.
- Production generated artifact delivery, download behavior, public URLs, signed URLs, and non-local streaming remain future audited phases.
- Frontend direct storage/provider access, export integration, credits/billing mutation, and production rollout remain blocked.

## Phase 172 status

- Phase 172: generated image preview QA and docs finalization pack.
- Backend-mediated image preview is local/gated and uses only the generation-specific relative backend route.
- The preview route is not a download route and does not expose public URLs, signed URLs, download URLs, local paths, internal refs, storage refs, base64, or direct frontend storage access.
- Video preview/playback remains unavailable.
- Production artifact delivery still requires a future audited auth/storage/signed-delivery phase.
## Launch Block 5 - Real Video Generation Foundation

- Status: foundation only; real video provider execution remains unavailable.
- The backend now has fail-closed video provider adapter contracts for future `veo`, `runway`, `pika`, and `gemini_video` integrations.
- Video lifecycle, verification, and storage boundaries are modeled, but generated video verification/storage/playback remain fail-closed until separately audited.
- Manual real-video smoke requires paid provider access/quota and a user-owned key; Codex and automated tests must not use keys or call video providers.
- Public URLs, signed URLs, download URLs, direct frontend storage, fake video success, fake progress, and playable video previews remain blocked.

## Launch Block 6 - Production Deployment Readiness

- Status: readiness boundary only; no deployment is performed by the app or test automation.
- Production deployment uses frontend static hosting, backend Node service hosting, and hosted Supabase setup with manual migration review/apply.
- `/monitoring/deployment-readiness` reports safe deployment status without exposing secrets or raw env values.
- Rollback is manual through hosting provider revisions and reviewed Supabase plans.
- Real providers, platform-paid generation, video providers, public URLs, signed URLs, downloads, and live billing remain disabled unless separately audited.
