import { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../auth/verify-admin.js";
import { dashboard, platformWidget, buyerWidget, moderationWidget } from "./dashboard.service.js";
export async function dashboardRoutes(app: FastifyInstance, handlers = { dashboard, platformWidget, buyerWidget, moderationWidget }) {
  app.get("/api/v1/admin/dashboard", { preHandler: [requireAdminAuth] }, () =>
    handlers.dashboard(),
  );
  app.get("/api/v1/admin/dashboard/platform", { preHandler: [requireAdminAuth] }, async () => ({ platformMetrics: await handlers.platformWidget() }));
  app.get("/api/v1/admin/dashboard/buyers", { preHandler: [requireAdminAuth] }, async () => ({ buyerMetrics: await handlers.buyerWidget() }));
  app.get("/api/v1/admin/dashboard/moderation", { preHandler: [requireAdminAuth] }, () => handlers.moderationWidget());
}
