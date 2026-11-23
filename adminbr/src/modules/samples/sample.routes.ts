import { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../auth/verify-admin.js";
import * as service from "./sample.service.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
export async function sampleRoutes(app: FastifyInstance, handlers = service) {
  const auth = { preHandler: [requireAdminAuth] };
  app.get("/api/v1/admin/samples", auth, (r) => handlers.list(r.query));
  app.get("/api/v1/admin/samples/:id", auth, (r) =>
    handlers.detail((r.params as any).id),
  );
  for (const action of ["quote", "reject", "delivered"] as const)
    app.post(`/api/v1/admin/samples/:id/${action}`, auth, async (r) => {
      const result = await handlers[action](
        (r.params as any).id,
        r.body,
        r.admin!.id,
      );
      await logAuditEvent({
        actorId: r.admin!.id,
        actorEmail: r.admin!.email,
        targetType: "SAMPLE",
        targetId: (r.params as any).id,
        action: `SAMPLE_${action.toUpperCase()}`,
        reason:
          action === "quote" ? "Released sample quote" : action === "delivered" ? "Admin confirmed physical sample delivery" : (r.body as any).rejectionReason,
        requestId: r.id,
      });
      return result;
    });
}
