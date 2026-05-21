# Phase 142 - Production Artifact Delivery Strategy Audit Pack

Status: draft/audit only

## Goal

Define the future production artifact delivery strategy without enabling delivery yet.

## Current safe state

- Local-dev artifact stream remains development-only.
- Artifact access route remains backend-mediated.
- Authorization guards exist in test-controlled mode.
- Workspace membership and RLS boundaries exist, but production runtime enforcement is not complete.
- Public artifact delivery remains blocked.
- Signed/download/storage URL behavior remains deferred.
- Frontend direct Supabase/storage access remains forbidden.

## Future production delivery model

The safe production model should be:

1. Backend verifies authenticated requester context.
2. Backend verifies export owner/workspace access.
3. Backend verifies workspace membership or owner scope.
4. Backend relies on Supabase RLS/storage policies where applicable.
5. Backend resolves artifact metadata without leaking local paths.
6. Backend returns a short-lived backend-mediated delivery descriptor.
7. Frontend uses only backend-provided access descriptors.
8. Frontend never directly creates Supabase clients or storage URLs.

## Required future provider boundary

Future production provider should be backend-only and should expose a small interface such as:

- resolve artifact access for jobId/artifactId/requester context
- verify authorization before producing delivery descriptor
- never expose local filesystem paths
- never expose service-role secrets
- never fabricate successful delivery
- return unavailable when not configured
- return safe failure when authorization/RLS/storage checks fail

## Deferred implementation

This phase does not implement:

- Supabase storage provider
- S3/R2 storage provider
- signed URL generation
- public URL generation
- frontend download/navigation
- direct frontend Supabase client
- service-role runtime access
- RLS migration application
- production artifact route rollout

## Safety requirements before implementation

Before production artifact delivery can be implemented:

- route authorization must be enforced in production configuration
- workspace membership must be enforced or backed by RLS
- RLS policies must be applied and verified
- storage provider must be backend-only
- signed URLs must be short-lived and authorization-gated
- artifact metadata must remain safe and path-free
- frontend must not bypass backend authorization

## Future phase split

Recommended next phases:

- Phase 143 - Production Artifact Provider Boundary Pack
- Phase 144 - Signed URL Delivery Audit Pack
- Phase 145 - Backend-Mediated Artifact Delivery Pack
- Phase 146 - Frontend Download UI Audit Pack
- Phase 147 - Frontend Download UI Pack
