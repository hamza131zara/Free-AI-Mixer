import { expect, test } from "@playwright/test";
import { sanitizeSafeEventMetadata } from "../../backend/observability/safeEventSanitizer";

const fakeSecret = "FAKE_PHASE34_BYOK_SECRET_DO_NOT_STORE";
const fakeServiceRole = "supabase_service_role_FAKE_PHASE34_DO_NOT_STORE";
const fakeBearer = "Bearer FAKE_PHASE34_TOKEN_DO_NOT_STORE";
const fakeJwt = "header.payload.signature";

test.describe("phase34 BYOK secret redaction boundary", () => {
  test("redacts BYOK provider key field names and encrypted or referenced secrets", () => {
    const result = sanitizeSafeEventMetadata({
      apiKey: fakeSecret,
      providerKey: fakeSecret,
      plaintextKey: fakeSecret,
      replacementPlaintextKey: fakeSecret,
      encryptedPayload: "ciphertext-should-not-log",
      secretRef: "vault/ref/should-not-log",
      nested: {
        api_key: fakeSecret,
        provider_key: fakeSecret,
        plaintext_key: fakeSecret,
        replacement_plaintext_key: fakeSecret,
        encrypted_payload: "ciphertext-nested-should-not-log",
        secret_ref: "vault/ref/nested-should-not-log",
      },
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(fakeSecret);
    expect(serialized).not.toContain("ciphertext-should-not-log");
    expect(serialized).not.toContain("vault/ref/should-not-log");
    expect(result.rejected).toBe(true);
    expect(result.redactedFields).toEqual(
      expect.arrayContaining([
        "apiKey",
        "providerKey",
        "plaintextKey",
        "replacementPlaintextKey",
        "encryptedPayload",
        "secretRef",
        "nested.api_key",
        "nested.provider_key",
        "nested.plaintext_key",
        "nested.replacement_plaintext_key",
        "nested.encrypted_payload",
        "nested.secret_ref",
      ]),
    );
  });

  test("redacts auth session token headers and service-role-like values", () => {
    const result = sanitizeSafeEventMetadata({
      Authorization: fakeBearer,
      Cookie: "sb-access-token=FAKE_PHASE34_COOKIE_DO_NOT_STORE",
      session: fakeJwt,
      token: fakeJwt,
      serviceRoleKey: fakeServiceRole,
      service_role: fakeServiceRole,
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(fakeBearer);
    expect(serialized).not.toContain("FAKE_PHASE34_COOKIE_DO_NOT_STORE");
    expect(serialized).not.toContain(fakeJwt);
    expect(serialized).not.toContain(fakeServiceRole);
    expect(result.rejected).toBe(true);
    expect(result.redactedFields).toEqual(
      expect.arrayContaining([
        "Authorization",
        "Cookie",
        "session",
        "token",
        "serviceRoleKey",
        "service_role",
      ]),
    );
  });

  test("redacts raw provider error body style fields", () => {
    const result = sanitizeSafeEventMetadata({
      providerError: "provider says key invalid: FAKE_PHASE34_PROVIDER_ERROR",
      provider_error: "raw provider response should not log",
      rawProviderError: "upstream body contains account metadata",
      raw_provider_error: "upstream raw body contains credentials",
      errorBody: "provider error body should not log",
      error_body: "provider error body snake should not log",
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("FAKE_PHASE34_PROVIDER_ERROR");
    expect(serialized).not.toContain("raw provider response should not log");
    expect(serialized).not.toContain("account metadata");
    expect(serialized).not.toContain("credentials");
    expect(serialized).not.toContain("provider error body should not log");
    expect(result.rejected).toBe(true);
    expect(result.redactedFields).toEqual(
      expect.arrayContaining([
        "providerError",
        "provider_error",
        "rawProviderError",
        "raw_provider_error",
        "errorBody",
        "error_body",
      ]),
    );
  });
});
