import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export interface ExportApiErrorBody {
  code:
    | "invalid_export_request"
    | "export_job_not_found"
    | "renderer_unavailable"
    | "export_artifacts_unavailable"
    | "internal_export_error";
  message: string;
  details?: unknown;
}

export class ExportApiError extends Error {
  public readonly status: number;
  public readonly body: ExportApiErrorBody;

  constructor(status: number, body: ExportApiErrorBody) {
    super(body.message);
    this.name = "ExportApiError";
    this.status = status;
    this.body = body;
  }
}

export const invalidExportRequest = (
  message: string,
  details?: unknown,
): ExportApiError =>
  new ExportApiError(400, {
    code: "invalid_export_request",
    message,
    details,
  });

export const exportJobNotFound = (jobId: string): ExportApiError =>
  new ExportApiError(404, {
    code: "export_job_not_found",
    message: "Export job was not found.",
    details: { jobId },
  });

export const exportArtifactsUnavailable = (jobId: string): ExportApiError =>
  new ExportApiError(409, {
    code: "export_artifacts_unavailable",
    message: "Export artifacts are not available for this job.",
    details: { jobId },
  });

export const internalExportError = (details?: unknown): ExportApiError =>
  new ExportApiError(500, {
    code: "internal_export_error",
    message: "Internal export error.",
    details,
  });

export const exportErrorHandler = (
  error: unknown,
  _request: Request,
  response: Response<ExportApiErrorBody>,
  _next: NextFunction,
): void => {
  if (error instanceof ExportApiError) {
    response.status(error.status).json(error.body);
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      code: "invalid_export_request",
      message: "Export request validation failed.",
      details: error.flatten(),
    });
    return;
  }

  if (error instanceof SyntaxError) {
    response.status(400).json({
      code: "invalid_export_request",
      message: "Malformed JSON body.",
    });
    return;
  }

  const fallback = internalExportError(
    error instanceof Error ? { message: error.message } : error,
  );
  response.status(fallback.status).json(fallback.body);
};
