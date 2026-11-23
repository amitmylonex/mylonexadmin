import { Prisma } from "@prisma/client";
import { prisma as db } from "../../../infrastructure/db.js";
import { trackingInquirySelect, trackingMatchSelect } from "./select.js";
import { trackingPredicates, trackingWhere } from "./query.js";
import type { TrackingQuery } from "./schema.js";
import type { LifecycleEvidence } from "./lifecycle.js";
import type { TrackingSummary } from "./types.js";

export async function listTrackingRecords(query: TrackingQuery, now: Date) {
  const where = trackingWhere(query, now);
  const p = trackingPredicates(now);
  const [ids, aggregate] = await Promise.all([
    db.$queryRaw<
      Array<{ id: string }>
    >(Prisma.sql`SELECT r.id FROM communication_requests r WHERE ${where}
            ORDER BY r.created_at DESC, r.id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`),
    db.$queryRaw<
      Array<Record<keyof TrackingSummary, bigint>>
    >(Prisma.sql`WITH scoped AS (SELECT r.id FROM communication_requests r WHERE ${where})
            SELECT COUNT(DISTINCT r.id) AS inquiries,
            COUNT(DISTINCT m.id) FILTER (WHERE ${p.attempted}) AS attempted,
            COUNT(DISTINCT COALESCE(m.whatsapp_message_id,m.id)) FILTER (WHERE ${p.sent}) AS sent,
            COUNT(DISTINCT COALESCE(m.whatsapp_message_id,m.id)) FILTER (WHERE ${p.delivered}) AS delivered,
            COUNT(DISTINCT COALESCE(m.whatsapp_message_id,m.id)) FILTER (WHERE ${p.read}) AS read,
            COUNT(DISTINCT p.id) AS quoted,
            COUNT(DISTINCT m.id) FILTER (WHERE ${p.declined}) AS declined,
            COUNT(DISTINCT m.id) FILTER (WHERE UPPER(m.whatsapp_status) = 'CLARIFYING') AS clarifying,
            COUNT(DISTINCT m.id) FILTER (WHERE UPPER(m.whatsapp_status) = 'FAILED') AS failed,
            COUNT(DISTINCT (m.communication_request_id,m.supplier_id)) FILTER (WHERE ${p.awaiting}) AS awaiting,
            COUNT(DISTINCT m.id) FILTER (WHERE ${p.noResponse}) AS "noResponse"
            FROM scoped r LEFT JOIN communication_request_matches m ON m.communication_request_id = r.id
            LEFT JOIN communication_request_responses p ON p.request_match_id = m.id`),
  ]);
  const records = ids.length
    ? await db.communicationRequest.findMany({
        where: { id: { in: ids.map((row) => row.id) } },
        select: {
          ...trackingInquirySelect,
          matches: { select: trackingMatchSelect },
        },
      })
    : [];
  const byId = new Map(records.map((row) => [row.id, row]));
  const summary = Object.fromEntries(
    Object.entries(aggregate[0]).map(([key, value]) => [key, Number(value)]),
  ) as TrackingSummary;
  return { records: ids.map(({ id }) => byId.get(id)!), summary };
}
export async function getTrackingDetailRecord(id: string, page: number, client = db) {
  const inquiry = await readTrackingInquiry(id, client);
  if (!inquiry) return null;
  const [matches,total,evidenceRows] = await Promise.all([
    readTrackingMatches(id, page, client),
    client.communicationRequestMatch.count({where:{communicationRequestId:id}}),
    client.$queryRaw<LifecycleEvidence[]>`SELECT MIN(m.forwarded_at) AS "dispatchedAt", MIN(p.created_at) AS "quotedAt",
      COALESCE(BOOL_OR(p.status = 'ACCEPTED_BY_BUYER' OR p.buyer_decision = 'accepted'),false) AS accepted,
      MIN(p.buyer_decision_at) FILTER (WHERE p.buyer_decision = 'accepted' OR p.status = 'ACCEPTED_BY_BUYER') AS "acceptedAt",
      MIN(o.created_at) AS "orderAt",
      COALESCE(BOOL_OR(p.status = 'APPROVED_FOR_REQUESTER' AND p.buyer_decision IS DISTINCT FROM 'rejected'),false) AS "availableQuote",
      COALESCE(BOOL_OR(p.status = 'APPROVED_FOR_REQUESTER' AND p.buyer_decision = 'rejected'),false) AS "rejectedQuote",
      COALESCE(BOOL_OR(m.status = 'REJECTED_BY_SUPPLIER'),false) AS "supplierDeclined",
      COALESCE(BOOL_OR(m.forwarded_at IS NOT NULL),false) AS forwarded
      FROM communication_request_matches m LEFT JOIN communication_request_responses p ON p.request_match_id = m.id
      LEFT JOIN orders o ON o.response_id = p.id WHERE m.communication_request_id = ${id}`]);
  return {inquiry,matches,total,evidence:evidenceRows[0]};
}
export async function getTrackingWebhookRecords(ids: string[]) {
  // Only current quote metadata has a durable inbound-message association.
  return ids.length
    ? db.whatsAppWebhookEvent.findMany({
        where: { id: { in: [...new Set(ids)] } },
        select: {
          id: true,
          eventType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : [];
}

// Older shared databases do not retain these newer optional tracking records.
// Keep missing evidence empty; never infer an approval time or delivery event.
export async function readTrackingInquiry(id: string, client = db) {
  try {
    return await client.communicationRequest.findFirst({where:{id},select:{...trackingInquirySelect,adminReviewedAt:true}});
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2022" || !String(error.meta?.column).endsWith("admin_reviewed_at")) throw error;
    const inquiry = await client.communicationRequest.findFirst({where:{id},select:trackingInquirySelect});
    return inquiry ? {...inquiry,adminReviewedAt:null} : null;
  }
}
export async function readTrackingMatches(id: string, page: number, client = db) {
  const args = {where:{communicationRequestId:id},orderBy:[{createdAt:"asc" as const},{id:"asc" as const}],take:25,skip:(page-1)*25};
  try {
    return await client.communicationRequestMatch.findMany({...args,select:trackingMatchSelect});
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021" || !String(error.meta?.table).includes("rfq_dispatch_attempts")) throw error;
    const {dispatchAttempts: _dispatchAttempts,...select} = trackingMatchSelect;
    const matches = await client.communicationRequestMatch.findMany({...args,select});
    return matches.map(match=>({...match,dispatchAttempts:[]}));
  }
}
