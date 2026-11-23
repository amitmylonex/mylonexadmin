import { prisma } from "../../infrastructure/db.js";
import type { RfqSender } from "./rfq-queue.js";
import { normalizeConsentPhone } from "../suppliers/supplier-phone.js";
import { deliveryEligibility, assertSourcingOpen } from "../rfqs/tracking/actions.js";
import { PublicError } from "../../common/errors/public-error.js";
export async function drainRfqResends(send: RfqSender, client=prisma) {
  const jobs=await client.rfqDispatchAttempt.findMany({where:{kind:"RESEND",status:"QUEUED"},orderBy:[{requestedAt:"asc"},{id:"asc"}],take:25,select:{id:true}});
  const results=[];
  for(const job of jobs) {
    const claim=await client.rfqDispatchAttempt.updateMany({where:{id:job.id,status:"QUEUED"},data:{status:"SENDING"}});
    if(!claim.count)continue;
    const attempt=await client.rfqDispatchAttempt.findUnique({where:{id:job.id},include:{match:{include:{supplier:true,communicationRequest:true,response:{select:{id:true}}}}}});
    if(!attempt)continue;
    const match=attempt.match;let status="SKIPPED_INELIGIBLE",messageId:string|undefined;
    let reason=deliveryEligibility(match,new Date());
    if(!reason) {try {await assertSourcingOpen(client,match.communicationRequestId);}catch(error){if(error instanceof PublicError)reason=error.message;else throw error;}}
    if(!reason) {
      try {const result=await send({matchId:match.id,attemptId:attempt.id,rfqId:match.communicationRequestId,phone:normalizeConsentPhone(match.supplier.phone,match.supplier.phoneCountryCode)!,deadline:match.quoteDeadlineAt});
        if(!result.messageId)throw new Error("Missing delivery ID");messageId=result.messageId;status="SENT";
      } catch {status="AMBIGUOUS_ERROR";}
    }
    const sentAt=messageId?new Date():null;
    await client.$transaction(async tx=>{
      await tx.rfqDispatchAttempt.updateMany({where:{id:job.id,status:"SENDING"},data:{status,providerMessageId:messageId||null,sentAt}});
      // Retain the old message on the match. Every resend has independent receipts
      // in the attempt ledger, avoiding late callbacks corrupting another message.
      if(messageId)await tx.communicationRequestMatch.update({where:{id:match.id},data:{reminderCount:{increment:1},lastReminderSentAt:sentAt}});
    });
    results.push({attemptId:attempt.id,status});
  }
  return results;
}
