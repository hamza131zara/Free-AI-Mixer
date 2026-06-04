# Known Issues

This file tracks current architecture debt and unstable behaviors that future work must not ignore.

## Stability Issues

### Hydration Runtime Sign-Off

Current state:

- explicit hydration state exists
- interaction is gated until restore completes
- queued scenes sanitize to `idle`
- generating scenes sanitize to `idle` unless valid browser-local resumable provider job metadata exists
- queue dedupe guards were added

Verification recorded:

- hydration/runtime browser sign-off passed
- H01-H10 Playwright matrix passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test:e2e` passed
- `npm run verify:phase36` passed

### LocalStorage Limitations

Current state:

- scenes and generated results persist in localStorage

Why it matters:

- large payloads may eventually pressure browser storage
- there is no persistence migration strategy beyond basic versioning

Target fix phase:

- later stabilization work after current foundation phases

### Selector Cache Assumptions

Current state:

- selector stability depends on immutable store updates

Why it matters:

- in-place mutation would break cached selector expectations

Target fix phase:

- ongoing discipline

## Platform Gaps

### Phase 25 Real Auth Runtime Smoke Is Manual And Opt-In

Current state:

- Phase 24 account bootstrap and real login runtime are signed off as a local/tested foundation.
- Phase 25 adds only a runbook and an opt-in real auth smoke test.
- The real auth smoke is disabled unless `FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE=1`.
- The smoke requires a dedicated verified Supabase test user.
- The smoke may create or reuse the app user, `Personal Workspace`, and active owner membership for that dedicated user.
- Signup is not automated by default because it can create real Supabase users and orphaned provider accounts.
- Automatic cleanup is not included because destructive real-data behavior does not belong in the default smoke.
- Active workspace selection remains deferred; multiple active memberships must block safely.
- Password reset/account recovery is covered by Phase 27 frontend UX and Supabase Auth wrapper methods.
- OAuth remains deferred.
- Event/audit persistence remains deferred.
- Admin analytics remains deferred.
- The Vite chunk-size warning remains a performance hardening item, not an auth blocker.

Why it matters:

- Real Supabase/JWKS/service-role/bootstrap behavior must be verified before deeper authenticated product features.
- The smoke must stay manual, secret-safe, non-destructive, and CI-safe by default.

### Phase 27 Account Recovery UX Is Frontend/Auth-Only

Current state:

- Forgot-password and reset-password UX use Supabase Auth only.
- Password reset does not add backend routes or migrations.
- Reset/update flows do not store reset tokens, access tokens, raw Supabase users, or raw Supabase sessions in app state.
- A successful password update signs out and asks the user to sign in again so `/auth/session` remains the canonical app-auth source.
- Dashboard setup status and retry UX remain backend-derived from `/auth/session` plus user-triggered `/account/bootstrap`.
- Multiple active workspace memberships still block safely; active workspace selection remains deferred.

Why it matters:

- Broader beta testers now have an account recovery path without weakening backend authority.
- Recovery UX must not become an implicit authenticated app session.
- Workspace selection, OAuth, transactional bootstrap hardening, event/audit persistence, and admin analytics remain future work.

### Phase 28 Controlled Private Beta Docs Are Checklist-Only

Current state:

- Controlled private beta documentation exists for 3-5 trusted testers only.
- The private beta checklist covers tester instructions, manual QA commands, password reset redirect setup, operational recovery, beta disable/rollback guidance, and security boundaries.
- The beta remains account/auth focused and must not imply real projects, credits, provider keys, billing, exports, admin analytics, or public launch readiness.
- No runtime behavior, backend routes, migrations, auth logic, generation/export behavior, billing, credits ledger, event/audit persistence, or analytics changed in Phase 28.
- Active workspace selection, team/invite/multi-workspace UX, OAuth, BYOK/provider key storage, billing, credits ledger, generation/export expansion, event/audit persistence, analytics, broader beta, and public launch remain deferred.

Why it matters:

- Controlled private beta can proceed only with clear expectations and manual checks.
- The docs should reduce tester confusion without creating product claims the runtime cannot satisfy yet.

### Phase 31 BYOK Provider Key Storage Is Strategy-Only

Current state:

- `docs/byok-provider-key-storage-strategy.md` documents the future BYOK provider key storage threat model and implementation contract.
- Provider Settings remains authenticated, non-live, and secret-free.
- Credits remain planning-only and non-live.
- No frontend raw-key inputs, backend storage, provider SDK calls, routes/mutations, encrypted vault runtime, migrations, credits ledger, billing, generation/export integration, or event/audit persistence were added.
- Future BYOK must be backend-only, workspace-authorized, encrypted or vault-backed, redacted, and tested before becoming live.
- Merged Phase 34 added focused pre-live BYOK security boundary coverage:
  - provider settings mutation routes remain fail-closed
  - the not-configured provider secret vault cannot produce fake success
  - BYOK/provider-secret redaction covers `provider_raw_error` and `providerrawerror`
  - frontend source boundaries still show no raw provider key input UI, no frontend Supabase/storage key access, and no browser storage for provider keys

Why it matters:

- Provider API keys are secrets and must not leak through frontend state, browser storage, logs, screenshots, snapshots, URLs, browser responses, or docs.
- The strategy doc must not be treated as live BYOK readiness.
- Live provider key storage, provider verification, encrypted vault runtime, active workspace selection, billing/credits ledger, and generation/export integration remain deferred.
- Phase 34 did not add live BYOK storage, migrations, provider SDK/API calls, fake connected/verified state, or credits/billing/generation/export/admin/event/audit runtime changes.

### Phase 35 Auth Email Operations Are Manual

Current state:

- Phase 35 adds docs and tester-facing copy for Supabase email limits, redirect URL setup, custom SMTP readiness, expired or reused auth links, newest-email-only behavior, and tokenized-link safety.
- Custom SMTP remains a manual Supabase dashboard operation, not application code.
- Built-in Supabase email delivery can rate-limit repeated signup and password reset testing.
- Email confirmation and password reset delivery depend on the configured Supabase Auth email provider or custom SMTP provider; testers may need to check spam, junk, or promotions folders.
- Controlled beta should prefer dedicated, pre-confirmed tester accounts with known temporary passwords when email delivery itself is not under test.
- Confirmation and recovery links may contain temporary tokens and must not be pasted into docs, chat, screenshots, logs, or issue reports.
- Production auth email must not be described as fully configured until the environment-specific email provider or custom SMTP setup has been manually verified.
- OTP/code confirmation remains deferred.
- Public launch remains blocked.

Why it matters:

- Broader tester onboarding depends on reliable email delivery and clear recovery instructions.
- Auth email operations must not introduce token logging, token storage, committed SMTP secrets, or public launch claims.

### Phase 36 Private Beta Go/No-Go Is Docs-Only

Current state:

- Phase 36 adds a controlled private beta staging and go/no-go checklist.
- Local/manual dry run and one internal smoke user are ready.
- 3-5 trusted testers are ready with restrictions after staging, real auth smoke, redirect allow-list, and manual QA checks pass.
- 5-15 testers remain blocked until staging, custom SMTP, and onboarding/support process hardening are complete.
- Public/open beta remains blocked.
- No frontend code, backend code, tests, auth logic, deployment config, SMTP config, provider/BYOK runtime, credits, billing, generation, export, event/audit, or analytics behavior changed.

Why it matters:

- Tester invitations need an explicit go/no-go gate rather than an implied readiness statement.
- Staging and operational checks must stay separate from public launch claims.

### Phase 37 Private Beta Publish Readiness Smoke Is A Safety Check

Current state:

- Phase 37 adds a focused private beta publish readiness smoke pack.
- The smoke checks public shell loading, protected-route honesty, auth email/custom SMTP copy, non-live credits/provider settings/project/export/admin boundaries, no fake artifact delivery, source-boundary safety, and continued public-launch blocking.
- This is not a public launch approval.
- No live auth behavior, SMTP credentials, migrations, BYOK storage, credits or billing mutation, provider SDK/API calls, generation/export/render runtime, artifact delivery behavior, fake success state, or deployment configuration changed.

Why it matters:

- Private beta preparation needs a final practical honesty check before tester or publish preparation.
- Public launch remains blocked until the manual go/no-go checklist, production auth/RLS/storage readiness, operational hardening, and product runtime decisions are separately verified.

### Phase 38 Staging Deployment Readiness Is Not Deployment

Current state:

- Phase 38 adds staging/private-beta deployment readiness documentation and focused smoke coverage.
- The readiness pack checks production build script posture, backend-safe public shell behavior, protected-page honesty, documented env names, no service-role exposure, no frontend Supabase DB/storage access, and non-live BYOK/credits/export/admin boundaries.
- It does not deploy anything, configure real environment values, configure SMTP, add migrations, change auth/runtime behavior, or approve public launch.

Why it matters:

- Staging preparation needs explicit controls before testers use a shared environment.
- Public launch remains blocked until staging has been manually configured, real auth smoke passes in that environment, production auth/RLS/storage readiness is verified, and a separate public launch go/no-go approves it.

### Phase 39 Staging Publish Dry Run Is Manual And Secret-Free

Current state:

- Phase 39 adds a staging publish dry-run safety pack.
- The pack includes placeholder-only staging env guidance and focused regression coverage for env-name documentation, frontend/backend secret boundaries, manual smoke gates, private beta go/no-go gating, and non-live product boundaries.
- It does not deploy anything, add real env values, configure SMTP, add service-role keys, add migrations, change auth runtime, change backend routes, enable BYOK, enable credits/billing, call provider SDKs, change generation/export/render runtime, or approve public launch.

Why it matters:

- Staging publish preparation must stay secret-free and manual until the deployment environment is configured outside the repo.
- Public launch remains blocked until the manual checklist, staging smoke, production auth/RLS/storage readiness, and a separate public launch go/no-go are complete.

### Phase 40 Tester Onboarding Is Manual And Controlled

Current state:

- Phase 40 adds a staging manual smoke runbook and private beta tester invite pack.
- Tester onboarding remains manual, controlled, and limited to approved staging tester accounts.
- Custom SMTP/email delivery must be manually verified before serious tester onboarding.
- The docs tell testers to check spam, junk, or promotions folders and not to share tokenized links, URL hashes, passwords, or secrets.
- Phase 40 does not deploy anything, change runtime behavior, add secrets, enable BYOK, enable credits/billing, change generation/export/render runtime, enable artifact delivery, or approve public launch.

Why it matters:

- Small private beta onboarding needs safe human instructions as much as technical smoke tests.
- Public launch remains blocked until the separate go/no-go checklist and production readiness checks pass.

### Phase 41 Feedback Intake Is Manual And Private-Beta-Only

Current state:

- Phase 41 adds private beta feedback intake documentation and focused docs/source regression coverage.
- Feedback channels are approved manually and are placeholders until the project owner chooses the actual email, form, or tracker.
- Testers are instructed not to send API keys, provider keys, SMTP credentials, service-role keys, JWTs, webhook secrets, private env values, passwords, confirmation links, recovery links, URL hashes, or tokenized screenshots.
- Feedback reports use a structured template with reproduction steps, expected result, actual result, browser/device/OS, environment label, severity, blocker/non-blocker, and issue categories.
- Triage remains manual, and feedback must be reviewed before becoming an implementation phase.
- No in-app feedback submission, feedback API route, database table, live email sending, fake feedback submission success UI, deployment, or public support launch was added.

Why it matters:

- Private beta feedback must be actionable without becoming a new secret-leak path.
- Tester reports should improve the product without creating public-launch claims or fake support infrastructure.

### Phase 42 Issue Triage And Patch Planning Is Manual

Current state:

- Phase 42 adds private beta issue triage and patch planning documentation plus focused docs/source regression coverage.
- Feedback intake still does not automatically become implementation.
- Issues must be classified by severity and category before any code changes.
- Risky issues follow audit-first handling before implementation.
- Patch planning uses a template with reproduction steps, expected result, actual result, proposed safe phase, affected files, tests, rollback notes, and strict exclusions.
- Docs/copy-only issues can be grouped when safe, but security/auth/storage/BYOK/billing/export runtime work must stay separate.
- No fake issue tracker, fake resolved status, fake in-app feedback, patch automation, issue tracker API route, database table, live email sending, deployment, or public launch approval was added.

Why it matters:

- Tester feedback needs a safe path into engineering work without bypassing review.
- Private beta fixes must not become broad mixed-scope patches or hidden runtime expansions.

### Phase 43 Private Beta RC Is A Manual Gate

Current state:

- Phase 43 adds a private beta release-candidate checklist and focused docs/source regression coverage.
- RC candidate means ready for controlled tester review only.
- Private beta RC is not public launch.
- Manual staging smoke, typecheck, build, post181 launch QA smoke, and Phase 37/38/39/40/41/42 readiness must pass before RC.
- Custom SMTP/email delivery must be manually verified before serious tester onboarding.
- Tester invite pack, feedback intake, and issue triage/patch planning must be ready.
- Product honesty gates still require non-live credits/billing, pre-live/fail-closed BYOK, honest provider settings, honest export/artifact delivery, and readiness-only admin/analytics.
- No fake RC-approved status, release automation, fake deployment, fake tester onboarding success, backend routes, database tables, live email sending, or public launch approval was added.

Why it matters:

- A controlled tester RC needs a clear manual decision record before invitations.
- The RC checklist must not be confused with production launch readiness.

### Phase 44 Launch Control Is Manual

Current state:

- Phase 44 adds private beta launch control and tester access gate documentation plus focused docs/source regression coverage.
- Tester access must use approved tester lists and approved staging/private beta accounts only.
- Open public signup, automatic invite automation, fake waitlist approval, fake tester access success, and production launch approval remain forbidden.
- Launch control uses a manual checklist with commit hash placeholder, staging URL placeholder, approved tester group placeholder, tester account list placeholder, smoke/product-honesty gates, rollback owner, and go/no-go/hold decision.
- Communication templates exist for approved tester invite, hold/no-go notice, access revoked/paused notice, and known limitations reminder.
- No invite API, waitlist API, tester database, release automation, live email sending, fake tester access approved state, runtime change, or public launch approval was added.

Why it matters:

- Private beta access needs a human gate before any tester receives staging access.
- Launch control must not become hidden public signup or fake invitation automation.

### Phase 45 Tester Account Dry Run Is Manual

Current state:

- Phase 45 adds controlled tester account dry-run documentation plus focused docs/source regression coverage.
- The dry run uses approved staging/private beta tester accounts only.
- Personal, admin, and service-role accounts must not be used for tester dry-run.
- The dry run checks login/logout, password reset only when SMTP is verified, dashboard/account bootstrap, protected routes, credits/status honesty, provider settings/BYOK fail-closed state, projects/history honesty, export/artifact honesty, admin/readiness-only state, feedback intake, and access pause/revoke path.
- No tester database, invite API, waitlist API, tester access API, auth runtime change, live email sending, fake tester account approved state, deployment, or public launch approval was added.
- No live email sending was added.

Why it matters:

- Real tester invitations should wait until one approved staging/private beta tester account has been manually proven safe.

### Phase 46 Final Manual Launch Runbook Is Manual

Current state:

- Phase 46 adds final manual private beta launch runbook documentation plus focused docs/source regression coverage.
- Private beta final manual launch is not public launch.
- Launch is controlled, manual, and reviewer-approved only.
- Required gates include clean git status, recorded commit hash, typecheck, build, post181 QA, Phase 37-45 readiness, staging manual smoke, RC checklist, launch control, controlled tester account dry-run, custom SMTP/email verification or documented limitation, tester invite pack, feedback intake, and issue triage/patch planning readiness.
- The launch sequence sends limited tester invites only after a manual go decision and monitors first tester login, auth/email issues, and feedback intake.
- Stop criteria include secret exposure, service-role exposure, broken auth/session, email/SMTP failure that blocks onboarding, fake billing/credits, fake downloads/artifacts/signed URLs, exposed admin area, public launch claims, staging outage, tester access leak, and serious security/privacy reports.
- No deployment automation, release automation, invite API, waitlist API, tester database, auth runtime change, live email sending, fake private-beta launched status, deployment, or public launch approval was added.
- No live email sending was added.

Why it matters:

- Approved tester invitations should only happen after a human reviewer signs a go/no-go/hold decision.
- The dry run must not become hidden onboarding automation or fake account success.

### Phase 47 Launch Decision Record Is Manual

Current state:

- Phase 47 adds private beta launch decision record documentation plus focused docs/source regression coverage.
- Launch decision record is manual and reviewer-owned.
- Private beta launch decision is not public launch approval.
- The decision record does not deploy anything, invite testers automatically, or create fake launched/approved state.
- Required inputs include clean git status, commit hash, staging URL, tester group, typecheck, build, post181 QA, Phase 37-46 readiness, staging manual smoke, RC checklist, controlled tester dry-run, SMTP/email verification or documented limitation, feedback intake readiness, issue triage/patch planning readiness, known limitations, and stop/rollback owner.
- Decision choices are go, no-go, and hold.
- Post-decision recordkeeping is docs/manual tracker only and must not store secrets, private tokens, env values, tokenized auth links, passwords, service-role keys, SMTP credentials, provider keys, JWTs, or webhook secrets.
- No deployment automation, release automation, invite API, waitlist API, tester database, auth runtime change, live email sending, fake launched/approved state, deployment, or public launch approval was added.
- No live email sending was added.

Why it matters:

- A go decision can allow controlled tester review only; it must not become deployment automation, public launch approval, or runtime launch state.

### Phase 48 First Tester Monitoring Is Manual

Current state:

- Phase 48 adds first tester monitoring documentation plus focused docs/source regression coverage.
- First tester monitoring is manual and reviewer-owned.
- Private beta monitoring is not public launch monitoring.
- Monitoring is for approved staging/private beta testers only.
- The first tester checklist covers launch decision record, staging URL, commit hash, approved tester account, manually sent invite, first login, auth/session behavior, email/custom SMTP issues, protected routes, credits/status honesty, BYOK/provider settings fail-closed behavior, project/history honesty, export/artifact honesty, admin/readiness-only boundaries, and feedback intake readiness.
- The first 24-hour cadence includes first tester login check, same-day feedback review, immediate blocker/security triage, daily triage summary, and hold/pause decision if needed.
- No analytics runtime, monitoring backend, database table, dashboard UI, API route, fake metrics, fake dashboards, fake monitoring status, live email sending, deployment, or public launch approval was added.
- No live email sending was added.

Why it matters:

- First tester monitoring should help humans pause, review, and triage safely without inventing analytics, fake dashboards, fake metrics, or launch state.

### Phase 49 First Tester Feedback Review Is Manual

Current state:

- Phase 49 adds first tester feedback review documentation plus focused docs/source regression coverage.
- First tester feedback review is manual and reviewer-owned.
- Feedback review is not public support launch.
- Feedback does not automatically become implementation.
- The review checklist covers approved tester confirmation, staging/private-beta URL, commit hash, feedback source/channel, screenshot/log redaction, severity, category, affected page/feature, reproduction steps, separation of risky auth/security/storage/BYOK/billing/export issues from docs/copy issues, patch plan choice, and stop/pause recommendation.
- Review categories include security/privacy, auth/session, email/SMTP, credits/billing honesty, BYOK/provider settings, generation/mixer, export/artifact honesty, admin/readiness, UI/UX, and docs/copy.
- Severity levels include blocker, critical, high, medium, low, and docs/copy only.
- No issue tracker API, feedback API, analytics runtime, database table, dashboard UI, fake metric state, fake resolved status, fake issue tracker, live email sending, deployment, or public launch approval was added.
- No fake metric state was added.
- No fake resolved status was added.
- No live email sending was added.

Why it matters:

- First tester feedback must be reviewed and classified before it becomes a safe, focused patch phase.

### Export Runtime Still Deferred

Current state:

- export/render job contracts exist in `src/types/exportJob.ts`
- export submit/poll/artifact service contracts exist in `src/services/exportService.ts`
- focused export service contract and edge tests exist in `tests/e2e/phase52-export-service.spec.ts`
- export agent orchestration scaffold exists in `src/agents/exportAgent.ts`
- focused export agent orchestration tests exist in `tests/e2e/phase53-export-agent.spec.ts`
- export store integration exists in `src/store/exportStore.ts`
- focused export store tests exist in `tests/e2e/phase54-export-store.spec.ts`
- export UI/status actions exist in `src/components/TimelineExportPanel.tsx`
- focused export UI tests exist in `tests/e2e/phase55-export-ui.spec.ts`
- actual video export is not implemented
- export runtime integration is not implemented
- auto-resume polling is not implemented for export jobs
- backend render queue is not implemented
- server workers are not implemented
- webhook completion is not implemented
- remote render cancellation is not implemented
- downloadable video output is not fully implemented (backend stream route exists in Phase 11-M, but frontend download UI deferred)
- real video rendering is not implemented
- durable export job persistence is not implemented
- artifact hosting/signed URLs are not implemented
- multi-device export resume coordination is not implemented
- auth/credits/billing are not implemented
- production queue/worker scaling is not implemented
- frontend-to-backend local development integration now exists (Phase 6.3-B), but production-grade export runtime integration remains incomplete
- renderer implementation is not started (Phase 6.5 decision recorded; implementation deferred)

Why it matters:

- Phase 5.2 currently adds service contracts and focused contract tests only, not runtime export capability
- frontend must remain truthful and must not fake completion/progress/artifacts/cancellation
- Phase 6.1 backend scaffold must avoid fake success/progress/artifacts/download claims
- initial backend job registry may be in-memory and local-only before durable persistence phases
- current requestId idempotency is process-local/in-memory only and is not durable across restarts
- local integration support must remain truthful: no fake progress, no fake terminal success, no fake artifacts, and no fake downloadable URLs
- real artifact records must only exist after real files are produced and verified
- export API responses must remain metadata-only (no raw blobs, no local filesystem paths)
- planned renderer lifecycle/worker contracts are documented, but workers/queues/webhooks/database/durable persistence are still deferred
- planned progress policy remains truthful-only (stage milestones only unless renderer can compute real percent)
- backend lifecycle state-machine guards now exist (Phase 6.6-B), but renderer execution and real artifact production are still deferred
- no real artifact URLs/download outputs exist; artifact hosting/signing remains deferred
- backend artifact metadata contract now exists (Phase 6.7-B), but it is structural-only and does not imply real artifact files
- worker-boundary claim ownership contract now exists (Phase 6.8-B), but no real worker runtime/queue/renderer execution exists yet
- Phase 6.9-A readiness audit confirms foundation readiness for Phase 7 planning, but renderer runtime and real artifact production remain deferred
- renderer input snapshot contract exists (Phase 7.0-B), but it is backend-internal contract validation only and does not imply renderer execution or file output
- temp/output path policy helper exists (Phase 7.1-B), but no file generation or directory creation runtime exists yet
- real file verification helper exists (Phase 7.2-B), but no renderer execution, production file generation pipeline, artifact hosting/signing, or download output exists yet
- renderer failure mapping helper exists (Phase 7.3-B), but it is mapping/sanitization only; no renderer runtime, lifecycle mutation, artifact output, or download capability exists yet
- single-process render harness exists (Phase 7.4-B), but it is injected-orchestration foundation only; no Remotion runtime, no route auto-execution, no queue/worker loop, and no download capability exist yet
- Remotion adapter contract stub exists from Phase 7.5-B as a historical boundary step; real runtime execution was intentionally deferred at that stage
- Remotion dependencies now exist from Phase 7.6-B as dependency onboarding only; real runtime execution remained deferred at that stage
- Remotion import smoke coverage now exists from Phase 7.7-B as import-only validation; real runtime execution remained deferred at that stage
- Remotion adapter mocked runtime call sequencing now exists from Phase 7.8-B; real runtime execution remained deferred at that stage
- Backend-only Remotion composition boundary scaffold exists from Phase 7.9-B; composition scaffold is present, but verified runtime output production is still deferred
- Remotion runtime helper boundary exists from Phase 8.0-B; default runtime execution remains intentionally non-executing/truthful until a later audited real-runtime phase
- `@remotion/bundler` dependency and runtime type boundary prep exist from Phase 8.1-B; real runtime bundle/selectComposition/renderMedia execution remains deferred
- route auto-execution remains deferred
- Phase 8.11-B safely stopped (app.ts lacked rendererAdapter/pathPolicy)
- Phase 8.12-B adds backend dependency composition module (`backend/composition/backendDependencies.ts`) â€” composes registry, rendererAdapter, pathPolicy but does NOT wire them into exports router yet
- Phase 8.13-B adds worker lifecycle app wiring (`backend/workers/renderWorkerLifecycle.ts`):
  - lifecycle created in app.ts using already-composed backendDeps
  - lifecycle.init() called during app creation but remains harmless when env flags disabled
  - lifecycle stored internally as `app.locals.renderWorkerLifecycle`
  - no public lifecycle/status route added
  - rendererAdapter/pathPolicy still NOT wired into exports router (execute route still returns 501)
- Phase 8.14-B adds truthful GET /exports/:jobId status mapping:
  - GET now maps actual registry status to public ExportPollResult types
  - GET no longer always returns kind: "pending"
  - terminal_success returns safe artifact metadata only (no local paths/URLs)
  - terminal_failure intentionally excludes failure.details (no leak risk)
  - POST /exports remains unchanged (already acts as enqueue boundary when worker flags enabled)
- verified output production remains deferred
- artifact hosting/signed URL/download capability remains deferred
- no public download URLs exist yet
- Phase 9-B adds artifact access contract types only (no hosting implementation):
  - BackendArtifactAccessKind with signed_url, backend_stream, local_dev_stream
  - BackendArtifactAccessDescriptor with safety comments
  - BackendArtifactAccessReadyResponse / BackendArtifactAccessUnavailableResponse
  - No storage provider implementation yet
  - No signed URL generation yet
  - No download UI yet
  - GET /exports/:jobId/artifacts still returns 501
- Phase 9-F adds artifact access provider interface boundary:
  - backend/artifacts/artifactAccessProvider.ts with ArtifactAccessProvider interface
  - ArtifactAccessRequest includes jobId, artifactId, optional artifact
  - getArtifactAccess returns Promise<BackendArtifactAccessResponse>
  - No provider implementation yet
  - No route wiring yet
  - Provider is lifecycle-neutral (does not mutate job state)
  - Provider is renderer-neutral (does not import renderer)
  - Provider is route-neutral (does not import routes)
- Phase 9-J adds not-configured provider implementation:
  - backend/artifacts/notConfiguredArtifactAccessProvider.ts with createNotConfiguredArtifactAccessProvider
  - Factory returns truthful artifact_access_unavailable response
  - Response does not include url or access descriptor
  - No route wiring yet
  - No dependency composition yet
  - No storage provider yet
- Phase 10-B adds artifact access route:
  - GET /exports/:jobId/artifacts/:artifactId/access
  - Route validates job exists and is successful
  - Route validates artifact exists and is ready
  - Route returns BackendArtifactAccessResponse
  - Defaults to not-configured provider (truthful "not configured")
  - No storage provider wired yet
  - No signed URL generation yet
  - No local file streaming yet
  - No download UI yet
- Phase 11-B adds internal artifact storage reference:
  - backend/artifacts/internalArtifactStorageRef.ts with InternalArtifactStorageRef
  - Internal-only type with filePath, rootPath, jobSegment, directoryPath
  - Not exported to contracts
  - Not added to BackendArtifactMetadata
  - Prerequisite for local dev stream provider and stream route
- Phase 11-F adds local dev stream provider:
  - backend/artifacts/localDevArtifactAccessProvider.ts with createLocalDevArtifactAccessProvider
  - LocalDevProviderOptions with injected resolveArtifactStorageRef, streamUrlForArtifact, isPathWithinRoot
  - Returns local_dev_stream access when ref exists, path is safe, URL is safe
  - Rejects file://, Windows paths, path traversal in URLs
- Phase 11-J adds artifact storage ref resolver boundary:
  - backend/artifacts/artifactStorageRefResolver.ts with ArtifactStorageRefResolver
  - resolve(jobId, artifactId) returns InternalArtifactStorageRef or undefined
  - Internal-only, not exported in public contracts
  - Added optional artifactStorageRefResolver to ExportRouterOptions
- Phase 11-M adds backend stream route:
  - GET /exports/:jobId/artifacts/:artifactId/stream route in backend/routes/exports.ts
  - Uses injected ArtifactStorageRefResolver (test-injected only, no app wiring)
  - Path validation via fs.realpath + path.relative root containment
  - File existence/isFile check at stream time
  - Safe headers: Content-Type, Content-Disposition, Cache-Control no-store, X-Content-Type-Options nosniff
  - Generic error codes: stream_not_configured, job_not_found, artifact_not_found, forbidden, not_found, internal_error
  - No local path leakage in error responses
  - No app/server wiring yet (resolver test-injected only)
  - No production signed URL provider yet
  - No frontend download UI yet
- Phase 12-B adds internal in-memory artifact storage ref store:
  - backend/artifacts/inMemoryArtifactStorageRefStore.ts
  - ArtifactStorageRefStore interface with set/get/has/delete/clear
  - Maps jobId + artifactId to InternalArtifactStorageRef
  - Process-memory only (Map-based, no serialization)
  - Starts empty, no persistence
  - No file existence/path validation (stream route owns that)
  - No app/provider/resolver wiring yet
- Phase 12-F adds render harness verified artifact ref registration callback:
  - singleProcessRenderHarness.ts gets optional onVerifiedArtifactRef callback
  - VerifiedArtifactRefPayload with jobId, artifactId, artifact, storageRef
  - Callback called only after verifyRenderedArtifact succeeds
  - Callback wrapped in try/catch (best-effort, non-blocking)
  - storageRef constructed from resolvedOutputPath (filePath, rootPath, jobSegment, directoryPath)
  - Harness does not import store (store-implementation-neutral)
  - No store/dependency wiring yet - callback ready for future wiring
  - markSuccess still receives only BackendArtifactMetadata (no path fields)
- Phase 12-J adds backend store wiring / ref registration callback connection:
  - backendDependencies.ts owns artifactStorageRefStore (process-memory only)
  - backendDependencies.ts exposes onVerifiedArtifactRef callback
  - onVerifiedArtifactRef wraps store.set in try/catch (best-effort)
  - executeRenderJob accepts optional onVerifiedArtifactRef and passes to harness
  - No app/route/provider/resolver wiring yet - store ready for future wiring
  - Stream route still requires resolver injection (future phase)
- Phase 12-N adds artifactStorageRefResolver to backendDependencies:
  - backendDependencies.ts now exposes artifactStorageRefResolver
  - Resolver calls artifactStorageRefStore.get(jobId, artifactId)
  - Returns InternalArtifactStorageRef | undefined
  - No filesystem access, no registry inspection
  - Resolver NOT injected into createExportRouter (API unchanged)
  - Stream route still returns 501 until resolver is injected (future phase)
  - Provider remains not-configured
- Phase 12-R adds worker callback wiring:
  - backendDeps.onVerifiedArtifactRef passed to createRenderWorkerLifecycle
  - Callback flows through worker startup â†’ loop â†’ worker â†’ executeRenderJob
  - Callback fires in harness only after artifact verification succeeds
  - Successful renders populate artifactStorageRefStore internally
  - Failed renders do NOT register refs (callback not called on failure)
  - Resolver still NOT injected into createExportRouter (API unchanged)
  - No provider/env/frontend wiring yet
- Phase 12-V adds route execution callback wiring:
  - backendDeps.onVerifiedArtifactRef passed to createExportRouter
  - POST /exports/:jobId/execute now passes callback to executeRenderJob
  - Both worker-triggered and route-triggered renders can populate store
  - Route execution remains gated by FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION
  - Resolver still NOT injected into createExportRouter (superseded by Phase 12-Z)
  - Provider still NOT wired
  - No env gating for local dev stream yet
- Phase 12-Z adds env-gated artifact resolver route injection:
  - isLocalDevArtifactStreamEnabled() checks FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1"
  - artifactStorageRefResolver passed to createExportRouter only when env enabled
  - Stream route becomes functional only when env enabled
  - Default behavior remains stream_not_configured / 501
  - Provider still NOT wired
  - Auth still not added
- Phase 13-B adds env-gated local dev artifact access provider wiring:
  - createLocalDevArtifactAccessProvider is injected into createExportRouter only when FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM === "1"
  - artifactStorageRefResolver and artifactAccessProvider now share the same local-dev env gate
  - Default behavior remains not-configured when env is disabled
  - Access route can now return a safe local_dev_stream descriptor in explicit local-dev mode only
  - Descriptor points to backend stream route, not a filesystem path
  - Stream route remains the final validation authority
  - No frontend download UI yet
  - No auth/authorization yet
  - No production signed URL or storage provider yet
  - local_dev_stream must not be enabled unconditionally or in production
- Phase 14-B adds backend local-dev artifact access behavior smoke:
  - createExportRouter-level smoke coverage now exists
  - Disabled `/access` behavior is verified as `artifact_access_unavailable` / `artifact_access_not_configured`
  - Disabled `/stream` behavior is verified as `501 stream_not_configured`
  - Enabled `/access` behavior is verified as safe `local_dev_stream` descriptor access only
  - Descriptor JSON does not expose local filesystem paths
  - Stream route remains the final validation authority
  - Artifact route strict param parsing bug is fixed by parsing only `jobId` into the strict jobId parser
  - Strict schema remains preserved; validation was not loosened
  - Positive real file stream/download smoke remains deferred
  - local_dev_stream must not be enabled unconditionally or in production
- Phase 15-B adds positive local-dev artifact stream file smoke:
  - Positive real temp-file stream smoke now exists at createExportRouter level
  - `/stream` success with real file bytes is now verified in local-dev backend coverage
  - Response headers are verified for `video/mp4`, attachment disposition, `no-store`, and `nosniff`
  - No frontend download UI exists yet
  - No auth/authorization exists yet
  - No signed URL or production storage provider exists yet
  - local_dev_stream remains local-dev-only and must not be enabled unconditionally or in production
- Phase 16-B adds frontend artifact access service only:
  - Frontend artifact access service now exists
  - Service requests `/exports/:jobId/artifacts/:artifactId/access` only
  - Service does not call `/stream` and does not trigger browser download/navigation
  - Unavailable artifact access remains truthful in frontend parsing
  - No frontend download UI exists yet
  - No auth/authorization exists yet
  - No signed URL or production storage provider exists yet
  - local_dev_stream remains local-dev-only and must not be treated as production-ready
- Phase 17-B adds exportStore artifact access state/actions only:
  - `exportStore` now tracks volatile per-artifact access state/actions
  - `requestExportArtifactAccess(...)` calls frontend artifact access service only
  - No direct `/stream` fetch or navigation is performed by the store
  - Browser download behavior remains deferred
  - Artifact access descriptors remain volatile and are not persisted
  - No frontend download UI exists yet
  - No auth/authorization exists yet
  - No signed URL or production storage provider exists yet
  - Public download URLs do not exist yet
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 18-B adds frontend artifact access UI boundary only:
  - Frontend artifact access UI boundary now exists
  - UI dispatches `exportStore` artifact access action only
  - UI renders truthful loading/ready/unavailable/error access states
  - `local_dev_stream` is shown only as local-dev access state
  - Actual download/navigation behavior remains deferred
  - Direct `/stream` fetch or navigation remains deferred
  - Browser download behavior remains deferred
  - No auth/authorization exists yet
  - No signed URL or production storage provider exists yet
  - Public download URLs do not exist yet
  - Artifact access descriptors remain volatile and are not persisted
  - UI tests using `vite preview` require a fresh build before verification
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 19-C adds export job ownership contract boundary only:
  - Export job ownership boundary now exists
  - Backend export job records now include `ownerId` and `workspaceId`
  - Registry requestId idempotency is now owner/workspace-aware
  - In-memory registry stores and returns ownership metadata
  - Same requestId can resolve independently across different owner/workspace scopes
  - Actual auth/session/requester identity is still deferred
  - Route authorization enforcement is still deferred
  - Artifact `/access` and `/stream` ownership checks are still deferred
  - Frontend download/navigation remains deferred
  - No signed URL or production storage provider exists yet
  - Default local/dev owner scope must not be mistaken for production auth
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 20-B adds internal requester context boundary only:
  - Internal requester context boundary now exists
  - Default local/dev requester fallback now exists
  - Default local/dev fallback is not production auth
  - Requester-facing routes now resolve fallback requester context internally
  - `getByIdForOwner(...)` now exists for owner-aware requester-facing lookup
  - Ownership-blind `getById(...)` remains for internal/worker flows
  - Real auth/session/requester extraction remains deferred
  - Route authorization enforcement remains deferred
  - Artifact `/access` and `/stream` ownership checks remain deferred as real auth enforcement
  - Frontend download/navigation remains deferred
  - No signed URL or production storage provider exists yet
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 21-B adds route requester resolver injection / owner-aware authorization behavior only:
  - Route requester resolver injection now exists
  - Owner-aware requester-facing route behavior is now testable with injected requester contexts
  - Not-owned requester-facing route behavior now avoids existence leakage in focused tests
  - `/stream` resolver/filesystem work is guarded behind owner-aware lookup
  - Real auth/session/requester extraction remains deferred
  - Real auth middleware remains deferred
  - Production route authorization using real requester identity remains deferred
  - Frontend download/navigation remains deferred
  - No signed URL or production storage provider exists yet
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 22-B adds authenticated requester context mode/interface boundary only:
  - Authenticated requester context mode boundary now exists
  - `authenticated_session` and `authenticated_token` are type/interface boundaries only
  - Real auth/session/cookie/bearer-token extraction remains deferred
  - Real auth middleware remains deferred
  - Production requester identity remains deferred
  - Route authorization with real requester identity remains deferred
  - Frontend download/navigation remains deferred
  - No signed URL or production storage provider exists yet
  - `local_dev_fallback` remains compatibility-only and must not be treated as production auth
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 24-A adds account/workspace/auth contract boundary only:
  - Account/workspace/auth contract boundary now exists
  - Workspace roles are now explicitly modeled
  - Provider key, credit ledger, artifact access, and storage metadata ownership contracts now exist
  - Real auth provider selection remains deferred
  - Real auth/session/cookie/bearer-token extraction remains deferred
  - Real auth middleware remains deferred
  - Database persistence/schema implementation remains deferred
  - BYOK encryption/storage implementation remains deferred
  - Billing/credits implementation remains deferred
  - Production signed URL/storage provider remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `local_dev_fallback` remains compatibility-only and must not be treated as production auth
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 25-B adds account/workspace/ledger/artifact repository boundary only:
  - Repository interface boundaries now exist
  - Supabase/Postgres implementation remains deferred
  - Database schema and migrations remain deferred
  - Real auth provider integration remains deferred
  - Auth middleware remains deferred
  - BYOK encryption/storage remains deferred
  - Credit ledger persistence and billing remain deferred
  - Signed URL generation remains deferred
  - Production storage provider remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 26-B adds Supabase/Postgres SQL schema draft only:
  - Initial Supabase/Postgres SQL schema draft now exists
  - Schema has not been executed as a migration
  - Supabase client and package installation remain deferred
  - Supabase/Postgres repository adapter remains deferred
  - Real auth provider integration remains deferred
  - Auth middleware and session/requester extraction remain deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Credit ledger persistence and billing remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `app_users` to `auth.users` mapping decision remains deferred
  - `export_jobs` lifecycle and worker-claim parity may need later expansion
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 27-B adds migration folder structure and initial SQL migration draft only:
  - Initial migration-style SQL draft now exists under `backend/db/migrations`
  - Migration has not been executed
  - Supabase CLI and package installation remain deferred
  - Supabase client runtime remains deferred
  - DB repository adapter remains deferred
  - Real auth provider integration remains deferred
  - Auth middleware and session/requester extraction remain deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Credit ledger persistence and billing remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `app_users` to `auth.users` mapping decision remains deferred
  - `export_jobs` lifecycle and worker-claim parity may need later expansion
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 28-B adds Supabase environment/config contract boundary only:
  - Supabase config boundary now exists
  - Supabase package installation remains deferred
  - Supabase client runtime remains deferred
  - Migration execution remains deferred
  - DB repository adapter remains deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Credit ledger persistence and billing remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `FREE_AI_MIXER_DATABASE_URL` optionality remains a later adapter decision
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 29-B adds Supabase client factory contract boundary only:
  - Supabase client factory contract boundary now exists
  - Supabase package installation remains deferred
  - Real Supabase SDK client runtime remains deferred
  - DB repository adapter remains deferred
  - Migration execution remains deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Credit ledger persistence and billing remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `sdk_not_installed` future handle must not be treated as a live Supabase client
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 30-B adds backend-only Supabase runtime client boundary:
  - `@supabase/supabase-js` is now installed
  - Backend-only Supabase runtime client factory boundary now exists
  - Real SDK client handle exists only inside backend boundary
  - Client creation must not be treated as DB readiness
  - Migration execution remains deferred
  - DB repository adapter remains deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Credit ledger persistence and billing remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - Frontend must not import `@supabase/supabase-js` yet
  - Routes, repositories, auth, and requester boundaries must not import the Supabase client factory until later audited phases
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 31-B adds migration command / script boundary only:
  - Migration workflow boundary now exists
  - Migration command names are reserved and described only
  - No migrations have been executed
  - Supabase CLI execution remains deferred
  - `package.json` migration scripts remain deferred
  - DB repository adapter remains deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Credit ledger persistence and billing remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - Real migration execution must remain manual and separately audited
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 32-B adds first export_jobs repository adapter boundary only:
  - First export_jobs repository adapter boundary now exists
  - Adapter is unwired and must not be treated as active persistence
  - DB repository wiring remains deferred
  - Migration execution remains deferred
  - Real database credentials remain deferred
  - Route DB integration remains deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Credit ledger persistence and billing remain deferred
  - Artifact and storage repository adapters remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `export_jobs` lifecycle and worker-claim parity may need later schema and adapter refinement
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 33-B adds account/workspace/membership repository adapter boundary only:
  - Account/workspace/membership repository adapter boundary now exists
  - Adapter is unwired and must not be treated as active account/workspace persistence
  - DB repository wiring remains deferred
  - Migration execution remains deferred
  - Real database credentials remain deferred
  - Route DB integration remains deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Provider key persistence remains deferred
  - Credit ledger persistence and billing remain deferred
  - Artifact and storage repository adapters remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - Membership status naming between `suspended` and `disabled` needs later normalization
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 34-B adds backend repository composition boundary only:
  - Repository composition boundary now exists
  - Repository composition is disabled by default
  - DB-backed composition is env/config-gated and lazy only
  - Composition availability must not be treated as active persistence or DB readiness
  - Route DB integration remains deferred
  - App startup DB dependency remains deferred
  - Migration execution remains deferred
  - Real database credentials remain deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Provider key persistence remains deferred
  - Credit ledger persistence and billing remain deferred
  - Artifact and storage repository adapters remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 35-B adds test-only route/repository integration harness:
  - Test-only route/repository integration harness now exists
  - Harness must not be treated as production route DB integration
  - Production route DB wiring remains deferred
  - App startup DB dependency remains deferred
  - Migration execution remains deferred
  - Real database credentials remain deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Provider key persistence remains deferred
  - Credit ledger persistence and billing remain deferred
  - Artifact and storage repository adapters remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `POST /exports` and `GET /exports/:jobId` compatibility are covered, but broader route DB integration remains separately audited
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 36-B adds local Supabase migration preflight boundary only:
  - Local migration preflight boundary now exists
  - Preflight boundary is local-only and manual-only
  - Preflight must not be treated as executed migration validation
  - Supabase CLI availability remains unverified
  - Docker and local Supabase readiness remain unverified
  - Actual local migration execution remains deferred
  - Remote and production migration execution remain deferred
  - Route DB integration remains deferred
  - App startup DB dependency remains deferred
  - Real database credentials remain deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Provider key persistence remains deferred
  - Credit ledger persistence and billing remain deferred
  - Artifact and storage repository adapters remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 37-B adds local Supabase CLI/Docker readiness boundary only:
  - Local Supabase CLI/Docker readiness boundary now exists
  - Readiness boundary is local-only and descriptive/manual-only
  - Supabase CLI availability remains unverified
  - Docker readiness remains unverified
  - Future manual command names are documented but not executed
  - Actual Supabase CLI execution remains deferred
  - Actual Docker startup remains deferred
  - Actual local migration execution remains deferred
  - Remote and production migration execution remains deferred
  - `package.json` migration and CLI scripts remain deferred
  - Route DB integration remains deferred
  - App startup DB dependency remains deferred
  - Real database credentials remain deferred
  - Auth middleware and session/requester extraction remain deferred
  - Production requester resolver remains deferred
  - RLS policy implementation remains deferred
  - BYOK encryption and KMS decisions remain deferred
  - Provider key persistence remains deferred
  - Credit ledger persistence and billing remain deferred
  - Artifact and storage repository adapters remain deferred
  - Production storage provider remains deferred
  - Signed URL generation remains deferred
  - Frontend auth UI remains deferred
  - Frontend download/navigation remains deferred
  - `local_dev_fallback` remains compatibility-only
  - `local_dev_stream` remains local-dev-only and must not be treated as production-ready
- Phase 41-D adds contract-aligned SQL hardening only:
  - `export_jobs_status_check` now exists in the SQL drafts using backend lifecycle statuses only:
    - `queued`
    - `submitted`
    - `rendering`
    - `finalizing`
    - `success`
    - `error`
    - `expired`
  - `artifact_records` now uses composite primary key `(job_id, artifact_id)` in the SQL drafts
  - No runtime DB wiring was added
  - No Supabase CLI execution was added
  - No auth/requester/RLS/runtime/storage/signed URL integration was added
  - Deferred hardening remains deferred:
    - `artifact_record_id`
    - `gen_random_uuid()` / `pgcrypto`
    - artifact status/kind/format checks
    - `credit_ledger.amount_delta bigint`
    - storage object uniqueness
    - `updated_at` triggers
- Phase 41-E adds remote SQL Editor validation only:
  - Remote SQL validation succeeded in a fresh Supabase cloud project using the Dashboard SQL Editor
  - 8 expected public tables were created
  - Constraint verification confirmed `export_jobs_status_check` and `artifact_records_pkey`
  - Results tab confirmed DDL success even if Explain may show syntax errors for `CREATE TABLE`
  - No local Supabase Docker was used
  - No `supabase link`, `supabase db push`, `supabase db reset`, or `supabase migration up` was run
  - This does NOT mean production DB integration is active
  - Route DB integration remains deferred
  - Auth/requester/RLS enforcement remains deferred
  - Supabase CLI migration workflow remains deferred
  - Local Supabase Docker remains deferred
  - Provider-key encryption runtime remains deferred
  - Artifact status/kind/format checks remain deferred
  - `updated_at` triggers remain deferred
  - storage object uniqueness remains deferred
  - `credit_ledger.amount_delta bigint` remains deferred
- Phase 42-B adds opt-in remote Supabase connection smoke only:
  - `tests/e2e/phase42-remote-supabase-connection-smoke.spec.ts` now exists
  - Smoke test is backend-only, read-only, and skipped by default
  - Opt-in requires:
    - `FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE=1`
    - `FREE_AI_MIXER_ENABLE_SUPABASE_DB=1`
    - `FREE_AI_MIXER_DB_PROVIDER=supabase`
    - `FREE_AI_MIXER_SUPABASE_URL`
    - `FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`
  - Smoke test uses existing backend config and client factory boundaries only
  - Smoke test queries `app_users` using `select("id").limit(1)`
  - Smoke test does not use anon key
  - Smoke test does not insert, update, delete, upsert, or call RPC
  - Smoke test does not call repository adapters
  - Smoke test does not wire routes, app runtime, or backend dependency composition
- Phase 42-C adds manual remote smoke success:
  - Remote Supabase connection smoke succeeded when opt-in env vars were provided locally
  - Manual smoke result was `2 passed`
  - Env vars and secrets were cleared after the test
  - No service-role key was committed
  - No `.env` changes were made
  - No local Supabase Docker was used
  - No `supabase link`, `supabase db push`, `supabase db reset`, or `supabase migration up` was run
  - This does NOT mean production DB integration is active
  - Route DB integration remains deferred
  - Repository remote write/read adapter tests remain deferred
  - Auth/requester/RLS enforcement remains deferred
  - Frontend Supabase client remains absent
  - Provider-key persistence, credit ledger runtime, artifact/storage runtime, and signed URLs remain deferred
- Phase 43-B adds opt-in remote account/workspace repository smoke only:
  - `tests/e2e/phase43-remote-account-workspace-repository-smoke.spec.ts` now exists
  - Smoke test is backend-only, read-only, and skipped by default
  - Opt-in requires:
    - `FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE=1`
    - `FREE_AI_MIXER_ENABLE_SUPABASE_DB=1`
    - `FREE_AI_MIXER_DB_PROVIDER=supabase`
    - `FREE_AI_MIXER_SUPABASE_URL`
    - `FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`
  - Smoke test uses existing backend config and client factory boundaries only
  - Smoke test instantiates `SupabaseAccountWorkspaceRepository` directly
  - Smoke test does not use `SupabaseExportJobsRepository`
  - Smoke test does not use `repositoryComposition`
  - Smoke test does not insert, update, delete, upsert, or call RPC
  - Initial real remote attempt failed because synthetic ids were non-UUID strings for UUID columns
  - Phase 43-B fix updated missing UUID-column ids to:
    - `00000000-0000-4000-8000-000000043001`
    - `00000000-0000-4000-8000-000000043002`
  - Synthetic auth subject remained text-only
- Phase 43-C adds manual remote account/workspace repository smoke success:
  - Remote Supabase account/workspace repository read-only smoke succeeded when opt-in env vars were provided locally
  - Manual smoke result was `2 passed`
  - Env vars and secrets were cleared after the test
  - `git status` was clean after the test
  - No service-role key was committed
  - No `.env` changes were made
  - No local Supabase Docker was used
  - No `supabase link`, `supabase db push`, `supabase db reset`, or `supabase migration up` was run
  - This does NOT mean production DB integration is active
  - Route DB wiring remains deferred
  - `SupabaseExportJobsRepository` remote smoke remains deferred
  - Repository write/read/delete cleanup smoke remains deferred
  - Auth/requester/RLS enforcement remains deferred
  - Frontend Supabase client remains absent
  - Provider-key persistence/runtime remains deferred
  - Credit ledger runtime remains deferred
  - Artifact/storage runtime and signed URLs remain deferred
- Phase 44-B adds opt-in remote export jobs repository smoke only:
  - `tests/e2e/phase44-remote-export-jobs-repository-smoke.spec.ts` now exists
  - Smoke test is backend-only and skipped by default
  - Opt-in requires:
    - `FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE=1`
    - `FREE_AI_MIXER_ENABLE_SUPABASE_DB=1`
    - `FREE_AI_MIXER_DB_PROVIDER=supabase`
    - `FREE_AI_MIXER_SUPABASE_URL`
    - `FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`
  - Smoke test uses existing backend config and client factory boundaries only
  - Smoke test instantiates `SupabaseExportJobsRepository` directly
  - Smoke test inserts prerequisite `app_users` and `workspaces` rows directly through the admin client
  - Smoke test calls `upsertJob`, `getByJobId`, and `getByIdempotencyScope`
  - Smoke test validates update/conflict behavior with the same idempotency scope
  - Smoke test cleans up by exact ids only:
    - `export_jobs` first
    - `workspaces` second
    - `app_users` third
  - Smoke test does not use routes, app startup, `backendDependencies`, or `repositoryComposition`
  - Smoke test does not use anon or publishable key
  - Smoke test does not use Supabase CLI
  - First real remote run failed only because equivalent UTC timestamps were returned as `+00:00` instead of `Z`
  - Phase 44-B fix updated timestamp assertions to compare semantically by normalized UTC value
  - Exact assertions remained for `jobId`, `requestId`, `timelineId`, `ownerId`, `workspaceId`, `status`, and `attemptCount`
- Phase 44-C adds manual remote export jobs repository smoke success:
  - Remote `SupabaseExportJobsRepository` smoke succeeded when opt-in env vars were provided locally
  - Manual smoke result was `2 passed`
  - Env vars and secrets were cleared after the test
  - `git status` was clean after the test
  - No service-role key was committed
  - No `.env` changes were made
  - No local Supabase Docker was used
  - No `supabase link`, `supabase db push`, `supabase db reset`, or `supabase migration up` was run
  - This validates controlled remote write/read/update/exact-id cleanup for export jobs repository only
  - This does NOT mean production DB integration is active
  - Route DB wiring remains deferred
  - repositoryComposition runtime DB wiring remains deferred
  - Auth/requester/RLS enforcement remains deferred
  - Frontend Supabase client remains absent
  - Provider-key persistence/runtime remains deferred
  - Credit ledger runtime remains deferred
  - Artifact/storage runtime and signed URLs remain deferred
- Phase 45-A audit confirmed runtime DB wiring is still unsafe:
  - `repositoryComposition` exists
  - `createBackendDependencies()` exposes `repositoryComposition`
  - export routes/workers still use `ExportJobRegistry`
  - `SupabaseExportJobsRepository` is not a drop-in replacement for `ExportJobRegistry`
  - runtime route DB wiring remains deferred
- Phase 45-B adds repository composition runtime boundary coverage:
  - `tests/e2e/phase45-repository-composition-runtime-boundary.spec.ts` now exists
  - Default backend dependency creation stays offline/in-memory when Supabase env is absent
  - `readSupabaseConfigFromEnv()` resolves disabled/valid with Supabase env cleared
  - `createBackendDependencies()` returns disabled `repositoryComposition` and an in-memory registry boundary
  - `createRepositoryComposition()` remains disabled without Supabase env
  - `createApp()` succeeds with no Supabase env vars and no runtime DB requirement
  - Source inspection confirms:
    - routes still receive `registry`
    - no `SupabaseExportJobsRepository` import in route/app wiring
    - no `SupabaseAccountWorkspaceRepository` import in route/app wiring
    - no `repositoryComposition` route wiring
    - worker lifecycle still depends on `ExportJobRegistry`
  - Source inspection confirms:
    - no service-role env logging
    - no Supabase CLI command usage
  - repositoryComposition runtime boundary is now guarded by tests
  - Route DB wiring remains deferred
  - Supabase repository composition is not connected to export routes
  - Export routes/workers still use `ExportJobRegistry`
  - Runtime DB persistence remains deferred
  - Auth/requester/RLS enforcement remains deferred
  - Frontend Supabase client remains absent
  - Provider-key persistence/runtime remains deferred
  - Credit ledger runtime remains deferred
  - Artifact/storage runtime and signed URLs remain deferred
- Phase 46-A audit confirmed a real registry adapter is still required:
  - export routes/workers depend on `ExportJobRegistry`
  - `SupabaseExportJobsRepository` is not a drop-in replacement for runtime registry behavior
  - runtime DB wiring is not safe yet
  - a Supabase-backed `ExportJobRegistry` adapter boundary is required before route/worker integration
- Phase 46-B adds a fail-closed `SupabaseExportJobRegistry` boundary:
  - `backend/registry/supabaseExportJobRegistry.ts` now exists
  - `tests/e2e/phase46-supabase-export-job-registry-boundary.spec.ts` now exists
  - `SupabaseExportJobRegistry` adapter boundary now exists but is fail-closed and not wired
  - `createSupabaseExportJobRegistry(...)` now exists
  - `supabaseExportJobRegistryBoundary` metadata now exists
  - boundary is constructor-injected
  - boundary does not create a DB client at import time
  - boundary does not require env vars at import time
  - every `ExportJobRegistry` method currently throws a clear not-wired error instead of returning fake success
  - boundary metadata preserves required future behavior:
    - lifecycle/state-machine preservation
    - owner/workspace/requestId idempotency
    - worker claim/TTL semantics
    - conditional transitions
    - artifact sanitization
    - failure sanitization
  - tests prove:
    - offline import with Supabase env cleared
    - no env/runtime DB dependency at import time
    - no routes/app/server/composition imports
    - no Supabase CLI usage
    - no service-role env logging
    - no `createClient(...)`
    - no config/env reads at import time
    - app/routes/workers are still not wired to `SupabaseExportJobRegistry`
    - routes still use `registry`
    - workers still use `ExportJobRegistry`
  - Runtime route DB wiring remains deferred
  - Worker DB wiring remains deferred
  - SupabaseExportJobsRepository remains repository-level only, not route registry runtime
  - Full Supabase-backed `ExportJobRegistry` implementation remains deferred
  - Atomic claim/TTL/concurrency behavior remains deferred
  - Auth/RLS/requester enforcement remains deferred
  - Frontend Supabase client remains absent
  - Provider-key persistence/runtime remains deferred
  - Credit ledger runtime remains deferred
  - Artifact/storage runtime and signed URLs remain deferred
- Phase 47-A audit confirmed safe first adapter work is read-only only:
  - `SupabaseExportJobRegistry` can safely implement:
    - `getById`
    - `getByIdForOwner`
    - `getByRequestId` only when `ownerScope` is provided
  - Mutating/lifecycle methods must remain fail-closed:
    - `create`
    - `getByStatus`
    - `claim`
    - `markRendering`
    - `markFinalizing`
    - `markSuccess`
    - `markError`
    - `transition`
  - No route/worker/runtime DB wiring is safe in this phase
  - No remote DB calls are required in default tests
- Phase 47-B adds read-only `SupabaseExportJobRegistry` method mappings:
  - `backend/registry/supabaseExportJobRegistry.ts` now has read-only mappings only
  - `tests/e2e/phase47-supabase-export-job-registry-method-mapping.spec.ts` now exists
  - `getById(jobId)` delegates to `jobsRepository.getByJobId(jobId)`
  - `getByIdForOwner(jobId, ownerScope)` reads by `jobId` and returns only when `ownerId` and `workspaceId` match
  - `getByRequestId(requestId, ownerScope?)` delegates to `jobsRepository.getByIdempotencyScope(...)` only when `ownerScope` exists
  - missing `ownerScope` for `getByRequestId` fails closed
  - mutating/lifecycle registry methods remain fail-closed
  - source inspection proves app/routes/workers are still not wired to `SupabaseExportJobRegistry`
  - focused Phase 47 method mapping test passed with typecheck and build
  - Route DB wiring remains deferred
  - Worker DB wiring remains deferred
  - Runtime DB persistence remains deferred
  - Atomic claim/TTL/concurrency behavior remains deferred
  - Conditional lifecycle transitions remain deferred
  - Artifact/failure persistence fidelity remains deferred
  - Auth/RLS/requester enforcement remains deferred
  - Frontend Supabase client remains absent
  - Provider-key persistence/runtime remains deferred
  - Credit ledger runtime remains deferred
  - Artifact/storage runtime and signed URLs remain deferred
- Phase 48-A audit confirmed the registry async/runtime mismatch remains a hard boundary:
  - `ExportJobRegistry` is synchronous today
  - `SupabaseExportJobsRepository` is async and Promise-based
  - routes call registry methods synchronously
  - workers/render harness call registry lifecycle methods synchronously
  - `SupabaseExportJobRegistry` must not fake sync behavior around async DB calls
  - runtime route/worker DB wiring is not safe yet
  - a full async registry refactor would affect routes, workers, harness, registry implementations, and many tests
- Phase 48-B adds async boundary test coverage:
  - `tests/e2e/phase48-export-job-registry-async-boundary.spec.ts` now exists
  - ExportJobRegistry async boundary is now guarded by tests
  - Runtime route DB wiring remains deferred
  - Worker DB wiring remains deferred
  - Runtime DB persistence remains deferred
  - Full async registry contract refactor remains deferred
  - SupabaseExportJobRegistry must not fake sync behavior over async DB calls
  - Atomic claim/TTL/concurrency behavior remains deferred
  - Conditional lifecycle transitions remain deferred
  - Artifact/failure persistence fidelity remains deferred
  - Auth/RLS/requester enforcement remains deferred
  - Frontend Supabase client remains absent
  - Provider-key persistence/runtime remains deferred
  - Credit ledger runtime remains deferred
  - Artifact/storage runtime and signed URLs remain deferred

### Local Supabase Docker Startup Still Blocked

Current state:

- local Supabase Docker startup remains blocked on this Windows environment
- previous failures point to a Realtime/container startup issue rather than Free AI Mixer runtime code
- remote SQL validation succeeded without using local Supabase Docker
- remote Supabase connection smoke now works when explicit opt-in env vars are provided
- remote Supabase account/workspace repository read-only smoke now works when explicit opt-in env vars are provided
- remote `SupabaseExportJobsRepository` smoke now works when explicit opt-in env vars are provided
- repositoryComposition runtime boundary is now guarded by tests while route DB wiring remains deferred
- `SupabaseExportJobRegistry` now has read-only mappings only, and the sync/async boundary is guarded by tests while mutating/lifecycle methods remain fail-closed and local Docker Supabase remains deferred

Why it matters:

- local Docker-based Supabase validation cannot currently be treated as a reliable path on this machine
- remote SQL Editor validation confirms schema execution only and does not activate runtime DB integration

Target fix phase:

- later local environment troubleshooting phase, separate from runtime integration and separate from remote SQL validation

Target fix phase:

- later backend/export phases

### No Durable Backend Queue

Current state:

- queue execution is in-memory and browser-bound

Why it matters:

- browser-local resume works only from persisted local state, not from a server-owned durable queue
- concurrency and status are local, not globally durable

Target fix phase:

- later backend/infrastructure work

### No Multi-Device Or Cross-Tab Resume Coordination

Current state:

- browser-local resume works only in the local persisted store for one browser context
- there is no shared lease, coordination, or ownership model across devices or browser contexts

Why it matters:

- multiple clients cannot safely coordinate one remote provider job
- resume guarantees stop at the local browser boundary

Target fix phase:

- later backend/infrastructure work

### No Server Workers Or Webhook Completion

Current state:

- provider polling is browser-driven
- there are no background workers, webhook consumers, or server-authoritative completion handlers

Why it matters:

- work only progresses while a browser runtime owns the polling loop
- the system cannot yet claim durable backend orchestration

Target fix phase:

- later backend/infrastructure work

### No Remote Provider Cancellation

Current state:

- local abort behavior exists only for the browser-owned polling flow
- remote provider cancellation is not implemented

Why it matters:

- canceling browser activity does not imply the upstream provider job is canceled

Target fix phase:

- later backend/infrastructure work

## Verification Gaps

- long-running provider telemetry is not implemented; the UI currently reports app lifecycle stages only

### Timeline Phase 4.5 Boundaries

Current state:

- timeline domain types exist in `src/types/timeline.ts`
- timeline store exists in `src/store/timelineStore.ts` with actions, selectors, and local persistence
- timeline UI shell and scene-source add-flow are implemented
- timeline sequencing/reorder is implemented through store-owned `moveClipUp` / `moveClipDown` and UI Move up/Move down buttons
- timeline manual playback simulation is implemented through store-owned playback actions/selectors and UI playback controls
- focused timeline UI coverage exists in `tests/e2e/phase43-timeline-ui.spec.ts`
- focused timeline store reorder coverage exists in `tests/e2e/phase42-timeline-store.spec.ts`
- drag/drop polish is not implemented yet
- automatic playback loop/timers are not implemented yet
- real media/video playback is not implemented yet
- video export/backend rendering are not implemented yet
- backend render queue is not implemented yet
- server workers for export orchestration are not implemented yet
- webhook completion for export jobs is not implemented yet
- remote render cancellation is not implemented yet
- downloadable video output is not fully implemented (backend stream route exists in Phase 11-M, but frontend download UI deferred)

Why it matters:

- Phase 4.5 establishes baseline manual playback simulation only; automatic playback loop/timers, real media playback, and playback/export runtime behavior remain deferred

Target fix phase:

- Phase 4.6 and later timeline/video phases
## Remotion runtime status (Phase 8.16-C accuracy)

- Backend composition boundary scaffold exists (Phase 7.9).
- Backend runtime helper boundary exists (Phase 8.0-B).
- Bundler dependency/type-boundary prep exists (Phase 8.1-B).
- Controlled opt-in real smoke exists (Phase 8.2-B) and is validated.
- Adapter real-runtime boundary alignment exists (Phase 8.3-B) and is validated.
- Harness-level real-runtime integration test milestone exists (Phase 8.4-B) and is validated.
- Internal backend execution trigger milestone exists (Phase 8.5-B) and is validated.
- Phase 8.11-B safely stopped (app.ts lacked rendererAdapter/pathPolicy).
- Backend dependency composition boundary exists (Phase 8.12-B).
  - `backend/composition/backendDependencies.ts` creates registry, rendererAdapter (no-op), pathPolicy.
  - Dependencies are composed but NOT wired into exports router yet.
  - Route behavior preserved: execute route returns 501 without dependencies.

### Still intentionally deferred

- Full real runtime execution for normal app/job flow.
- Verified output production wired into regular lifecycle success path.
- Route auto-execution (`POST /exports` remains non-executing for renderer runtime).
- Artifact hosting and public download delivery (signed/download URLs).
- Frontend artifact access/download UI.
- Auth/authorization for artifact access.
- Production storage provider and signed URL provider.
- Durable artifact storage refs beyond the current local/dev in-memory model.
- Public download URLs.
- Real user-media decoding in renderer path.
- Durable queue/worker/scheduler/database-backed renderer execution flow.
- Frontend export lifecycle integration with real backend completion.
- Synchronous HTTP route execution blocks request until render completes (no async queue/worker yet).
- Route trigger (`POST /exports/:jobId/execute`) is dev/test-gated only; not production-exposed.
- Timeout guard now exists (120000ms default via `FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS`) but does not cancel render â€” only protects HTTP response from hanging.
- Caller must poll job state after receiving 504 timeout response to get latest lifecycle status.
- No cancellation, no queue, no scheduler yet.
- Worker helper `drainRenderWorkerOnce` exists but requires manual invocation (not auto-started).
- Worker loop helper `createRenderWorkerLoop` exists and is test-controlled, but requires manual `start()` call.
- Worker startup factory `createRenderWorkerStartup` exists but is not wired to app/server startup.
- No production auto-start yet â€” worker loop and startup are dev/test-gated only.
- Worker lifecycle app wiring exists (Phase 8.13-B):
  - `createRenderWorkerLifecycle(...)` created in app.ts using composed backendDeps
  - `lifecycle.init()` called during app creation but remains harmless without env flags
  - lifecycle stored internally as `app.locals.renderWorkerLifecycle` (internal/test/dev only)
  - no public lifecycle route or status endpoint added
  - no server.ts shutdown wiring added
  - no process signal handlers added
- No route enqueue behavior yet.
- Backend dependency composition module exists (Phase 8.12-B) but dependencies are not wired into exports router yet.
- rendererAdapter and pathPolicy composed for lifecycle (Phase 8.13-B) but still NOT passed to createExportRouter â€” execute route returns 501 without them.
- process.cwd()-based pathPolicy roots are acceptable for dev/test but may need env override before production.
- Registry interface boundary exists (Phase 8.15-B):
  - `ExportJobRegistry` interface separated from `InMemoryExportJobRegistry` implementation
  - `backend/registry/exportJobRegistry.ts` owns interface/types
  - `backend/registry/inMemoryExportJobRegistry.ts` contains implementation
  - Future durable persistence adapters can implement `ExportJobRegistry` without changing consumers
  - No real persistence/storage added â€” jobs remain in-memory only
  - requestId idempotency remains process-local only
  - Claims/leases remain in-memory only with TTL support
  - Submitted/rendering/finalizing jobs do not survive server restart yet
  - No restart recovery semantics yet
  - No JSON/SQLite/Postgres/Redis adapter yet
- Graceful shutdown helper exists (Phase 8.16-B) with server.ts wiring (Phase 8.17-B):
  - `backend/lifecycle/gracefulShutdown.ts` provides testable shutdown coordinator
  - `createGracefulShutdown(...)` returns shutdown/isShuttingDown/getStatus controller
  - `backend/server.ts` exports `startServer(...)` with shutdown coordination
  - `startServer(...)` wires lifecycle shutdown and SIGINT/SIGTERM handlers
  - Helper calls lifecycle.shutdown() and server.close() when provided
  - Helper is idempotent and safe
  - No process.exit() calls added
  - No bounded in-flight render wait/cancellation yet
  - No durable recovery semantics yet
  - No persistence-backed shutdown recovery yet
  - Shutdown stops polling/server intake but does not recover jobs after restart
  - backend/server.ts no longer auto-starts when imported by tests
  - Only startServer(...) calls app.listen

### Recovery Policy Boundary (Phase 8.18-B)

Recovery policy boundary exists (Phase 8.18-B):
- `backend/registry/exportJobRecoveryPolicy.ts` provides restart recovery policy
- Exports: recoverExportJobRecord, recoverExportJobRecords, getRecoverableRecords, getTerminalRecords
- Recovery rules: submitted stays, rendering/finalizing â†’ submitted, terminal stays
- Claims cleared for recovered non-terminal jobs
- attemptCount and identity fields preserved
- Clone-based (original records not mutated)
- No filesystem I/O, no registry mutations, no path leakage
- Recovery policy used by JSON persistence adapter for on-load recovery

### JSON File Persistence Adapter (Phase 8.19-B)

JSON file persistence adapter exists (Phase 8.19-B):
- `backend/registry/jsonFileExportJobRegistry.ts` implements ExportJobRegistry
- Env-gated: FREE_AI_MIXER_PERSISTENCE_ENABLED (disabled by default)
- Optional: FREE_AI_MIXER_PERSISTENCE_FILE_PATH
- Default file: .free-ai-mixer-jobs.json in process.cwd()
- Atomic writes: temp file + rename
- Uses Phase 8.18 recovery policy on load
- Sanitized failure/artifact persistence (no paths/URLs/details)
- .gitignore entries for persistence files

### Persistence Runtime Local Smoke (Phase 8.20-B)

Persistence runtime smoke test exists (Phase 8.20-B):
- tests/e2e/phase820-persistence-runtime-smoke.spec.ts verifies persistence through real HTTP flow
- Uses app.listen on ephemeral port + fetch against real routes
- Does not use Express app.request as HTTP client
- Verifies POST /exports writes persistence file
- Verifies recreated app can GET truthful pending status
- Verifies requestId idempotency survives restart
- Verifies no path/URL leakage in persisted JSON
- Worker and route execution remain disabled during smoke
- No production persistence runtime mode yet

### Production DB Adapter Strategy (Phase 8.21-A complete)

Production DB adapter strategy documented (Phase 8.21-A):
- ExportJobRegistry interface is correct DB adapter boundary
- Future DB adapter must implement ExportJobRegistry directly
- DB adapter must NOT delegate lifecycle to InMemoryExportJobRegistry
- DB adapter must implement lifecycle logic transactionally in DB
- JSON persistence stays dev/local only
- Recommended: PostgreSQL via PostgresExportJobRegistry
- Recommended future env: FREE_AI_MIXER_DB_PROVIDER, DATABASE_URL, etc.
- DB must use SELECT FOR UPDATE for claim() to prevent race conditions
- DB must use optimistic locking for status transitions
- DB must sanitize failure/artifact fields before INSERT
- Recovery on startup: SELECT jobs WHERE status IN (rendering, finalizing) AND claimExpiresAt < NOW()

Still deferred:
- JSON persistence is local/dev only
- No production DB adapter yet (Postgres, Redis, SQLite)
- No DB packages installed yet
- No schema migrations yet
- No multi-process locking yet
- No production persistence runtime mode yet
- No large-scale query/indexing support yet
- No artifact hosting/download persistence yet
- No cancellation yet
- Frontend manual refresh boundary exists (Phase 8.22-B); automatic polling loop not implemented yet
- No retry with backoff, no WebSocket/SSE real-time updates, no background refresh
- Persisted export handle storage boundary exists (Phase 8.23-B); manual reconnect action added (Phase 8.24-B); manual reconnect button added (Phase 8.25-B)
- No automatic reconnect on app load yet
- No automatic polling yet

### Safety reminder

- No fake success/progress/artifacts/cancellation behavior is allowed in renderer phases.
- No public/API-safe response should expose backend local filesystem paths.
- Adapter boundary alignment does not mean production rendering rollout is complete.
- Harness opt-in test coverage does not mean production renderer rollout is complete.
- Internal trigger availability does not mean route execution is enabled or production rollout is complete.
- Dev/test-gated route trigger (`POST /exports/:jobId/execute`) is now available behind `FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1` but still requires env flag and executor configuration; it is not production-ready auto-execution.

### Async Registry Foundation / Runtime DB Deferrals

- Async `ExportJobRegistry` foundation now exists across the local runtime boundary.
- Routes, worker loop, and render harness now await registry methods locally without enabling DB persistence.
- `SupabaseExportJobRegistry` read methods are awaitable, but Supabase runtime DB wiring still remains deferred.
- `SupabaseExportJobRegistry.create(...)` adapter support now exists, but Supabase runtime DB wiring still remains deferred.
- Supabase runtime read/create wiring still remains deferred because the current app uses one shared registry across submit, read, execute, and artifact routes.
- Repository-level `createIfAbsent(...)` now exists and backs the adapter create path without activating runtime DB persistence.
- Repository-level `listByStatus(...)` now exists in `SupabaseExportJobsRepository`, and `SupabaseExportJobRegistry.getByStatus(...)` adapter support now exists.
- Supabase lifecycle and mutating registry methods still remain fail-closed.
- Runtime `getByStatus` support does not mean worker readiness, and any worker-facing `listByStatus` wiring still remains deferred.
- Atomic DB lifecycle mutation behavior remains deferred.
- Claim/lease schema draft fields now exist in the SQL drafts:
  - `claimed_by_worker_id`
  - `claim_expires_at`
  - `row_version`
- Actual DB migration/application of claim/lease schema support remains deferred.
- Repository-level `claimIfAvailable(...)` now exists.
- Repository-level `transitionIfOwned(...)` now exists.
- Repository-level `markSuccessIfOwned(...)` now exists.
- Repository-level `artifact_records` metadata persistence now exists using safe backend artifact metadata only.
- Env-gated `SupabaseExportJobRegistry` runtime selection now exists in `backendDependencies`.
- Offline runtime registry local-config smoke coverage now exists.
- Invalid/incomplete enabled Supabase env fallback is now explicitly covered.
- Offline route execution readiness boundary coverage now exists.
- Offline route runtime smoke coverage now exists.
- `GET /exports/:jobId` async not-found handling is now fixed.
- Offline worker runtime smoke coverage now exists.
- Worker startup gating boundary coverage now exists.
- Manual worker drain boundary coverage now exists.
- Manual worker drain runtime helper now exists.
- Execute success-path offline smoke coverage now exists.
- Remote Supabase readiness guard coverage now exists.
- Opt-in remote Supabase lifecycle smoke coverage now exists.
- Manual worker drain with Supabase runtime selection coverage now exists.
- Controlled worker-loop activation coverage now exists.
- Frontend DB-backed export lifecycle coverage now exists through backend routes only.
- `SupabaseExportJobRegistry.claim(...)` adapter support now exists, but real worker/runtime DB claim behavior still remains deferred.
- `SupabaseExportJobRegistry.markRendering(...)`, `markFinalizing(...)`, and `markError(...)` adapter support now exists, but this still does not make the worker loop runtime-ready.
- `SupabaseExportJobRegistry.markSuccess(...)` adapter support now exists.
- Artifact metadata validation now exists at the adapter boundary before repository success persistence.
- Failed claim mapping now routes through `ExportJobTransitionError`, but this does not imply worker readiness.
- `getByStatus` support does not imply worker readiness.
- Lifecycle DB transition semantics for a real Supabase-backed registry remain deferred.
- Artifact and failure DB lifecycle fidelity for a real Supabase-backed registry still remains deferred.
- Route DB wiring remains deferred.
- App and composition wiring remain deferred.
- Worker DB wiring remains deferred.
- Worker startup still remains env-gated.
- Worker loop activation still remains deferred and env-gated.
- Worker DB wiring still is not activated as an automatic loop.
- Default worker loop startup still remains disabled unless both startup and loop env gates are enabled.
- Default test runs still remain offline by default, even when future remote smoke coverage exists.
- Frontend status refresh now requires a real backend `jobId` handle and does not fabricate poll handles from `requestId`.
- Frontend reconnect and refresh continue to use existing backend export routes only; no direct Supabase client usage exists in the frontend.
- Fake progress percentages, fake success states, fake download URLs, and signed/download/storage URL behavior still remain absent from the frontend DB-backed lifecycle path.
- Incomplete opt-in remote Supabase env still falls back safely without leaking secrets.
- Remote lifecycle smoke now exists, but it still remains skipped/offline by default unless explicitly enabled.
- Remote manual worker drain smoke now exists, but it still remains skipped/offline by default unless explicitly enabled.
- Remote Supabase worker smoke still remains deferred and opt-in only.
- Route execution gating still remains separate from runtime registry selection.
- Execute success-path smoke no longer remains deferred offline, but remote Supabase execute/worker smoke still remains deferred.
- Lifecycle `markRendering` / `markFinalizing` / `markSuccess` / `markError` runtime DB support remains deferred.
- Generic `transition(...)` still remains deferred/fail-closed.
- Signed URLs, download URLs, storage objects, and `storage_refs` runtime persistence still remain deferred.
- `transition(...)` runtime DB support remains deferred.
- Execute route DB-backed lifecycle remains deferred.
- Runtime DB persistence remains deferred.
- Auth, requester, and RLS enforcement remain deferred.
- Remote Supabase tests remain opt-in only.
- Local Supabase Docker remains deferred on this Windows environment.

- Phase 78 adds production artifact delivery strategy boundary coverage:
  - Production artifact delivery remains deferred.
  - Future public artifact delivery requires auth/RLS/ownership enforcement first.
  - Safe future delivery options are short-lived `signed_url` or authenticated `backend_stream`.
  - `local_dev_stream` remains local-dev-only and is not production-ready.
  - No fake signed/download URLs are implemented.
  - No direct frontend storage access is implemented.
  - No local filesystem paths should be exposed or persisted.
  - Signed/download/storage URL behavior remains deferred.

- Phase 79 adds auth / ownership / RLS strategy boundary coverage:
  - Owner/workspace boundary fields exist, but they are not a complete production auth system yet.
  - Real authenticated requester identity remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Fake auth/session/user identity remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 80 adds requester context boundary coverage:
  - Backend requester context boundary now exists.
  - Explicit unauthenticated requester states now exist.
  - Real authenticated requester integration remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership checks remain deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - No fake auth/session/user identity was introduced.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 81 adds requester context resolver boundary coverage:
  - Requester context resolver boundary now exists.
  - Resolver returns explicit `auth_not_configured` state by default.
  - Resolver does not fabricate user identity from headers.
  - Real trusted auth middleware integration remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership checks remain deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 82 adds requester context route options boundary coverage:
  - Export router can now accept a non-enforcing requester context resolver.
  - Default route requester context remains explicit `auth_not_configured`.
  - Route authorization enforcement remains deferred.
  - Real trusted auth middleware integration remains deferred.
  - Workspace membership checks remain deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 83 adds requester context route runtime smoke coverage:
  - Export routes can invoke an injected requester context resolver during real route requests.
  - Requester context remains non-enforcing until real auth integration.
  - Route authorization enforcement remains deferred.
  - Real trusted auth middleware integration remains deferred.
  - Workspace membership checks remain deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 84 adds route authorization strategy boundary coverage:
  - Export owner/workspace contracts exist, but route authorization enforcement remains deferred.
  - Export routes must eventually authorize requested owner/workspace scope against trusted requester context.
  - Arbitrary `x-user-id` / `x-workspace-id` headers must not be trusted as authenticated identity.
  - Workspace membership checks remain deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 85 adds export authorization decision boundary coverage:
  - Pure owner/workspace authorization decision helper now exists.
  - Local-dev fallback requester context is not treated as production authorization.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 86 adds export authorization route guard boundary coverage:
  - Pure route-safe authorization guard mapping now exists.
  - Future unauthorized decisions can map to `401 auth_required`.
  - Future forbidden owner/workspace decisions can map to `403 forbidden`.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 87 adds export authorization route enforcement audit coverage:
  - Authorization decision and route guard boundaries exist.
  - Export routes are not enforcing authorization yet.
  - Export routes do not emit authorization `401` / `403` responses yet.
  - Trusted auth middleware remains required before route enforcement.
  - Arbitrary `x-user-id` / `x-workspace-id` headers must not be trusted.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 88 adds authenticated requester export scope adapter boundary coverage:
  - Pure authenticated requester to export requester adapter now exists.
  - Authenticated requester `userId` maps to export `ownerId`.
  - Authenticated requester `workspaceId` maps to export `workspaceId`.
  - Unauthenticated requester context is not adapted into authenticated export requester context.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 89 adds export authorization route enforcement readiness coverage:
  - Requester context resolver, export requester adapter, authorization decision, and route guard boundaries exist.
  - Export routes still do not wire authorization enforcement.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Trusted auth middleware remains required before route enforcement.
  - Arbitrary `x-user-id` / `x-workspace-id` headers must not be trusted.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 90 adds trusted auth middleware strategy boundary coverage:
  - Trusted auth middleware boundary now exists.
  - Default middleware behavior remains explicit `auth_not_configured`.
  - Middleware does not fabricate user identity from arbitrary headers.
  - App/server wiring remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 91 adds trusted auth middleware app wiring audit coverage:
  - Trusted auth middleware boundary exists, but app/server wiring remains deferred.
  - Export routes do not consume trusted auth middleware yet.
  - Route authorization enforcement remains deferred.
  - Real trusted auth provider integration remains deferred.
  - Arbitrary `x-user-id` / `x-workspace-id` headers must not be trusted.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 92 adds non-enforcing trusted auth middleware app wiring:
  - App now wires auth-not-configured trusted auth middleware.
  - Middleware remains non-enforcing and does not authenticate users yet.
  - Export routes do not consume trusted auth middleware yet.
  - Route authorization enforcement remains deferred.
  - Real trusted auth provider integration remains deferred.
  - Arbitrary `x-user-id` / `x-workspace-id` headers must not be trusted.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 93 adds export routes trusted request context consumption audit coverage:
  - App has non-enforcing trusted auth middleware, but export routes do not consume trusted request context yet.
  - Export routes still use the existing requester resolver boundary.
  - Requester adapter, authorization decision, and route guard boundaries exist but remain unwired from routes.
  - Route authorization enforcement remains deferred.
  - Real trusted auth provider integration remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 94 adds non-enforcing export route trusted request context consumption:
  - Export routes now read trusted request context from app middleware.
  - The route read remains non-enforcing.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Route authorization enforcement remains deferred.
  - Real trusted auth provider integration remains deferred.
  - Arbitrary `x-user-id` / `x-workspace-id` headers must not be trusted.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 95 adds export routes authorization enforcement audit coverage:
  - Export routes read trusted request context, but authorization enforcement remains deferred.
  - Requester adapter, authorization decision, and route guard boundaries exist but remain unwired from export routes.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Real trusted auth provider integration remains required before enforcement.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Arbitrary `x-user-id` / `x-workspace-id` headers must not be trusted.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 96 adds real auth provider integration strategy boundary coverage:
  - Trusted auth provider strategy boundary now exists.
  - Default auth provider strategy returns explicit `auth_not_configured`.
  - Real token/session verification remains deferred.
  - App/server provider wiring remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Arbitrary `x-user-id` / `x-workspace-id` headers must not be trusted.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 97 adds auth provider middleware wiring strategy coverage:
  - Trusted auth middleware can now consume a trusted auth provider strategy.
  - Default app behavior remains explicit `auth_not_configured`.
  - Real auth provider app/server wiring remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 98 adds auth provider app composition audit coverage:
  - Trusted auth provider strategy and middleware wiring boundaries exist.
  - App still wires only the auth-not-configured middleware wrapper.
  - Real auth provider app/server wiring remains deferred.
  - Export routes still consume trusted request context non-enforcing only.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 99 adds auth provider runtime configuration boundary coverage:
  - Auth provider runtime config reader now exists.
  - Missing/disabled/unsupported provider modes fail closed as not configured.
  - Future JWT/session provider modes are represented as config only.
  - Runtime config is not wired into app/middleware/routes/server yet.
  - Real token/session verification remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 100 adds auth provider runtime config wiring audit coverage:
  - Runtime auth provider config boundary exists, but remains unwired from provider strategy, middleware, app, server, and routes.
  - App still uses the auth-not-configured middleware wrapper.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Real token/session verification remains deferred.
  - Runtime config provider instantiation remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 101 adds auth provider runtime config composition boundary coverage:
  - Runtime auth provider config can compose to a provider strategy boundary.
  - Missing/disabled config composes to auth-not-configured behavior.
  - Future JWT/session provider modes fail closed and do not authenticate users yet.
  - Runtime config composition remains unwired from app/middleware/routes/server.
  - Real token/session verification remains deferred.
  - Runtime config provider instantiation remains deferred from app composition.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 102 adds auth provider runtime composition wiring audit coverage:
  - Runtime config composition boundary exists, but remains unwired from middleware, app, server, and routes.
  - App still uses the auth-not-configured middleware wrapper.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Real token/session verification remains deferred.
  - Runtime config provider wiring remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 103 adds auth provider runtime composition middleware wiring audit coverage:
  - Runtime config composition boundary exists, but trusted auth middleware does not consume it yet.
  - Trusted auth middleware remains provider-strategy based.
  - App still uses the auth-not-configured middleware wrapper.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Real token/session verification remains deferred.
  - Runtime config provider middleware wiring remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 104 wires runtime auth provider composition into trusted auth middleware only:
  - `createTrustedAuthMiddleware(...)` can now consume runtime auth provider config composition.
  - App still uses the auth-not-configured middleware wrapper.
  - Future JWT/session runtime config remains fail-closed and does not authenticate users yet.
  - App/server runtime provider wiring remains deferred.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Real token/session verification remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 105 adds auth runtime config app composition audit coverage:
  - Trusted auth middleware can consume runtime auth provider composition, but app/server still do not use runtime auth config.
  - App still uses only the auth-not-configured middleware wrapper.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Real token/session verification remains deferred.
  - App/server runtime auth config wiring remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 106 wires runtime auth config into app trusted auth middleware composition:
  - App now uses runtime auth config for trusted auth middleware composition.
  - Missing/disabled config remains fail-closed as auth-not-configured.
  - Future JWT/session config remains fail-closed and does not authenticate users yet.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Real token/session verification remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 107 adds auth runtime config route authorization audit coverage:
  - App wires runtime auth config into trusted auth middleware composition.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Real token/session verification remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 108 adds final route authorization enforcement readiness audit coverage:
  - App wires runtime auth config into trusted auth middleware composition.
  - Export routes still read trusted request context non-enforcing only.
  - Requester context, requester resolver, requester adapter, authorization decision, and route guard boundaries exist.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Real token/session verification remains deferred.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 109 adds route authorization enforcement strategy decision coverage:
  - Route authorization enforcement is explicitly not ready yet.
  - Runtime auth config is wired into app trusted auth middleware composition.
  - Future JWT/session provider strategies still fail closed with `invalid_credentials`.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Real token/session verification remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 110 adds real auth provider implementation audit coverage:
  - Real token/session verification is explicitly not implemented yet.
  - Future JWT/session provider strategies still fail closed with `invalid_credentials`.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 111 adds JWT provider verification strategy boundary coverage:
  - JWT verification strategy boundary now exists.
  - JWT verification remains fail-closed and does not authenticate users yet.
  - Missing authorization header maps to `missing_credentials`.
  - Fake bearer token maps to `invalid_credentials`.
  - No real JWT verification package or token verification was added.
  - JWT strategy is not wired into auth provider composition yet.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 112 adds JWT provider composition wiring audit coverage:
  - JWT verification strategy boundary exists, but remains unwired from provider composition.
  - Auth provider composition still uses generic fail-closed JWT behavior.
  - Middleware/app/routes/server do not wire JWT verification strategy yet.
  - No real JWT verification package or token verification was added.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership enforcement exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 113 wires future JWT provider composition to the fail-closed JWT verification boundary:
  - JWT provider composition now delegates to `createFailClosedFutureJwtVerificationStrategy(...)`.
  - JWT verification result maps through `mapJwtVerificationResultToRequesterContext(...)`.
  - Missing authorization header maps to `missing_credentials`.
  - Fake bearer token maps to `invalid_credentials`.
  - No real JWT verification package or token verification was added.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 114 adds JWT verification dependency audit coverage:
  - No JWT verification dependency is installed yet.
  - No `jose` / `jsonwebtoken` import exists.
  - JWT provider remains fail-closed.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 115 adds JWT verification dependency selection strategy coverage:
  - `jose` is selected as the future JWT verification dependency candidate.
  - No JWT dependency is installed yet.
  - No JWT dependency is imported yet.
  - JWT verification remains fail-closed.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 116 adds JWT dependency installation audit coverage:
  - jose remains selected as the future JWT verification dependency.
  - jose is not installed yet.
  - No JWT dependency import exists.
  - JWT verification remains fail-closed.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 117 installs selected JWT dependency `jose`:
  - `jose` is now installed and lockfile-tracked.
  - `jose` is not imported by runtime auth yet.
  - JWT verification remains fail-closed.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization `401` / `403` responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 118 adds JWT verification runtime import audit coverage:
  - jose is installed and lockfile-tracked.
  - jose is not imported by runtime auth yet.
  - JWT verification remains fail-closed.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 119 adds JWT verification runtime import boundary coverage:
  - jose is imported only inside backend/auth/jwtProviderVerificationStrategy.ts.
  - jwtVerify and createRemoteJWKSet imports are available.
  - realVerificationEnabled remains false.
  - JWT provider strategy still fails closed.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 120 adds JWT verification execution strategy audit coverage:
  - jose imports are available inside the JWT verification boundary.
  - realVerificationEnabled remains false.
  - No jwtVerify execution call exists yet.
  - No createRemoteJWKSet execution call exists yet.
  - JWT provider strategy still fails closed.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 121 adds JWT verification configuration strategy coverage:
  - JWT verification configuration boundary now exists.
  - Future remote JWKS configuration shape exists.
  - Missing provider / issuer / audience / JWKS URI fail closed.
  - Unsupported key mode fails closed.
  - Configured remote JWKS mode can be represented without execution.
  - realVerificationEnabled remains false.
  - No jwtVerify execution call exists yet.
  - No createRemoteJWKSet execution call exists yet.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 122 adds JWT verification configuration wiring audit coverage:
  - JWT verification configuration boundary exists, but remains unwired from JWT execution.
  - Future remote JWKS config can be represented.
  - realVerificationEnabled remains false.
  - No jwtVerify execution call exists yet.
  - No createRemoteJWKSet execution call exists yet.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 123 wires JWT verification configuration shape into the JWT boundary:
  - JWT verification boundary can now accept configuration shape.
  - Configured remote JWKS mode can be represented inside the boundary.
  - realVerificationEnabled remains false.
  - Missing Authorization still maps to missing_credentials.
  - Fake bearer token still maps to invalid_credentials.
  - No jwtVerify execution call exists yet.
  - No createRemoteJWKSet execution call exists yet.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 124 adds JWT verification JWKS construction audit coverage:
  - Future remote JWKS configuration can be represented.
  - createRemoteJWKSet import is available inside JWT verification boundary.
  - createRemoteJWKSet is not executed yet.
  - No JWKS URL construction exists yet.
  - realVerificationEnabled remains false.
  - Missing Authorization still maps to missing_credentials.
  - Fake bearer token still maps to invalid_credentials.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 125 adds JWT verification JWKS construction boundary coverage:
  - JWKS construction exists only inside backend/auth/jwtProviderVerificationStrategy.ts.
  - Configured remote JWKS mode can construct a jose RemoteJWKSet function.
  - realVerificationEnabled remains false.
  - No jwtVerify execution call exists yet.
  - Missing Authorization still maps to missing_credentials.
  - Fake bearer token still maps to invalid_credentials.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 126 adds JWT verification JWKS construction wiring audit coverage:
  - JWKS construction boundary exists, but is not wired into verify execution yet.
  - Configured remote JWKS mode can construct a jose RemoteJWKSet function.
  - realVerificationEnabled remains false.
  - No jwtVerify execution call exists yet.
  - Missing Authorization still maps to missing_credentials.
  - Fake bearer token still maps to invalid_credentials.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 127 wires JWKS construction into the fail-closed JWT verify path:
  - constructRemoteJwksForJwtVerification(...) is now called by the JWT strategy.
  - Configured remote JWKS mode can construct a jose RemoteJWKSet function.
  - realVerificationEnabled remains false.
  - No jwtVerify execution call exists yet.
  - Missing Authorization still maps to missing_credentials.
  - Fake bearer token still maps to invalid_credentials.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 128 adds JWT verification execution audit coverage:
  - JWKS construction is wired into the fail-closed verify path.
  - realVerificationEnabled remains false.
  - No jwtVerify execution call exists yet.
  - Missing Authorization still maps to missing_credentials.
  - Fake bearer token still maps to invalid_credentials.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 129 adds JWT verification execution boundary coverage:
  - executeJwtVerificationWithJose(...) now exists inside the JWT verification boundary.
  - The isolated jwtVerify call path exists only inside that helper.
  - The fail-closed JWT strategy does not call the execution boundary yet.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 130 adds merged JWT execution and payload mapping audit coverage:
  - Old immediate auth phases 130 through 135 are merged into Phase 130 and Phase 131.
  - executeJwtVerificationWithJose(...) exists but is not wired into JWT strategy yet.
  - Verified payload mapping shape exists for sub and workspaceId/workspace_id.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.

- Phase 131 implements merged JWT execution and production requester mapping:
  - JWT strategy now calls executeJwtVerificationWithJose(...).
  - Real JWT execution remains opt-in and disabled by default.
  - Verified JWT payload mapping shape exists for sub and workspaceId/workspace_id.
  - Export routes still read trusted request context non-enforcing only.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Route authorization enforcement remains deferred.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.

- Phase 132 adds route authorization enforcement final audit coverage:
  - Route authorization enforcement remains deferred.
  - Export routes still do not call authorization adapter/decision/guard boundaries.
  - Export routes still do not emit authorization 401 / 403 responses.
  - Arbitrary x-user-id / x-workspace-id headers are not trusted.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 133 adds test-controlled core export route authorization enforcement:
  - Default route authorization remains disabled.
  - Explicit enforce mode allows matching authenticated requester owner/workspace.
  - Explicit enforce mode rejects unauthenticated requester with safe 401.
  - Explicit enforce mode rejects owner/workspace mismatch with safe 403.
  - Arbitrary x-user-id / x-workspace-id headers are not trusted.
  - POST /exports creation behavior remains unchanged.
  - Artifact access/stream route authorization remains deferred to Phase 134.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 134 adds test-controlled artifact access/stream authorization enforcement:
  - Default artifact access behavior remains authorization disabled.
  - Explicit enforce mode protects artifact access; stream remains blocked when stream provider is not configured.
  - Unauthenticated artifact access requests return safe 401; unconfigured stream requests remain safely blocked with 501.
  - Owner/workspace mismatch returns safe 403.
  - Arbitrary x-user-id / x-workspace-id headers are not trusted.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.


- Phase 135 adds route authorization regression coverage:
  - Default/local-dev behavior remains non-enforcing.
  - Arbitrary x-user-id / x-workspace-id headers are not trusted.
  - Enforced status and artifact access routes reject unauthenticated requester with safe 401.
  - Owner/workspace mismatch returns safe 403.
  - Matching authenticated owner/workspace can pass guarded routes.
  - Stream route remains safely blocked when stream provider is not configured.
  - Workspace membership lookup/enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 137 adds workspace membership strategy and contract coverage:
  - WorkspaceMembershipRepository contract exists.
  - Not-configured membership repository denies safely.
  - Active membership can produce an allowed decision.
  - Inactive/missing membership denies safely.
  - Membership boundary is not wired into routes yet.
  - Workspace membership repository implementation remains deferred.
  - Workspace membership enforcement remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 138 adds workspace membership repository boundary coverage:
  - In-memory workspace membership repository exists.
  - Active membership can produce an allowed decision.
  - Missing membership denies safely.
  - Disabled membership denies safely.
  - Not-configured membership repository still denies safely.
  - Membership repository is not wired into routes yet.
  - Workspace membership runtime enforcement remains deferred.
  - Supabase membership repository implementation remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 139 adds backend-only workspace membership enforcement helper coverage:
  - Owner/workspace match can allow access.
  - Active workspace membership can allow access.
  - Unauthenticated requester denies safely.
  - Workspace mismatch denies safely.
  - Inactive/missing/not-configured membership denies safely.
  - Membership enforcement helper is not wired into routes yet.
  - Supabase membership repository implementation remains deferred.
  - Supabase RLS policy application remains deferred.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 140 adds Supabase RLS policy draft and migration audit coverage:
  - RLS policy draft exists under docs/security only.
  - No live supabase/migrations file was added.
  - No Supabase CLI apply was performed.
  - No remote Supabase smoke was added.
  - RLS policies are not applied at runtime.
  - Service-role shortcuts remain forbidden.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 141 adds RLS verification and remote opt-in smoke coverage:
  - Offline RLS draft verification boundary exists.
  - Remote RLS smoke configuration boundary exists.
  - Remote smoke is disabled by default.
  - Incomplete opt-in env fails safely.
  - No Supabase CLI apply was performed.
  - No live migration was added.
  - RLS verification is not wired into routes or app runtime.
  - Service-role shortcuts remain forbidden.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.
  - Direct frontend Supabase/storage access remains forbidden.
  - Signed/download/storage URL behavior remains deferred.

- Phase 142 adds production artifact delivery strategy audit coverage:
  - Production artifact delivery remains deferred.
  - No production storage provider was added.
  - No active signed URL generation or public URL delivery behavior was added.
  - No frontend download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Service-role shortcuts remain forbidden.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.


- Phase 143 adds production artifact provider boundary coverage:
  - ProductionArtifactDeliveryProvider interface exists.
  - Not-configured production delivery provider fails closed.
  - Provider boundary is not wired into routes or app runtime.
  - No production storage provider was added.
  - No active signed URL generation or public URL delivery behavior was added.
  - No frontend download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Service-role shortcuts remain forbidden.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.

- Phase 144 adds signed URL delivery audit coverage:
  - Signed URL delivery remains deferred.
  - No createSignedUrl or getPublicUrl behavior was added.
  - No production storage provider was added.
  - No route response signed URLs were added.
  - No frontend download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Service-role shortcuts remain forbidden.
  - Public artifact delivery remains blocked until auth/RLS/ownership exists.

- Phase 145 adds backend-mediated artifact delivery boundary coverage:
  - Backend-mediated descriptor boundary exists.
  - Delivery fails closed unless authorization, workspace/RLS readiness, storage config, and artifact readiness are all true.
  - Ready descriptor is not wired into routes yet.
  - No signed URL or public URL behavior was added.
  - No frontend download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Service-role shortcuts remain forbidden.
  - Public artifact delivery remains blocked until production route/provider readiness.

- Phase 146 adds frontend download UI audit coverage:
  - Frontend download UI remains deferred.
  - Frontend artifact access remains backend-service/store mediated.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until backend descriptor route wiring is ready.

- Phase 147 adds frontend download UI boundary coverage:
  - ArtifactDownloadAction component exists.
  - Download UI remains disabled without backend-mediated descriptor.
  - Ready state only dispatches a callback.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Backend descriptor route/provider wiring remains deferred.
  - Public artifact delivery remains blocked until backend descriptor route wiring is ready.

- Phase 148 adds backend artifact delivery descriptor route wiring audit coverage:
  - Backend descriptor route wiring remains deferred.
  - Production provider route wiring remains deferred.
  - No signed URL or public URL behavior was added.
  - No frontend download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Service-role shortcuts remain forbidden.
  - Public artifact delivery remains blocked until backend descriptor route wiring is implemented safely.

- Phase 149 adds backend artifact delivery descriptor route wiring:
  - Descriptor route exists at /exports/:jobId/artifacts/:artifactId/delivery.
  - Descriptor route returns unavailable until workspace/RLS/storage prerequisites are ready.
  - Enforced mode rejects unauthenticated requester with safe 401.
  - Enforced mode rejects owner/workspace mismatch with safe 403.
  - No signed URL or public URL behavior was added.
  - No frontend download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Service-role shortcuts remain forbidden.
  - Public artifact delivery remains blocked until backend descriptor readiness can be made production-safe.

- Phase 150 adds frontend artifact delivery descriptor service coverage:
  - Frontend can call backend descriptor route through service boundary.
  - Service parses unavailable and backend-mediated ready descriptor states.
  - Service maps 401/403 safely.
  - Service is not wired into exportStore or UI yet.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until store/UI wiring and backend readiness are approved.

- Phase 151 adds frontend artifact delivery descriptor store coverage:
  - Dedicated descriptor store boundary exists.
  - Store action requests backend descriptor route through service boundary.
  - Store tracks loading/unavailable/ready/error states.
  - Main exportStore/UI wiring remains deferred.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until UI wiring and backend readiness are approved.

- Phase 152 adds frontend artifact delivery descriptor UI wiring audit coverage:
  - TimelineExportPanel wiring remains deferred.
  - Descriptor route, service, store, and UI component boundaries exist.
  - No component-owned fetch orchestration was added.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until UI wiring and backend readiness are approved.

- Phase 153 adds frontend artifact delivery descriptor UI wiring coverage:
  - ArtifactDeliveryDescriptorAction component exists.
  - Descriptor store state maps to ArtifactDownloadAction descriptor props.
  - Ready state requires backend-mediated descriptor state.
  - Idle/error states do not become fake ready descriptors.
  - TimelineExportPanel wiring remains deferred.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until main UI wiring and backend readiness are approved.

- Phase 154 adds TimelineExportPanel descriptor UI wiring audit coverage:
  - TimelineExportPanel wiring remains deferred.
  - Descriptor route, service, store, and UI component boundaries exist.
  - No direct fetch orchestration was added to TimelineExportPanel.
  - No stream/download URL construction was added to TimelineExportPanel.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until panel wiring and backend readiness are approved.

- Phase 155 wires TimelineExportPanel to artifact delivery descriptor UI:
  - Panel renders ArtifactDeliveryDescriptorAction for artifact metadata.
  - Panel uses artifact.id and exportHandle.jobId.
  - Panel does not call descriptor fetch directly.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until backend readiness and final navigation/download phase are approved.

- Phase 156 adds artifact delivery ready-state backend precondition audit coverage:
  - Descriptor route ready state remains blocked by default.
  - workspaceMembershipOrRlsReady remains false in route wiring.
  - providerConfigured remains false in route wiring.
  - artifactReady remains false in route wiring.
  - Backend-mediated helper can only return ready when every precondition is explicitly true.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Public artifact delivery remains blocked until ready-state preconditions are implemented safely.

- Phase 157 adds artifact delivery ready-state precondition boundary coverage:
  - Pure backend precondition helper exists.
  - Helper fails closed for missing authorization, workspace/RLS readiness, metadata, artifact readiness, storage config, and provider availability.
  - Helper can return ready only when every condition is explicitly true.
  - Helper is not wired into the descriptor route yet.
  - Descriptor route ready state remains blocked by default.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Public artifact delivery remains blocked until route integration is audited and implemented safely.

- Phase 158 adds descriptor route ready-state integration audit coverage:
  - Descriptor route is not wired to decideArtifactDeliveryReadyPreconditions(...) yet.
  - Descriptor route ready state remains blocked by default.
  - workspaceMembershipOrRlsReady remains false in route wiring.
  - providerConfigured remains false in route wiring.
  - artifactReady remains false in route wiring.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Public artifact delivery remains blocked until route integration is implemented safely.

- Phase 159 wires descriptor route to artifact delivery ready-state preconditions:
  - Descriptor route now calls decideArtifactDeliveryReadyPreconditions(...).
  - Route remains unavailable by default.
  - workspaceMembershipOrRlsReady remains false in route wiring.
  - providerConfigured/providerCanResolve remain false in route wiring.
  - Ready descriptor cannot be reached without future approved readiness wiring.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Public artifact delivery remains blocked until ready-state regression and production provider readiness are approved.

- Phase 160 adds artifact delivery ready-state regression coverage:
  - Unauthenticated and mismatched requesters cannot reach ready state.
  - Missing metadata, id mismatch, not-ready status, unsafe metadata, and provider blockers fail closed.
  - Descriptor route remains unavailable by default.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - Direct frontend Supabase/storage access remains forbidden.
  - Public artifact delivery remains blocked until frontend ready-state UX and production provider readiness are approved.

- Phase 161 adds frontend ready descriptor UI regression coverage:
  - Frontend can represent backend-mediated ready descriptor state truthfully.
  - Unavailable/error/idle states do not become fake ready descriptors.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until browser download/navigation is separately audited.

- Phase 162 adds browser download/navigation final audit coverage:
  - Browser download/navigation remains deferred.
  - Frontend can represent backend-mediated ready descriptor state truthfully.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No document.createElement/programmatic click behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until backend readiness and download/navigation implementation are separately approved.
- Phase 163 adds browser download/navigation implementation strategy coverage:
  - Pure frontend navigation decision helper exists.
  - Browser navigation remains blocked by default.
  - Expired/unavailable descriptors remain blocked.
  - No window.open or location.href behavior was added.
  - No anchor download behavior was added.
  - No document.createElement/programmatic click behavior was added.
  - No frontend Supabase/storage access was added.
  - No signed URL or public URL handling was added.
  - Public artifact delivery remains blocked until backend ready-state and production storage provider readiness are approved.
- Phase 164 adds production storage provider strategy audit coverage:
  - Production storage provider implementation remains deferred.
  - Existing production provider boundary remains fail-closed.
  - No Supabase/S3/R2 production provider was added.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until provider boundary and readiness are implemented safely.
- Phase 165 adds production storage provider boundary coverage:
  - ProductionStorageProvider interface exists.
  - Not-configured production storage provider fails closed.
  - Storage reference validation rejects local path-like object keys.
  - Provider boundary is not route-wired yet.
  - No Supabase/S3/R2 production provider was added.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until provider integration and readiness are implemented safely.
- Phase 166 adds production storage provider route/precondition integration audit coverage:
  - Route/provider integration remains deferred.
  - ProductionStorageProvider remains backend-only and fail-closed.
  - Descriptor route remains unavailable by default.
  - providerConfigured/providerCanResolve remain false in route wiring.
  - No Supabase/S3/R2 provider was added.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until provider integration is implemented safely.
- Phase 167 adds production storage provider integration boundary coverage:
  - resolveProductionStorageReadiness(...) exists.
  - Missing/invalid storage refs fail closed.
  - Not-configured production storage provider fails closed.
  - Verified provider result can map to providerConfigured/providerCanResolve readiness.
  - Integration helper is not route-wired yet.
  - No Supabase/S3/R2 provider was added.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until route integration and real provider readiness are implemented safely.
- Phase 168 adds descriptor route production storage readiness integration audit coverage:
  - Descriptor route integration with resolveProductionStorageReadiness(...) remains deferred.
  - Production storage readiness helper exists and fails closed by default.
  - Descriptor route remains unavailable by default.
  - providerConfigured/providerCanResolve remain false in route wiring.
  - No Supabase/S3/R2 provider was added.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until route integration and real provider readiness are implemented safely.
- Phase 169 wires descriptor route to production storage readiness:
  - Descriptor route now calls resolveProductionStorageReadiness(...).
  - Storage readiness feeds providerConfigured/providerCanResolve preconditions.
  - Not-configured provider keeps route unavailable.
  - workspaceMembershipOrRlsReady remains false in route wiring.
  - No Supabase/S3/R2 provider was added.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until real provider and workspace/RLS readiness are implemented safely.
- Phase 170 adds production storage readiness regression and provider selection coverage:
  - Missing/invalid storage refs fail closed.
  - Not-configured and object-not-found provider states fail closed.
  - Unauthenticated and mismatched requesters cannot reach storage readiness.
  - workspaceMembershipOrRlsReady still blocks ready state.
  - Supabase Storage is selected as the first recommended production provider strategy.
  - No Supabase/S3/R2 provider was added.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until provider verification and signed delivery are implemented safely.
- Phase 171 adds Supabase production storage provider boundary + verification coverage:
  - Backend-only Supabase provider boundary exists.
  - Object verification is injectable/tested and fails closed.
  - Missing config, invalid refs, object missing, and provider unavailable states fail closed.
  - Provider is not route-wired yet.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until route integration and signed delivery are implemented safely.
- Phase 172 wires descriptor route to optional production storage provider injection:
  - Route passes productionStorageProvider into resolveProductionStorageReadiness(...).
  - Provider verification remains blocked while workspace/RLS readiness is blocked.
  - workspaceMembershipOrRlsReady still blocks ready state.
  - No signed URL or public URL behavior was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked until signed delivery is implemented safely.

- Phase 173-A adds signed URL delivery safety audit coverage:
  - Signed URL generation remains deferred.
  - Signed URL provider boundary remains deferred.
  - Descriptor route signed URL integration remains deferred.
  - Signed URLs must be backend-only and short-lived when implemented later.
  - Unauthorized/forbidden/unavailable states must not generate signed URLs.
  - Fake signed URLs and fake ready descriptors remain forbidden.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked.
- Phase 173-B adds backend signed URL provider boundary coverage:
  - SignedUrlDeliveryProvider boundary exists.
  - Not-configured signed URL provider fails closed.
  - Invalid storage refs and invalid expiry values fail closed.
  - Signed URL TTL is capped at 300 seconds.
  - Provider boundary is not route-wired yet.
  - No Supabase signed URL implementation was added.
  - No descriptor route signed URL integration was added.
  - No browser download/navigation behavior was added.
  - No frontend Supabase/storage access was added.
  - Public artifact delivery remains blocked.

- Phase 173-E wires descriptor route to the backend signed URL provider boundary, but public artifact delivery remains blocked:
  - The route defaults to a fail-closed signed URL provider when none is injected.
  - Supabase signed URL provider is not directly route-wired.
  - Signed URL generation is gated behind backend ready preconditions.
  - Workspace/RLS readiness still prevents unsafe ready delivery.
  - No frontend download/navigation behavior exists yet.
  - No public URLs or direct frontend storage access exist.
  - Phase 174 is still required before browser download/navigation.

- Phase 174-B adds user-triggered frontend download navigation, but production launch remains blocked:
  - Navigation only uses backend-approved descriptors.
  - backend_signed_url descriptors can be parsed and carried through the frontend store.
  - Browser navigation is triggered only from the download button flow.
  - Expired, unavailable, and unsafe descriptors are blocked.
  - No direct frontend Supabase/storage access exists.
  - No public URL generation exists.
  - Controlled E2E delivery smoke and production hardening are still required before launch.

- Phase 174-C adds controlled artifact delivery smoke coverage, but this is not a public launch approval:
  - The smoke uses mocked/backend-approved descriptor payloads.
  - Remote production storage is not required by default.
  - Browser navigation remains user-triggered only.
  - Direct frontend Supabase/storage access remains blocked.
  - Security hardening phases 175-177 and operational phases 178-181 remain required.

- Phase 175-A starts production Auth/RLS finalization with audit-only coverage:
  - Workspace/RLS readiness still blocks unsafe delivery readiness.
  - Production RLS finalization remains pending.
  - No trusted-header auth shortcut is allowed.
  - No frontend Supabase/storage access is allowed.
  - No service-role frontend behavior is allowed.
  - Public launch remains blocked.

- Phase 175-B adds production JWT auth configuration readiness, but runtime auth rollout remains pending:
  - JWT provider, issuer, audience, and JWKS URI can be validated.
  - JWKS construction can be checked without route rollout.
  - routeRuntimeEnabled remains false.
  - realVerificationEnabled remains false.
  - Trusted-header shortcuts remain forbidden.
  - Public launch remains blocked.

- Phase 175-C adds production RLS readiness validation, but runtime RLS rollout remains pending:
  - The RLS policy draft can be validated offline.
  - Remote RLS smoke remains opt-in and disabled by default.
  - No Supabase CLI migration is applied.
  - No route runtime RLS enforcement is enabled.
  - No service-role behavior is added.
  - Public launch remains blocked.

- Phase 176-A begins secrets and service-role exposure hardening with audit-only coverage:
  - Frontend must not include Supabase service-role keys or direct storage access.
  - Backend must not expose public URLs or log secrets.
  - Signed URL generation must remain backend-owned.
  - Public launch remains blocked.

- Phase 176-B adds a secret exposure guard boundary, but it is not route-wired:
  - Service-role and frontend secret exposure markers can be detected.
  - Public URL generation markers can be detected.
  - Direct frontend Supabase/storage markers can be detected.
  - Runtime enforcement and broader repository scanning remain future hardening work.
  - Public launch remains blocked.

- Phase 176-C adds repository-level secret exposure regression coverage:
  - Selected frontend delivery/navigation files are scanned with the secret exposure guard.
  - Selected backend artifact/auth/readiness files are scanned with the secret exposure guard.
  - Docs remain explicit that public launch is blocked.
  - Runtime enforcement and full-repository CI scanning remain future hardening work.

- Phase 177 adds production security and abuse regression coverage:
  - Unauthorized and forbidden states remain blocked.
  - Expired descriptors remain blocked.
  - Unsafe metadata and unsafe navigation targets remain blocked.
  - Rate-limit strategy exists as a boundary, not runtime route enforcement.
  - Public launch remains blocked until operational phases 178-181 are complete.

- Phase 178 adds production environment and deployment pipeline readiness documentation:
  - Production env variables are documented with placeholders only.
  - Build/start commands are verified through readiness tests.
  - Supabase project checklist is documented.
  - No real secrets are committed.
  - Public launch remains blocked until Phase 181 final go/no-go.


- Phase 179 adds logging, monitoring, and error handling readiness coverage:
  - Structured log redaction boundary exists.
  - Monitoring plan is documented.
  - Backend, render/export, and download failure visibility are covered by readiness tests.
  - No sensitive data should be logged.
  - Public launch remains blocked until Phase 181 final go/no-go.


- Phase 180 adds storage policy, backup, and recovery readiness coverage:
  - Storage buckets must remain private by default.
  - Signed URLs remain short-lived and backend-generated.
  - Artifact retention and failed artifact cleanup are documented but not automated.
  - Database backup and restore expectations are documented.
  - Public launch remains blocked until Phase 181 final go/no-go.


- Phase 181 adds final public launch audit readiness coverage:
  - Staging, private beta, security, abuse prevention, deployment, monitoring, and storage recovery checklists are documented.
  - publicLaunchApproved remains false until manual approval.
  - This phase supports a go/no-go decision; it does not automatically launch the platform.

- Phase 94 adds a backend-only real provider generation contract boundary:
  - Real generation remains blocked.
  - `/generation/jobs` remains disabled.
  - `vendorCallsEnabled` remains false.
  - BYOK validation does not imply generation readiness.
  - No real provider calls, generation artifacts, signed URLs, fake success/progress, credits/billing mutation, export integration, or public launch behavior is included.

- Phase 96 adds an OpenAI image generation adapter boundary:
  - The adapter is not route-wired.
  - `/generation/jobs` remains disabled.
  - OpenAI image provider success is not deliverable until artifact storage is approved.
  - No generated image URL, base64 image, local path, signed URL, public URL, fake artifact success, credits/billing mutation, export route behavior, or public launch behavior is included.

- Phase 98 adds a generated image artifact storage boundary:
  - The verifier/storage seam is backend-only.
  - Generated image delivery remains unavailable.
  - No public URL, signed URL, frontend bytes/base64, stream route, or export route reuse is included.
  - `/generation/jobs` remains disabled and OpenAI provider 2xx output still cannot become user-visible success.
  - No fake success/progress/artifact, credits/billing mutation, export route behavior, or public launch behavior is included.

- Phase 100 adds OpenAI adapter/storage integration at test boundary only:
  - Adapter-level mocked `b64_json` output can become safe metadata after injected storage verifies and stores it.
  - The adapter is not route-wired or dependency-composed.
  - `/generation/jobs` remains disabled and `vendorCallsEnabled` remains false.
  - Generated image delivery remains unavailable.
  - No public URL, signed URL, stream route, frontend bytes/base64, fake progress, credits/billing mutation, export route behavior, or public launch behavior is included.

- Phase 102 adds generation runtime composition readiness metadata only:
  - Generation runtime env gates are parsed, but route execution remains disabled.
  - Even when all future generation gates are present, `vendorCallsEnabled` remains false.
  - The OpenAI image adapter and generated image storage are not route-callable.
  - `/generation/jobs` remains blocked with `generation_runtime_disabled`.
  - No real provider call, frontend change, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, or export route behavior is included.

- Phase 104 adds generation route execution precondition contracts only:
  - Future `/generation/jobs` request shape is image-only and rejects raw keys, frontend workspace IDs, provider key IDs, model overrides, multi-image requests, uploads, masks, streaming, and delivery options.
  - Future execution requires backend auth, backend-derived workspace, owner/admin authorization, active validated OpenAI BYOK key, prompt validation, and fail-closed rate/idempotency/single-flight/cost controls.
  - `/generation/jobs` remains disabled and does not call adapters or artifact storage.
  - No real provider call, frontend change, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, or export route behavior is included.

- Phase 106 adds generation route dependency injection as a fail-closed seam only:
  - `createGenerationRouter` can accept future generation dependencies, but `/generation/jobs` still stops at `generation_runtime_disabled`.
  - Injected adapter, generated image storage, repository, vault, and membership dependencies are not called.
  - `vendorCallsEnabled` remains false and `attemptedProviderIds` remains empty.
  - No real provider call, frontend change, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, or export route behavior is included.

- Phase 108 adds a generation route preconditions-only mode:
  - `FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE=preconditions_only` lets `/generation/jobs` evaluate request/auth/workspace/owner-admin/gate/control/active-key readiness.
  - The default remains `disabled` and preserves the immediate `generation_runtime_disabled` stop.
  - Preconditions-only mode stops at `generation_execution_blocked` even when all modeled preconditions pass.
  - BYOK decrypt, adapter execution, generated-image storage, provider calls, artifact creation, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, and export route behavior remain blocked.

- Phase 111 wires generation route precondition dependencies through app composition:
  - `app.ts` passes safe read/authorization dependencies only: generation runtime config/readiness, route access, provider-key repository, workspace membership repository, and fail-closed execution-control readiness.
  - `FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY=1` is a local/staging precondition-smoke readiness switch only.
  - The generation route still does not receive provider secret vault, OpenAI image adapter execution, generated-image storage execution, or artifact delivery dependencies.
  - BYOK decrypt, adapter execution, provider calls, generated artifacts, public/signed URL delivery, fake success/progress/artifact, credits/billing mutation, and export route behavior remain blocked.
