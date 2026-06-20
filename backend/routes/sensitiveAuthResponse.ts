import type { ErrorRequestHandler, RequestHandler, Response } from "express";

export const sensitiveAuthCacheControlValue =
  "private, no-store, max-age=0, must-revalidate";

export const setSensitiveAuthResponseHeaders = (
  response: Response,
): void => {
  response.setHeader("Cache-Control", sensitiveAuthCacheControlValue);
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
};

export const applySensitiveAuthResponseHeaders: RequestHandler = (
  _request,
  response,
  next,
) => {
  setSensitiveAuthResponseHeaders(response);
  next();
};

export const createSensitiveAuthErrorHandler = (options: {
  kind: "auth" | "account";
}): ErrorRequestHandler => {
  return (_error, _request, response, next) => {
    setSensitiveAuthResponseHeaders(response);

    if (response.headersSent) {
      next(_error);
      return;
    }

    if (options.kind === "auth") {
      response.status(503).json({
        kind: "auth_unavailable",
        status: "auth_provider_unavailable",
        message: "Authentication is temporarily unavailable.",
      });
      return;
    }

    response.status(503).json({
      kind: "bootstrap_unavailable",
      status: "bootstrap_unavailable",
      message: "Account bootstrap is temporarily unavailable.",
    });
  };
};
