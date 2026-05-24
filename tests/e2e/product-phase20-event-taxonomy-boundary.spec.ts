import { expect, test } from "@playwright/test";
import { resolveEventLogTaxonomy } from "../../backend/observability/eventLogContracts";

test.describe("product phase 20 event taxonomy boundary", () => {
  test("event taxonomy stays readiness-only and separates future categories", () => {
    const taxonomy = resolveEventLogTaxonomy();

    expect(taxonomy).toMatchObject({
      kind: "event_log_taxonomy",
      liveEventEmissionEnabled: false,
      persistenceEnabled: false,
      routeHooksEnabled: false,
      workerHooksEnabled: false,
      creditAndBillingSeparated: true,
    });

    expect(taxonomy.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "login_attempted",
          category: "auth_account",
          safeToEmitNow: false,
        }),
        expect.objectContaining({
          eventType: "provider_key_added",
          category: "byok_provider",
          safeToEmitNow: false,
        }),
        expect.objectContaining({
          eventType: "generation_succeeded",
          category: "generation_export",
          safeToEmitNow: false,
          requiredPrerequisites: ["generation runtime truth"],
        }),
        expect.objectContaining({
          eventType: "credits_settled",
          category: "credits_billing",
          safeToEmitNow: false,
          requiredPrerequisites: ["credit ledger runtime"],
        }),
        expect.objectContaining({
          eventType: "operational_error_detected",
          category: "operational_error",
          safeToEmitNow: false,
        }),
      ]),
    );
  });
});
