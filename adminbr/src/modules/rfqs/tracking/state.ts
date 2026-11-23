import { normalizeConsentPhone } from "../../suppliers/supplier-phone.js";
import type { TrackingMatchRecord } from "./select.js";
import type { TrackingCounts } from "./types.js";

export function supplierEligibility(match: TrackingMatchRecord) {
  if (["REJECTED_BY_ADMIN", "REJECTED_BY_SUPPLIER"].includes(match.status))
    return { eligible: false, reason: "Match rejected" };
  if (match.supplier.status !== "APPROVED")
    return { eligible: false, reason: "Supplier is not approved" };
  if (!match.supplier.whatsappConsent || !match.supplier.whatsappConsentAt)
    return { eligible: false, reason: "Explicit WhatsApp consent is missing" };
  if (
    !normalizeConsentPhone(
      match.supplier.phone,
      match.supplier.phoneCountryCode || "India",
    )
  )
    return { eligible: false, reason: "Valid WhatsApp number is missing" };
  return {
    eligible: true,
    reason:
      "Current supplier profile is eligible; historical eligibility and dispatch configuration are not recorded here",
  };
}
export function trackingState(match: TrackingMatchRecord, now: Date) {
  const status = match.whatsappStatus?.toUpperCase();
  const read = Boolean(match.whatsappReadAt || status === "READ");
  const delivered = Boolean(
    read || match.whatsappDeliveredAt || status === "DELIVERED",
  );
  const sent = Boolean(
    delivered ||
    match.whatsappSentAt ||
    match.whatsappMessageId ||
    status === "SENT",
  );
  const attempted = Boolean(
    sent ||
    match.lastReminderSentAt ||
    (status &&
      [
        "SENDING",
        "FAILED",
        "AMBIGUOUS_ERROR",
        "SENDING_SHORTLISTED",
        "SENDING_CLOSED",
        "AMBIGUOUS_SHORTLISTED",
        "AMBIGUOUS_CLOSED",
      ].includes(status)),
  );
  const declined = Boolean(
    match.status === "REJECTED_BY_SUPPLIER" ||
    match.supplierRejectedAt ||
    status === "DECLINED",
  );
  const deadlinePassed = Boolean(
    match.quoteDeadlineAt && match.quoteDeadlineAt <= now,
  );
  const terminal = Boolean(
    status &&
    [
      "DECLINED",
      "CLARIFYING",
      "NO_RESPONSE",
      "CLOSED",
      "SHORTLISTED",
      "SENDING_CLOSED",
      "SENDING_SHORTLISTED",
      "AMBIGUOUS_CLOSED",
      "AMBIGUOUS_SHORTLISTED",
      "FAILED",
    ].includes(status),
  );
  const awaiting =
    match.status === "FORWARDED_TO_SUPPLIER" &&
    sent &&
    !match.response &&
    !declined &&
    !terminal &&
    !deadlinePassed;
  return {
    read,
    delivered,
    sent,
    attempted,
    declined,
    deadlinePassed,
    awaiting,
    noResponse:
      !match.response &&
      !declined &&
      status !== "CLARIFYING" &&
      (status === "NO_RESPONSE" ||
        Boolean(deadlinePassed && match.status === "FORWARDED_TO_SUPPLIER")),
  };
}
export function summarizeMatches(
  matches: TrackingMatchRecord[],
  now: Date,
): TrackingCounts {
  const messageKeys = {
    sent: new Set<string>(),
    delivered: new Set<string>(),
    read: new Set<string>(),
  };
  const quoteIds = new Set<string>();
  const awaitingPairs = new Set<string>();
  const counts: TrackingCounts = {
    attempted: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    quoted: 0,
    declined: 0,
    clarifying: 0,
    failed: 0,
    awaiting: 0,
    noResponse: 0,
  };
  for (const match of matches) {
    const state = trackingState(match, now);
    for (const key of ["sent", "delivered", "read"] as const)
      if (state[key]) messageKeys[key].add(match.whatsappMessageId || match.id);
    if (match.response) quoteIds.add(match.response.id);
    for (const key of ["attempted", "declined", "noResponse"] as const)
      if (state[key]) counts[key]++;
    if (state.awaiting)
      awaitingPairs.add(`${match.communicationRequestId}|${match.supplierId}`);
    if (match.whatsappStatus?.toUpperCase() === "CLARIFYING") counts.clarifying++;
    if (match.whatsappStatus?.toUpperCase() === "FAILED") counts.failed++;
  }
  return {
    ...counts,
    awaiting: awaitingPairs.size,
    quoted: quoteIds.size,
    sent: messageKeys.sent.size,
    delivered: messageKeys.delivered.size,
    read: messageKeys.read.size,
  };
}
