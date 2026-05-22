# Phase 164 - Production Storage Provider Strategy Audit Pack

Status: audit only

## Goal

Audit the safest production storage provider strategy for artifact delivery.

## Current safe state

- Backend descriptor route exists.
- Descriptor route is integrated with ready-state preconditions.
- Descriptor route remains unavailable by default.
- Production artifact provider boundary exists.
- Not-configured provider fails closed.
- Frontend descriptor UI exists.
- Browser navigation strategy exists but is blocked by default.
- No production storage provider exists.
- No signed URL generation exists.
- No public URL generation exists.
- No direct frontend Supabase/storage access exists.
- Public artifact delivery remains blocked.

## Candidate production storage providers

Possible future providers:

1. Supabase Storage
2. S3-compatible storage
3. Cloudflare R2
4. Local production storage is not recommended for public delivery

## Recommended strategy

The safest near-term production strategy is:

- backend-only production storage provider boundary
- no frontend storage SDK
- no service-role key in frontend
- no direct browser storage access
- backend validates requester authorization first
- backend validates workspace/RLS readiness
- backend validates artifact metadata
- backend validates provider readiness
- backend returns unavailable unless every check passes
- signed URL generation remains deferred to a later audited phase

## Required future provider conditions

A future production storage provider must:

1. Run backend-only.
2. Never expose service-role secrets.
3. Never expose local filesystem paths.
4. Never trust frontend-supplied storage keys blindly.
5. Validate artifact ownership/workspace scope before resolving.
6. Validate artifact metadata is safe and path-free.
7. Fail closed when storage config is missing.
8. Fail closed when artifact object is missing.
9. Fail closed when provider cannot verify object metadata.
10. Avoid public URLs by default.
11. Avoid signed URLs until a signed URL provider phase is approved.
12. Preserve backend-mediated delivery model.

## Explicitly deferred

This phase does not add:

- Supabase storage provider implementation
- S3/R2 provider implementation
- signed URL generation
- public URL generation
- browser download/navigation
- direct frontend Supabase client
- frontend storage access
- service-role runtime shortcut
- public artifact delivery

## Recommended next phase

Phase 165 should add a production storage provider boundary only.

Expected Phase 165 behavior:

- interface/helper only
- fail-closed not-configured behavior
- no signed URLs
- no public URLs
- no frontend storage access
- no browser navigation/download
