# Phase 162 - Browser Download/Navigation Final Audit Pack

Status: audit only

## Goal

Audit what must be true before Free AI Mixer can enable real browser download/navigation for exported artifacts.

## Current safe state

- Backend descriptor route exists.
- Descriptor route is integrated with ready-state preconditions.
- Descriptor route remains unavailable by default.
- Frontend descriptor service exists.
- Frontend descriptor store exists.
- TimelineExportPanel renders descriptor UI.
- Frontend can represent backend-mediated ready descriptor state.
- No browser download/navigation exists.
- No signed URL generation exists.
- No public URL generation exists.
- No direct frontend Supabase/storage access exists.
- Public artifact delivery remains blocked.

## Future browser download/navigation requirements

Before browser download/navigation can be enabled, all of these must be true:

1. Backend descriptor route can safely return ready only after authorization, workspace/RLS, artifact metadata, and provider checks pass.
2. Ready descriptors must be backend-mediated only.
3. Browser navigation/download must use backend-approved descriptor data only.
4. Frontend must not construct stream/download URLs manually.
5. Frontend must not call Supabase/storage directly.
6. Frontend must not create signed/public URLs.
7. The descriptor must expire quickly.
8. Expired descriptors must not trigger download.
9. Unauthorized/forbidden/unavailable descriptors must stay disabled.
10. No local filesystem path may be exposed.
11. No service-role secret may be exposed.
12. Download behavior must be user-triggered only.
13. The route must preserve auth/ownership/workspace checks.

## Candidate future implementation options

A later implementation phase may choose one of these:

- backend-mediated stream route navigation
- short-lived backend-mediated download route
- safe anchor link generated from backend descriptor route path

But the implementation must not bypass backend authorization.

## Explicitly deferred

This phase does not add:

- window.open
- location.href
- anchor download behavior
- document.createElement("a")
- programmatic click
- signed URL generation
- public URL generation
- direct frontend Supabase client
- frontend storage access
- production storage provider
- service-role runtime shortcut
- public artifact delivery

## Recommended next phase

Phase 163 should implement browser download/navigation only if the final audit confirms backend ready descriptors are production-safe.

If backend ready-state remains unavailable-by-default, Phase 163 should stay audit/regression-only or add a disabled UI placeholder instead of real navigation.
