import express, { type Express } from "express";
import { exportErrorHandler } from "./errors/exportErrors";
import { createExportRouter } from "./routes/exports";
import { createBackendDependencies } from "./composition/backendDependencies";

export const createApp = (): Express => {
  const app = express();
  const backendDeps = createBackendDependencies();

  app.use(express.json());
  app.use(createExportRouter(backendDeps.registry));
  app.use(exportErrorHandler);

  return app;
};
