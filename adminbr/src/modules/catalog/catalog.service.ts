import { PublicError } from "../../common/errors/public-error.js";
import type { CatalogKind as TransportCatalogKind } from "../../contracts/admin-contracts.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { quickAddSchema, wovenListingSchema, supplierCapabilitySchema, fabricCollectionCreateSchema } from "./catalog.schema.js";
import { z } from "zod";

export class CatalogError extends PublicError {}
export const catalogKinds = z.enum(["collections", "fabrics", "woven", "capabilities"]);
export type CatalogKind = TransportCatalogKind;
export const catalogSchemas = { collections: fabricCollectionCreateSchema, fabrics: quickAddSchema, woven: wovenListingSchema, capabilities: supplierCapabilitySchema };
export async function requireSupplier(supplierId: string) {
  const supplier = await prisma.supplierProfile.findUnique({ where: { id: supplierId }, select: { id: true, status: true } });
  if (!supplier) throw new CatalogError(404, "Supplier not found");
  return supplier;
}
// Catalog lock order: supplier, then allocator when applicable.
export async function lockSupplier(tx: Prisma.TransactionClient, supplierId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "SupplierProfile" WHERE id = ${supplierId} FOR UPDATE`;
  if (!rows.length) throw new CatalogError(404, "Supplier not found");
}
export async function saveCatalogItem(supplierId: string, kind: CatalogKind, payload: unknown, itemId?: string) {
  const input = catalogSchemas[kind].parse(payload);
  return prisma.$transaction(async tx => {
    await lockSupplier(tx, supplierId);
    return saveInTransaction(tx, supplierId, kind, input, itemId);
  });
}
export async function saveInTransaction(tx: Prisma.TransactionClient, supplierId: string, kind: CatalogKind, payload: unknown, itemId?: string) {
  if (kind === "collections") {
    const input = fabricCollectionCreateSchema.parse(payload);
    const duplicate = await tx.fabricCollection.findFirst({ where: { supplierId, name: { equals: input.name, mode: "insensitive" }, ...(itemId ? { id: { not: itemId } } : {}) } });
    if (duplicate) throw new CatalogError(409, "Collection name already exists");
    if (itemId) return checked(await tx.fabricCollection.updateMany({ where: { id: itemId, supplierId }, data: input }));
    return tx.fabricCollection.create({ data: { ...input, supplierId } });
  }
  if (kind === "fabrics") {
    const input = quickAddSchema.parse(payload);
    let collectionId = input.fabricCollectionId;
    if (collectionId) {
      const collection = await tx.fabricCollection.findFirst({ where: { id: collectionId, supplierId, isArchived: false } });
      if (!collection) throw new CatalogError(400, "Select an active collection belonging to this supplier");
    } else if (input.fabricCollectionName) {
      const collection = await tx.fabricCollection.findFirst({ where: { supplierId, name: { equals: input.fabricCollectionName, mode: "insensitive" }, isArchived: false } });
      if (!collection) throw new CatalogError(400, "Create the collection before linking a listing");
      collectionId = collection.id;
    }
    await tx.systemCounter.update({ where: { id: "mylonex_fabric_code" }, data: { value: { increment: 0 } } });
    const duplicate = await tx.supplierCatalog.findFirst({ where: { supplierId, isActive: true, fabricName: { equals: input.fabricName, mode: "insensitive" }, gsm: input.gsm, weaveType: { equals: input.weaveType, mode: "insensitive" }, ...(itemId ? { id: { not: itemId } } : {}) } });
    if (duplicate) throw new CatalogError(409, "A fabric with this name, weave and GSM already exists");
    const data = {
      fabricName: input.fabricName, fabricType: input.fabricType, compositionText: input.composition ?? null,
      gsm: input.gsm, widthInches: input.widthInches ?? null, construction: input.construction ?? null,
      weaveType: input.weaveType, fabricState: input.fabricState, dyeMethod: input.fabricState === "dyed" ? input.dyeMethod : null,
      productionCycle: input.productionCycle.replace(/-/g, "_") as "ready_stock" | "running_production" | "made_to_order",
      stockQuantity: input.stockQuantity, pricePerMeter: input.pricePerMeter, minimumOrderQuantity: input.minimumOrderQuantity,
      leadTimeDays: input.leadTimeDays, city: input.city ?? null, locationState: input.locationState ?? null,
      description: input.description ?? null, materialPurity: input.materialPurity, blendDescription: input.blendDescription ?? null,
      finishOptions: input.finishOptions, imageUrls: input.imageUrls, fabricCollectionId: collectionId ?? null, isActive: input.isActive,
      ...(input.fabricState === "greige" || input.fabricState === "rfd" ? { shadeVariants: [] as Prisma.InputJsonValue, colorOptions: [] } : input.shadeVariantAction === "replace" || !itemId ? { shadeVariants: input.shadeVariants as Prisma.InputJsonValue, colorOptions: input.shadeVariants.map(s => s.name) } : {}),
    };
    if (itemId) return checked(await tx.supplierCatalog.updateMany({ where: { id: itemId, supplierId }, data }));
    const counter = await tx.systemCounter.update({ where: { id: "mylonex_fabric_code" }, data: { value: { increment: 1 } } });
    return tx.supplierCatalog.create({ data: { ...data, supplierId, mylonexCode: `MYLO${String(counter.value).padStart(4, "0")}` } });
  }
  if (kind === "woven") {
    const { specs, ...input } = wovenListingSchema.parse(payload);
    const data = { ...input, constructionLabel: specs.map(s => `${s.specKey}:${s.valueText ?? s.valueNum}`).join(" / "), specSummary: specs.map(s => `${s.specKey}: ${s.valueText ?? s.valueNum} ${s.unit ?? ""}`).join(" | ") };
    if (itemId) {
      checked(await tx.wovenProduct.updateMany({ where: { id: itemId, supplierId }, data }));
      await tx.wovenProductSpec.deleteMany({ where: { productId: itemId } });
    } else {
      const product = await tx.wovenProduct.create({ data: { ...data, supplierId } });
      itemId = product.id;
    }
    if (specs.length) await tx.wovenProductSpec.createMany({ data: specs.map(s => ({ ...s, productId: itemId! })) });
    return { id: itemId };
  }
  const input = supplierCapabilitySchema.parse(payload);
  const [fabrics, woven] = await Promise.all([
    tx.supplierCatalog.count({ where: { supplierId, id: { in: input.linkedSupplierCatalogIds } } }),
    tx.wovenProduct.count({ where: { supplierId, id: { in: input.linkedWovenProductIds } } }),
  ]);
  if (fabrics !== new Set(input.linkedSupplierCatalogIds).size || woven !== new Set(input.linkedWovenProductIds).size) throw new CatalogError(400, "Linked listings must belong to this supplier");
  if (itemId) return checked(await tx.supplierCapability.updateMany({ where: { id: itemId, supplierId }, data: input }));
  return tx.supplierCapability.create({ data: { ...input, supplierId } });
}
function checked(result: { count: number }) {
  if (!result.count) throw new CatalogError(404, "Catalog item not found for this supplier");
  return { updated: true };
}
export async function getCatalogItem(supplierId: string, kind: CatalogKind, id: string) {
  const where = { id, supplierId };
  const item = kind === "collections" ? await prisma.fabricCollection.findFirst({ where }) : kind === "fabrics" ? await prisma.supplierCatalog.findFirst({ where }) : kind === "woven" ? await prisma.wovenProduct.findFirst({ where, include: { specs: true } }) : await prisma.supplierCapability.findFirst({ where });
  if (!item) throw new CatalogError(404, "Catalog item not found for this supplier");
  return item;
}
export function editablePayload(kind: CatalogKind, item: any) {
  item = Object.fromEntries(Object.entries(item).filter(([, value]) => value !== null));
  if (kind !== "fabrics") return item;
  return { ...item, composition: item.compositionText, productionCycle: item.productionCycle.replace(/_/g, "-"), shadeVariantAction: "preserve" };
}
export async function setCatalogActive(supplierId: string, kind: Exclude<CatalogKind, "collections">, id: string, active: boolean, client = prisma) {
  return client.$transaction(async tx => {
    await lockSupplier(tx, supplierId);
    const where = { id, supplierId };
    const item = kind === "fabrics" ? await tx.supplierCatalog.findFirst({ where }) : kind === "woven" ? await tx.wovenProduct.findFirst({ where, include: { specs: true } }) : await tx.supplierCapability.findFirst({ where });
    if (!item) throw new CatalogError(404, "Catalog item not found for this supplier");
    if (active) {
      const payload = editablePayload(kind, item);
      // Excel permits blank supplier titles; the independently allocated code is
      // the display fallback and must also permit later reactivation.
      catalogSchemas[kind].parse(kind === "fabrics" ? { ...payload, fabricName: payload.fabricName || payload.mylonexCode } : payload);
    }
    return kind === "fabrics" ? checked(await tx.supplierCatalog.updateMany({ where, data: { isActive: active } })) : kind === "woven" ? checked(await tx.wovenProduct.updateMany({ where, data: { isActive: active } })) : checked(await tx.supplierCapability.updateMany({ where, data: { isActive: active } }));
  });
}
