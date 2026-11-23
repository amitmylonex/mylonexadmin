import { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../auth/verify-admin.js";
import { idSchema } from "../../common/pagination/query.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
import { createSupplierAccount } from "./supplier-create.service.js";
import { transitionSupplier } from "./supplier-status.service.js";
import * as service from "./supplier.service.js";
export async function supplierRoutes(app: FastifyInstance) {
  const auth = { preHandler: [requireAdminAuth] };
  app.get("/api/v1/admin/suppliers", auth, request => service.list(request.query));
  app.get("/api/v1/admin/suppliers/:id", auth, request => service.detail(idSchema.parse(request.params).id));
  app.post("/api/v1/admin/suppliers", auth, async (request, reply) => {
    const user = await createSupplierAccount(request.body);
    await logAuditEvent({ actorId: request.admin!.id, actorEmail: request.admin!.email, targetType: "SUPPLIER_PROFILE",
      targetId: user.supplierProfile!.id, action: "CREATE_SUPPLIER_ACCOUNT", reason: "Admin supplier provisioning", requestId: request.id });
    return reply.code(201).send({ supplier: user.supplierProfile, emailSent: user.emailSent, emailStatus: user.emailStatus,
      message: user.emailStatus === "sent" ? "Supplier account created. Password setup email sent. Approval is pending."
        : user.emailStatus === "failed" ? "Supplier account created. Password setup email failed; ask the supplier to use password reset. Approval is pending."
          : "Supplier account created. Email delivery is disabled; ask the supplier to use password reset. Approval is pending." });
  });
  // Retain POST as a compatibility alias while callers migrate to PATCH.
  app.route({ method: ["PATCH", "POST"], url: "/api/v1/admin/suppliers/:id/status", ...auth, handler: async request => {
    const { id } = idSchema.parse(request.params);
    const result = await transitionSupplier(id, request.body);
    await logAuditEvent({ actorId: request.admin!.id, actorEmail: request.admin!.email, targetType: "SUPPLIER_PROFILE", targetId: id,
      action: "SUPPLIER_STATUS_CHANGED", previousState: { status: result.previousStatus }, newState: { status: result.status }, reason: result.reason, requestId: request.id });
    return { supplier: { id, status: result.status } };
  } });
  app.post("/api/v1/admin/suppliers/:id/whatsapp-consent", auth, async request => {
    const { id } = idSchema.parse(request.params);
    const result = await service.updateConsent(id, request.body);
    await logAuditEvent({ actorId: request.admin!.id, actorEmail: request.admin!.email, targetType: "SUPPLIER_PROFILE", targetId: id,
      action: result.supplier.whatsappConsent ? "WHATSAPP_CONSENT_RECORDED" : "WHATSAPP_CONSENT_REVOKED",
      reason: "Admin recorded explicit supplier consent decision", requestId: request.id });
    return result;
  });
}
