import { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../auth/verify-admin.js";
import { dashboard } from "./dashboard.service.js";
export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/dashboard", { preHandler: [requireAdminAuth] }, () =>
    dashboard(),
  );
}
