import { z } from "zod";
import { prisma } from "../../infrastructure/db.js";
import { CatalogError } from "./catalog.service.js";
import { excelImportRowSchema } from "./excel/row-schema.js";
import { createImportRow, importCreateSchema } from "./catalog-import.repository.js";

export const importSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1).max(500),
  skipDuplicates: z.boolean().default(true),
  fileName: z.string().trim().min(1).max(255).optional(),
  preview: z.boolean().default(false),
});

export function validateImportRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row, index) => {
    const identity = {
      rowNumber: typeof row.sourceRowNumber === "number" ? row.sourceRowNumber : index + 2,
      sourceSheet: typeof row.sourceSheet === "string" ? row.sourceSheet : undefined,
      clientRowId: typeof row.clientRowId === "string" ? row.clientRowId : undefined,
      fabricName: typeof row.fabricName === "string" ? row.fabricName.trim() : "",
    };
    const clean = Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null));
    const result = excelImportRowSchema.pipe(importCreateSchema).safeParse(clean);
    return result.success
      ? { ...identity, data: result.data, error: undefined }
      : { ...identity, data: undefined, error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") };
  });
}

export async function importCatalog(supplierId: string, payload: unknown, client = prisma) {
  const input = importSchema.parse(payload);
  if (!(await client.supplierProfile.findUnique({ where: { id: supplierId }, select: { id: true } }))) {
    throw new CatalogError(404, "Supplier not found");
  }
  const rows = validateImportRows(input.rows);
  const failures = rows.filter(r => r.error).map(({ data, error, ...identity }) => ({ ...identity, reason: error! }));
  if (input.preview) return { ok: true, failures, validCount: rows.length - failures.length, totalRows: rows.length };
  // Match existing behavior: validate the whole payload before starting writes.
  if (failures.length) throw new CatalogError(400, `Import not saved. ${failures.map(f => `Row ${f.rowNumber}: ${f.reason}`).join("; ")}`);
  let createdCount = 0;
  const skipped: Array<{ rowNumber: number; fabricName: string; reason: string; sourceSheet?: string; clientRowId?: string }> = [];
  for (const { data, error, ...identity } of rows) {
    try {
      const outcome = await client.$transaction(tx => createImportRow(tx, supplierId, data!, input.skipDuplicates));
      if (outcome.skipped) skipped.push({ ...identity, reason: "Duplicate fabric (already exists in active supplier catalog)" });
      else createdCount++;
    } catch (failure) {
      failures.push({ ...identity, reason: failure instanceof CatalogError ? failure.message : "Could not save this row. Retry or contact support." });
    }
  }
  const summary = {
    totalRows: rows.length, importedCount: createdCount, createdCount, updatedCount: 0,
    skippedCount: skipped.length, failedCount: failures.length, failures, skipped,
    message: `Published ${createdCount} fabrics; skipped ${skipped.length} duplicates; ${failures.length} failed. Buyer visibility requires an approved supplier.`,
  };
  return { ok: true, data: summary, ...summary };
}
