import { randomUUID } from "node:crypto";
import { createServer } from "http";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { initializeStorage } from "./storage";
import { getSupabaseUrl } from "./supabase-config";
import { trackError } from "./observability/error-tracker";
import { logEvent } from "./observability/logger";
import { getMetricsSnapshot, recordHttpMetric } from "./observability/metrics";

export type BootstrapMode = "production-static" | "development-vite" | "api-only";

export interface BootstrapOptions {
  mode?: BootstrapMode;
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

function parseNumericEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return fallback;
}

function getAllowedCorsOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return new Set(configured);
  }

  if (process.env.NODE_ENV !== "production") {
    return new Set([
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
  }

  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  return new Set(appBaseUrl ? [appBaseUrl] : []);
}

function getHelmetConfig() {
  if (process.env.NODE_ENV !== "production") {
    return {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    } as const;
  }

  const supabaseUrl = getSupabaseUrl() ?? "";
  let supabaseOrigin = "";
  try {
    supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {
    supabaseOrigin = "";
  }

  const connectSrc = ["'self'", "https://*.supabase.co"];
  if (supabaseOrigin) {
    connectSrc.push(supabaseOrigin);
  }

  return {
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://unpkg.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.supabase.co",
          "https://*.renthub.in.th",
          "https://*.basemaps.cartocdn.com",
          "https://*.tile.openstreetmap.org",
        ],
        connectSrc,
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  } as const;
}

function isMetricsRequestAuthorized(req: Request) {
  const expectedKey = process.env.METRICS_API_KEY?.trim();
  if (!expectedKey) {
    return process.env.NODE_ENV !== "production";
  }

  return req.header("x-metrics-key") === expectedKey;
}

function resolveMode(mode: BootstrapMode | undefined): BootstrapMode {
  if (mode) {
    return mode;
  }
  return process.env.NODE_ENV === "production"
    ? "production-static"
    : "development-vite";
}

export async function bootstrapApp(options: BootstrapOptions = {}) {
  const app = express();
  const httpServer = createServer(app);

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  const allowedOrigins = getAllowedCorsOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-Id",
        "X-Metrics-Key",
      ],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 60 * 10,
    }),
  );

  app.use(helmet(getHelmetConfig()));

  const isProduction = process.env.NODE_ENV === "production";
  const apiLimiter = rateLimit({
    windowMs: parseNumericEnv(
      process.env.API_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
    ),
    limit: parseNumericEnv(
      process.env.API_RATE_LIMIT_MAX,
      isProduction ? 120 : 500,
    ),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => !req.path.startsWith("/api"),
  });
  app.use(apiLimiter);

  const logAllHttpRequests = parseBooleanEnv(
    process.env.LOG_ALL_HTTP_REQUESTS,
    isProduction,
  );
  const includeHttpUserAgent = parseBooleanEnv(
    process.env.LOG_INCLUDE_HTTP_USER_AGENT,
    false,
  );
  const slowRequestThresholdMs = parseNumericEnv(
    process.env.LOG_SLOW_REQUEST_MS,
    1000,
  );

  app.use((req, res, next) => {
    const requestId = req.header("x-request-id")?.trim() || randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/metrics", (req, res) => {
    if (!isMetricsRequestAuthorized(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(getMetricsSnapshot());
  });

  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const route = req.route?.path
        ? `${req.baseUrl}${String(req.route.path)}`
        : req.path;
      recordHttpMetric({
        method: req.method,
        route,
        statusCode: res.statusCode,
        latencyMs: duration,
      });

      if (req.path.startsWith("/api")) {
        const shouldLog =
          logAllHttpRequests ||
          res.statusCode >= 400 ||
          duration >= slowRequestThresholdMs;
        if (!shouldLog) {
          return;
        }

        const level =
          res.statusCode >= 500
            ? "error"
            : res.statusCode >= 400
              ? "warn"
              : "info";
        logEvent(level, "http_request", {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          route,
          statusCode: res.statusCode,
          latencyMs: duration,
          ip: req.ip,
          ...(includeHttpUserAgent
            ? { userAgent: req.get("user-agent") ?? "" }
            : {}),
          slow: duration >= slowRequestThresholdMs,
        });
      }
    });

    next();
  });

  await initializeStorage();
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    trackError(err, {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      status,
    });

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  const mode = resolveMode(options.mode);
  if (mode === "production-static") {
    serveStatic(app);
  } else if (mode === "development-vite") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  return { app, httpServer };
}
