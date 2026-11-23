import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { PublicError } from "../../common/errors/public-error.js";
import { normalizeConsentPhone } from "../suppliers/supplier-phone.js";
import { matchingSpecSchema } from "./moderation.schema.js";
import { type RoutingCandidate } from "./matching/candidates.js";
import { normalizedListingFromCatalog, normalizedListingFromWoven, parseRequirementFromRequest, scoreListingMatch } from "./matching/engine.js";

export async function commitModeration(id: string, decision: "approve" | "reject", actor: string, note: string | undefined,
  prepared: { updatedAt: Date; candidates: RoutingCandidate[] }, client = prisma) {
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM communication_requests WHERE id = ${id} FOR UPDATE`;
    const request = await tx.communicationRequest.findUnique({ where: { id } });
    if (!request || request.requesterRole !== "BUYER") throw new PublicError(404, "Buyer RFQ not found");
    const target = decision === "approve" ? "approved" : "rejected";
    if (request.status === target) return { rfqId: id, status: target, alreadyReviewed: true, matchedSupplierCount: 0, queuedCount: 0, dashboardOnlyCount: 0 };
    if (request.status !== "pending") throw new PublicError(409, "This RFQ is no longer pending. Refresh the queue.");
    if (request.updatedAt.getTime() !== prepared.updatedAt.getTime()) throw new PublicError(409, "RFQ requirements changed. Refresh the preview before reviewing.");
    const now = new Date();
    if (decision === "reject") {
      if (await tx.communicationRequestMatch.findFirst({ where: { communicationRequestId: id, status: "FORWARDED_TO_SUPPLIER" }, select: { id: true } })) throw new PublicError(409, "This RFQ already has forwarded matches. Review its routing history instead of rejecting it.");
      await tx.communicationRequestMatch.updateMany({ where: { communicationRequestId: id, status: "PENDING_ADMIN_REVIEW" },
        data: { status: "REJECTED_BY_ADMIN", adminReviewedAt: now, adminReviewedByUserId: actor, adminReviewNote: note } });
      await tx.communicationRequest.update({ where: { id }, data: { status: target, adminReviewNote: note, adminReviewedAt: now, adminReviewedByUserId: actor } });
      return { rfqId: id, status: target, alreadyReviewed: false, matchedSupplierCount: 0, queuedCount: 0, dashboardOnlyCount: 0 };
    }
    if (!prepared.candidates.length) throw new PublicError(409, "No eligible approved supplier matches. Review specs or add an explicit manual match.");
    const ids = [...new Set(prepared.candidates.map(row => row.supplierId))].sort();
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM "SupplierProfile" WHERE id IN (${Prisma.join(ids)}) AND status = 'APPROVED' ORDER BY id FOR SHARE`);
    const suppliers = await tx.supplierProfile.findMany({ where: { id: { in: locked.map(row => row.id) }, status: "APPROVED" } });
    const raw = request.specPayload as Record<string, any> | null;
    const parsed = matchingSpecSchema.safeParse(raw);
    const requirement = parsed.success ? parseRequirementFromRequest(parsed.data, request.deliveryPincode) : null;
    if (requirement) requirement.quantity = request.quantity;
    let matchedSupplierCount = 0, queuedCount = 0, dashboardOnlyCount = 0;
    for (const candidate of prepared.candidates) {
      const supplier = suppliers.find(row => row.id === candidate.supplierId); if (!supplier) continue;
      let snapshot = candidate.listingSnapshot;
      let scored: { score: number; explanation: string } | null = candidate;
      if (candidate.sourceType !== "manual") {
        const where = { id: candidate.sourceId, supplierId: supplier.id, isActive: true };
        const listing = candidate.sourceType === "supplier_catalog"
          ? await tx.supplierCatalog.findFirst({ where, include: { supplier: true } })
          : await tx.wovenProduct.findFirst({ where, include: { supplier: true, specs: true } });
        if (!listing) continue;
        if (raw?.origin === "fabric_quick_rfq" && (candidate.sourceType !== "supplier_catalog" || candidate.sourceId !== raw.selectedFabricId)) continue;
        const normalized = candidate.sourceType === "supplier_catalog" ? normalizedListingFromCatalog(listing as any) : normalizedListingFromWoven(listing as any);
        snapshot = { composition: normalized.composition, weave: normalized.weave, gsm: normalized.gsm, width: normalized.width, pricePerMeter: normalized.pricePerMeter, moq: normalized.moq };
        if (raw?.origin !== "fabric_quick_rfq") {
          if (!requirement) continue;
          if (!(normalized.width > 0)) continue;
          scored = scoreListingMatch(normalized, requirement); if (!scored) continue;
        }
      }
      const existing = await tx.communicationRequestMatch.findUnique({ where: { communicationRequestId_sourceType_sourceId_supplierId: {
        communicationRequestId: id, sourceType: candidate.sourceType, sourceId: candidate.sourceId, supplierId: supplier.id } } });
      if (candidate.sourceType === "manual" && !existing) continue;
      if (existing && ["REJECTED_BY_ADMIN", "REJECTED_BY_SUPPLIER"].includes(existing.status)) continue;
      if (existing?.status === "FORWARDED_TO_SUPPLIER") { matchedSupplierCount++; continue; }
      const phone = normalizeConsentPhone(supplier.phone, supplier.phoneCountryCode);
      const queue = Boolean(supplier.whatsappConsent && supplier.whatsappConsentAt && phone);
      const queueState = queue ? "QUEUED" : !supplier.whatsappConsent || !supplier.whatsappConsentAt ? "SKIPPED_NO_CONSENT" : "SKIPPED_INVALID_PHONE";
      const priorAttempt = Boolean(existing?.whatsappStatus || existing?.whatsappMessageId);
      const data = { status: "FORWARDED_TO_SUPPLIER" as const, adminReviewedAt: now, adminReviewedByUserId: actor, adminReviewNote: note || null,
        forwardedAt: now, quoteDeadlineAt: new Date(now.getTime() + 72 * 3600000), ...(!priorAttempt ? { whatsappStatus: queueState } : {}) };
      if (existing) await tx.communicationRequestMatch.update({ where: { id: existing.id }, data: { ...data, score: scored.score, explanation: scored.explanation, listingSnapshot: snapshot } });
      else await tx.communicationRequestMatch.create({ data: { ...data, communicationRequestId: id, supplierId: supplier.id, sourceType: candidate.sourceType,
        sourceId: candidate.sourceId, score: scored.score, explanation: scored.explanation, listingSnapshot: snapshot,
        routeMeta: { moderation: "rfq_approval", notification: queueState } } });
      matchedSupplierCount++; if (queue && !priorAttempt) queuedCount++; else dashboardOnlyCount++;
    }
    if (!matchedSupplierCount) throw new PublicError(409, "Supplier eligibility or listings changed. No routing was saved; refresh the preview.");
    await tx.communicationRequest.update({ where: { id }, data: { status: target, adminReviewNote: note || null, adminReviewedAt: now, adminReviewedByUserId: actor } });
    return { rfqId: id, status: target, alreadyReviewed: false, matchedSupplierCount, queuedCount, dashboardOnlyCount };
  }, { maxWait: 5000, timeout: 30000 });
}
