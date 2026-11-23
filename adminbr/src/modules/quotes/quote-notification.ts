import { prisma } from "../../infrastructure/db.js";
import { config } from "../../config.js";
type Event = { email: string; rfqNumber: string; rfqId: string; requesterRole: string; price: string; quoteId: string; revision: number };
export type QuoteReadySender = (event: Event) => Promise<string>;
export async function sendBuyerQuoteEmail(event: Event, send: typeof fetch = fetch) {
  if (!config.postmarkToken || !config.postmarkFrom || !config.appBaseUrl) throw new Error("Buyer email configuration is incomplete");
  const path = event.requesterRole === "SUPPLIER" ? "/supplier/inquiries/placed/" : "/buyer/inquiries/";
  const link = new URL(path + encodeURIComponent(event.rfqId), config.appBaseUrl).toString();
  const response = await send("https://api.postmarkapp.com/email", { method: "POST", signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Postmark-Server-Token": config.postmarkToken },
    body: JSON.stringify({ From: config.postmarkFrom, To: event.email, Subject: `Your MyloNex quote is ready — ${event.rfqNumber}`,
      TextBody: `A quote for ${event.rfqNumber} is ready for review.\nFinal buyer price: INR ${event.price}/m.\nReview the quote: ${link}`,
      MessageStream: config.postmarkStream, TrackLinks: "None", Metadata: { quoteId: event.quoteId, revision: String(event.revision) } }),
  });
  const body = await response.json() as { ErrorCode?: number; MessageID?: string };
  if (!response.ok || body.ErrorCode !== 0 || !body.MessageID) throw new Error("Buyer quote email was not confirmed");
  return body.MessageID;
}
export async function notifyReleasedQuote(id: string, client = prisma, sender?: QuoteReadySender) {
  if (!sender && !config.postmarkEnabled) return { state: "QUEUED", message: "Quote released; buyer email queued until the delivery worker is enabled." };
  if (!sender && (!config.postmarkToken || !config.postmarkFrom || !config.appBaseUrl)) return { state: "QUEUED", message: "Quote released; buyer email remains queued until Postmark delivery configuration is complete." };
  const claimed = await client.communicationRequestResponse.updateMany({ where: { id, status: "APPROVED_FOR_REQUESTER", buyerNotificationStatus: "QUEUED" }, data: { buyerNotificationStatus: "SENDING" } });
  if (!claimed.count) return { state: "UNCHANGED", message: "Buyer notification is already claimed or completed." };
  const quote = await client.communicationRequestResponse.findUnique({ where: { id }, include: { requestMatch: { include: { communicationRequest: { include: { buyer: { select: { email: true } } } } } } } });
  if (!quote) return { state: "MISSING", message: "Quote no longer exists." };
  let state = "AMBIGUOUS_ERROR", messageId: string | undefined;
  const request = quote.requestMatch.communicationRequest;
  if (quote.status !== "APPROVED_FOR_REQUESTER" || quote.validUntilDate && quote.validUntilDate <= new Date()) state = "SKIPPED_INELIGIBLE";
  else {
    try { messageId = await (sender || sendBuyerQuoteEmail)({ email: request.buyer.email, rfqNumber: request.rfqNumber,
      rfqId: request.id, requesterRole: request.requesterRole, price: quote.price.toFixed(2), quoteId: quote.id, revision: quote.submissionRevision });
      if (!messageId) throw new Error("Missing delivery ID"); state = "SENT";
    } catch { /* Uncertain external delivery must be reconciled, never blindly retried. */ }
  }
  await client.communicationRequestResponse.updateMany({ where: { id, submissionRevision: quote.submissionRevision, buyerNotificationStatus: "SENDING" },
    data: { buyerNotificationStatus: state, buyerNotificationMessageId: messageId || null } });
  return { state, message: state === "SENT" ? "Buyer quote-ready email sent." : "Quote released; buyer notification requires delivery reconciliation." };
}
export async function drainBuyerQuoteNotifications(client = prisma, sender?: QuoteReadySender) {
  const rows = await client.communicationRequestResponse.findMany({ where: { status: "APPROVED_FOR_REQUESTER", buyerNotificationStatus: "QUEUED" }, take: 25, orderBy: { buyerNotificationQueuedAt: "asc" }, select: { id: true } });
  const results = [];
  for (const row of rows) results.push(await notifyReleasedQuote(row.id, client, sender));
  return results;
}
