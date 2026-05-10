# Prompts

This file defines prompt patterns that keep Free AI Mixer aligned with its architecture.

## Prompt Rules

- Scope one phase or one subsystem at a time.
- Name the exact files or folders in play.
- Preserve the current lifecycle contract unless the task is explicitly a lifecycle change.
- State what must not change.
- Require `npm run build` and `npm run typecheck` when code changes are made.
- Prefer minimal fixes over broad rewrites.

## Always Include

- the current phase name
- implementation mode vs audit mode
- architecture constraints
- success criteria
- forbidden work
- required output format

## Good Prompt Pattern

```text
PHASE X.Y — [FOCUSED OBJECTIVE]
MODE: IMPLEMENTATION

Read first:
- PROJECT_BIBLE.md
- docs/architecture.md
- docs/phases.md
- docs/known-issues.md
- package.json
- relevant files in the affected layer only

GOAL

[single narrow objective]

SUCCESS CRITERIA

1. ...
2. ...

STRICT RULES

- do not redesign UI
- do not replace Zustand
- do not move orchestration into components
- do not touch unrelated systems

OUTPUT REQUIRED

1. modified files
2. why each changed
3. verification results
4. phase status
```

## Good Prompt Characteristics

- exact scope
- exact constraints
- exact verification
- exact success criteria
- exact files or layers

## Bad Prompt Characteristics

- "make it production-ready"
- "clean up the architecture"
- "refactor the app to be scalable"
- "redesign the UI while fixing the queue"
- "replace the current pattern with a better one"

## Canonical Constraints To Reuse

- UI reflects centralized state only
- components render and dispatch only
- store owns scene state
- agents own orchestration logic
- services own API transport
- no fake timers
- no direct provider calls from components
- no silent lifecycle mutation
- no timeline/video work unless the phase explicitly targets it

## Current Recommended Prompt Order

1. hydration sign-off and docs reconciliation
2. transport truthfulness and provider realism
3. long-running provider support
4. timeline and sequencing
5. backend/export contract-first planning and boundary enforcement

## Documentation Read Order

When prompting future AI sessions, use this read order:

1. `PROJECT_BIBLE.md`
2. `docs/architecture.md`
3. `docs/phases.md`
4. `docs/known-issues.md`
5. `docs/prompts.md`

Use `docs/roadmap.md` for product direction, not for low-level implementation rules.

Phase numbering in prompts must match `docs/phases.md`.

## Phase 6 Prompt Notes

- Phase 6.0-A should remain audit/planning only and define backend/export ownership boundaries before implementation.
- Phase 6.0-B should remain docs/architecture sync only.
- Early Phase 6 implementation prompts must enforce truthful backend responses with no fake success/progress/artifacts/download claims.
- Phase 6.1 prompts should stay backend-only and contract-first (no renderer, no frontend integration, no fake completion/artifacts/downloads).
- Phase 6.2 prompts should keep registry lifecycle truthful: process-local idempotency is allowed, but fake completion/progress/artifacts/downloads and timer-driven fake advancement are forbidden.
- Phase 6.3 prompts should keep local frontend/backend integration boundary-safe: service config/path alignment and focused integration tests are allowed, but no React orchestration, no UI polling loops, and no fake success/progress/artifacts/download behavior.
- Phase 6.5 prompts should remain renderer-planning/boundary-focused until worker/queue prerequisites are defined; no renderer code, no fake output/progress, and no artifact URLs/download claims without real produced files.
- Phase 6.6 prompts should start with backend lifecycle state-machine audit/contract work only and keep renderer execution, workers, queues, webhooks, and durable persistence deferred until explicitly phased.
- After Phase 6.6-B, prompts should preserve route compatibility and frontend non-impact while expanding lifecycle guards; renderer runtime and artifact hosting/download behavior must stay deferred until explicit renderer phases.
- Phase 6.7 prompts should keep artifact metadata contract work backend-only and structural-only: no real artifact generation, no hosting/signing URLs, no download output claims, and no React/store/agent/service drift.
- Phase 6.8 prompts should keep worker-boundary work registry-only: claim/ownership guards are allowed, but no worker runtime loop, no queue runtime, no renderer execution, and no frontend orchestration changes.
- Phase 6.9 prompts should remain sign-off/readiness-only: confirm boundaries and deferred systems before opening Phase 7 Remotion pilot planning; no implementation changes.
- Phase 7.0 prompts should keep renderer-snapshot work backend-only: no Remotion install, no renderer execution, no file output, no queue/worker runtime loop, and no frontend orchestration changes.
- Phase 7.1 prompts should keep temp/output path policy work helper-only: path validation/derivation and traversal protections are allowed, but no file/directory creation runtime and no renderer execution.
- Phase 7.2 prompts should keep real file verification work backend-only and read-only: `fs.stat` checks and verified metadata mapping are allowed, but no renderer execution, no production file writes/deletes, no artifact hosting/signing/download URLs, and no frontend orchestration changes.
- Phase 7.3 prompts should keep renderer failure mapping work backend-only and side-effect free: normalized failure mapping/sanitization tests are allowed, but no renderer execution, no lifecycle mutation, no file/artifact/url creation, and no frontend orchestration changes.
- Phase 7.4 prompts should keep single-process harness work backend-only and adapter-injected: explicit claim/render/verify/finalize orchestration is allowed, but no Remotion install/runtime, no route auto-execution, no queue/scheduler/worker loop, no hosting/signing/download URLs, and no frontend orchestration changes.
- Phase 7.5 prompts should keep Remotion adapter work stub-only at first: harness-compatible adapter contract tests are allowed, but no Remotion install/import, no composition files, no renderer runtime, no route auto-execution, and no frontend orchestration changes.
- Phase 7.6 prompts should keep dependency onboarding isolated: installing `remotion` and `@remotion/renderer` is allowed, but no runtime imports, no adapter execution wiring, no composition files, no route auto-execution, and no frontend orchestration changes.
- Phase 7.7 prompts should keep Remotion validation import-only: dynamic module import smoke tests are allowed, but no runtime API execution, no adapter implementation, no composition files, no route auto-execution, and no frontend orchestration changes.
