# Phase 168 - Descriptor Route Production Storage Readiness Integration Audit Pack

Status: audit only

## Goal

Audit how the backend artifact delivery descriptor route should later integrate with resolveProductionStorageReadiness(...).

## Current safe state

- ProductionStorageProvider boundary exists.
- resolveProductionStorageReadiness(...) exists.
- Not-configured production storage provider fails closed.
- Descriptor route is integrated with decideArtifactDeliveryReadyPreconditions(...).
- Descriptor route remains unavailable by default.
- providerConfigured remains false in route wiring.
- providerCanResolve remains false in route wiring.
- No Supabase/S3/R2 production provider exists.
- No signed URL generation exists.
- No public URL generation exists.
- No browser download/navigation exists.
- No direct frontend Supabase/storage access exists.
- Public artifact delivery remains blocked.

## Future descriptor route integration requirements

A future route integration phase must:

1. Resolve storage references only from trusted backend artifact metadata.
2. Reject missing storage references.
3. Reject invalid/local path-like storage references.
4. Use resolveProductionStorageReadiness(...) before setting providerConfigured/providerCanResolve true.
5. Keep descriptor route unavailable if provider is not configured.
6. Keep descriptor route unavailable if provider cannot verify object existence.
7. Preserve authorization, workspace/RLS, artifact metadata, and provider readiness checks.
8. Never trust frontend-supplied storage references.
9. Never expose bucket/object keys directly to frontend unless separately approved.
10. Never generate signed URLs in this phase.
11. Never generate public URLs in this phase.
12. Never trigger browser navigation/download in this phase.

## Explicitly deferred

This phase does not add:

- descriptor route wiring to resolveProductionStorageReadiness(...)
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

Phase 169 should implement descriptor route integration with resolveProductionStorageReadiness(...) only if it remains unavailable-by-default with the not-configured provider.

Expected Phase 169 behavior:

- descriptor route calls production storage readiness helper
- missing/invalid/not-configured provider states remain unavailable
- no signed URLs
- no public URLs
- no frontend storage access
- no browser navigation/download
