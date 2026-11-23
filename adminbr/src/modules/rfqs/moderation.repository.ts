import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import type { ModerationQuery } from "./moderation.schema.js";
import { findRoutingCandidates } from "./matching/candidates.js";
import { visibleRfq } from "./moderation.privacy.js";
export async function listModeration(q: ModerationQuery, client = prisma, match = findRoutingCandidates) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  const pending: Prisma.CommunicationRequestWhereInput = { status: "pending", requesterRole: "BUYER" };
  const where: Prisma.CommunicationRequestWhereInput = { ...pending, ...(q.search ? { OR: [{ rfqNumber: contains }, { fabricName: contains }, { anonymizedBuyerReference: contains }] } : {}) };
  const [records, totalCount, pendingCount, urgentCount] = await Promise.all([
    client.communicationRequest.findMany({ where, take: q.pageSize, skip: (q.page - 1) * q.pageSize,
      orderBy: [{ createdAt: q.sort === "oldest" ? "asc" : "desc" }, { id: "asc" }], include: { buyer: { select: { fullName: true, email: true } } } }),
    client.communicationRequest.count({ where }), client.communicationRequest.count({ where: pending }),
    client.communicationRequest.count({ where: { ...pending, priority: { in: ["urgent", "high"] } } }),
  ]);
  // Sequential, bounded previews avoid multiplying catalog scans/connections for
  // a full queue page; each matcher retains at most eight supplier candidates.
  const rfqs = [];
  for (const request of records) {
    const candidates = await match(request, client);
    const ids = candidates.map(candidate => candidate.supplierId);
    const suppliers = ids.length ? await client.supplierProfile.findMany({ where: { id: { in: ids }, status: "APPROVED" },
      select: { id: true, whatsappConsent: true, whatsappConsentAt: true } }) : [];
    rfqs.push({ ...visibleRfq(request), proposedMatches: candidates.filter(candidate => suppliers.some(s => s.id === candidate.supplierId)).map(candidate => ({
      supplierId: candidate.supplierId, companyName: candidate.supplierName, sourceType: candidate.sourceType, score: candidate.score, explanation: candidate.explanation,
      whatsappConsent: Boolean(suppliers.find(s => s.id === candidate.supplierId)?.whatsappConsent && suppliers.find(s => s.id === candidate.supplierId)?.whatsappConsentAt),
    })) });
  }
  return { rfqs, metrics: { pendingCount, urgentCount }, totalCount, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(totalCount / q.pageSize)) };
}
