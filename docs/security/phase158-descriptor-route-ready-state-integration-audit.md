# Phase 158 - Descriptor Route Ready-State Integration Audit Pack

Status: audit only

## Goal

Audit whether the backend artifact delivery descriptor route can safely integrate the Phase 157 ready-state precondition helper in a later implementation phase.

## Current safe state

- Descriptor route exists:
  - GET /exports/:jobId/artifacts/:artifactId/delivery
- Phase 157 precondition helper exists:
  - decideArtifactDeliveryReadyPreconditions(...)
- Descriptor route is not wired to the precondition helper yet.
- Descriptor route remains blocked from ready state by default.
- workspaceMembershipOrRlsReady remains false in current route wiring.
- providerConfigured remains false in current route wiring.
- artifactReady remains false in current route wiring.
- No signed URL generation exists.
- No public URL generation exists.
- No browser download/navigation exists.
- Public artifact delivery remains blocked.

## Future route integration requirements

A later route integration phase must:

1. Use trusted requester context only.
2. Preserve route authorization guard behavior.
3. Verify export job exists.
4. Verify artifact metadata exists on the export record.
5. Verify requested artifactId matches real artifact metadata.
6. Verify artifact metadata is safe and path-free.
7. Verify artifact is ready/available.
8. Verify workspace membership or RLS readiness.
9. Verify storage/provider readiness.
10. Call decideArtifactDeliveryReadyPreconditions(...).
11. Return unavailable unless all preconditions pass.
12. Never return ready by default.
13. Never expose local filesystem paths.
14. Never generate signed URLs.
15. Never generate public URLs.
16. Never add frontend browser download/navigation behavior.

## Explicitly deferred

This phase does not add:

- descriptor route integration with precondition helper
- ready descriptor route behavior
- production storage provider
- signed URL generation
- public URL generation
- browser download/navigation
- direct frontend Supabase client
- frontend storage access
- service-role runtime shortcut
- public artifact delivery

## Recommended next phase

Phase 159 should integrate decideArtifactDeliveryReadyPreconditions(...) into the descriptor route in a controlled way.

Expected Phase 159 behavior:

- unavailable by default
- ready only in focused test-controlled setup if safe
- no signed URLs
- no public URLs
- no browser navigation/download
- no direct frontend Supabase/storage
