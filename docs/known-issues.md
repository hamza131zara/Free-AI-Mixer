# Known Issues

This file tracks current architecture debt and unstable behaviors that future work must not ignore.

## Stability Issues

### Hydration Runtime Sign-Off

Current state:

- explicit hydration state exists
- interaction is gated until restore completes
- active scenes sanitize to `idle`
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

### No Long-Running Provider Support

Current state:

- generation assumes request/response completion in one call
- there is no provider job ID, polling loop, or resumable execution model

Phase 3.8B update:

- provider job contract types now exist in `src/types/providerJob.ts`
- runtime generation still assumes single-request completion
- polling/orchestration changes are deferred to Phase 3.8C
- persistence/resume changes are deferred to later Phase 3.8D/E work

Phase 3.8C1 update:

- submit/poll service contracts now exist
- polling agent scaffolding now exists
- queue/store runtime still does not orchestrate long-running polling
- refresh-safe resume still does not exist

Phase 3.8C2 update:

- queue/store runtime now orchestrates accepted provider jobs through polling
- immediate success and terminal poll outcomes flow through the existing lifecycle contract
- refresh-safe resume still does not exist

Phase 3.8C3 update:

- runtime hardening now blocks duplicate accepted-job submissions for the same scene
- long-running provider jobs surface explicit accepted, waiting, polling, timeout, and completion wording in the UI
- queue concurrency and terminal callback behavior are covered by dedicated hardening tests
- refresh-safe resume still does not exist

Phase 3.8D1 update:

- durable provider job metadata now persists for hydration classification
- hydration can distinguish resume-needed, expired, and resume-unavailable provider jobs
- automatic resume polling still does not exist and remains deferred to Phase 3.8D2

Phase 3.8D2 update:

- valid persisted provider jobs now auto-resume polling after hydration
- resume polling reuses the existing provider job id and does not submit a duplicate provider job
- provider job not found after reload now becomes an explicit scene error
- backend durability, cross-tab ownership, and server-side queue recovery still do not exist

Phase 3.8D3 update:

- browser-local resume now hardens retry-after-resume-failure and regenerate-after-resume-success flows
- fingerprint mismatches now fail safely and require explicit user action instead of auto-resume
- resumed success and failure states now surface explicit after-reload labels in the UI
- backend durability, multi-device coordination, and remote cancellation still do not exist

Target fix phase:

- Phase 3.8

### No Durable Backend Queue

Current state:

- queue execution is in-memory and browser-bound

Why it matters:

- refresh cannot safely resume real remote work
- concurrency and status are local, not globally durable

Target fix phase:

- Phase 3.8 and later backend work

## Verification Gaps

- long-running provider telemetry is not implemented; the UI currently reports app lifecycle stages only
