# Known Issues

This file tracks current architecture debt and unstable behaviors that future work must not ignore.

## High-Risk Current Issues

### Simulated Success in the Service Layer

Current state:

- `src/services/sceneGenerationService.ts` still returns mock generated scenes when:
  - base URL is missing
  - HTTP response is not OK
  - response JSON shape is invalid
  - most transport errors occur

Why it matters:

- failures can look like successes
- retry behavior becomes harder to trust
- provider observability becomes misleading

Target fix phase:

- Phase 3.7

### Milestone-Based Progress

Current state:

- queue progress uses local milestone numbers rather than real provider telemetry

Why it matters:

- the UI can imply stronger operational certainty than the providers actually expose

Target fix phase:

- Phase 3.7

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

- provider failure behavior is not trustworthy until service simulation is removed
