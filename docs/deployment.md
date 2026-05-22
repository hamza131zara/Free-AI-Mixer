# Production Deployment Readiness

Phase 178 documents the production environment and deployment pipeline checklist.

This document is a readiness checklist only. It does not approve public launch by itself.

## Production deployment commands

Frontend build command: npm run build

Backend start command: npm run backend:start

Verification before deploy: npm run typecheck, npm run build, npm run test:e2e, git status --short

## Frontend hosting

Frontend hosting should serve the Vite dist output after npm run build.

Frontend rules: do not expose service-role keys; do not add a frontend Supabase client; do not directly access Supabase storage from frontend; use backend-approved artifact descriptors only; browser navigation must remain user-triggered only.

## Backend hosting

Backend hosting should run npm run backend:start.

Backend rules: backend owns auth, authorization, storage verification, signed URL generation, and artifact delivery decisions; backend must fail closed when config is missing; backend must not log secrets; backend must not expose local filesystem paths; backend must not generate fake success or fake signed URLs.

## Required production environment variables

NODE_ENV=production
FREE_AI_MIXER_AUTH_PROVIDER=jwt
FREE_AI_MIXER_AUTH_ISSUER=<managed-by-host>
FREE_AI_MIXER_AUTH_AUDIENCE=<managed-by-host>
FREE_AI_MIXER_AUTH_JWKS_URI=<managed-by-host>
FREE_AI_MIXER_SUPABASE_URL=<managed-by-host>
FREE_AI_MIXER_SUPABASE_ANON_KEY=<managed-by-host>
FREE_AI_MIXER_SUPABASE_STORAGE_BUCKET=<managed-by-host>

Do not commit real values.

## Supabase project checklist

Supabase project checklist: RLS policies reviewed before production rollout; RLS policies applied only through audited production process; Storage bucket exists; Storage bucket is private by default; Anon key only is allowed for client-safe contexts; Service-role key stays backend-secret only; Signed URLs remain short-lived and backend-generated only.

## No secrets committed

No secrets committed: no .env; no service-role key; no private key block; no production token; no public launch flag; no raw signed URL token committed.

Public launch remains blocked until Phase 181 final go/no-go.
