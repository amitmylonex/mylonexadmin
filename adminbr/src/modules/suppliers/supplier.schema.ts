import { z } from "zod";
import { SupplierType } from "@prisma/client";
export const supplierListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(15),
  unmatchedForRfq: z.string().uuid().optional(),
  status: z.enum(["ALL", "PENDING", "APPROVED", "SUSPENDED"]).optional(), search: z.string().trim().max(200).optional(),
  supplierType: z.nativeEnum(SupplierType).optional(), city: z.string().trim().max(200).optional(), catalogStatus: z.enum(["active", "empty"]).optional(),
});
export const createSupplierSchema = z.object({
  fullName: z.string().trim().min(2).max(200), companyName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(254).transform(s => s.toLowerCase()),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,19}$/, "Enter a valid phone number"),
  gstNumber: z.string().trim().transform(s => s.toUpperCase()).refine(s => !s || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s), "Enter a valid GST number").optional(),
  supplierType: z.enum(["manufacturer", "trader", "buying_house"]),
  city: z.string().trim().min(1).max(200).optional(), locationState: z.string().trim().min(1).max(200).optional(),
});
