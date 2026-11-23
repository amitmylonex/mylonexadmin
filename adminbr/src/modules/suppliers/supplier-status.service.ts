import { z } from "zod";
import { SupplierStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
export const statusChangeSchema = z.object({ expectedCurrentStatus: z.nativeEnum(SupplierStatus).optional(),
  nextStatus: z.enum(["APPROVED", "SUSPENDED"]).optional(), status: z.enum(["APPROVED", "SUSPENDED"]).optional(),
  reason: z.string().trim().min(5, "Audit reason must be at least 5 characters").max(2000).default("Admin supplier governance update"),
}).refine(input => Boolean(input.status || input.nextStatus) && !(input.status && input.nextStatus && input.status !== input.nextStatus), "Choose one consistent target status");
export async function transitionSupplier(id: string, payload: unknown, profiles = prisma.supplierProfile) {
  const input = statusChangeSchema.parse(payload);
  const existing = await profiles.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw Object.assign(new Error("Supplier not found"), { statusCode: 404 });
  const nextStatus = (input.status || input.nextStatus)!;
  const expected = input.expectedCurrentStatus || existing.status;
  if (expected === nextStatus) throw Object.assign(new Error("Supplier already has this status"), { statusCode: 400 });
  const changed = await profiles.updateMany({ where: { id, status: expected }, data: { status: nextStatus } });
  if (!changed.count) throw Object.assign(new Error("Supplier status changed. Refresh and try again."), { statusCode: 409 });
  return { previousStatus: expected, status: nextStatus, reason: input.reason };
}
