import { expect, test } from "@playwright/test";
import { resolveAuditTrailTaxonomy } from "../../backend/observability/auditTrailContracts";
import { resolveEventLogTaxonomy } from "../../backend/observability/eventLogContracts";

test.describe("product phase 20 audit trail contract boundary", () => {
  test("audit taxonomy stays separate from analytics events and remains append-only later", () => {
    const auditTaxonomy = resolveAuditTrailTaxonomy();
    const eventTaxonomy = resolveEventLogTaxonomy();

    expect(auditTaxonomy).toMatchObject({
      kind: "audit_trail_taxonomy",
      appendOnlyLater: true,
      persistenceEnabled: false,
      routeHooksEnabled: false,
      workerHooksEnabled: false,
    });

    expect(auditTaxonomy.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditType: "provider_key_mutation_attempted",
          category: "provider_key_security",
          safeToPersistNow: false,
        }),
        expect.objectContaining({
          auditType: "admin_route_access_attempted",
          category: "admin_access",
          safeToPersistNow: false,
        }),
        expect.objectContaining({
          auditType: "billing_sensitive_action_attempted",
          category: "billing_sensitive_action",
          safeToPersistNow: false,
        }),
      ]),
    );

    expect(eventTaxonomy.entries.some((entry) => entry.category === "admin_access")).toBe(
      false,
    );
  });
});
