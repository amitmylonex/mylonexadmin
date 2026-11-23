import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdminAuth } from "../auth/verify-admin.js";
import { listQuerySchema, idSchema } from "../../common/pagination/query.js";
import { PublicError } from "../../common/errors/public-error.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
import * as service from "./order.service.js";
export async function orderRoutes(app: FastifyInstance) {
  const auth = { preHandler: [requireAdminAuth] };
  app.get("/api/v1/admin/orders", auth, (r) => service.list(r.query));
  app.get("/api/v1/admin/accepted-orders/:kind", auth, (r) =>
    service.accepted((r.params as any).kind, r.query),
  );
  app.post(
    "/api/v1/admin/accepted-orders/:kind/:id/delivered",
    auth,
    async (r) => {
      const kind = z
        .enum(["production", "sampling"])
        .parse((r.params as any).kind);
      const { id } = idSchema.parse(r.params);
      await service.deliver(r.params, r.admin!.id, r.body);
      await logAuditEvent({
        actorId: r.admin!.id,
        actorEmail: r.admin!.email,
        targetType: "ORDER",
        targetId: id,
        action: "MARK_DELIVERED",
        reason: `Admin confirmed ${kind} delivery`,
        requestId: r.id,
      });
      return { ok: true };
    },
  );
}
