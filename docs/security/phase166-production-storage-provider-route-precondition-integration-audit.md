# Phase 166 - Production Storage Provider Route/Precondition Integration Audit Pack

Status: audit only

## Goal

Audit how the production storage provider boundary should later integrate with artifact delivery ready-state preconditions and the descriptor route.

## Current safe state

- ProductionStorageProvider boundary exists.
- Not-configured production storage provider fails closed.
- Storage reference validation exists.
- Descriptor route is integrated with decideArtifactDeliveryReadyPreconditions(...).
- Descriptor route remains unavailable by default.
- providerConfigured remains false.
- providerCanResolve remains false.
- No Supabase/S3/R2 production provider exists.
- No signed URL generation exists.
- No public URL generation exists.
- No browser download/navigation exists.
- No direct frontend Supabase/storage access exists.
- Public artifact delivery remains blocked.

## Future integration requirements

A future integration phase must:

1. Keep storage provider backend-only.
2. Resolve storage refs only from trusted backend artifact metadata.
3. Reject local path-like storage refs.
4. Verify object existence before setting providerCanResolve true.
5. Never trust frontend-provided storage refs.
6. Never expose bucket/object keys directly to frontend unless explicitly approved.
7. Never expose service-role secrets.
8. Never generate signed/public URLs in this route/precondition integration phase.
9. Keep descriptor route unavailable unless provider verification succeeds.
10. Preserve authorization, workspace/RLS, artifact metadata, and provider checks before ready state.

## Explicitly deferred

This phase does not add:

- route wiring to ProductionStorageProvider
- Supabase Storage provider
- S3/R2 provider
- signed URL generation
- public URL generation
- browser download/navigation
- direct frontend Supabase client
- frontend storage access
- service-role runtime shortcut
- public artifact delivery

## Recommended next phase

Phase 167 should add a production storage provider integration boundary only if still safe.

Expected Phase 167 behavior:

- controlled backend-only provider integration helper
- unavailable-by-default when provider is not configured
- no signed URLs
- no public URLs
- no frontend storage access
- no browser navigation/download
