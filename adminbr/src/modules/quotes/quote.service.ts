import { Prisma } from "@prisma/client";
import { quoteDecisionSchema } from "./quote.schema.js";
import * as repo from "./quote.repository.js";
import { listQuerySchema, idSchema } from "../../common/pagination/query.js";
import { readWhatsAppQuoteMetadata } from "./quote-metadata.js";
import { PublicError } from "../../common/errors/public-error.js";
import { prisma } from "../../infrastructure/db.js";
import { quoteApprovalSchema, quoteRejectionSchema, expiryFromDate } from "./quote.schema.js";
import { notifyReleasedQuote } from "./quote-notification.js";
export function publicQuoteTerms(notes: string | null | undefined) {
  const metadata = readWhatsAppQuoteMetadata(notes);
  if (!metadata) return null;
  const { inboundMessageId: _privateId, ...terms } = metadata;
  return terms;
}
export async function list(query: unknown, client = prisma) {
  const result = await repo.listPending(listQuerySchema.parse(query), client);
  return {
    ...result,
    quotes: result.quotes.map((q) => ({
      ...q,
      whatsAppTerms: publicQuoteTerms(q.additionalNotes),
      additionalNotes: readWhatsAppQuoteMetadata(q.additionalNotes)
        ? null
        : /^\s*[\[{]/.test(q.additionalNotes || "")
          ? null
          : q.additionalNotes,
    })),
  };
}
export function buildQuoteReview(
  existing: any,
  decision: "approve" | "reject",
  input: ReturnType<typeof quoteDecisionSchema.parse>,
  actor: string,
): Prisma.CommunicationRequestResponseUncheckedUpdateManyInput {
  if (decision === "reject" && input.edits)
    throw new PublicError(
      400,
      "Quote edits can only be released with approval",
    );
  const edits = input.edits;
  const protectedMetadata =
    readWhatsAppQuoteMetadata(existing.additionalNotes) ||
    /^\s*[\[{]/.test(existing.additionalNotes || "");
  return {
    status:
      decision === "approve" ? "APPROVED_FOR_REQUESTER" : "REJECTED_BY_ADMIN",
    adminReviewedAt: new Date(),
    adminReviewedByUserId: actor,
    adminReviewNote: input.note || null,
    ...(decision === "approve" && existing.supplierOriginalPrice == null ? { supplierOriginalPrice: existing.price } : {}),
    ...(edits
      ? {
          ...edits,
          additionalNotes: protectedMetadata
            ? undefined
            : edits.additionalNotes,
          ...(existing.supplierOriginalPrice == null
            ? { supplierOriginalPrice: existing.price }
            : {}),
        }
      : {}),
  };
}
export async function decide(
  id: unknown,
  decision: "approve" | "reject",
  body: unknown,
  actor: string,
  client = prisma,
  notify = notifyReleasedQuote,
) {
  const input = decision === "approve" ? quoteApprovalSchema.parse(body || {}) : quoteRejectionSchema.parse(body);
  const quoteId = idSchema.parse({ id }).id;
  const result = await repo.reviewLocked(
    quoteId,
    (existing) => {
      if (decision === "reject") return { status: "REJECTED_BY_ADMIN", adminReviewedAt: new Date(), adminReviewedByUserId: actor,
        adminReviewNote: (input as ReturnType<typeof quoteRejectionSchema.parse>).rejectionReason };
      const approval = input as ReturnType<typeof quoteApprovalSchema.parse>;
      const expiry = approval.validUntilDate ? expiryFromDate(approval.validUntilDate) : existing.validUntilDate;
      if (expiry && expiry <= new Date()) throw new PublicError(400, "Quote expiry has passed; choose a new future date before release.");
      return { status: "APPROVED_FOR_REQUESTER", adminReviewedAt: new Date(), adminReviewedByUserId: actor, adminReviewNote: approval.adminReviewNote || null,
        ...(existing.supplierOriginalPrice == null ? { supplierOriginalPrice: existing.price } : {}),
        ...(approval.markupPriceInr !== undefined ? { price: new Prisma.Decimal(approval.markupPriceInr) } : {}),
        ...(approval.validUntilDate ? { validUntilDate: expiry } : {}),
        buyerNotificationStatus: "QUEUED", buyerNotificationMessageId: null, buyerNotificationQueuedAt: new Date() };
    }, client,
  );
  if (!result)
    throw new PublicError(
      409,
      "Quote is no longer pending. Refresh the queue before reviewing it.",
    );
  let notification;
  if (decision === "approve") {
    try { notification = await notify(quoteId, client); }
    catch { notification = { state: "QUEUED_OR_RECONCILIATION_REQUIRED", message: "Quote released; buyer notification delivery needs reconciliation." }; }
  }
  return {
    ok: true,
    quote: result,
    ...(notification ? { notification } : {}),
  };
}
