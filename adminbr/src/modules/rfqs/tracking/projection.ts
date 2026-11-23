import { deliveryEligibility } from "./actions.js";
import { deriveAdminRfqStatus } from "../display-status.js";
import { readWhatsAppQuoteMetadata } from "../../quotes/quote-metadata.js";
import { isQuotePriceExpired } from "../../quotes/quote-validity.js";
import {
  summarizeMatches,
  supplierEligibility,
  trackingState,
} from "./state.js";
import type { TrackingInquiryRecord, TrackingMatchRecord } from "./select.js";
import type {
  TimelineEvent,
  TrackingListItem,
  TrackingQuote,
  TrackingSupplier,
} from "./types.js";

type WebhookRecord = {
  id: string;
  eventType: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};
const iso = (date: Date | null) => date?.toISOString() ?? null;
const label = (value: string) => value.toLowerCase().replace(/_/g, " ");
function ordinaryNotes(value: string | null) {
  if (!value) return null;
  // Never render unrecognized structured payloads as remarks.
  if (/^\s*[\[{]/.test(value)) return null;
  try {
    const decoded: unknown = JSON.parse(value);
    if (typeof decoded === "object" && decoded !== null) return null;
  } catch {
    /* Ordinary free text. */
  }
  return value;
}
export function projectTrackingQuote(
  response: NonNullable<TrackingMatchRecord["response"]>,
  now: Date,
): TrackingQuote {
  const metadata = readWhatsAppQuoteMetadata(response.additionalNotes);
  return {
    id: response.id,
    price: String(response.price),
    originalPrice:
      response.supplierOriginalPrice === null
        ? null
        : String(response.supplierOriginalPrice),
    priceBasis: metadata?.priceBasis ?? null,
    priceValidity: metadata?.priceValidity ?? null,
    priceValidUntil: metadata?.priceValidUntil ?? null,
    priceExpired: metadata?.priceValidUntil
      ? isQuotePriceExpired(metadata.priceValidUntil, now.getTime())
      : null,
    totalMoq: response.moq,
    moqPerColour: metadata?.moqPerColour ?? null,
    leadDays: response.leadTimeDays,
    sampleAvailability: metadata?.sampleStatus ?? response.sampleAvailability,
    sampleYardage: metadata?.sampleYardageM ?? null,
    sampleLeadDays: metadata?.sampleLeadTimeDays ?? null,
    samplingPrice: metadata?.samplingPrice ?? null,
    remarks:
      metadata?.remarks ??
      ordinaryNotes(response.additionalNotes) ??
      ordinaryNotes(response.notes) ??
      (!metadata && (response.additionalNotes || response.notes)
        ? "Unrecognized structured notes withheld."
        : null),
    approvalStatus: response.status,
    submittedAt: metadata?.submittedAt ?? response.createdAt.toISOString(),
    submittedAtLabel: metadata
      ? "Current WhatsApp submission"
      : response.submissionRevision > 1
        ? "First quote record created (revision submission time unavailable)"
        : "Quote record created",
    revision: response.submissionRevision,
    source: metadata
      ? `WhatsApp ${metadata.source.toLowerCase()}`
      : "Website / legacy channel",
    dispatchLocation: response.dispatchLocation,
  };
}
export function projectTrackingListItem(
  inquiry: TrackingInquiryRecord,
  matches: TrackingMatchRecord[],
  now: Date,
): TrackingListItem {
  const overall = deriveAdminRfqStatus(matches);
  return {
    id: inquiry.id,
    rfqNumber: inquiry.rfqNumber,
    fabricName: inquiry.fabricName,
    quantity: inquiry.quantity,
    createdAt: inquiry.createdAt.toISOString(),
    recordedStatus: inquiry.status,
    overallStatus: overall.label,
    overallTone: overall.tone,
    matchedSuppliers: new Set(matches.map((match) => match.supplierId)).size,
    eligibleSuppliers: new Set(
      matches
        .filter((match) => supplierEligibility(match).eligible)
        .map((match) => match.supplierId),
    ).size,
    matchCount: matches.length,
    counts: summarizeMatches(matches, now),
  };
}
export function projectTrackingSupplier(
  inquiry: TrackingInquiryRecord,
  match: TrackingMatchRecord,
  now: Date,
  webhook?: WebhookRecord,
): TrackingSupplier {
  const state = trackingState(match, now);
  const eligibility = supplierEligibility(match);
  const status = match.whatsappStatus?.toUpperCase();
  const quote = match.response
    ? projectTrackingQuote(match.response, now)
    : null;
  const timeline: TimelineEvent[] = [];
  const unavailableEvents: string[] = [];
  const add = (
    key: string,
    date: Date | string | null | undefined,
    text: string,
  ) => {
    if (date)
      timeline.push({
        key,
        at: typeof date === "string" ? date : date.toISOString(),
        label: text,
      });
  };
  add("inquiry", inquiry.createdAt, "Buyer submitted RFQ");
  add("match", match.createdAt, "Supplier match created");
  add("match-review", match.adminReviewedAt, "Admin match review recorded");
  add("forwarded", match.forwardedAt, "RFQ forwarded to supplier");
  add(
    "sent",
    match.whatsappSentAt,
    "Stored send acceptance time (match-level record)",
  );
  add(
    "delivered",
    match.whatsappDeliveredAt,
    "Delivery recorded (may be backfilled from read receipt)",
  );
  add("read", match.whatsappReadAt, "Read receipt recorded");
  add(
    "reminder",
    match.lastReminderSentAt,
    "Latest reminder attempt/reservation recorded; acceptance is not guaranteed",
  );
  add("declined", match.supplierRejectedAt, "Supplier declined inquiry");
  if (match.response && quote) {
    add("quote-created", match.response.createdAt, "Quote record created");
    if (quote.submittedAt !== match.response.createdAt.toISOString())
      add("quote-submission", quote.submittedAt, quote.submittedAtLabel);
    add(
      "quote-review",
      match.response.adminReviewedAt,
      `Quote review recorded: ${label(match.response.status)}`,
    );
    add(
      "buyer-decision",
      match.response.buyerDecisionAt,
      `Buyer decision recorded: ${match.response.buyerDecision || "unavailable"}`,
    );
    if (webhook) {
      add(
        "webhook-received",
        webhook.createdAt,
        "Associated quote webhook first claimed",
      );
      if (webhook.status === "PROCESSED")
        add(
          "webhook-processed",
          webhook.updatedAt,
          "Associated quote webhook processed",
        );
    }
  }
  if (state.attempted)
    unavailableEvents.push(
      "Initial send attempt time and full retry/message history",
    );
  if (state.sent && !match.whatsappSentAt)
    unavailableEvents.push("Send acceptance timestamp");
  if (state.delivered && !match.whatsappDeliveredAt)
    unavailableEvents.push("Delivery timestamp");
  if (state.read && !match.whatsappReadAt)
    unavailableEvents.push("Read timestamp");
  if (status === "CLARIFYING")
    unavailableEvents.push(
      "Clarification request timestamp/details are not persisted on this match",
    );
  if (state.noResponse)
    unavailableEvents.push(
      "No-response transition timestamp (deadline is shown separately)",
    );
  if (status === "FAILED") unavailableEvents.push("Failure timestamp");
  const notificationStatus = status === "QUEUED" ? "Queued" : status?.startsWith("SENDING")
    ? label(status)
    : status?.startsWith("AMBIGUOUS")
      ? "Ambiguous outcome"
      : status === "FAILED"
        ? "Failed"
        : state.sent
          ? "Sent evidence recorded"
          : state.attempted
            ? "Attempt recorded; acceptance unavailable"
            : eligibility.eligible
              ? "Not attempted"
              : "Not eligible";
  return {
    id: match.id,
    dispatchLogs: (match.dispatchAttempts || []).map(a=>({...a,requestedAt:a.requestedAt.toISOString(),sentAt:iso(a.sentAt),deliveredAt:iso(a.deliveredAt),readAt:iso(a.readAt)})),
    resendBlockedReason: deliveryEligibility({...match,communicationRequest:{status:inquiry.status}},now)
      || (/^(QUEUED|SENDING|AMBIGUOUS)/i.test(match.whatsappStatus||"") ? "Existing delivery is queued, sending or awaiting reconciliation" : null)
      || ((match.dispatchAttempts || []).some(a=>["QUEUED","SENDING","AMBIGUOUS_ERROR"].includes(a.status)) ? "A dispatch job is pending or requires reconciliation" : null),
    supplierId: match.supplierId,
    supplierName: match.supplier.companyName,
    sourceType: match.sourceType,
    sourceId: match.sourceId,
    matchStatus: match.status,
    consentStatus: match.supplier.whatsappConsent && match.supplier.whatsappConsentAt ? "Recorded" : "Not recorded",
    dispatchChannel: match.forwardedAt ? (state.attempted ? "Web Portal + WhatsApp" : "Web Portal") : "Not routed",
    declineReason: match.supplierRejectionReason,
    rawWhatsAppStatus: match.whatsappStatus,
    eligible: eligibility.eligible,
    eligibilityReason: eligibility.reason,
    notificationStatus,
    deliveryStatus: state.read
      ? "Read"
      : state.delivered
        ? "Delivered"
        : state.sent
          ? "Sent"
          : "No receipt recorded",
    responseStatus: quote
      ? "Quoted"
      : state.declined
        ? "Declined"
        : status === "CLARIFYING"
          ? "Clarification requested"
          : state.noResponse
            ? status === "NO_RESPONSE"
              ? "No response"
              : "No response by recorded deadline"
            : state.awaiting
              ? "Awaiting response"
              : "No recorded response",
    sentAt: iso(match.whatsappSentAt),
    deliveredAt: iso(match.whatsappDeliveredAt),
    readAt: iso(match.whatsappReadAt),
    deadline: iso(match.quoteDeadlineAt),
    deadlinePassed: state.deadlinePassed,
    reminderCount: match.reminderCount,
    failureCode: match.whatsappLastError
      ? (match.whatsappLastError.match(/\[Code\s+(\d+)\]/i)?.[1] ??
        "Recorded error; raw provider details withheld")
      : null,
    quote,
    timeline: [
      ...new Map(
        timeline.map((event) => [event.key + event.at, event]),
      ).values(),
    ].sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key)),
    unavailableEvents,
  };
}
