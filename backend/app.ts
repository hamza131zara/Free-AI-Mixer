import express, { type Express } from "express";
import { exportErrorHandler } from "./errors/exportErrors";
import { InMemoryExportJobRegistry } from "./registry/exportJobRegistry";
import { createExportRouter } from "./routes/exports";

export const createApp = (): Express => {
  const app = express();
  const registry = new InMemoryExportJobRegistry();

  app.use(express.json());
  app.use(createExportRouter(registry));
  app.use(exportErrorHandler);

  return app;
};
