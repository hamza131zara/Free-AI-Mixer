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
