import { Prisma } from "@prisma/client";
import type { TrackingInquiryRecord, TrackingMatchRecord } from "../src/modules/rfqs/tracking/select.js";
export const now = new Date("2026-10-26T12:00:00Z");
export const inquiry: TrackingInquiryRecord = { id: "00000000-0000-4000-8000-000000000001", rfqNumber: "RFQ-TEST-0001", fabricName: "Synthetic Cotton", quantity: 3000, status: "pending", createdAt: new Date("2026-10-25T10:00:00Z") };
export function match(overrides: Partial<TrackingMatchRecord> = {}): TrackingMatchRecord {
    return { id: "match-1", communicationRequestId: inquiry.id, supplierId: "supplier-1", sourceType: "manual", sourceId: "source-1", status: "FORWARDED_TO_SUPPLIER",
        createdAt: new Date("2026-10-25T10:01:00Z"), forwardedAt: new Date("2026-10-25T10:02:00Z"), adminReviewedAt: null,
        supplierRejectedAt: null, supplierRejectionReason: null, dispatchAttempts: [], whatsappStatus: null, whatsappMessageId: null, whatsappSentAt: null, whatsappDeliveredAt: null,
        whatsappReadAt: null, whatsappLastError: null, quoteDeadlineAt: new Date("2026-10-28T10:00:00Z"), reminderCount: 0, lastReminderSentAt: null,
        supplier: { id: "supplier-1", companyName: "Synthetic Mill", status: "APPROVED", phone: "+910000000001", phoneCountryCode: "91", whatsappConsent: true, whatsappConsentAt: new Date("2026-10-01T00:00:00Z") }, response: null, ...overrides };
}
export function response(overrides: Partial<NonNullable<TrackingMatchRecord["response"]>> = {}): NonNullable<TrackingMatchRecord["response"]> {
    return { id: "quote-1", supplierId: "supplier-1", price: new Prisma.Decimal(165), supplierOriginalPrice: null, leadTimeDays: 30, moq: 3000,
        dispatchLocation: "Surat", sampleAvailability: "Available", additionalNotes: null, notes: "Synthetic remarks", quoteType: "indicative",
        status: "PENDING_ADMIN_REVIEW", adminReviewedAt: null, buyerDecision: null, buyerDecisionAt: null, submissionRevision: 1,
        createdAt: new Date("2026-10-26T11:00:00Z"), ...overrides };
}
export const metadata = { version: 1, submittedVia: "whatsapp", source: "FLOW", priceBasis: "Ex-mill", priceValidity: "48 hours",
    priceValidUntil: "2026-10-28T11:00:00.000Z", moqPerColour: 500, sampleStatus: "AVAILABLE", sampleYardageM: 10,
    sampleLeadTimeDays: 7, samplingPrice: 0, remarks: "Saved sample details", submittedAt: "2026-10-26T11:00:00.000Z", inboundMessageId: "private-inbound-id" };
