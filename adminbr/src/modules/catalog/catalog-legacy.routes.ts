import { paginationSchema as catalogPagination } from "../catalog/catalog.routes.js";
import { getCatalogItem, setCatalogActive } from "../catalog/catalog.service.js";
import { importCatalog } from "../catalog/catalog.import.js";
import { FastifyInstance } from "fastify";
import { prisma } from "../../infrastructure/db.js";
import { logAuditEvent } from "../../infrastructure/audit.js";
import { requireAdminAuth } from "../auth/verify-admin.js";
import { z } from "zod";
export async function catalogLegacyRoutes(fastify:FastifyInstance){
  // 6. Get Supplier Full Catalog
  fastify.get(
    "/api/v1/admin/suppliers/:id/catalog",
    { preHandler: [requireAdminAuth] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

      const supplier = await prisma.supplierProfile.findUnique({
        where: { id },
        select: {
          id: true,
          companyName: true,
          status: true,
          user: { select: { email: true } },
        },
      });

      if (!supplier) {
        return reply.status(404).send({ error: "Supplier not found" });
      }

      const { page, pageSize } = catalogPagination.parse(request.query);
      const paging = { skip: (page-1)*pageSize, take: pageSize, orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }] };
      const [fabricCollections, catalogEntries, wovenProducts, capabilities, counts] = await Promise.all([
        prisma.fabricCollection.findMany({ where: { supplierId: id }, ...paging, include: { _count: { select: { catalogEntries: true } } } }),
        prisma.supplierCatalog.findMany({ where: { supplierId: id }, ...paging }),
        prisma.wovenProduct.findMany({ where: { supplierId: id }, ...paging }),
        prisma.supplierCapability.findMany({ where: { supplierId: id }, ...paging }),
        Promise.all([prisma.fabricCollection.count({ where: { supplierId: id } }), prisma.supplierCatalog.count({ where: { supplierId: id } }), prisma.wovenProduct.count({ where: { supplierId: id } }), prisma.supplierCapability.count({ where: { supplierId: id } })]),
      ]);

      return {
        supplier,
        page, pageSize, totalPages: Math.max(1, ...counts.map(count => Math.ceil(count/pageSize))),
        fabricCollections,
        catalogEntries,
        wovenProducts,
        capabilities,
      };
    }
  );

  // 7. Toggle Product/Capability Active Status
  fastify.post(
    "/api/v1/admin/suppliers/:id/catalog/items/:type/:itemId/toggle-active",
    { preHandler: [requireAdminAuth] },
    async (request, reply) => {
      const { id, type, itemId } = request.params as {
        id: string;
        type: "catalog" | "woven" | "capability";
        itemId: string;
      };
      const admin = request.admin!;

      const kind = ({ catalog: "fabrics", woven: "woven", capability: "capabilities" } as const)[type];
      if (!kind) return reply.code(400).send({ error: "Invalid item type" });
      const item = await getCatalogItem(id, kind, itemId) as any;
      await setCatalogActive(id, kind, itemId, !item.isActive);
      const updatedItem = { isActive: !item.isActive };

      await logAuditEvent({
        actorId: admin.id,
        actorEmail: admin.email,
        targetType: "SUPPLIER_CATALOG_ITEM",
        targetId: itemId,
        action: `TOGGLE_ACTIVE_${type.toUpperCase()}`,
        previousState: undefined,
        newState: { isActive: updatedItem.isActive },
        reason: `Admin toggled active status to ${updatedItem.isActive}`,
      });

      return { ok: true, item: updatedItem };
    }
  );

  // 8. Toggle Collection Archive Status
  fastify.post(
    "/api/v1/admin/suppliers/:id/catalog/collections/:collectionId/toggle-archive",
    { preHandler: [requireAdminAuth] },
    async (request, reply) => {
      const { id, collectionId } = z.object({ id: z.string().uuid(), collectionId: z.string().uuid() }).parse(request.params);
      const admin = request.admin!;

      const collection = await prisma.fabricCollection.findFirst({
        where: { id: collectionId, supplierId: id },
      });

      if (!collection) {
        return reply.status(404).send({ error: "Collection not found" });
      }

      const updated = await prisma.fabricCollection.update({
        where: { id: collectionId },
        data: { isArchived: !collection.isArchived },
      });

      await logAuditEvent({
        actorId: admin.id,
        actorEmail: admin.email,
        targetType: "FABRIC_COLLECTION",
        targetId: collectionId,
        action: updated.isArchived ? "ARCHIVE_COLLECTION" : "RESTORE_COLLECTION",
        previousState: { isArchived: collection.isArchived },
        newState: { isArchived: updated.isArchived },
        reason: updated.isArchived ? "Admin archived collection" : "Admin restored collection",
      });

      return { ok: true, collection: updated };
    }
  );

  // 9. Excel Catalog Import
  fastify.post(
    "/api/v1/admin/suppliers/:id/catalog/excel-import",
    { preHandler: [requireAdminAuth], bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const admin = request.admin!;
      const result = await importCatalog(id, request.body);
      if (!(request.body as any)?.preview) await logAuditEvent({ actorId: admin.id, actorEmail: admin.email, targetType: "SUPPLIER_PROFILE", targetId: id, action: "EXCEL_CATALOG_IMPORT", newState: result, reason: "Validated import with independent row transactions", requestId: request.id });
      return result;
    }
  );
}
