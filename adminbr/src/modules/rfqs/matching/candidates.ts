import { Prisma } from "@prisma/client";
import { prisma } from "../../../infrastructure/db.js";
import { matchingSpecSchema } from "../moderation.schema.js";
import { normalizedListingFromCatalog, normalizedListingFromWoven, parseRequirementFromRequest, scoreListingMatch, type NormalizedListing } from "./engine.js";
export const routingRequestSelect = { id: true, rfqNumber: true, status: true, requesterRole: true, specPayload: true, deliveryPincode: true, quantity: true, updatedAt: true } as const;
export type RoutingRequest = Prisma.CommunicationRequestGetPayload<{ select: typeof routingRequestSelect }>;
export type RoutingCandidate = { supplierId: string; supplierName: string; sourceType: "supplier_catalog" | "woven_product" | "manual"; sourceId: string; score: number; explanation: string; listingSnapshot: Prisma.InputJsonValue };
type Client = Prisma.TransactionClient;
export async function findRoutingCandidates(request: RoutingRequest, client: Client = prisma): Promise<RoutingCandidate[]> {
  const spec = request.specPayload as Record<string, any> | null;
  if (spec?.origin === "fabric_quick_rfq") {
    const id = typeof spec.selectedFabricId === "string" ? spec.selectedFabricId : "";
    const entry = id ? await client.supplierCatalog.findFirst({ where: { id, isActive: true, supplier: { status: "APPROVED" } }, include: { supplier: true } }) : null;
    return entry ? [{ supplierId: entry.supplierId, supplierName: entry.supplier.companyName, sourceType: "supplier_catalog", sourceId: entry.id, score: 100,
      explanation: "Exact fabric selected by the buyer; no similarity broadening.", listingSnapshot: { fabricName: entry.fabricName, composition: entry.compositionText, weave: entry.weaveType, gsm: entry.gsm, width: Number(entry.widthInches) } }] : [];
  }
  const parsed = matchingSpecSchema.safeParse(request.specPayload);
  const best = new Map<string, RoutingCandidate>();
  const keep = (candidate: RoutingCandidate) => {
    const previous = best.get(candidate.supplierId);
    if (!previous || candidate.score > previous.score || candidate.score === previous.score && candidate.sourceId < previous.sourceId) best.set(candidate.supplierId, candidate);
    if (best.size > 8) {
      const lowest = [...best.values()].sort((a, b) => a.score - b.score || b.sourceId.localeCompare(a.sourceId))[0]; best.delete(lowest.supplierId);
    }
  };
  if (parsed.success) {
    const requirement = parseRequirementFromRequest(parsed.data, request.deliveryPincode); requirement.quantity = request.quantity;
    if (requirement.composition && requirement.weave && requirement.gsmMin && requirement.gsmMax && requirement.width) {
      const score = (listing: NormalizedListing) => {
        if (!listing.composition.trim() || !(listing.width > 0)) return;
        const result = scoreListingMatch(listing, requirement);
        if (result) keep({ supplierId: listing.supplierId, supplierName: listing.supplierName, sourceType: listing.sourceType, sourceId: listing.sourceId, ...result,
          listingSnapshot: { composition: listing.composition, weave: listing.weave, gsm: listing.gsm, width: listing.width, pricePerMeter: listing.pricePerMeter, moq: listing.moq } });
      };
      // Keyset pages bound memory regardless of catalog size. Only the top eight
      // distinct suppliers are retained; no entire catalog is materialized.
      for (const kind of ["catalog", "woven"] as const) {
        let cursor: string | undefined;
        while (true) {
          const where = { isActive: true, supplier: { status: "APPROVED" as const }, ...(cursor ? { id: { gt: cursor } } : {}) };
          if (kind === "catalog") {
            const rows = await client.supplierCatalog.findMany({ where: { ...where, weaveType: { equals: requirement.weave, mode: "insensitive" } }, take: 200, orderBy: { id: "asc" }, include: { supplier: true } });
            for (const entry of rows) score(normalizedListingFromCatalog(entry));
            if (rows.length < 200) break; cursor = rows.at(-1)!.id;
          } else {
            const rows = await client.wovenProduct.findMany({ where, take: 200, orderBy: { id: "asc" }, include: { supplier: true, specs: true } });
            for (const entry of rows) score(normalizedListingFromWoven(entry));
            if (rows.length < 200) break; cursor = rows.at(-1)!.id;
          }
        }
      }
    }
  }
  const manual = await client.communicationRequestMatch.findMany({ where: { communicationRequestId: request.id, sourceType: "manual", status: "PENDING_ADMIN_REVIEW", supplier: { status: "APPROVED" } },
    take: 8, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { supplier: true } });
  // Explicit, audited manual sourcing remains available for missing or zero-match specs.
  const selected = manual.map(row => ({ supplierId: row.supplierId, supplierName: row.supplier.companyName, sourceType: "manual" as const, sourceId: row.sourceId,
    score: row.score, explanation: row.explanation, listingSnapshot: { sourceType: "manual", explanation: row.explanation } }));
  return [...selected, ...[...best.values()].sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId)).filter(row => !selected.some(item => item.supplierId === row.supplierId))].slice(0, 8);
}
