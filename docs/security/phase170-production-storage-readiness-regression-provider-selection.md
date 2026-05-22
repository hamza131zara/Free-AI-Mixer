# Phase 170 - Production Storage Readiness Regression + Provider Selection Pack

Status: regression + provider selection audit only

## Goal

Add regression coverage after Phase 169 descriptor route production storage readiness wiring, and select the safest first production storage provider strategy.

## Current safe state

- Descriptor route calls resolveProductionStorageReadiness(...).
- Storage readiness feeds providerConfigured/providerCanResolve preconditions.
- Descriptor route remains unavailable by default.
- workspaceMembershipOrRlsReady still blocks ready state.
- Not-configured production storage provider fails closed.
- No real Supabase/S3/R2 provider exists.
- No signed URL generation exists.
- No public URL generation exists.
- No browser download/navigation exists.
- No direct frontend Supabase/storage access exists.
- Public artifact delivery remains blocked.

## Regression requirements

This phase verifies:

1. Missing storageRef cannot produce ready delivery.
2. Invalid/local-path-like storageRef cannot produce ready delivery.
3. Not-configured provider cannot produce ready delivery.
4. Object-not-found provider result cannot produce ready delivery.
5. Unauthenticated requester cannot reach storage readiness.
6. Mismatched requester cannot reach storage readiness.
7. workspaceMembershipOrRlsReady still blocks ready state.
8. Route does not add signed URL/public URL/browser navigation shortcuts.

## Provider selection

Candidate providers:

1. Supabase Storage
2. S3-compatible storage
3. Cloudflare R2

Recommended first provider:

- Supabase Storage

Reason:

- Supabase is already part of the project registry/RLS roadmap.
- Supabase Storage can align with workspace/RLS and backend-mediated artifact access.
- It allows controlled backend-only verification before signed URL generation is introduced.
- It keeps frontend storage access forbidden.

## Supabase Storage implementation constraints for next phase

Phase 171 should add a backend-only Supabase production storage provider boundary and object verification behavior.

It must:

- validate env configuration safely
- fail closed when env is missing
- validate bucket/object keys
- verify object existence/metadata only
- not generate signed URLs yet
- not generate public URLs
- not expose service-role secrets
- not log secrets
- not add frontend Supabase/storage access
- not add browser download/navigation
- not enable public artifact delivery

## Explicitly deferred

This phase does not add:

- Supabase Storage provider implementation
- S3/R2 provider implementation
- signed URL generation
- public URL generation
- browser download/navigation
- direct frontend Supabase client
- frontend storage access
- service-role runtime shortcut
- public artifact delivery

## Recommended next phase

Phase 171 - Supabase Production Storage Provider Boundary + Verification Pack

Expected Phase 171 behavior:

- backend-only Supabase provider
- env/config validation
- object existence verification
- fail-closed default behavior
- no signed URLs
- no public URLs
- no frontend storage
- no browser download/navigation
