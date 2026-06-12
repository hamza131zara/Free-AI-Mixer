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
FREE_AI_MIXER_STORAGE_BUCKET_ARTIFACTS=<managed-by-host>
FREE_AI_MIXER_STORAGE_BUCKET_UPLOADS=<managed-by-host>

Do not commit real values.

## Supabase project checklist

Supabase project checklist: RLS policies reviewed before production rollout; RLS policies applied only through audited production process; Storage bucket exists; Storage bucket is private by default; Anon key only is allowed for client-safe contexts; Service-role key stays backend-secret only; Signed URLs remain short-lived and backend-generated only.

## No secrets committed

No secrets committed: no .env; no service-role key; no private key block; no production token; no public launch flag; no raw signed URL token committed.

Public launch remains blocked until Phase 181 final go/no-go.

## Launch Block 6 production deployment boundary

Production deployment remains manual and checklist-driven. This project does not auto-deploy, auto-apply remote migrations, inject real secrets, or enable live providers from application startup.

Required deployment shape:

- Frontend static hosting serves the Vite `dist` output from `npm run build`.
- Backend Node service hosting runs `npm run backend:start` with server-only environment variables.
- Hosted Supabase setup is manual: review migrations, apply them through an audited Supabase process, verify private buckets, and keep the service-role key backend-only.
- Production CORS must use `FREE_AI_MIXER_ALLOWED_ORIGINS`; production must not rely on wildcard origins.
- `/monitoring/health`, `/monitoring/readiness`, and `/monitoring/deployment-readiness` are the safe JSON readiness checks.

Rollback steps:

- Revert the frontend hosting deployment to the previous build.
- Revert the backend service revision to the previous image/release.
- Disable real provider and artifact delivery gates before rollback smoke if there is any uncertainty.
- Do not roll back database migrations automatically; use a reviewed Supabase rollback plan.

Smoke checklist:

- Confirm no service-role key or provider secret is present in frontend env.
- Confirm protected routes reject unauthenticated users.
- Confirm artifact delivery is backend-mediated only.
- Confirm real providers, platform-paid generation, video providers, public URLs, signed URLs, and downloads remain disabled unless separately audited.
Launch Block 7 note: before any private beta invitation or public launch decision, review [Launch Block 7 Final QA, Private Beta, And Public Launch Matrix](./launch-block7-final-qa-public-launch-matrix.md). Deployment readiness is necessary but not sufficient for public launch.
