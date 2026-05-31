# BYOK Provider Key Storage Strategy

## Executive Summary

BYOK provider key storage remains deferred. The current Provider Settings page is safe because it is authenticated, non-live, and explicit that secure API key input, storage, validation, and routing execution are not enabled.

Future BYOK implementation must be backend-only, workspace-authorized, and secret-safe. The frontend must never store raw provider keys, receive saved raw keys, call providers directly, or infer connection state locally.

Provider API keys are secrets. They must not appear in frontend state, browser storage, logs, test artifacts, URLs, query strings, screenshots, snapshots, browser-visible API responses, or documentation examples.

## Threat Model

BYOK introduces direct secret-handling risk. The implementation must defend against:

- Frontend key leakage through forms, component state, errors, devtools, or browser-visible responses.
- `localStorage`, `sessionStorage`, or Zustand persistence of raw provider keys.
- Logs, Playwright traces, screenshots, snapshots, or test fixtures containing secrets.
- Browser responses exposing raw keys, encrypted payloads, secret references, service-role data, or provider raw errors.
- Service-role exposure through frontend env names or public configuration.
- Unauthorized workspace mutation through spoofed user, workspace, role, or provider identifiers.
- Fake connected or verified states before real backend storage and provider verification exist.
- Provider verification abuse that causes rate-limit, cost, or account lockout problems.
- Raw provider error body leakage, including provider account metadata or key fragments.
- Key rotation, replacement, deletion, or disablement mistakes that leave stale active keys.
- Confusion between BYOK provider balances and Free AI Mixer platform credits.
- Multiple active workspace memberships causing mutations against the wrong workspace.

## Storage Strategy

### Supabase Table With Backend-Only Encryption

This can be acceptable later if encryption and decryption happen only on the backend. The database should store `encrypted_payload` plus safe metadata such as provider id, workspace id, key version, fingerprint, status, and verification timestamps.

The Supabase service-role key is not an encryption boundary. A separate app encryption key or KMS is required. This option is testable and fits the current backend auth/workspace model, but it must not ship until redaction, authorization, rotation, and no-leak tests are in place.

### Supabase Table With External Vault References

This is the strongest production direction when operational support exists. Supabase stores metadata and a `secret_ref`; the external secret manager stores the actual provider key. This reduces database blast radius but adds vault IAM, local/staging setup, recovery, rotation, and deployment complexity.

### Secret Vault Interface Boundary

A backend vault interface is the right seam before live storage. It should support not-configured behavior, store, retrieve/decrypt, delete/disable, rotate, and readiness checks without returning raw keys to routes or frontend responses. The current safe step is to keep this boundary non-live until the storage choice is approved.

### Rejected: Frontend-Only Or Session Key Storage

Frontend-only key entry, session-only key storage, direct provider calls, or local browser persistence are rejected. They violate the backend authority model and create high-risk leakage paths.

### Current Safe Step

The current Phase 31 step is docs-only. It records the contract before adding migrations, live routes, raw-key inputs, provider SDK calls, or encrypted vault runtime.

## Phase 34 Pre-Live Security Boundary Coverage

Merged Phase 34 added focused pre-live security boundary coverage before any live provider key storage or provider connection work.

Coverage now records that:

- Provider settings mutation routes remain fail-closed.
- The not-configured provider secret vault cannot produce fake success.
- Mutation unavailable responses stay safe and do not echo raw provider key-like request values.
- BYOK/provider-secret redaction covers `provider_raw_error` and `providerrawerror` in addition to existing provider key, plaintext key, replacement plaintext key, encrypted payload, secret reference, auth/session/token, service-role-like, and raw provider error fields.
- Frontend remains safe: no raw provider key input UI, no frontend Supabase/storage key access, and no `localStorage` or `sessionStorage` provider key persistence.
- Frontend provider metadata remains non-live and must not become fake connected or fake verified state.

Phase 34 did not add live BYOK storage, migrations, provider SDK/API calls, fake connected or verified provider state, credits, billing, generation, export, admin, event, or audit runtime behavior.

## Future Recommended Architecture

Future BYOK should use a backend-only provider secret boundary:

