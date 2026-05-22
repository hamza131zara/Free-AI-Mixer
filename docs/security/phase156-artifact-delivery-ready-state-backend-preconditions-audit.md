# Phase 156 - Artifact Delivery Ready-State Backend Preconditions Audit Pack

Status: audit only

## Goal

Audit the backend preconditions required before the artifact delivery descriptor route can safely return a ready backend-mediated descriptor.

## Current safe state

- Backend descriptor route exists:
  - GET /exports/:jobId/artifacts/:artifactId/delivery
- Frontend descriptor service exists.
- Frontend descriptor store exists.
- ArtifactDeliveryDescriptorAction exists.
- TimelineExportPanel renders ArtifactDeliveryDescriptorAction.
- Descriptor route can return unavailable states.
- Descriptor route must not return ready by default.
- No signed URL generation exists.
- No public URL generation exists.
- No frontend browser download/navigation exists.
- Public artifact delivery remains blocked.

## Required future ready-state preconditions

A future ready descriptor must require all of these to be true:

1. Trusted requester context exists.
2. Route authorization allows requester access.
3. Export job exists.
4. Export job owner/workspace scope is verified.
5. Workspace membership or RLS readiness is verified.
6. Artifact metadata exists on the export job.
7. Artifact metadata status is available/ready.
8. Artifact id matches a real backend artifact record.
9. Storage/provider is configured.
10. Backend-mediated delivery provider can resolve the artifact safely.
11. No local filesystem path is exposed.
12. No service-role secret is exposed.
13. No signed/public URL is returned unless a later signed URL phase approves it.
14. Descriptor expiration is short-lived.
15. Missing or unsafe prerequisites return unavailable, not ready.

## Current intentionally blocked route behavior

The descriptor route must remain unavailable until future implementation phases safely connect these prerequisites.

Current blocked conditions should include:

- workspaceMembershipOrRlsReady: false
- providerConfigured: false
- artifactReady: false

This is intentional. It prevents accidental ready descriptors while auth/RLS/storage/provider readiness is incomplete.

## Explicitly deferred

This phase does not add:

- ready descriptor route behavior
- artifact metadata lookup wiring into ready state
- production storage provider
- signed URL generation
- public URL generation
- browser download/navigation
- direct frontend Supabase client
- frontend storage access
- service-role runtime shortcut
- RLS migration application

## Recommended next phase

Phase 157 should add a pure backend precondition helper only, for example:

- decideArtifactDeliveryReadyPreconditions(...)

The helper should fail closed and return structured unavailable reasons unless all prerequisites are explicitly true.

Phase 157 should still avoid signed URLs, public URLs, browser navigation, and production storage provider wiring.
