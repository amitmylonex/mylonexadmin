import { Prisma } from "@prisma/client";
import { z } from "zod";
import { CatalogError, lockSupplier } from "./catalog.service.js";
import { SUPPLIER_DYE_METHODS, SUPPLIER_FABRIC_STATES, SUPPLIER_PRODUCTION_CYCLES } from "./constants.js";

// Persistence bounds after spreadsheet unit/range normalization.
export const importCreateSchema = z.object({
  fabricName: z.string().trim().max(500).default(""),
  composition: z.string().trim().min(1).max(5000),
  construction: z.string().trim().min(1).max(5000),
  weaveType: z.string().trim().min(1).max(200),
  gsm: z.number().int().positive().max(2147483647),
  widthInches: z.number().positive().max(999999.99),
  weightUnit: z.enum(["GSM", "OZ", "GLM"]), weightValue: z.number().positive().max(999999.99),
  widthUnit: z.enum(["inches", "cm"]), widthValue: z.number().positive().max(999999.99),
  sampleAvailability: z.string().trim().min(1).max(5000),
  fabricState: z.enum(SUPPLIER_FABRIC_STATES), dyeMethod: z.enum(SUPPLIER_DYE_METHODS).optional(),
  productionCycle: z.enum(SUPPLIER_PRODUCTION_CYCLES),
  stockQuantity: z.number().int().min(0).max(2147483647),
  pricePerMeter: z.number().positive().max(9999999999.99),
  minimumOrderQuantity: z.number().int().positive().max(2147483647),
  leadTimeDays: z.number().int().positive().max(3650),
  description: z.string().max(5000).optional(), city: z.string().max(5000).optional(), locationState: z.string().max(5000).optional(),
  fabricCollectionName: z.string().trim().max(200).optional(),
  finishOptions: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  imageUrl: z.preprocess(value => value === "" ? undefined : value, z.string().url().max(2048).optional()),
});
export type ImportCreateRow = z.infer<typeof importCreateSchema>;

export async function createImportRow(tx: Prisma.TransactionClient, supplierId: string, input: ImportCreateRow, skipDuplicates: boolean) {
  // Keep lock ordering consistent with manual catalog writes.
  await lockSupplier(tx, supplierId);
  // UPDATE acquires the allocator row lock until commit, including duplicate checks.
  // The reviewed schema repair must initialize the historical code floor first.
  // Never guess zero when the allocator is missing.
  await tx.systemCounter.update({ where: { id: "mylonex_fabric_code" }, data: { value: { increment: 0 } } });
  const duplicate = await tx.supplierCatalog.findFirst({
    where: { supplierId, isActive: true, fabricName: { equals: input.fabricName, mode: "insensitive" },
      weaveType: { equals: input.weaveType, mode: "insensitive" }, gsm: input.gsm },
    select: { id: true },
  });
  if (duplicate) {
    if (skipDuplicates) return { skipped: true };
    throw new CatalogError(409, "Duplicate fabric in active supplier catalog");
  }
  let collectionId: string | undefined;
  if (input.fabricCollectionName) {
    const collection = await tx.fabricCollection.upsert({
      where: { supplierId_name: { supplierId, name: input.fabricCollectionName } },
      update: {}, create: { supplierId, name: input.fabricCollectionName },
    });
    if (collection.isArchived) throw new CatalogError(400, "Restore the archived collection before importing into it");
    collectionId = collection.id;
  }
  const counter = await tx.systemCounter.update({ where: { id: "mylonex_fabric_code" }, data: { value: { increment: 1 } } });
  const mylonexCode = `MYLO${String(counter.value).padStart(4, "0")}`;
  const { composition, fabricCollectionName, imageUrl, productionCycle, dyeMethod, ...fields } = input;
  await tx.supplierCatalog.create({ data: {
    ...fields, supplierId, mylonexCode, compositionText: composition,
    fabricCollectionId: collectionId, fabricType: null, materialPurity: null, blendDescription: null,
    productionCycle: productionCycle.replace(/-/g, "_") as "ready_stock" | "made_to_order" | "running_production",
    dyeMethod: input.fabricState === "dyed" ? dyeMethod : null,
    imageUrls: imageUrl ? [imageUrl] : [], isActive: true,
  } });
  return { skipped: false, mylonexCode };
}