- Raw key is accepted only by a backend HTTPS request body.
- Raw key is never echoed, logged, serialized into public responses, or persisted in frontend state.
- Backend encrypts the key with a separate app encryption key or KMS, or stores it in an external vault and persists only a `secret_ref`.
- Frontend receives only redacted metadata such as masked summary, fingerprint, suffix, status, and verification state.
- Decryption happens only at the provider verification or provider generation boundary.
- Delete disables or revokes active use without returning secret material.
- Replace/rotate creates a new encrypted secret or vault reference and marks the old key as rotated or disabled.
- Records include `key_version` or `encryption_version` so future rotation is explicit.
- Provider execution later must retrieve keys only through backend services after workspace authorization.

## Authorization Rules

Provider key mutations require:

- Verified backend session.
- Backend app-user mapping.
- Backend-derived workspace authority.
- Exactly one active workspace context until active workspace selection exists.
- `workspace_owner` or `workspace_admin` for add, replace, delete, test, and routing mutation.

Provider key mutations must block:

- Unauthenticated requesters.
- Requesters without app-user mapping.
- Requesters without verified workspace authority.
- Workspace viewers and workspace members.
- Multiple active workspace memberships until active workspace selection exists.
- Frontend-provided `userId`, `authSubject`, `workspaceId`, `workspaceRole`, or `platformRole`.
- Supabase metadata as workspace or platform authority.
- Any inference that workspace owner means `platform_admin`.

## Future API Contracts

These are route contracts only. They are not approved for implementation in this docs phase.

### GET /provider-settings/catalog

Request:

- No secret-bearing request body.
- Public or authenticated access is acceptable for provider metadata.

Response:

- Provider id, display name, capabilities, docs URL, status, and cost/security notes.
- No connected state unless backend-derived.
- No provider keys, encrypted payloads, secret references, or provider account data.

Authorization:

- None required for static catalog metadata.

No fake success rule:

- Must not imply a provider is connected or verified.

### GET /provider-settings/status

Request:

- Authenticated account request with bearer handled by the frontend account fetch helper.
- No frontend workspace authority fields.

Response:

- Backend-derived active workspace id when available.
- Redacted connection summaries only.
- Masked suffix or fingerprint only.
- Verification state only when backend-derived.

Never returned:

- Raw key, encrypted payload, secret reference, provider raw errors, service-role values, or provider account balances.

Authorization:

- Verified backend session and backend workspace authority.

Safe errors:

- `401` sign-in required, `403` workspace required, `503` auth/workspace/storage unavailable.

No fake success rule:

- Connection state remains `not_connected` or unavailable until real backend storage exists.

### POST /provider-settings/connections

Request:

- `{ providerId, apiKey }` over HTTPS only.
- `apiKey` is accepted only by backend and must never be logged or echoed.

Response:

- Redacted connection summary.
- Masked suffix/fingerprint.
- Storage or verification state.

Never returned:

- Raw key, encrypted payload, secret reference, provider raw response, or provider account balance.

Authorization:

- Verified backend session, backend workspace authority, and workspace owner/admin.

Safe errors:

- Sign-in required, workspace required, owner/admin required, vault unavailable, invalid provider, invalid key format, rate limited.

No fake success rule:

- Return connected only after real storage succeeds.

### POST /provider-settings/connections/:providerId/test

Request:

- Provider id from route.
- No raw key unless a future pre-save verification flow explicitly approves one.

Response:

- Sanitized verification result.
- `verified_at` only after real provider success.

Never returned:

- Raw provider error body, raw key, provider account metadata, encrypted payload, or secret reference.

Authorization:

- Verified backend session, backend workspace authority, and workspace owner/admin.

Safe errors:

- Verification unavailable, invalid provider, rate limited, provider rejected credentials, provider unavailable.

No fake success rule:

- Test success requires a real provider verification response.

### PUT /provider-settings/connections/:providerId

Request:

- `{ apiKey }` replacement key over HTTPS only.

Response:

- Redacted updated connection summary.
- New masked suffix/fingerprint.
- Rotation status.

Never returned:

- Old key, new key, encrypted payload, secret reference, provider raw response.

Authorization:

- Verified backend session, backend workspace authority, and workspace owner/admin.

Safe errors:

- Sign-in required, workspace required, owner/admin required, vault unavailable, invalid provider, invalid key format, rate limited.

No fake success rule:

