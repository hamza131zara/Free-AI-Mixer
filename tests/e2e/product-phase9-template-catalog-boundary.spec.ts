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

test.describe("product phase 9 template catalog boundary", () => {
  test("template catalog endpoints stay read-only and expose static planning metadata only", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const catalogResponse = await fetch(`${baseUrl}/templates/catalog`);
      expect(catalogResponse.status).toBe(200);
      await expect(catalogResponse.json()).resolves.toMatchObject({
        kind: "template_catalog",
      });

      const detailResponse = await fetch(`${baseUrl}/templates/template-social-launch-cut`);
      expect(detailResponse.status).toBe(200);
      await expect(detailResponse.json()).resolves.toMatchObject({
        kind: "template_detail",
        template: {
          sampleLabel: "Static sample content only",
        },
      });
    } finally {
      await stopServer(server);
    }
  });

  test("template catalog boundary does not expose prepare or generate execution endpoints", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const prepareResponse = await fetch(`${baseUrl}/templates/template-social-launch-cut/prepare`, {
        method: "POST",
      });
      expect(prepareResponse.status).toBe(404);

      const generateResponse = await fetch(`${baseUrl}/templates/template-social-launch-cut/generate`, {
        method: "POST",
      });
      expect(generateResponse.status).toBe(404);
    } finally {
      await stopServer(server);
    }
  });

  test("template boundary source avoids generation and export execution shortcuts", async () => {
    const combinedSource = [
      readSource("backend/contracts/templateCatalogHttpTypes.ts"),
      readSource("backend/templates/templateCatalog.ts"),
      readSource("backend/routes/templates.ts"),
      readSource("src/services/templateCatalogService.ts"),
      readSource("src/store/templateCatalogStore.ts"),
      readSource("src/types/templates.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain("generation/jobs");
    expect(combinedSource).not.toContain("/exports");
    expect(combinedSource).not.toContain("createSignedUrl");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("SERVICE_ROLE");
  });
});
