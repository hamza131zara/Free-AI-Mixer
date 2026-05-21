# Phase 144 - Signed URL Delivery Audit Pack

Status: audit only

## Goal

Define future signed URL delivery requirements without implementing signed URLs.

## Current safe state

- Production artifact provider boundary exists.
- Default production provider remains not configured.
- No signed URL generation exists.
- No public URL generation exists.
- No service-role shortcut exists.
- No frontend download/navigation behavior exists.
- Public artifact delivery remains blocked.

## Future signed URL requirements

A future signed URL delivery implementation must:

1. Run backend-only.
2. Require authenticated requester context.
3. Require export owner/workspace authorization.
4. Require workspace membership or verified ownership.
5. Require RLS/storage policy readiness.
6. Use short-lived expiration.
7. Never expose service-role secrets.
8. Never expose local filesystem paths.
9. Never fabricate ready delivery when storage/provider is unavailable.
10. Return safe unavailable/error states when authorization or storage checks fail.

## Future descriptor shape

Future backend response may include a safe descriptor such as:

- kind: ready
- deliveryMode: signed_url
- artifactId
- jobId
- expiresAt
- url

But only after authorization, RLS, storage provider, and route enforcement are production-ready.

## Explicitly deferred

This phase does not add:

- createSignedUrl calls
- getPublicUrl calls
- Supabase storage provider
- S3/R2 provider
- service-role runtime behavior
- route response signed URLs
- frontend window.open
- frontend location.href
- frontend direct Supabase client
- public artifact delivery

## Future phase split

Recommended next phases:

- Phase 145 - Backend-Mediated Artifact Delivery Pack
- Phase 146 - Frontend Download UI Audit Pack
- Phase 147 - Frontend Download UI Pack
