/** Explicit buyer serialization contract. Never spread a database quote here.
 * Supplier totals, notes, original price and admin metadata stay server-side. */
export function buyerQuote(quote: any) {
  if (!quote || !["APPROVED_FOR_REQUESTER", "ACCEPTED_BY_BUYER"].includes(quote.status)) return null;
  return {
    id: quote.id, price: String(quote.price), leadTimeDays: quote.leadTimeDays,
    moq: quote.moq, dispatchLocation: quote.dispatchLocation, sampleAvailability: quote.sampleAvailability,
    quoteType: quote.quoteType, status: quote.status, responseImageUrls: quote.responseImageUrls || [],
    validUntilDate: quote.validUntilDate, createdAt: quote.createdAt, updatedAt: quote.updatedAt,
    buyerDecision: quote.buyerDecision, buyerDecisionReason: quote.buyerDecisionReason, buyerDecisionAt: quote.buyerDecisionAt,
    // Marketplace quote totals component derives material value from final price
    // and RFQ quantity when the supplier's unreviewed estimate is absent.
    totalValueEstimate: null, notes: null, additionalNotes: null,
  };
}
