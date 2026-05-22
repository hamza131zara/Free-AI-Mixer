# Phase 173-A - Signed URL Delivery Safety Audit Only

Status: audit only

## Goal

Audit signed URL delivery safety before adding any signed URL provider, Supabase signed URL implementation, descriptor route signed URL integration, frontend navigation/download, public URLs, frontend Supabase/storage, or service-role shortcut.

## Current safe state

- Descriptor route accepts optional backend-only productionStorageProvider.
- Production storage readiness can verify storage through backend-only provider injection.
- workspaceMembershipOrRlsReady still blocks ready state.
- Route remains unavailable by default.
- No signed URL provider exists.
- No Supabase signed URL implementation exists.
- No descriptor route signed URL integration exists.
- Public artifact delivery remains blocked.

## Safety requirements

- Signed URL generation must be backend-only.
- Signed URLs must be short-lived.
- Unauthorized, forbidden, unavailable, expired, unsafe, or unverified states must not generate signed URLs.
- Storage refs must come only from trusted backend artifact metadata.
- Frontend must not use Supabase/storage directly.
- Service-role/storage backend keys must never be exposed or logged.
- Public URL generation remains forbidden.
- Fake signed URLs and fake ready descriptors remain forbidden.

## Next checkpoint

Phase 173-B should add a backend-only signed URL provider boundary that fails closed by default. No descriptor route signed URL integration yet.
