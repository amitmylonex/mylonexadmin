export type TrackingCounts = {
  attempted: number;
  sent: number;
  delivered: number;
  read: number;
  quoted: number;
  declined: number;
  clarifying: number;
  failed: number;
  awaiting: number;
  noResponse: number;
};
export type TimelineEvent = { key: string; at: string; label: string };
export type TrackingQuote = {
  id: string;
  price: string;
  originalPrice: string | null;
  priceBasis: string | null;
  priceValidity: string | null;
  priceValidUntil: string | null;
  priceExpired: boolean | null;
  totalMoq: number | null;
  moqPerColour: number | null;
  leadDays: number;
  sampleAvailability: string | null;
  sampleYardage: number | null;
  sampleLeadDays: number | null;
  samplingPrice: number | null;
  remarks: string | null;
  approvalStatus: string;
  submittedAt: string;
  submittedAtLabel: string;
  revision: number;
  source: string;
  dispatchLocation: string | null;
};
export type DispatchLog = {id:string;kind:string;status:string;requestedAt:string;sentAt:string|null;deliveredAt:string|null;readAt:string|null;failureCode:string|null};
export type TrackingSupplier = { dispatchLogs?: DispatchLog[]; resendBlockedReason?: string|null; consentStatus: string; dispatchChannel: string; declineReason: string|null;
  id: string;
  supplierId: string;
  supplierName: string;
  sourceType: string;
  sourceId: string;
  matchStatus: string;
  notificationStatus: string;
  deliveryStatus: string;
  responseStatus: string;
  rawWhatsAppStatus: string | null;
  eligible: boolean;
  eligibilityReason: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  deadline: string | null;
  deadlinePassed: boolean;
  reminderCount: number;
  failureCode: string | null;
  quote: TrackingQuote | null;
  timeline: TimelineEvent[];
  unavailableEvents: string[];
};
export type TrackingListItem = {
  id: string;
  rfqNumber: string;
  fabricName: string;
  quantity: number;
  createdAt: string;
  recordedStatus: string;
  overallStatus: string;
  overallTone: string;
  matchedSuppliers: number;
  eligibleSuppliers: number;
  matchCount: number;
  counts: TrackingCounts;
};
export type TrackingSummary = TrackingCounts & { inquiries: number };
export type TrackingList = {
  rows: TrackingListItem[];
  summary: TrackingSummary;
  total: number;
  page: number;
  pageSize: number;
  asOf: string;
};
export type TrackingDetail = { lifecycle: Array<{key:string;label:string;recorded:boolean;at:string|null}>;
  inquiry: Omit<
    TrackingListItem,
    "eligibleSuppliers" | "matchedSuppliers" | "matchCount" | "counts"
  >;
  suppliers: TrackingSupplier[];
  totalMatches: number;
  page: number;
  pageSize: number;
  asOf: string;
};

export const TRACKING_METRICS: Array<{
  key: keyof TrackingSummary;
  label: string;
  definition: string;
}> = [
  {
    key: "inquiries",
    label: "Buyer inquiries",
    definition:
      "Buyer-owned quote RFQs matching the search, status and UTC inquiry-date filters.",
  },
  {
    key: "attempted",
    label: "Attempts tracked",
    definition:
      "Matches with retained send/receipt evidence, a send reservation/outcome, or a reminder attempt timestamp. One per match; total historical retries are unavailable.",
  },
  {
    key: "sent",
    label: "Sent records",
    definition:
      "Distinct retained message IDs (match ID when absent) with acceptance or receipt evidence. Includes delivered/read. Superseded messages are unavailable.",
  },
  {
    key: "delivered",
    label: "Delivered records",
    definition:
      "Distinct retained message IDs/matches with a delivered/read status or receipt timestamp. Read processing can backfill the delivery timestamp.",
  },
  {
    key: "read",
    label: "Read records",
    definition:
      "Distinct retained message IDs/matches with READ status or a stored read timestamp. A quote alone is not a read receipt.",
  },
  {
    key: "quoted",
    label: "Quotes received",
    definition:
      "Persisted response records, counted once per response; revisions are not extra quotes. Includes all approval statuses and submission channels.",
  },
  {
    key: "declined",
    label: "Supplier declines",
    definition:
      "Matches with supplier rejection status/timestamp or retained DECLINED WhatsApp status.",
  },
  {
    key: "clarifying",
    label: "Clarifications",
    definition:
      "Matches currently recorded as CLARIFYING. Historical clarification events are not retained.",
  },
  {
    key: "failed",
    label: "Failed notifications",
    definition:
      "Matches whose retained WhatsApp status is FAILED. Ambiguous network outcomes and old reminder errors are not counted as definite failures.",
  },
  {
    key: "awaiting",
    label: "Suppliers awaiting",
    definition:
      "Distinct supplier/RFQ pairs with at least one forwarded match with send evidence, no response/decline/clarification/terminal outcome, and no passed recorded deadline. Multiple open matches for one supplier in one RFQ count once.",
  },
];
