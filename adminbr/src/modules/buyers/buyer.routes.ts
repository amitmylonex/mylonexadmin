import { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../auth/verify-admin.js";
import * as service from "./buyer.service.js";
export async function buyerRoutes(app: FastifyInstance, handlers = service) {
  const auth = { preHandler: [requireAdminAuth] };
  app.get("/api/v1/admin/buyers", auth, (r) => handlers.list(r.query));
  app.get("/api/v1/admin/buyers/:id", auth, (r) =>
    handlers.detail(r.params, r.query),
  );
}
