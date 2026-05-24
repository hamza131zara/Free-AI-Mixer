import { expect, test } from "@playwright/test";
import { createNotConfiguredAuditTrailRecorder } from "../../backend/observability/notConfiguredAuditTrailRecorder";
import { createNotConfiguredEventRecorder } from "../../backend/observability/notConfiguredEventRecorder";

test.describe("product phase 20 noop event recorder boundary", () => {
  test("event and audit recorders are not-configured by default and do not persist safe payloads", async () => {
    const eventRecorder = createNotConfiguredEventRecorder();
    const auditRecorder = createNotConfiguredAuditTrailRecorder();

    expect(eventRecorder.getReadiness()).toMatchObject({
      kind: "event_recorder_not_configured",
      persistenceEnabled: false,
      liveRecordingEnabled: false,
    });

    expect(auditRecorder.getReadiness()).toMatchObject({
      kind: "audit_trail_not_configured",
      persistenceEnabled: false,
      liveRecordingEnabled: false,
      appendOnlyLater: true,
    });

    await expect(
      eventRecorder.record({
        eventId: "evt_safe_1",
        eventType: "admin_status_viewed",
        occurredAt: "2026-05-24T00:00:00.000Z",
        actorKind: "platform_operator",
        actorUserId: "user_internal_1",
        outcome: "attempted",
        source: "backend_admin",
        metadata: {
          note: "future admin readiness view only",
        },
      }),
    ).resolves.toMatchObject({
      kind: "not_recorded",
      persisted: false,
      reason: "not_configured",
    });

    await expect(
      auditRecorder.record({
        eventId: "aud_safe_1",
        eventType: "admin_route_access_attempted",
        occurredAt: "2026-05-24T00:00:00.000Z",
        actorKind: "platform_operator",
        actorUserId: "user_internal_1",
        outcome: "attempted",
        source: "backend_admin",
        metadata: {
          note: "future admin route access audit only",
        },
      }),
    ).resolves.toMatchObject({
      kind: "not_recorded",
      persisted: false,
      reason: "not_configured",
    });
  });

  test("unsafe event and audit payloads are rejected fail closed", async () => {
    const eventRecorder = createNotConfiguredEventRecorder();
    const auditRecorder = createNotConfiguredAuditTrailRecorder();

    await expect(
      eventRecorder.record({
        eventId: "evt_unsafe_1",
        eventType: "provider_key_added",
        occurredAt: "2026-05-24T00:00:00.000Z",
        actorKind: "workspace_member",
        actorUserId: "user_internal_2",
        workspaceId: "workspace_alpha",
        outcome: "attempted",
        source: "backend_route",
        metadata: {
          encryptedPayload: "ciphertext-should-never-be-stored",
          apiKey: "sk-secret-never-store",
        },
      }),
    ).resolves.toMatchObject({
      kind: "rejected",
      persisted: false,
      reason: "unsafe_fields_detected",
    });

    await expect(
      auditRecorder.record({
        eventId: "aud_unsafe_1",
        eventType: "provider_key_mutation_attempted",
        occurredAt: "2026-05-24T00:00:00.000Z",
        actorKind: "workspace_member",
        actorUserId: "user_internal_2",
        workspaceId: "workspace_alpha",
        outcome: "attempted",
        source: "backend_route",
        metadata: {
          authorization: "Bearer secret-token",
          cookie: "sb-access-token=very-secret",
        },
      }),
    ).resolves.toMatchObject({
      kind: "rejected",
      persisted: false,
      reason: "unsafe_fields_detected",
    });
  });
});
