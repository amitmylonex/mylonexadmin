import type {TrackingSummary} from "../../../../shared/rfq-tracking";
export const TRACKING_METRICS: Array<{ key: keyof TrackingSummary; label: string; definition: string }> = [
    { key: "inquiries", label: "Buyer inquiries", definition: "Buyer-owned quote RFQs matching the search, status and UTC inquiry-date filters." },
    { key: "attempted", label: "Attempts tracked", definition: "Matches with retained send/receipt evidence, a send reservation/outcome, or a reminder attempt timestamp. One per match; total historical retries are unavailable." },
    { key: "sent", label: "Sent records", definition: "Distinct retained message IDs (match ID when absent) with acceptance or receipt evidence. Includes delivered/read. Superseded messages are unavailable." },
    { key: "delivered", label: "Delivered records", definition: "Distinct retained message IDs/matches with a delivered/read status or receipt timestamp. Read processing can backfill the delivery timestamp." },
    { key: "read", label: "Read records", definition: "Distinct retained message IDs/matches with READ status or a stored read timestamp. A quote alone is not a read receipt." },
    { key: "quoted", label: "Quotes received", definition: "Persisted response records, counted once per response; revisions are not extra quotes. Includes all approval statuses and submission channels." },
    { key: "declined", label: "Supplier declines", definition: "Matches with supplier rejection status/timestamp or retained DECLINED WhatsApp status." },
    { key: "clarifying", label: "Clarifications", definition: "Matches currently recorded as CLARIFYING. Historical clarification events are not retained." },
    { key: "failed", label: "Failed notifications", definition: "Matches whose retained WhatsApp status is FAILED. Ambiguous network outcomes and old reminder errors are not counted as definite failures." },
    { key: "awaiting", label: "Suppliers awaiting", definition: "Distinct supplier/RFQ pairs with at least one forwarded match with send evidence, no response/decline/clarification/terminal outcome, and no passed recorded deadline. Multiple open matches for one supplier in one RFQ count once." },
];
