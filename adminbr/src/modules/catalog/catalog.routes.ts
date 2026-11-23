import { FastifyInstance } from "fastify";
import { prisma } from "../../infrastructure/db.js";
import { requireAdminAuth } from "../auth/verify-admin.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
import { catalogKinds, getCatalogItem, saveCatalogItem, requireSupplier, editablePayload, setCatalogActive } from "./catalog.service.js";
import { uploadImage } from "./catalog.upload.js";
import { z } from "zod";
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(15), search: z.string().trim().max(200).default("") });
const paramsSchema = z.object({ id: z.string().uuid(), kind: catalogKinds, itemId: z.string().uuid().optional() });
export async function catalogRoutes(app: FastifyInstance) {
  const auth = { preHandler: [requireAdminAuth] };
  app.get("/api/v1/admin/catalog/suppliers", auth, async request => {
    const { page, pageSize, search } = paginationSchema.parse(request.query);
    const where = search ? { companyName: { contains: search, mode: "insensitive" as const } } : {};
    const [suppliers, totalCount] = await Promise.all([
      prisma.supplierProfile.findMany({ where, skip: (page-1)*pageSize, take: pageSize, select: { id: true, companyName: true, status: true, user: { select: { email: true } }, _count: { select: { supplierCatalogEntries: true, wovenProducts: true, fabricCollections: true, capabilities: true } } }, orderBy: [{ companyName: "asc" }, { id: "asc" }] }),
      prisma.supplierProfile.count({ where }),
    ]);
    return { suppliers, totalCount, page, pageSize, totalPages: Math.ceil(totalCount/pageSize) };
  });
  const base = "/api/v1/admin/suppliers/:id/catalog/manage/:kind";
  app.get(base, auth, async request => {
    const { id, kind } = paramsSchema.parse(request.params);
    const { page, pageSize, search } = paginationSchema.parse(request.query);
    await requireSupplier(id);
    // Collection selector is independently paginated, so linking isn't limited to the current catalog page.
    if (kind !== "collections") throw Object.assign(new Error("Use the supplier catalog overview to browse listings"), { statusCode: 400 });
    const where = { supplierId: id, isArchived: false, ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}) };
    const [items, totalCount] = await Promise.all([
      prisma.fabricCollection.findMany({ where, skip: (page-1)*pageSize, take: pageSize, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, isArchived: true } }),
      prisma.fabricCollection.count({ where }),
    ]);
    return { items, totalCount, page, pageSize, totalPages: Math.max(1, Math.ceil(totalCount/pageSize)) };
  });
  app.get(base + "/:itemId", auth, async request => {
    const { id, kind, itemId } = paramsSchema.parse(request.params);
    return { item: editablePayload(kind, await getCatalogItem(id, kind, itemId!)) };
  });
  app.post(base, auth, async (request, reply) => {
    const { id, kind } = paramsSchema.parse(request.params);
    const item = await saveCatalogItem(id, kind, request.body);
    await audit(request, id, `CREATE_${kind.toUpperCase()}`);
    return reply.code(201).send({ ok: true, item });
  });
  app.put(base + "/:itemId", auth, async request => {
    const { id, kind, itemId } = paramsSchema.parse(request.params);
    const item = await saveCatalogItem(id, kind, request.body, itemId);
    await audit(request, itemId!, `UPDATE_${kind.toUpperCase()}`);
    return { ok: true, item };
  });
  app.post(base + "/:itemId/active", auth, async request => {
    const { id, kind, itemId } = paramsSchema.parse(request.params);
    if (kind === "collections") throw Object.assign(new Error("Use collection archive controls"), { statusCode: 400 });
    const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body);
    await setCatalogActive(id, kind, itemId!, isActive);
    await audit(request, itemId!, isActive ? "PUBLISH_LISTING" : "DEACTIVATE_LISTING");
    return { ok: true };
  });
  app.post("/api/v1/admin/suppliers/:id/catalog/images", { ...auth, bodyLimit: 15 * 1024 * 1024 }, async request => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireSupplier(id);
    return { imageUrl: await uploadImage(id, request.body) };
  });
}
async function audit(request: any, id: string, action: string) {
  await logAuditEvent({ actorId: request.admin.id, actorEmail: request.admin.email, targetType: "SUPPLIER_CATALOG_ITEM", targetId: id, action, reason: "Admin catalog management", requestId: request.id });
}