- Replacement succeeds only after backend storage/rotation succeeds.

### DELETE /provider-settings/connections/:providerId

Request:

- Provider id from route.
- No secret-bearing request body.

Response:

- Redacted disabled/not-connected summary.

Never returned:

- Deleted key, encrypted payload, secret reference, provider raw response.

Authorization:

- Verified backend session, backend workspace authority, and workspace owner/admin.

Safe errors:

- Sign-in required, workspace required, owner/admin required, key not found, vault unavailable.

No fake success rule:

- Deletion/disablement succeeds only after backend state changes.

## Provider Verification Strategy

Provider verification should be:

- Explicit user action only.
- Backend-only.
- Rate-limited per workspace, user, provider, and source where practical.
- Format-checked before remote provider calls.
- Implemented with minimal provider endpoint calls, not generation endpoints.
- Free of Free AI Mixer generation credit consumption.
- Recorded as `verified_at` only after real provider success.
- Mapped to sanitized public errors only.
- Kept out of raw logs, screenshots, snapshots, and event payloads.

Raw provider error bodies must not be logged or returned. Provider failures should be reduced to safe categories such as invalid credentials, provider unavailable, rate limited, unsupported provider, or verification unavailable.

## Credits And Billing Separation

BYOK means the user pays the provider directly through their own provider account and API key.

Free AI Mixer credits meter platform usage only. Provider balances, provider free trials, provider rate limits, and provider invoices are not Free AI Mixer credits.

Multiple provider keys must not multiply platform credits. Adding BYOK support must not activate billing, checkout, credit ledger mutation, refill behavior, fake balances, or premium entitlement.

## Frontend UX Rules

Safe future UI may show:

- Provider catalog.
- Backend-derived connected or not-connected status.
- Masked suffix or fingerprint only.
- Backend-derived verified, unverified, failed, or needs-reverification state.
- Add, replace, remove, and test actions only after backend storage exists.
- Provider cost and account ownership warnings.

Frontend must never:

- Store raw key after submit.
- Show saved raw key.
- Call provider APIs directly.
- Infer connected state locally.
- Fake verification success.
- Store keys in `localStorage`, `sessionStorage`, Zustand, URLs, or query strings.
- Trust Supabase metadata for workspace or platform authority.

## Draft Schema Direction

Future schema may use `provider_keys` or `provider_credentials` with:

- `workspace_id`
- `provider_id` or `provider_name`
- `encrypted_payload` or `secret_ref`
- `key_fingerprint` or suffix
- `status`
- `verification_status`
- `verified_at`
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`
- `deleted_at`
- `key_version` or `encryption_version`

Constraints should enforce uniqueness for active keys per workspace/provider. RLS should remain default-deny, with backend/service-role-only access for secret-bearing rows.

Existing draft schema and repository seams may exist, but live persistence remains deferred until a future approved implementation phase.

## Logging And Redaction Strategy

Redaction must cover:

- `apiKey`
- `providerKey`
- `plaintextKey`
- `replacementPlaintextKey`
- `encryptedPayload`
- `secretRef`
- Provider raw errors.
- `Authorization`, `Cookie`, session, and token headers.
- Env/config secrets.
- Playwright screenshots, traces, snapshots, and fixtures.
- Docs examples.

Documentation must use placeholders only. Do not include real-looking API keys, JWTs, service-role keys, provider account ids, or secret references.

## Future Testing Strategy

Before live BYOK, tests should prove:

- No frontend Supabase DB/storage usage.
- No `localStorage`, `sessionStorage`, or Zustand provider key persistence.
- Mutation routes require backend auth and workspace owner/admin.
- Viewer/member roles are blocked.
- Raw key is never returned.
- Encrypted payload is never returned.
- Provider errors are sanitized.
- Not-configured vault ignores sensitive input.
- No fake connected or verified state.
- No provider SDK/API calls until explicitly approved.
- No generation, export, credits, billing, admin, event, audit, or analytics runtime expansion.

## Deferred Items

The following remain deferred:

- Live key storage.
- Encrypted vault runtime.
- Provider SDK/API verification.
- Provider key UI input fields.
- Routes and mutations becoming live.
- Migrations.
- Active workspace selection.
- Billing and credits ledger.
- Generation/export runtime integration.
- Event/audit persistence.
