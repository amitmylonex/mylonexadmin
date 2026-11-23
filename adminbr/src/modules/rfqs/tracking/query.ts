import { Prisma } from "@prisma/client";
import type { TrackingQuery } from "./schema.js";

// Fixed SQL aliases only; every user input is a bound Prisma parameter.
export function trackingPredicates(now: Date) {
  const read = Prisma.sql`(m.whatsapp_read_at IS NOT NULL OR UPPER(m.whatsapp_status) = 'READ')`;
  const delivered = Prisma.sql`(${read} OR m.whatsapp_delivered_at IS NOT NULL OR UPPER(m.whatsapp_status) = 'DELIVERED')`;
  const sent = Prisma.sql`(${delivered} OR m.whatsapp_sent_at IS NOT NULL OR m.whatsapp_message_id IS NOT NULL OR UPPER(m.whatsapp_status) = 'SENT')`;
  const attempted = Prisma.sql`(${sent} OR m.last_reminder_sent_at IS NOT NULL OR UPPER(m.whatsapp_status) IN ('SENDING','FAILED','AMBIGUOUS_ERROR','SENDING_SHORTLISTED','SENDING_CLOSED','AMBIGUOUS_SHORTLISTED','AMBIGUOUS_CLOSED'))`;
  const declined = Prisma.sql`(m.status = 'REJECTED_BY_SUPPLIER' OR m.supplier_rejected_at IS NOT NULL OR UPPER(m.whatsapp_status) = 'DECLINED')`;
  const awaiting = Prisma.sql`(m.status = 'FORWARDED_TO_SUPPLIER' AND ${sent} AND p.id IS NULL AND NOT COALESCE(${declined},false)
        AND COALESCE(UPPER(m.whatsapp_status),'') NOT IN ('DECLINED','CLARIFYING','NO_RESPONSE','CLOSED','SHORTLISTED','SENDING_CLOSED','SENDING_SHORTLISTED','AMBIGUOUS_CLOSED','AMBIGUOUS_SHORTLISTED','FAILED')
        AND (m.quote_deadline_at IS NULL OR m.quote_deadline_at > ${now}))`;
  const noResponse = Prisma.sql`(p.id IS NULL AND NOT COALESCE(${declined},false) AND COALESCE(UPPER(m.whatsapp_status),'') <> 'CLARIFYING'
        AND (UPPER(m.whatsapp_status) = 'NO_RESPONSE' OR (m.status = 'FORWARDED_TO_SUPPLIER' AND m.quote_deadline_at <= ${now})))`;
  return { read, delivered, sent, attempted, declined, awaiting, noResponse };
}
export function trackingWhere(query: TrackingQuery, now: Date) {
  const predicates = trackingPredicates(now);
  const filters: Prisma.Sql[] = [
    Prisma.sql`r.requester_role = 'BUYER' AND r.request_type = 'quote'`,
  ];
  if (query.q) {
    const search = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(Prisma.sql`(r.rfq_number ILIKE ${search} OR r.fabric_name ILIKE ${search} OR EXISTS (
            SELECT 1 FROM communication_request_matches sm JOIN "SupplierProfile" s ON s.id = sm.supplier_id
            WHERE sm.communication_request_id = r.id AND (s."companyName" ILIKE ${search} OR s.id ILIKE ${search})))`);
  }
  if (query.from)
    filters.push(
      Prisma.sql`r.created_at >= ${new Date(query.from + "T00:00:00Z")}`,
    );
  if (query.to)
    filters.push(
      Prisma.sql`r.created_at < ${new Date(new Date(query.to + "T00:00:00Z").getTime() + 86400000)}`,
    );
  const states: Partial<Record<TrackingQuery["status"], Prisma.Sql>> = {
    "not-attempted": Prisma.sql`NOT COALESCE(${predicates.attempted}, false)`,
    sending: Prisma.sql`UPPER(m.whatsapp_status) IN ('SENDING','SENDING_SHORTLISTED','SENDING_CLOSED')`,
    sent: predicates.sent,
    delivered: predicates.delivered,
    read: predicates.read,
    quoted: Prisma.sql`p.id IS NOT NULL`,
    declined: predicates.declined,
    clarifying: Prisma.sql`UPPER(m.whatsapp_status) = 'CLARIFYING'`,
    failed: Prisma.sql`UPPER(m.whatsapp_status) = 'FAILED'`,
    "no-response": predicates.noResponse,
  };
  if (query.status === "no-matches")
    filters.push(
      Prisma.sql`NOT EXISTS (SELECT 1 FROM communication_request_matches m WHERE m.communication_request_id = r.id)`,
    );
  else if (states[query.status])
    filters.push(Prisma.sql`EXISTS (SELECT 1 FROM communication_request_matches m
        LEFT JOIN communication_request_responses p ON p.request_match_id = m.id WHERE m.communication_request_id = r.id AND ${states[query.status]})`);
  return Prisma.join(filters, " AND ");
}
