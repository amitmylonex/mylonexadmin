import type { Prisma } from "@prisma/client";

// Explicit allowlist: never load listing snapshots, Flow tokens or raw webhook payloads.
export const trackingMatchSelect = {
  id: true,
  communicationRequestId: true,
  supplierId: true,
  sourceType: true,
  sourceId: true,
  status: true,
  createdAt: true,
  forwardedAt: true,
  adminReviewedAt: true,
  supplierRejectedAt: true,
  supplierRejectionReason: true,
  whatsappStatus: true,
  whatsappMessageId: true,
  whatsappSentAt: true,
  whatsappDeliveredAt: true,
  whatsappReadAt: true,
  whatsappLastError: true,
  quoteDeadlineAt: true,
  reminderCount: true,
  lastReminderSentAt: true,
  dispatchAttempts: {take:5,orderBy:[{requestedAt:"desc"},{id:"desc"}],select:{id:true,kind:true,status:true,requestedAt:true,sentAt:true,deliveredAt:true,readAt:true,failureCode:true}},
  supplier: {
    select: {
      id: true,
      companyName: true,
      status: true,
      phone: true,
      phoneCountryCode: true,
      whatsappConsent: true,
      whatsappConsentAt: true,
    },
  },
  response: {
    select: {
      id: true,
      supplierId: true,
      price: true,
      supplierOriginalPrice: true,
      leadTimeDays: true,
      moq: true,
      dispatchLocation: true,
      sampleAvailability: true,
      additionalNotes: true,
      notes: true,
      quoteType: true,
      status: true,
      adminReviewedAt: true,
      buyerDecision: true,
      buyerDecisionAt: true,
      submissionRevision: true,
      createdAt: true,
    },
  },
} satisfies Prisma.CommunicationRequestMatchSelect;
export type TrackingMatchRecord = Prisma.CommunicationRequestMatchGetPayload<{
  select: typeof trackingMatchSelect;
}>;
export const trackingInquirySelect = {
  id: true,
  rfqNumber: true,
  fabricName: true,
  quantity: true,
  status: true,
  createdAt: true,
} as const;
export type TrackingInquiryRecord = Prisma.CommunicationRequestGetPayload<{
  select: typeof trackingInquirySelect;
}>;
