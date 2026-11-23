import { z } from "zod";
import { Prisma } from "@prisma/client";
export function expiryFromDate(value: string) {
  // A date picked in the Indian admin console is inclusive through the IST day.
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return new Date(date.getTime() + 18.5 * 3600000 - 1);
}
export const quoteApprovalSchema = z.object({
  markupPriceInr: z.number().finite().positive().max(9999999999.99).refine(value => new Prisma.Decimal(value).decimalPlaces() <= 2, "Use at most two decimal places").optional(),
  adminReviewNote: z.string().trim().max(2000).optional(),
  validUntilDate: z.string().refine(value => { const expiry = expiryFromDate(value); return Boolean(expiry && expiry > new Date()); }, "Choose a valid current or future date").optional(),
}).strict();
export const quoteRejectionSchema = z.object({ rejectionReason: z.string().trim().min(1, "A rejection reason is required").max(2000) }).strict();
export const quoteEditsSchema = z.object({
  price: z.coerce.number().positive().max(9999999999.99),
  leadTimeDays: z.coerce.number().int().positive().max(2147483647),
  moq: z.coerce.number().int().positive().max(2147483647).optional(),
  dispatchLocation: z.string().trim().min(1).max(500).optional(),
  quoteType: z.enum(["exact", "indicative"]).optional(),
  additionalNotes: z.string().trim().max(10000).optional(),
  sampleAvailability: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(5000).optional(),
});
export const quoteDecisionSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  edits: quoteEditsSchema.optional(),
});
