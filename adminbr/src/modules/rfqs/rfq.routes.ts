import { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../auth/verify-admin.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
import * as service from "./rfq.service.js";
import { getRfqTracking, getRfqTrackingDetail } from "./tracking/service.js";
import { registry } from "./registry.js";
import { manualRoute, queueResend } from "./tracking/actions.js";
import { dispatchLogs } from "./tracking/dispatch-logs.js";
import {rerunController} from "./controller.js";
const defaults = {registry,manualRoute,queueResend,dispatchLogs,getRfqTrackingDetail};
export async function rfqRoutes(app: FastifyInstance, handlers = defaults) {
  const auth = { preHandler: [requireAdminAuth] };
  app.get("/api/v1/admin/rfqs", auth, (r) => handlers.registry(r.query));
  app.get("/api/v1/admin/rfqs/:id", auth, (r) =>
    service.detail((r.params as any).id, r.query),
  );
  app.get("/api/v1/admin/rfq-match-approvals", auth, (r) =>
    service.listPendingMatches(r.query),
  );
  for (const decision of ["forward", "reject"] as const)
    app.post(`/api/v1/admin/rfq-match-approvals/:id/${decision}`, auth, async (r) => {
      const result = await service.decide(
        (r.params as any).id,
        decision,
        r.body,
        r.admin!.id,
      );
      await logAuditEvent({
        actorId: r.admin!.id,
        actorEmail: r.admin!.email,
        targetType: "RFQ",
        targetId: (r.params as any).id,
        action: `RFQ_MATCH_${decision.toUpperCase()}`,
        reason: (r.body as any)?.note || "Admin review",
        requestId: r.id,
      });
      return result;
    });
  app.post("/api/v1/admin/rfq-match-approvals/bulk", auth, async (r) => {
    const result = await service.bulk(r.body, r.admin!.id);
    await logAuditEvent({
      actorId: r.admin!.id,
      actorEmail: r.admin!.email,
      targetType: "RFQ",
      targetId: "bulk",
      action: "BULK_RFQ_REVIEW",
      newState: result,
      reason: (r.body as any)?.note || "Bulk review",
      requestId: r.id,
    });
    return result;
  });
  app.post("/api/v1/admin/rfqs/:id/matches/re-run", auth, async r => {
    const id = (r.params as {id:string}).id;
    return rerunController(id,r.body,r.admin!,r.id);
  });
  app.post("/api/v1/admin/rfqs/:id/manual-match", auth, async (r) => {
    const result = await handlers.manualRoute((r.params as any).id, r.body, r.admin!.id);
    await logAuditEvent({ actorId: r.admin!.id, actorEmail: r.admin!.email,
      targetType: "RFQ", targetId: (r.params as any).id,
      action: "MANUAL_SUPPLIER_MATCH", reason: (r.body as any)?.note || "Admin manual match", requestId: r.id });
    return result;
  });
  app.post("/api/v1/admin/rfq-tracking/:matchId/resend-whatsapp", auth, async r => {
    const result = await handlers.queueResend((r.params as any).matchId,r.body,r.admin!.id);
    await logAuditEvent({actorId:r.admin!.id,actorEmail:r.admin!.email,targetType:"RFQ",targetId:(r.params as any).matchId,action:"RFQ_WHATSAPP_RESEND_QUEUED",reason:(r.body as any)?.reason || "Admin resend",requestId:r.id});
    return result;
  });
  app.get("/api/v1/admin/rfq-tracking/:matchId/dispatch-logs",auth,r=>handlers.dispatchLogs((r.params as any).matchId,r.query));
  app.get("/api/v1/admin/rfq-tracking", auth, async (r, reply) => {
    const result = await getRfqTracking(r.query);
    if (!result.ok)
      return reply.code(result.status).send({ error: result.error });
    return {
      ...result.data,
      totalCount: result.data.total,
      totalPages: Math.max(
        1,
        Math.ceil(result.data.total / result.data.pageSize),
      ),
    };
  });
  app.get("/api/v1/admin/rfq-tracking/:id", auth, async (r, reply) => {
    const result = await handlers.getRfqTrackingDetail((r.params as any).id, r.query);
    if (!result.ok)
      return reply.code(result.status).send({ error: result.error });
    return {
      ...result.data,
      totalCount: result.data.totalMatches,
      totalPages: Math.max(
        1,
        Math.ceil(result.data.totalMatches / result.data.pageSize),
      ),
    };
  });
}
