# Phase 154 - Timeline Export Panel Descriptor UI Wiring Audit Pack

Status: audit only

## Goal

Audit readiness to wire ArtifactDeliveryDescriptorAction into TimelineExportPanel safely.

## Current safe state

- Backend descriptor route exists.
- Frontend descriptor service exists.
- Frontend descriptor store exists.
- ArtifactDownloadAction exists.
- ArtifactDeliveryDescriptorAction exists.
- TimelineExportPanel is not wired yet.
- No browser download/navigation behavior exists.
- Public artifact delivery remains blocked.

## Future TimelineExportPanel wiring requirements

Future TimelineExportPanel wiring must:

1. Render ArtifactDeliveryDescriptorAction only for verified artifact metadata.
2. Pass real jobId and artifactId from backend-safe artifact/job state.
3. Dispatch descriptor store actions only.
4. Keep React components render/dispatch-only.
5. Avoid direct fetch calls in TimelineExportPanel.
6. Avoid constructing stream/download URLs in TimelineExportPanel.
7. Avoid window.open, location.href, anchor click, or document.createElement.
8. Avoid frontend Supabase/storage access.
9. Avoid signed/public URL handling.
10. Preserve unavailable/error states truthfully.

## Deferred implementation

This phase does not add:

- TimelineExportPanel wiring
- direct download behavior
- window.open
- location.href
- anchor download behavior
- direct frontend Supabase client
- frontend storage access
- signed URL handling
- public URL handling
- real browser download/navigation

## Future phase

Phase 155 should wire ArtifactDeliveryDescriptorAction into TimelineExportPanel only if the panel stays render/dispatch-only and still avoids browser navigation/download behavior.
