export type MatchSummary = {
  id: string;
  status: string;
  sourceType?: string;
  response: { id: string; status: string; buyerDecision: string | null } | null;
};

/** Admin RFQ list/detail status derived from match and response data. */
export function deriveAdminRfqStatus(matches: MatchSummary[]) {
  if (matches.length === 0) {
    return { label: "Sourcing", tone: "amber" as const };
  }

  const hasAcceptedByBuyer = matches.some(
    (match) => match.response?.status === "ACCEPTED_BY_BUYER",
  );
  if (hasAcceptedByBuyer) {
    return { label: "Accepted", tone: "emerald" as const };
  }

  const hasApprovedResponse = matches.some(
    (match) =>
      match.response?.status === "APPROVED_FOR_REQUESTER" &&
      match.response.buyerDecision !== "rejected",
  );
  if (hasApprovedResponse) {
    return { label: "Quotes Available", tone: "green" as const };
  }

  const releasedResponses = matches.filter(
    (match) =>
      match.response?.status === "APPROVED_FOR_REQUESTER" ||
      match.response?.status === "ACCEPTED_BY_BUYER",
  );
  const allReleasedRejected =
    releasedResponses.length > 0 &&
    releasedResponses.every(
      (match) => match.response?.buyerDecision === "rejected",
    );
  if (allReleasedRejected) {
    return { label: "Quote Declined", tone: "amber" as const };
  }

  const hasSupplierDeclined = matches.some(
    (match) => match.status === "REJECTED_BY_SUPPLIER",
  );
  if (hasSupplierDeclined) {
    return { label: "Supplier Declined", tone: "amber" as const };
  }

  const hasForwarded = matches.some(
    (match) => match.status === "FORWARDED_TO_SUPPLIER",
  );
  if (hasForwarded) {
    return { label: "Forwarded", tone: "blue" as const };
  }

  return { label: "In Review", tone: "slate" as const };
}
