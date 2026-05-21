# Phase 146 - Frontend Download UI Audit Pack

Status: audit only

## Goal

Audit future frontend download UI requirements without enabling download/navigation behavior.

## Current safe state

- Frontend can request artifact access metadata through backend service/store boundaries.
- Frontend does not directly open artifact URLs.
- Frontend does not directly navigate to artifact routes.
- Frontend does not create Supabase clients.
- Frontend does not create signed URLs.
- Frontend does not use storage clients.
- Public artifact delivery remains blocked.

## Future frontend download UI requirements

A future frontend download UI must:

1. Use backend-mediated artifact descriptors only.
2. Never construct storage URLs in React components.
3. Never call Supabase storage from frontend.
4. Never use service-role credentials.
5. Never assume an artifact is downloadable until backend says ready.
6. Clearly show unavailable/error states.
7. Use store actions, not component-level orchestration.
8. Avoid fake progress, fake ready states, and fake artifacts.

## Deferred implementation

This phase does not add:

- Download button
- window.open
- location.href
- anchor download behavior
- frontend Supabase client
- signed URL handling
- public URL handling
- stream navigation
- production artifact delivery UI

## Future phase

Phase 147 should implement frontend download UI only if it uses backend-provided descriptors and keeps React components render/dispatch only.
