import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSupplier, saveCatalogItem, setCatalogActive } from "./catalog.service.js";
import { generateCatalogTemplate } from "./catalog-template.service.js";
import { logAuditEvent } from "../../infrastructure/audit.js";

export function catalogActionsRoutes(app: FastifyInstance, dependencies = { requireSupplier, saveCatalogItem, setCatalogActive, generateCatalogTemplate }) {
  const supplierParams = z.object({ id: z.string().uuid() });
  // These routes also inherit the namespace guard; explicit hooks keep this
  // plugin protected when reused independently.
  const auth = { preHandler: [app.authenticate] };
  app.get("/api/v1/admin/suppliers/:id/catalog/excel-template", auth, async (request, reply) => {
    const { id } = supplierParams.parse(request.params);
    await dependencies.requireSupplier(id);
    const buffer = await dependencies.generateCatalogTemplate();
    return reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="mylonex_supplier_catalog_template.xlsx"')
      .header("Cache-Control", "no-store").send(buffer);
  });
  app.post("/api/v1/admin/suppliers/:id/catalog/quick-add", auth, async (request, reply) => {
    const { id } = supplierParams.parse(request.params);
    const item = await dependencies.saveCatalogItem(id, "fabrics", request.body);
    await logAuditEvent({ actorId: request.admin!.id, actorEmail: request.admin!.email, targetType: "SUPPLIER_PROFILE", targetId: id,
      action: "QUICK_ADD_FABRIC", reason: "Admin manual catalog creation", requestId: request.id });
    return reply.code(201).send({ item });
  });
  app.patch("/api/v1/admin/suppliers/:id/catalog/products/:productId", auth, async request => {
    const { id, productId } = supplierParams.extend({ productId: z.string().uuid() }).parse(request.params);
    const { isActive, sourceType } = z.object({ isActive: z.boolean(), sourceType: z.enum(["fabrics", "woven", "capabilities"]).default("fabrics") }).parse(request.body);
    await dependencies.setCatalogActive(id, sourceType, productId, isActive);
    await logAuditEvent({ actorId: request.admin!.id, actorEmail: request.admin!.email, targetType: "SUPPLIER_CATALOG_ITEM", targetId: productId,
      action: isActive ? "PUBLISH_LISTING" : "DEACTIVATE_LISTING", newState: { isActive, sourceType }, reason: "Admin catalog publication", requestId: request.id });
    return { item: { id: productId, isActive } };
  });
}
