# Production Monitoring and Error Handling

Phase 179 documents logging, monitoring, and error handling readiness.

This document is a monitoring plan only. It does not approve public launch by itself.

## Structured logs

Structured logs should use event names, levels, and safe metadata fields.

Do not log raw tokens, cookies, service-role keys, signed URL tokens, private keys, raw Authorization headers, or local filesystem paths.

All sensitive values must redact before emission.

## Backend error mapping

Backend error mapping should keep stable error codes for invalid requests, missing jobs, unavailable artifacts, renderer failures, and internal failures.

Errors returned to clients must remain sanitized and must not include stack traces or secrets.

## Render/export failure visibility

Render/export failure visibility should include job id, phase, sanitized failure code, and safe message.

Renderer/provider details must be sanitized before logging or response mapping.

## Download failure visibility

Download failure visibility should cover unavailable descriptors, unauthorized/forbidden states, expired descriptors, invalid navigation targets, and transport failures.

Frontend should display safe states only and must not expose backend secrets.

## Monitoring plan

Monitoring plan:

- collect backend process health
- track export request failures
- track render/export failures
- track descriptor/download failures
- track rate-limit/abuse boundary blocks
- track storage provider unavailable states
- alert on repeated internal errors
- alert on unexpected public launch flags

## No sensitive data in logs

No sensitive data in logs:

- redact Authorization headers
- redact cookies
- redact access tokens
- redact refresh tokens
- redact service-role keys
- redact signed URL query tokens
- redact private key blocks
- redact local filesystem paths

Public launch remains blocked until Phase 181 final go/no-go.
