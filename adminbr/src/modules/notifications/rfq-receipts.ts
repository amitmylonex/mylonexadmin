import { z } from "zod";
import { prisma } from "../../infrastructure/db.js";
const receiptSchema=z.object({messageId:z.string().min(1).max(500),status:z.enum(["SENT","DELIVERED","READ","FAILED"]),at:z.date().refine(d=>d<=new Date(Date.now()+600000),"Receipt timestamp is in the future"),failureCode:z.string().regex(/^\d{1,12}$/).optional(),attemptId:z.string().uuid().optional()});
const rank:Record<string,number>={SENT:1,DELIVERED:2,READ:3};
/** Call only AFTER the existing webhook verifies the provider signature. No raw
 * payloads/tokens/phones are persisted. Safe for duplicate/out-of-order receipts. */
export async function recordDispatchReceipt(input: unknown, client=prisma) {
  const event=receiptSchema.parse(input);
  const result = await client.$transaction(async tx=>{
    let rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM rfq_dispatch_attempts WHERE provider_message_id=${event.messageId} FOR UPDATE`;
    if(!rows.length && event.attemptId) rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM rfq_dispatch_attempts WHERE id=${event.attemptId} AND provider_message_id IS NULL AND status IN ('SENDING','AMBIGUOUS_ERROR') FOR UPDATE`;
    if(!rows.length)return {recorded:false};
    const attempt=await tx.rfqDispatchAttempt.findUnique({where:{id:rows[0].id}});if(!attempt || event.attemptId && attempt.id !== event.attemptId)return {recorded:false};
    const previous=attempt.status.toUpperCase();
    const oldRank=attempt.readAt?3:attempt.deliveredAt?2:rank[previous]||0;
    const incoming=rank[event.status]||0;
    const status=event.status==="FAILED" ? oldRank>=2?previous:"FAILED" : incoming>=oldRank?event.status:previous;
    const dateField=event.status==="SENT"?"sentAt":event.status==="DELIVERED"?"deliveredAt":event.status==="READ"?"readAt":null;
    const data={status,...(!attempt.providerMessageId?{providerMessageId:event.messageId}:{}),...(dateField && !(attempt as any)[dateField]?{[dateField]:event.at}:{}),...(event.failureCode?{failureCode:event.failureCode}:{})};
    await tx.rfqDispatchAttempt.update({where:{id:attempt.id},data});
    return {recorded:true,status,matchId:attempt.matchId};
  });
  if (result.recorded && result.matchId && result.status) {
    // Update the retained original message outside the ledger lock to avoid a
    // match->ledger / ledger->match deadlock with resend reservation.
    const where = {id:result.matchId,whatsappMessageId:event.messageId};
    const field = event.status === "SENT" ? "whatsappSentAt" : event.status === "DELIVERED" ? "whatsappDeliveredAt" : event.status === "READ" ? "whatsappReadAt" : null;
    if (field) await client.communicationRequestMatch.updateMany({where:{...where,[field]:null},data:{[field]:event.at}});
    // Delivery callbacks must not replace conversation outcomes such as
    // CLOSED, DECLINED or SHORTLISTED on the legacy overloaded status field.
    const allowed = ["QUEUED","SENDING","SENT","FAILED","AMBIGUOUS_ERROR",...(result.status === "READ" ? ["DELIVERED","READ"] : result.status === "DELIVERED" ? ["DELIVERED"] : [])];
    const guard = {OR:[{whatsappStatus:null},{whatsappStatus:{in:allowed}}],
      ...(result.status !== "READ" ? {whatsappReadAt:null} : {}),...(!["READ","DELIVERED"].includes(result.status)?{whatsappDeliveredAt:null}:{})};
    await client.communicationRequestMatch.updateMany({where:{...where,...guard},data:{whatsappStatus:result.status}});
  }
  return {recorded:result.recorded,...(result.recorded?{status:result.status}:{})};
}
