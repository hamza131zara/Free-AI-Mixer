# Phase 152 - Frontend Artifact Delivery Descriptor UI Wiring Audit Pack

Status: audit only

## Goal

Audit future UI wiring from artifact delivery descriptor store to frontend download UI without enabling browser download/navigation behavior.

## Current safe state

- Backend descriptor route exists.
- Frontend descriptor service exists.
- Frontend descriptor store exists.
- ArtifactDownloadAction component exists.
- TimelineExportPanel is not wired to descriptor store yet.
- No browser download/navigation behavior exists.
- Public artifact delivery remains blocked.

## Future UI wiring requirements

Future UI wiring must:

1. Use artifactDeliveryDescriptorStore only.
2. Request backend descriptor through store action.
3. Render loading/unavailable/error/ready states truthfully.
4. Pass backend-mediated ready descriptor into ArtifactDownloadAction.
5. Keep React components render/dispatch only.
6. Avoid component-owned fetch orchestration.
7. Avoid direct route construction in React components.
8. Avoid window.open, location.href, anchor click, or document.createElement.
9. Avoid frontend Supabase/storage access.
10. Avoid signed/public URL handling.

## Deferred implementation

This phase does not add:

- TimelineExportPanel wiring
- download button activation
- window.open
- location.href
- anchor download behavior
- direct frontend Supabase client
- frontend storage access
- signed URL handling
- public URL handling
- real browser download/navigation

## Future phase

Phase 153 should wire descriptor store state into UI only if it keeps components render/dispatch-only and still avoids browser navigation/download behavior.
