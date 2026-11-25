import { prisma } from "../../../infrastructure/db.js";
import { PublicError } from "../../../common/errors/public-error.js";
import { normalizeConsentPhone } from "../../suppliers/supplier-phone.js";
import { activeRfqStates, assertSourcingOpen } from "../tracking/actions.js";
import { matchingSpecSchema } from "../moderation.schema.js";
import { normalizedListingFromCatalog, normalizedListingFromWoven, parseRequirementFromRequest, scoreListingMatch } from "./engine.js";

export async function decideMatch(id: string, decision: "forward" | "reject", actor: string, note: string | undefined, client = prisma) {
  const reference = await client.communicationRequestMatch.findUnique({ where: { id }, select: { communicationRequestId: true, supplierId: true } });
  if (!reference) throw new PublicError(404, "Supplier match not found");
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM communication_requests WHERE id=${reference.communicationRequestId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "SupplierProfile" WHERE id=${reference.supplierId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM communication_request_matches WHERE id=${id} FOR UPDATE`;
    const match = await tx.communicationRequestMatch.findUnique({ where: { id }, include: { supplier: true, communicationRequest: true } });
    if (!match) throw new PublicError(404, "Supplier match not found");
    const target = decision === "forward" ? "FORWARDED_TO_SUPPLIER" : "REJECTED_BY_ADMIN";
    if (match.status === target) return { changedCount: 0, alreadyReviewedCount: 1, queuedCount: 0 };
    if (match.status !== "PENDING_ADMIN_REVIEW") throw new PublicError(409, "Match has already been reviewed. Refresh its history.");
    const request = match.communicationRequest;
    if (!["pending", ...activeRfqStates].includes(request.status)) throw new PublicError(409, "Sourcing is closed for this RFQ");
    const now = new Date();
    if (decision === "reject") {
      await tx.communicationRequestMatch.update({ where: { id }, data: { status: target, adminReviewedAt: now, adminReviewedByUserId: actor, adminReviewNote: note || null } });
      return { changedCount: 1, alreadyReviewedCount: 0, queuedCount: 0 };
    }
    await assertSourcingOpen(tx, request.id);
    if (match.supplier.status !== "APPROVED") throw new PublicError(409, "Supplier is not currently approved");
    if (match.sourceType !== "manual") {
      const where = { id: match.sourceId, supplierId: match.supplierId, isActive: true };
      const listing = match.sourceType === "supplier_catalog"
        ? await tx.supplierCatalog.findFirst({ where, include: { supplier: true } })
        : match.sourceType === "woven_product" ? await tx.wovenProduct.findFirst({ where, include: { supplier: true, specs: true } }) : null;
      if (!listing) throw new PublicError(409, "The matched listing is no longer active");
      const raw = request.specPayload as Record<string, any> | null;
      if (raw?.origin === "fabric_quick_rfq") {
        if (match.sourceType !== "supplier_catalog" || match.sourceId !== raw.selectedFabricId) throw new PublicError(409, "The selected fabric changed");
      } else {
        const parsed = matchingSpecSchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(409, "Review the RFQ requirements before forwarding");
        const requirement = parseRequirementFromRequest(parsed.data, request.deliveryPincode); requirement.quantity = request.quantity;
        const normalized = match.sourceType === "supplier_catalog" ? normalizedListingFromCatalog(listing as any) : normalizedListingFromWoven(listing as any);
        if (!scoreListingMatch(normalized, requirement)) throw new PublicError(409, "The listing no longer meets this RFQ's requirements");
      }
    }
    const prior = Boolean(match.whatsappStatus || match.whatsappMessageId);
    const queue = Boolean(!prior && match.supplier.whatsappConsent && match.supplier.whatsappConsentAt && normalizeConsentPhone(match.supplier.phone, match.supplier.phoneCountryCode));
    const state = queue ? "QUEUED" : !match.supplier.whatsappConsent || !match.supplier.whatsappConsentAt ? "SKIPPED_NO_CONSENT" : "SKIPPED_INVALID_PHONE";
    await tx.communicationRequestMatch.update({ where: { id }, data: { status: target, forwardedAt: now, adminReviewedAt: now,
      adminReviewedByUserId: actor, adminReviewNote: note || null, quoteDeadlineAt: match.quoteDeadlineAt || new Date(now.getTime() + 72 * 3600000),
      ...(!prior ? { whatsappStatus: state } : {}) } });
    if (request.status === "pending") await tx.communicationRequest.update({ where: { id: request.id }, data: {
      status: "approved", adminReviewedAt: now, adminReviewedByUserId: actor, adminReviewNote: note || null } });
    return { changedCount: 1, alreadyReviewedCount: 0, queuedCount: queue ? 1 : 0 };
  }, { timeout: 30000 });
}
export async function decideMatchBatch(ids: string[], decision: "forward" | "reject", actor: string, note?: string, client = prisma) {
  let changedCount = 0, queuedCount = 0, alreadyReviewedCount = 0;
  const failures: Array<{ matchId: string; message: string }> = [];
  for (const id of ids) {
    try { const result = await decideMatch(id, decision, actor, note, client); changedCount += result.changedCount; queuedCount += result.queuedCount; alreadyReviewedCount += result.alreadyReviewedCount; }
    catch (error) { failures.push({ matchId: id, message: error instanceof PublicError ? error.message : "Could not review this match. Retry shortly." }); }
  }
  return { changedCount, requestedCount: ids.length, alreadyReviewedCount, queuedCount, failures,
    notification: { message: `${queuedCount} WhatsApp notifications queued. Queueing is not delivery confirmation; unconsented suppliers receive dashboard routing only.` } };
}
