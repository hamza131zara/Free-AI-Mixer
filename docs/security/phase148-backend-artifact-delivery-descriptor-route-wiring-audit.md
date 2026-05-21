# Phase 148 - Backend Artifact Delivery Descriptor Route Wiring Audit Pack

Status: audit only

## Goal

Audit the future backend route wiring needed to expose backend-mediated artifact delivery descriptors safely.

## Current safe state

- Production artifact delivery provider boundary exists.
- Backend-mediated delivery descriptor boundary exists.
- Frontend download UI boundary exists.
- No descriptor route is wired yet.
- No signed URL generation exists.
- No public URL generation exists.
- No frontend download/navigation behavior exists.
- Public artifact delivery remains blocked.

## Future backend descriptor route requirements

A future descriptor route must:

1. Run backend-only.
2. Require trusted authenticated requester context.
3. Use export route authorization guards.
4. Verify owner/workspace access.
5. Verify workspace membership or RLS readiness.
6. Verify artifact metadata exists and is ready.
7. Use production artifact provider boundary.
8. Return backend-mediated descriptors only after all checks pass.
9. Never expose local filesystem paths.
10. Never fabricate ready delivery.
11. Never expose service-role secrets.
12. Never return signed/public URLs until a separately approved provider phase.

## Possible future route shape

Future route may be one of:

- GET /exports/:jobId/artifacts/:artifactId/delivery
- GET /exports/:jobId/artifacts/:artifactId/access with backend-mediated descriptor result

The exact route should be selected in the implementation phase.

## Explicitly deferred

This phase does not add:

- descriptor route wiring
- production provider route wiring
- signed URL generation
- public URL generation
- frontend window.open
- frontend location.href
- anchor download behavior
- direct frontend Supabase client
- service-role runtime behavior
- public artifact delivery

## Future phase

Phase 149 should implement backend artifact delivery descriptor route wiring only if authorization, membership/RLS readiness, artifact readiness, and provider boundaries remain safe.
