import { z } from "zod";
import { prisma } from "../../../infrastructure/db.js";
import { PublicError } from "../../../common/errors/public-error.js";
import { idSchema } from "../../../common/pagination/query.js";
import { activeRfqStates, assertSourcingOpen } from "../tracking/actions.js";
import { findRoutingCandidates, routingRequestSelect } from "./candidates.js";

export const rematchSchema = z.object({ note: z.string().trim().max(2000).optional() }).strict();
export async function rematchRfq(rawId: unknown, body: unknown, actor: string, client = prisma, matcher = findRoutingCandidates) {
  const id = idSchema.parse({ id: rawId }).id, input = rematchSchema.parse(body ?? {});
  const request = await client.communicationRequest.findUnique({ where: { id }, select: routingRequestSelect });
  if (!request) throw new PublicError(404, "RFQ not found");
  if (!["pending", ...activeRfqStates].includes(request.status)) throw new PublicError(409, "Sourcing is closed for this RFQ");
  const version = request.updatedAt.getTime();
  const candidates = await matcher(request, client);
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM communication_requests WHERE id=${id} FOR UPDATE`;
    const current = await tx.communicationRequest.findUnique({ where: { id }, select: routingRequestSelect });
    if (!current || !["pending", ...activeRfqStates].includes(current.status)) throw new PublicError(409, "Sourcing is closed for this RFQ");
    if (current.updatedAt.getTime() !== version) throw new PublicError(409, "RFQ requirements changed. Re-run matching again.");
    await assertSourcingOpen(tx, id);
    const suppliers = candidates.length ? await tx.supplierProfile.findMany({ where: { id: { in: candidates.map(c => c.supplierId) }, status: "APPROVED" }, select: { id: true } }) : [];
    const eligible = new Set(suppliers.map(s => s.id));
    const catalogIds = candidates.filter(c => c.sourceType === "supplier_catalog").map(c => c.sourceId);
    const wovenIds = candidates.filter(c => c.sourceType === "woven_product").map(c => c.sourceId);
    const [catalog, woven] = await Promise.all([
      catalogIds.length ? tx.supplierCatalog.findMany({where:{id:{in:catalogIds},isActive:true},select:{id:true,supplierId:true}}) : [],
      wovenIds.length ? tx.wovenProduct.findMany({where:{id:{in:wovenIds},isActive:true},select:{id:true,supplierId:true}}) : [],
    ]);
    const active = new Set([...catalog.map(c => `supplier_catalog:${c.id}:${c.supplierId}`),...woven.map(c => `woven_product:${c.id}:${c.supplierId}`)]);
    // Unique request/source/listing/supplier tuple prevents concurrent duplicate inserts.
    // Never upsert: existing decisions, scores, quotes and delivery evidence survive.
    const rows = candidates.filter(c => c.sourceType !== "manual" && eligible.has(c.supplierId) && active.has(`${c.sourceType}:${c.sourceId}:${c.supplierId}`)).map(c => ({
      communicationRequestId: id, supplierId: c.supplierId, sourceType: c.sourceType, sourceId: c.sourceId,
      score: c.score, explanation: c.explanation, listingSnapshot: c.listingSnapshot, status: "PENDING_ADMIN_REVIEW" as const,
      routeMeta: { rematchedByAdmin: actor, note: input.note || "" },
    }));
    const saved = rows.length ? await tx.communicationRequestMatch.createMany({ data: rows, skipDuplicates: true }) : { count: 0 };
    const totalMatchCount = await tx.communicationRequestMatch.count({ where: { communicationRequestId: id } });
    return { createdCount: saved.count, candidateCount: rows.length, totalMatchCount, queuedCount: 0,
      message: saved.count ? `${saved.count} new match(es) awaiting Admin review. No notifications sent.` : "No new eligible matches. Existing match history is unchanged." };
  }, { timeout: 30000 });
}
