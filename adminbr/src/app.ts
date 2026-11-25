import {receiptBridgeRoutes} from "./modules/notifications/receipt-bridge.routes.js";
import {catalogLegacyRoutes} from "./modules/catalog/catalog-legacy.routes.js";
import {quoteRoutes} from "./modules/quotes/quote.routes.js";
import {orderRoutes} from "./modules/orders/order.routes.js";
import { PublicError } from "./common/errors/public-error.js";
import { checkDatabaseSchema } from "./infrastructure/readiness.js";
import { ZodError } from "zod";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import { randomUUID } from "node:crypto";
import { parseRuntime } from "./config/runtime.js";
import { MemoryCache } from "./shared/cache/ttl-cache.js";
import { apiError } from "./common/errors/api-error.js";
import { createAdminAuthenticator, type AdminSessionResolver } from "./modules/auth/verify-admin.js";
import { config } from "./config.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { supplierRoutes } from "./modules/suppliers/supplier.routes.js";
import { buyerRoutes } from "./modules/buyers/buyer.routes.js";
import { rfqRoutes,moderationRoutes } from "./modules/rfqs/routes.js";
import { sampleRoutes } from "./modules/samples/sample.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { catalogActionsRoutes } from "./modules/catalog/catalog-actions.routes.js";

declare module "fastify" {
  interface FastifyInstance { authenticate: ReturnType<typeof createAdminAuthenticator> }
}
export function buildApp(options: { resolveSession?: AdminSessionResolver; checkSchema?: typeof checkDatabaseSchema;
  dashboardHandlers?: Parameters<typeof dashboardRoutes>[1]; catalogActions?: Parameters<typeof catalogActionsRoutes>[1]; buyerHandlers?: Parameters<typeof buyerRoutes>[1]; moderationHandlers?: Parameters<typeof moderationRoutes>[1]; quoteHandlers?: Parameters<typeof quoteRoutes>[1]; rfqHandlers?: Parameters<typeof rfqRoutes>[1]; receiptRecorder?: Parameters<typeof receiptBridgeRoutes>[1]; sampleHandlers?: Parameters<typeof sampleRoutes>[1] } = {}) {
  const runtime = parseRuntime(process.env);
  const readiness = new MemoryCache(1);
  const app = Fastify({
    bodyLimit: runtime.bodyLimit,
    requestTimeout: runtime.requestTimeout,
    trustProxy: runtime.trustProxy,
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    disableRequestLogging: true,
    logger: {
      serializers: { req: req => ({ method: req.method }), err: () => ({ type: "Error", message: "Internal error", stack: "" }) },
      redact: ["req.headers.authorization", "req.headers.cookie", "req.headers.x-mylonex-signature", "password", "token"],
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  app.setErrorHandler((error, request, reply) => {
    const code = (error as any).code;
    if (error instanceof ZodError) return reply.code(400).send(apiError(400, "Request validation failed", "VALIDATION_ERROR", error.issues.map(i => ({ path: i.path.join("."), message: i.message }))));
    if (code === "P2022" || code === "P2021") return reply.code(503).send(apiError(503, "Database schema compatibility repair is required. Contact the administrator.", "DATABASE_SCHEMA_UNAVAILABLE"));
    if (code === "P2002") return reply.code(409).send(apiError(409, "A record with these unique values already exists."));
    const httpError = error as { statusCode?: number; message: string };
    const status = error instanceof PublicError ? error.statusCode : httpError.statusCode && httpError.statusCode >= 400 && httpError.statusCode < 500 ? httpError.statusCode : 500;
    if (status === 500) request.log.error({ requestId: request.id }, "Request failed");
    return reply.code(status).send(apiError(status, status >= 500 && !(error instanceof PublicError) ? "Unable to complete this request. Please retry or contact support." : httpError.message));
  });
  app.addHook("preSerialization", async (request,reply,payload) => {
    if(payload && typeof payload === "object" && !Array.isArray(payload) && !Buffer.isBuffer(payload)) {
      const body = payload as Record<string, any>;
      if (reply.statusCode >= 400) {
        const existing = body.error;
        const message = typeof existing === "string" ? existing : existing?.message || (reply.statusCode === 404 ? "Route not found" : "Request could not be completed");
        return { ...body, ...apiError(reply.statusCode, message, existing?.code, existing?.details ?? null), ok: false, requestId: request.id };
      }
      return {...body, success:true,ok:true,requestId:request.id};
    }
    return payload;
  });
  app.addHook("onSend", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
    reply.header("Cache-Control", "no-store");
  });
  app.addHook("onResponse", async (request, reply) => {
    request.log.info({ method: request.method, route: request.routeOptions.url || "unmatched",
      statusCode: reply.statusCode, elapsedMs: reply.elapsedTime }, "Request completed");
  });
  app.get("/ready", async (_request, reply) => {
    try { const missing = await readiness.remember("schema", 5000, options.checkSchema || checkDatabaseSchema); if (missing.length) return reply.code(503).send({ ...apiError(503, "Database schema upgrade required", "DATABASE_SCHEMA_UNAVAILABLE"), status: "unavailable" }); return { status: "ready" }; }
    catch { return reply.code(503).send({ ...apiError(503, "Database unavailable", "DATABASE_UNAVAILABLE"), status: "unavailable" }); }
  });
  // Enable CORS for adminfr (Vite SPA on port 5173)
  app.register(cors, {
    origin: runtime.origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    exposedHeaders: ["X-Request-Id"],
  });
  app.register(helmet);
  app.register(compress, { threshold: 2048, encodings: ["gzip", "deflate"], customTypes: /^application\/json/ });
  app.decorate("authenticate", createAdminAuthenticator(options.resolveSession));
  // onRequest runs before body parsing: every method and future admin route is guarded.
  app.after(() => app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?")[0];
    if (request.method !== "OPTIONS" && /^\/api\/v1\/admin(?:\/|$)/.test(pathname)) {
      return app.authenticate(request, reply);
    }
  }));

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Register all modules
  app.register(authRoutes);
  app.register(async scope => receiptBridgeRoutes(scope,options.receiptRecorder));
  app.register(async scope => dashboardRoutes(scope, options.dashboardHandlers));
  app.register(supplierRoutes);
  app.register(async scope => { await buyerRoutes(scope, options.buyerHandlers); });
  app.register(async scope => rfqRoutes(scope, options.rfqHandlers));
  app.register(async scope => moderationRoutes(scope, options.moderationHandlers));
  app.register(async scope => sampleRoutes(scope, options.sampleHandlers));
  app.register(async scope => quoteRoutes(scope, options.quoteHandlers));
  app.register(orderRoutes);
  app.register(catalogRoutes);
  app.register(async scope => { catalogActionsRoutes(scope, options.catalogActions); });
  app.register(catalogLegacyRoutes);

  return app;
}
