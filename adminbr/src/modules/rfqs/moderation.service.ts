import { prisma } from "../../infrastructure/db.js";
import { PublicError } from "../../common/errors/public-error.js";
import { idSchema } from "../../common/pagination/query.js";
import { approvalSchema, rejectionSchema, moderationBulkSchema, moderationQuerySchema } from "./moderation.schema.js";
import { routingRequestSelect, findRoutingCandidates } from "./matching/candidates.js";
import { commitModeration } from "./moderation.transaction.js";
import { listModeration } from "./moderation.repository.js";

export function createModerationService(client = prisma, matcher = findRoutingCandidates, commit = commitModeration) {
  async function review(id: string, decision: "approve" | "reject", actor: string, note?: string) {
    const request = await client.communicationRequest.findUnique({ where: { id }, select: routingRequestSelect });
    if (!request || request.requesterRole !== "BUYER") throw new PublicError(404, "Buyer RFQ not found");
    const candidates = decision === "approve" && request.status === "pending" ? await matcher(request, client) : [];
    return commit(id, decision, actor, note, { updatedAt: request.updatedAt, candidates }, client);
  }
  return {
    list: (query: unknown) => listModeration(moderationQuerySchema.parse(query), client, matcher),
    async approve(id: unknown, body: unknown, actor: string) {
      const input = approvalSchema.parse(body ?? {});
      return review(idSchema.parse({ id }).id, "approve", actor, input.note);
    },
    async reject(id: unknown, body: unknown, actor: string) {
      const input = rejectionSchema.parse(body);
      return review(idSchema.parse({ id }).id, "reject", actor, input.reason);
    },
    async bulk(body: unknown, actor: string) {
      // Validate the complete batch before performing any writes.
      const input = moderationBulkSchema.parse(body);
      const results = [], failures = [];
      for (const id of input.ids) {
        try { results.push(await review(id, input.decision, actor, input.decision === "reject" ? input.reason : input.note)); }
        catch (error) { failures.push({ rfqId: id, message: error instanceof PublicError ? error.message : "Unable to review this RFQ. Retry or contact support." }); }
      }
      return { requestedCount: input.ids.length, changedCount: results.filter(r => !r.alreadyReviewed).length,
        failedCount: failures.length, results, failures,
        awaitingSupplierCount: input.decision === "approve" ? results.filter(r => !r.alreadyReviewed && r.matchedSupplierCount === 0).length : 0,
        queuedCount: results.reduce((sum, r) => sum + r.queuedCount, 0), matchedSupplierCount: results.reduce((sum, r) => sum + r.matchedSupplierCount, 0) };
    },
  };
}
export const moderationService = createModerationService();
