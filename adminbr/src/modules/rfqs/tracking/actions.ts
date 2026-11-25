import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../infrastructure/db.js";
import { PublicError } from "../../../common/errors/public-error.js";
import { idSchema } from "../../../common/pagination/query.js";
import { normalizeConsentPhone } from "../../suppliers/supplier-phone.js";
export const activeRfqStates = ["approved","active","open","in_progress","quoted"];
export const manualRouteSchema = z.object({supplierId:z.string().uuid(),note:z.string().trim().min(1).max(2000)}).strict();
export const resendSchema = z.object({reason:z.string().trim().min(1).max(2000)}).strict();
export function deliveryEligibility(match: any, now: Date) {
  if (!activeRfqStates.includes(match.communicationRequest.status)) return "RFQ is not active";
  if (match.status !== "FORWARDED_TO_SUPPLIER" || match.response) return "Only routed matches awaiting a supplier response can be notified";
  if (match.quoteDeadlineAt && match.quoteDeadlineAt <= now) return "The supplier quote deadline has passed";
  if (match.supplier.status !== "APPROVED") return "Supplier is not approved";
  if (!match.supplier.whatsappConsent || !match.supplier.whatsappConsentAt) return "Explicit WhatsApp consent is missing";
  if (!normalizeConsentPhone(match.supplier.phone,match.supplier.phoneCountryCode)) return "Valid WhatsApp number is missing";
  return null;
}
export async function assertSourcingOpen(tx: Prisma.TransactionClient, id: string) {
  const decided = await tx.communicationRequestMatch.findFirst({where:{communicationRequestId:id,response:{is:{OR:[{status:"ACCEPTED_BY_BUYER"},{buyerDecision:"accepted"},{order:{isNot:null}}]}}},select:{id:true}});
  if (decided) throw new PublicError(409,"The buyer has accepted a quote or placed an order. Additional sourcing is closed.");
}
export async function manualRoute(rawId: unknown, body: unknown, actor: string, client = prisma) {
  const id = idSchema.parse({id:rawId}).id, input = manualRouteSchema.parse(body);
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM communication_requests WHERE id=${id} FOR UPDATE`;
    const rfq = await tx.communicationRequest.findUnique({where:{id},select:{id:true,status:true}});
    if (!rfq) throw new PublicError(404,"RFQ not found");
    if (rfq.status !== "pending" && !activeRfqStates.includes(rfq.status)) throw new PublicError(409,"Only pending or active RFQs can receive manual matches");
    await assertSourcingOpen(tx,id);
    await tx.$queryRaw`SELECT id FROM "SupplierProfile" WHERE id=${input.supplierId} FOR SHARE`;
    const supplier = await tx.supplierProfile.findFirst({where:{id:input.supplierId,status:"APPROVED"}});
    if (!supplier) throw new PublicError(409,"Choose a currently approved supplier");
    if (await tx.communicationRequestMatch.findFirst({where:{communicationRequestId:id,supplierId:supplier.id},select:{id:true}})) throw new PublicError(409,"This supplier already has a match for this RFQ");
    const match = await tx.communicationRequestMatch.create({data:{communicationRequestId:id,supplierId:supplier.id,sourceType:"manual",sourceId:`admin_manual_${randomUUID()}`,
      score:0,explanation:input.note,listingSnapshot:{sourceType:"manual",createdByAdmin:actor},routeMeta:{manual:true},status:"PENDING_ADMIN_REVIEW"}});
    return {ok:true,match:{id:match.id,status:match.status},notification:{state:"PENDING_REVIEW",message:"Manual match staged for Admin review. Forward it before notifying the supplier."}};
  });
}
export async function queueResend(rawId: unknown, body: unknown, actor: string, client = prisma, now = new Date()) {
  const id=idSchema.parse({id:rawId}).id,input=resendSchema.parse(body);
  const reference=await client.communicationRequestMatch.findUnique({where:{id},select:{communicationRequestId:true,supplierId:true}});
  if (!reference) throw new PublicError(404,"Supplier match not found");
  return client.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM communication_requests WHERE id=${reference.communicationRequestId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "SupplierProfile" WHERE id=${reference.supplierId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM communication_request_matches WHERE id=${id} FOR UPDATE`;
    const match=await tx.communicationRequestMatch.findUnique({where:{id},include:{supplier:true,communicationRequest:true,response:{select:{id:true}}}});
    if(!match)throw new PublicError(404,"Supplier match not found");
    const reason=deliveryEligibility(match,now);if(reason)throw new PublicError(409,reason);
    await assertSourcingOpen(tx,match.communicationRequestId);
    if (/^(QUEUED|SENDING|AMBIGUOUS)/i.test(match.whatsappStatus||"")) throw new PublicError(409,"An existing notification is queued, sending or awaiting reconciliation");
    const pending=await tx.rfqDispatchAttempt.findFirst({where:{matchId:id,status:{in:["QUEUED","SENDING","AMBIGUOUS_ERROR"]}},select:{id:true}});
    if(pending)throw new PublicError(409,"A resend is already queued or needs reconciliation");
    const latest=await tx.rfqDispatchAttempt.findFirst({where:{matchId:id,kind:"RESEND"},orderBy:{requestedAt:"desc"},select:{requestedAt:true}});
    const last=[latest?.requestedAt,match.lastReminderSentAt,match.whatsappSentAt].filter((d):d is Date=>Boolean(d)).sort((a,b)=>b.getTime()-a.getTime())[0];
    if(last && now.getTime()-last.getTime()<600000)throw new PublicError(429,"Wait at least 10 minutes between notifications for this supplier match");
    const daily=await tx.rfqDispatchAttempt.count({where:{matchId:id,kind:"RESEND",requestedAt:{gte:new Date(now.getTime()-86400000)}}});
    if(daily>=3)throw new PublicError(429,"Maximum three resends per supplier match in 24 hours");
    // Keep the retained message/receipts unchanged. Capture legacy evidence once.
    if(match.whatsappMessageId)await tx.rfqDispatchAttempt.upsert({where:{providerMessageId:match.whatsappMessageId},update:{},create:{matchId:id,kind:"LEGACY_SNAPSHOT",status:match.whatsappStatus?.toUpperCase()||"SENT",
      providerMessageId:match.whatsappMessageId,requestedAt:now,sentAt:match.whatsappSentAt,deliveredAt:match.whatsappDeliveredAt,readAt:match.whatsappReadAt}});
    const attempt=await tx.rfqDispatchAttempt.create({data:{matchId:id,kind:"RESEND",status:"QUEUED",requestedAt:now,requestedByUserId:actor,reason:input.reason}});
    return {ok:true,attemptId:attempt.id,state:"QUEUED",message:"WhatsApp resend queued; previous receipts are preserved. Delivery is not yet confirmed."};
  });
}
