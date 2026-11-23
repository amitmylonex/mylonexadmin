import type { FastifyInstance } from "fastify";
import { moderationService } from "./moderation.service.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
export async function moderationRoutes(app: FastifyInstance, handlers = moderationService) {
  app.get("/api/v1/admin/rfq-approvals", r => handlers.list(r.query));
  for (const decision of ["approve", "reject"] as const) {
    app.post(`/api/v1/admin/rfq-approvals/:id/${decision}`, async r => {
      const id = (r.params as { id: string }).id;
      const result = await handlers[decision](id, r.body, r.admin!.id);
      await logAuditEvent({ actorId: r.admin!.id, actorEmail: r.admin!.email, targetType: "RFQ", targetId: id,
        action: `RFQ_${decision.toUpperCase()}`, reason: (r.body as any)?.reason || (r.body as any)?.note || "Admin review", requestId: r.id });
      return result;
    });
  }
  app.post("/api/v1/admin/rfq-approvals/bulk", async r => {
    const result = await handlers.bulk(r.body, r.admin!.id);
    await logAuditEvent({ actorId: r.admin!.id, actorEmail: r.admin!.email, targetType: "RFQ", targetId: "bulk",
      action: "BULK_RFQ_MODERATION", newState: result, reason: (r.body as any)?.reason || (r.body as any)?.note || "Bulk review", requestId: r.id });
    return result;
  });
}
