import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "../../backend/app";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const startServer = async (): Promise<{ server: Server; baseUrl: string }> => {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

test.describe("product phase 12 card catalog boundary", () => {
  test("card catalog endpoints stay read-only and expose static template metadata only", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const catalogResponse = await fetch(`${baseUrl}/cards/catalog`);
      expect(catalogResponse.status).toBe(200);
      await expect(catalogResponse.json()).resolves.toMatchObject({
        kind: "cards_catalog",
      });

      const detailResponse = await fetch(`${baseUrl}/cards/card-birthday-confetti-frame`);
      expect(detailResponse.status).toBe(200);
      await expect(detailResponse.json()).resolves.toMatchObject({
        kind: "card_template_detail",
        template: {
          samplePreviewKind: "static_sample_only",
          safeUseLabel: "Decorative greeting card template only",
        },
      });
    } finally {
      await stopServer(server);
    }
  });

  test("card catalog boundary does not expose export share or qr execution endpoints", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const exportResponse = await fetch(`${baseUrl}/cards/export`, {
        method: "POST",
      });
      expect(exportResponse.status).toBe(404);

      const shareResponse = await fetch(`${baseUrl}/cards/share`, {
        method: "POST",
      });
      expect(shareResponse.status).toBe(404);

      const qrResponse = await fetch(`${baseUrl}/cards/qr`, {
        method: "POST",
      });
      expect(qrResponse.status).toBe(404);
    } finally {
      await stopServer(server);
    }
  });

  test("card boundary source avoids generation export delivery and billing shortcuts", async () => {
    const combinedSource = [
      readSource("backend/contracts/cardsHttpTypes.ts"),
      readSource("backend/cards/cardTemplateCatalog.ts"),
      readSource("backend/routes/cards.ts"),
      readSource("src/services/cardCatalogService.ts"),
      readSource("src/store/cardCatalogStore.ts"),
      readSource("src/types/cards.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain("generation/jobs");
    expect(combinedSource).not.toContain("/exports");
    expect(combinedSource).not.toContain("createSignedUrl");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("SERVICE_ROLE");
    expect(combinedSource).not.toContain("stripe");
    expect(combinedSource).not.toContain("paddle");
  });
});
