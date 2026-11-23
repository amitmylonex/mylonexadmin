import { prisma } from "../../infrastructure/db.js";
import { PublicError } from "../../common/errors/public-error.js";
import { assertSourcingOpen, activeRfqStates } from "../rfqs/tracking/actions.js";
import { normalizeConsentPhone } from "../suppliers/supplier-phone.js";

/** Provider adapter must use a finite timeout. A claimed/ambiguous delivery is
 * never automatically retried: reconcile provider callbacks before retrying. */
export type RfqSender = (input: { matchId: string; attemptId?: string; rfqId: string; phone: string; deadline: Date | null }) => Promise<{ messageId: string }>;
export async function drainQueuedRfqNotifications(send: RfqSender, client = prisma, limit = 25) {
  const rows = await client.communicationRequestMatch.findMany({ where: { whatsappStatus: "QUEUED", whatsappMessageId: null,
    status: "FORWARDED_TO_SUPPLIER" }, take: Math.min(25, Math.max(1, limit)), orderBy: [{ forwardedAt: "asc" }, { id: "asc" }], select: { id: true } });
  const results: Array<{ matchId: string; status: string }> = [];
  for (const row of rows) {
    // Conditional update claims the durable queue entry exactly once across workers.
    const claim = await client.communicationRequestMatch.updateMany({ where: { id: row.id, whatsappStatus: "QUEUED", whatsappMessageId: null,
      status: "FORWARDED_TO_SUPPLIER" }, data: { whatsappStatus: "SENDING" } });
    if (!claim.count) continue;
    const match = await client.communicationRequestMatch.findUnique({ where: { id: row.id }, include: { supplier: true, communicationRequest: true, response:{select:{id:true}} } });
    if (!match) continue;
    const attempt = await client.rfqDispatchAttempt.create({data:{matchId:match.id,kind:"INITIAL",status:"SENDING"}});
    const supplier = match.supplier, phone = normalizeConsentPhone(supplier.phone, supplier.phoneCountryCode);
    let eligible = supplier.status === "APPROVED" && supplier.whatsappConsent && supplier.whatsappConsentAt && phone && !match.response && activeRfqStates.includes(match.communicationRequest.status)
      && (!match.quoteDeadlineAt || match.quoteDeadlineAt > new Date());
    if (eligible) {try {await assertSourcingOpen(client,match.communicationRequestId);}catch(error){if(error instanceof PublicError)eligible=false;else throw error;}}
    let status = "SKIPPED_INELIGIBLE", messageId: string | undefined;
    if (eligible) {
      try {
        const sent = await send({ matchId: match.id, attemptId:attempt.id, rfqId: match.communicationRequestId, phone: phone!, deadline: match.quoteDeadlineAt });
        if (!sent.messageId) throw new Error("Missing provider message ID");
        status = "SENT"; messageId = sent.messageId;
      } catch { status = "AMBIGUOUS_ERROR"; }
    }
    const acceptedAt=messageId?new Date():null;
    const saved=await client.rfqDispatchAttempt.updateMany({where:{id:attempt.id,status:"SENDING"},data:{status,providerMessageId:messageId||null,sentAt:acceptedAt}});
    // A provider receipt may beat the network acknowledgement. Its higher
    // evidence must survive completion of the original send.
    const completed=saved.count?{status,providerMessageId:messageId||null,sentAt:acceptedAt,deliveredAt:null,readAt:null}:await client.rfqDispatchAttempt.findUnique({where:{id:attempt.id}});
    if(completed) {
      status=completed.status;
      await client.communicationRequestMatch.updateMany({where:{id:row.id,whatsappStatus:"SENDING",whatsappMessageId:null},data:{whatsappStatus:status,
        ...(completed.providerMessageId?{whatsappMessageId:completed.providerMessageId}:{}),...(completed.sentAt?{whatsappSentAt:completed.sentAt}:{}),
        ...(completed.deliveredAt?{whatsappDeliveredAt:completed.deliveredAt}:{}),...(completed.readAt?{whatsappReadAt:completed.readAt}:{})}});
    }
    results.push({ matchId: row.id, status });
  }
  return results;
}
