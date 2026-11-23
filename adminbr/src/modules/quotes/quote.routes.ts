import { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../auth/verify-admin.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
import * as service from "./quote.service.js";
export async function quoteRoutes(app: FastifyInstance, handlers = service) {
  const auth = { preHandler: [requireAdminAuth] };
  app.get("/api/v1/admin/quote-approvals", auth, (r) => handlers.list(r.query));
  for (const decision of ["approve", "reject"] as const)
    app.post(
      `/api/v1/admin/quote-approvals/:id/${decision}`,
      auth,
      async (r) => {
        const result = await handlers.decide(
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
          action: `QUOTE_${decision.toUpperCase()}`,
          reason: (r.body as any)?.adminReviewNote || (r.body as any)?.rejectionReason || "Admin quote review",
          requestId: r.id,
        });
        return result;
      },
    );
}
