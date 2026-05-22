# Storage Policy, Backup and Recovery

Phase 180 documents storage policy, backup, artifact retention, cleanup, and disaster recovery readiness.

This document is a readiness checklist only. It does not approve public launch by itself.

## Storage bucket policy

Storage bucket policy:

- artifact buckets must be private by default
- no public bucket is allowed for production artifacts
- browser access must use backend-approved signed URL descriptors only
- service-role credentials must remain backend-secret only
- frontend must not access Supabase storage directly

## Signed URL TTL policy

Signed URL TTL policy:

- signed URLs must be short-lived
- signed URLs must be backend-generated
- expired descriptors must be blocked by the frontend navigation strategy
- signed URL tokens must not be logged or committed

## Artifact retention strategy

Artifact retention strategy:

- define a retention window for successful artifacts
- keep retention changes manual review until automated cleanup is audited
- keep metadata path-free and safe for frontend descriptors
- do not delete artifacts without verified ownership/workspace context

## Failed artifact cleanup

Failed artifact cleanup:

- failed exports should be eligible for safe cleanup
- safe cleanup must verify job ownership, artifact metadata, and storage reference
- cleanup must not expose local paths or signed URL tokens
- cleanup automation remains deferred until audited

## Database backup expectations

Database backup expectations:

- production database should use scheduled backups
- point-in-time recovery should be available before launch
- backup status should be checked before major deployment
- restore access must be limited to trusted operators only

## Database restore plan

Database restore plan:

- run a restore drill before public launch
- maintain a rollback checklist for deployment failure
- verify restored export_jobs and artifact metadata integrity
- verify workspace/owner access after restore

## Disaster recovery notes

Disaster recovery notes:

- define incident response steps
- define recovery owner and escalation path
- preserve audit logs where available
- communicate downtime and recovery status clearly
- public launch remains blocked until Phase 181 final go/no-go
