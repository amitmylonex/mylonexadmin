import { prisma } from "../../infrastructure/db.js";
import { sampleTotal } from "../../common/money/sample-money.mjs";
import { Prisma } from "@prisma/client";
import * as repo from "./sample.repository.js";
import { sampleQuoteSchema, sampleRejectSchema, sampleListSchema } from "./sample.schema.js";
import { idSchema, listQuerySchema } from "../../common/pagination/query.js";
import { PublicError } from "../../common/errors/public-error.js";
import { notificationStatus } from "../notifications/notification-status.js";
export const list = (query: unknown, client = prisma) => repo.list(sampleListSchema.parse(query),client);
export async function detail(id: unknown, client = prisma) {
  const sample = await repo.find(idSchema.parse({ id }).id,client);
  if (!sample) throw new PublicError(404, "Sample request not found");
  return { sample };
}
export function sampleMaterialCost(rate: number, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new PublicError(400, "Sample quantity must be positive");
  const total = new Prisma.Decimal(rate).mul(quantity).toDecimalPlaces(2);
  if (total.greaterThan("9999999999.99"))
    throw new PublicError(
      400,
      "Sample material total exceeds the supported amount",
    );
  return total;
}
export async function quote(id: unknown, body: unknown, actor: string, client = prisma) {
  const input = sampleQuoteSchema.parse(body);
  const changed = await repo.changeRequested(
    idSchema.parse({ id }).id,
    async (sample,tx) => {
      if(new Date(input.quoteValidUntil)<=new Date())throw new PublicError(400,"Quote expiry must remain in the future");
      const supplierId=input.supplierId||sample.supplierId;
      await tx.$queryRaw`SELECT id FROM "SupplierProfile" WHERE id=${supplierId} FOR SHARE`;
      const supplier=await tx.supplierProfile.findFirst({where:{id:supplierId,status:"APPROVED"},select:{id:true}});
      if(!supplier)throw new PublicError(409,"Assign a currently approved fulfillment supplier before quoting this sample");
      return {
      supplierId:supplier.id,
      status: "quoted",
      quoteSampleCostInr: new Prisma.Decimal(input.quoteSampleCostInr),
      quoteCourierCostInr: new Prisma.Decimal(input.quoteCourierCostInr),
      quoteDeliveryTimeline: input.quoteDeliveryTimeline,
      quoteRefundPolicy: input.quoteRefundPolicy,
      quoteValidUntil: new Date(input.quoteValidUntil),
      quoteInternalNotes: input.quoteInternalNotes || null,
      quotedAt: new Date(),
      quotedByUserId: actor,
    };}, client,
  );
  if (!changed?.count)
    throw new PublicError(
      409,
      "Only requested samples can be quoted. Refresh the list.",
    );
  return { ok: true, totalSampleCostInr: sampleTotal(input.quoteSampleCostInr,input.quoteCourierCostInr), notification: notificationStatus };
}
export async function reject(id: unknown, body: unknown, actor: string, client = prisma) {
  const input = sampleRejectSchema.parse(body);
  const changed = await repo.changeRequested(idSchema.parse({ id }).id, () => ({
    status: "rejected",
    rejectionReason: input.rejectionReason,
    rejectedAt: new Date(),
    rejectedByUserId: actor,
  }),client);
  if (!changed?.count)
    throw new PublicError(
      409,
      "Only requested samples can be rejected. Refresh the list.",
    );
  return { ok: true };
}

export { delivered } from "./sample-delivery.js";
