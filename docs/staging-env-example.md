# Staging Environment Example

## Purpose

This is a documentation-only staging environment example. It lists expected variable names and placeholder values for a private beta staging dry run.

Do not copy real secrets into this file. Do not commit real staging, production, SMTP, provider, webhook, JWT, database, service-role, or tester credentials.

This file is not deployment automation and is not public launch approval.

## Frontend Public Variables

Only public client configuration belongs in the frontend environment.

```text
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=replace-with-staging-public-anon-key-from-secret-manager
VITE_SCENE_API_BASE_URL=https://your-staging-backend.example.invalid
VITE_SCENE_GENERATION_PATH=/scenes/generate
```

Never add `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`, SMTP credentials, provider API keys, webhook secrets, JWT secrets, or admin secrets to frontend variables.

## Backend Server-Only Variables

Backend-only variables must live in the staging backend secret manager or deployment environment, not in frontend config.

```text
FREE_AI_MIXER_AUTH_RUNTIME_ENABLED=1
FREE_AI_MIXER_AUTH_PROVIDER=jwt
FREE_AI_MIXER_AUTH_ISSUER=https://your-staging-project.supabase.co/auth/v1
FREE_AI_MIXER_AUTH_AUDIENCE=authenticated
FREE_AI_MIXER_AUTH_JWKS_URI=https://your-staging-project.supabase.co/auth/v1/.well-known/jwks.json
FREE_AI_MIXER_AUTH_JWT_KEY_MODE=remote_jwks
FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=ES256
FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED=1

FREE_AI_MIXER_ENABLE_SUPABASE_DB=1
FREE_AI_MIXER_DB_PROVIDER=supabase
FREE_AI_MIXER_SUPABASE_URL=https://your-staging-project.supabase.co
FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=replace-with-server-only-service-role-secret
```

The service-role value is server-only. Never expose it through `VITE_*`, browser code, screenshots, issue reports, docs, tests, or logs.

`FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS` must match the hosted Supabase project's active JWT signing key. Current hosted staging uses ECC P-256 / ES256. If Supabase signing configuration changes later, update the allow-list intentionally after confirming the token header and JWKS support.

## Opt-In Real Auth Smoke Variables

Use only approved staging smoke accounts.

```text
FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE=1
FREE_AI_MIXER_REAL_AUTH_SMOKE_EMAIL=dedicated-staging-smoke-user@example.invalid
FREE_AI_MIXER_REAL_AUTH_SMOKE_PASSWORD=replace-with-dedicated-smoke-password-from-secret-manager
```

Do not use personal, admin, customer, or production owner accounts for smoke testing.

## Variables That Must Not Be Committed

- SMTP passwords or SMTP connection strings.
- Provider API keys.
- Service-role keys.
- JWT signing secrets.
- Webhook secrets.
- Database passwords or connection strings.
- Tester passwords.
- Confirmation links, recovery links, URL hashes, access tokens, refresh tokens, or raw JWTs.

## Dry-Run Reminder

The staging publish dry run is manual and gated. It proves readiness posture only; it does not deploy, enable public launch, enable live BYOK, enable credits/billing, enable provider SDK calls, or enable public artifact delivery.

## Launch Block 6 Deployment Readiness Variables

```text
NODE_ENV=production
FREE_AI_MIXER_ALLOWED_ORIGINS=https://your-staging-frontend.example.invalid
FREE_AI_MIXER_PRODUCTION_ARTIFACT_DELIVERY_MODE=not_configured
FREE_AI_MIXER_CREDITS_RUNTIME_ENABLED=0
FREE_AI_MIXER_BILLING_RUNTIME_ENABLED=0
FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED=0
FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS=0
FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE=disabled
FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED=0
```

Keep mock/local-only generation modes, real providers, platform-paid generation, video providers, public URLs, signed URLs, and downloads disabled unless a later audited block explicitly enables them.
