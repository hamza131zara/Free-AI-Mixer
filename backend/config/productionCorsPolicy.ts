import type { RequestHandler } from "express";

export interface ProductionCorsPolicy {
  allowedOrigins: string[];
  mode: "local_friendly" | "production_explicit" | "production_blocked";
}

export type ProductionCorsEnv = Record<string, string | undefined>;

const splitOrigins = (value: string | undefined): string[] =>
  typeof value === "string"
    ? value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : [];

export const readProductionCorsPolicy = (
  env: ProductionCorsEnv = process.env,
): ProductionCorsPolicy => {
  const isProduction = env.NODE_ENV === "production";
  const allowedOrigins = splitOrigins(env.FREE_AI_MIXER_ALLOWED_ORIGINS);

  if (!isProduction) {
    return {
      allowedOrigins,
      mode: "local_friendly",
    };
  }

  if (allowedOrigins.length === 0) {
    return {
      allowedOrigins: [],
      mode: "production_blocked",
    };
  }

  return {
    allowedOrigins,
    mode: "production_explicit",
  };
};

export const createProductionCorsMiddleware = (
  policy: ProductionCorsPolicy = readProductionCorsPolicy(),
): RequestHandler => {
  return (request, response, next) => {
    const origin = request.headers.origin;

    if (!origin) {
      next();
      return;
    }

    if (
      policy.mode === "local_friendly" ||
      policy.allowedOrigins.includes(origin)
    ) {
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      response.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
      );

      if (request.method === "OPTIONS") {
        response.sendStatus(204);
        return;
      }

      next();
      return;
    }

    if (request.method === "OPTIONS") {
      response.sendStatus(403);
      return;
    }

    next();
  };
};
