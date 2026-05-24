import { expect, test } from "@playwright/test";
import { createSafeStructuredLogEvent } from "../../backend/observability/safeStructuredLogger";
import { sanitizeSafeEventMetadata } from "../../backend/observability/safeEventSanitizer";

test.describe("product phase 20 event redaction boundary", () => {
  test("unsafe event metadata is sanitized and marked rejected", () => {
    const sanitization = sanitizeSafeEventMetadata({
      authorization: "Bearer eyJhbGciOiJSUzI1NiJ9.payload.signature",
      cookie: "sb-access-token=access-secret; sb-refresh-token=refresh-secret",
      prompt: "draw a cinematic dragon city at sunset",
      encryptedPayload: "ciphertext-value",
      serviceRoleKey: "supabase_service_role_real_secret",
      providerSignedUrl:
        "https://example.com/object?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=secret",
      localPath: "C:\\Users\\Super\\secret.mp4",
      nested: {
        apiKey: "sk-super-secret",
        "x-user-id": "spoof-user",
      },
    });

    const serialized = JSON.stringify(sanitization);

    expect(sanitization.rejected).toBe(true);
    expect(serialized).not.toContain("Bearer eyJhbGciOiJSUzI1NiJ9");
    expect(serialized).not.toContain("sb-access-token=access-secret");
    expect(serialized).not.toContain("draw a cinematic dragon city at sunset");
    expect(serialized).not.toContain("ciphertext-value");
    expect(serialized).not.toContain("supabase_service_role_real_secret");
    expect(serialized).not.toContain("X-Amz-Signature=secret");
    expect(serialized).not.toContain("C:\\Users\\Super\\secret.mp4");
    expect(serialized).not.toContain("sk-super-secret");
    expect(serialized).not.toContain("spoof-user");
  });

  test("structured logger reuses the same redaction boundary for event-like payloads", () => {
    const event = createSafeStructuredLogEvent({
      event: "phase20.redaction.boundary",
      severity: "warn",
      metadata: {
        rawPrompt: "never store this prompt",
        jwt: "eyJhbGciOiJSUzI1NiJ9.payload.signature",
        path: "C:\\sensitive\\video.mov",
        signedUrl:
          "https://example.com/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=secret",
      },
    });

    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain("never store this prompt");
    expect(serialized).not.toContain("eyJhbGciOiJSUzI1NiJ9.payload.signature");
    expect(serialized).not.toContain("C:\\sensitive\\video.mov");
    expect(serialized).not.toContain("X-Amz-Signature=secret");
    expect(event.redactedFields.length).toBeGreaterThan(0);
  });
});
