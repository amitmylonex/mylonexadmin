# Phase 7 — RFQ lifecycle tracking and WhatsApp dispatch logs

Implemented locally on November 19, 2026. UI and filters remain in `adminfr`; validated registry queries, lifecycle evidence, routing, resend reservations and receipt ingestion remain in `adminbr`.

## API contracts

Existing ADMIN authentication protects every `/api/v1/admin/*` route, including the new actions and log reader.

- `GET /api/v1/admin/rfqs`: full registry across requester roles and recorded states. Search covers RFQ number, fabric and requester name/email. Supports `status=all|pending|active|quoted|closed|cancelled|rejected`, `quantityMin`, `quantityMax`, `from`, `to`, page/pageSize (maximum 50), newest/oldest ordering. Date filters cover inclusive IST calendar days; invalid/reversed date and quantity ranges return 400.
- `GET /api/v1/admin/rfq-tracking/:rfqId?page=1`: RFQ lifecycle plus every supplier match through stable 25-row pages. Includes current consent, dashboard/WhatsApp channel, retained original-message status/timestamps, reminder count, quote/bid details, supplier decline reason, response/deadline state and recorded timeline. Each match includes up to five recent dispatch ledger rows and a reason when resending is unavailable.
- `POST /api/v1/admin/rfqs/:rfqId/manual-match`: `{ "supplierId": "supplier UUID", "note": "Additional capacity requested" }`. An active RFQ routes the approved supplier immediately to its dashboard, with a 72-hour deadline and a consent-aware initial WhatsApp queue entry. A pending RFQ stages PENDING_ADMIN_REVIEW for the Phase 5 approval workflow; it never bypasses RFQ moderation.
- `POST /api/v1/admin/rfq-tracking/:matchId/resend-whatsapp`: `{ "reason": "Supplier requested a reminder" }`. Persists a separate QUEUED resend attempt and returns its ID. Queued is not sent or delivered. The supplier's existing deadline, original provider message and earlier receipts are preserved.
- `GET /api/v1/admin/rfq-tracking/:matchId/dispatch-logs?page=1&pageSize=10`: all ledger attempts through pages of at most 25. Returns kind/status, reservation/capture time, send/delivery/read times and a safe numeric failure code. Does not return phone numbers, provider IDs, internal reasons, raw provider payloads or tokens.

Registry status normalizes approved/open/in_progress to active. A persisted supplier response makes a nonterminal RFQ quoted; an actual order makes it closed. Explicit cancelled/rejected statuses take precedence, and the original recorded status remains visible alongside the registry state. Unknown legacy states remain visible in the unfiltered registry.

## Lifecycle evidence and bounded detail reads

The stepper shows Submitted -> Admin Approved -> Dispatched to Mills -> Quotes Received -> Buyer Accepted -> Order Placed. Each step is independently backed by a recorded event:

- Submitted: RFQ createdAt.
- Admin Approved: RFQ adminReviewedAt with a compatible approved/active/quoted/closed recorded state. A forwarded legacy match cannot manufacture an RFQ approval timestamp. Historical approval after cancellation/rejection is not reconstructed from ambiguous metadata.
- Dispatched to Mills: a match forwardedAt, meaning dashboard routing; this does not imply WhatsApp delivery.
- Quotes Received: an actual CommunicationRequestResponse creation record.
- Buyer Accepted: a stored accepted status/decision; an absent decision timestamp stays explicitly unavailable.
- Order Placed: an actual Order creation record, not merely a quote or buyer acceptance.

SQL aggregates inspect all matches/responses/orders for lifecycle evidence. Supplier details remain paginated, so an order or acceptance on another page still appears accurately in the RFQ stepper. Missing earlier history is shown as Not recorded even when a later step exists. Detail reads no longer materialize all matches merely to calculate their overall status/count. The existing tracking overview remains a buyer-production-RFQ view; the full registry and direct detail route cover all RFQs.

## Routing and resend safety

Manual routing locks the RFQ and approved supplier, checks accepted/order history, rejects terminal sourcing and existing live/declined supplier matches, and saves dashboard routing with the queue status in one transaction. Non-consented suppliers still receive dashboard routing without invoking WhatsApp. Current supplier approval, explicit consent timestamp and normalized valid phone are rechecked when a queued message is processed.

Resend reservations lock RFQ -> supplier -> match in a consistent order. Limits are durable across API processes: at least ten minutes after the latest known notification/reservation and at most three resend reservations per match in a rolling 24 hours. Pending/in-flight/ambiguous jobs block another resend. Quoted/declined matches, expired supplier deadlines, closed RFQs, and RFQs with accepted quotes/orders are ineligible. Concurrent reservations cannot bypass the match lock. Existing marketplace reminder counts/history are retained; unavailable historical resend counts are not invented.

The worker increments reminderCount and lastReminderSentAt only when the resend's provider acknowledgement contains a message ID. It retains the original message fields on the match; each resend's separate receipts belong to its ledger row. The UI explicitly labels the main delivery pill as the retained original message and exposes every individual resend through dispatch logs.

## Durable attempt ledger and workers

New `RfqDispatchAttempt` / `rfq_dispatch_attempts` stores INITIAL, RESEND and LEGACY_SNAPSHOT records with independent message status and timestamps. INITIAL logs begin when the original queue worker claims a job. A legacy snapshot is captured once when reserving a resend and contains only already-retained evidence; its capture time is not presented as a historical send time.

- `drainQueuedRfqNotifications(send, client?, limit?)`: existing Phase 5 initial worker now records its attempt and passes attemptId to the injected provider sender. It also checks current active sourcing before sending. Provider receipts that arrive before the send acknowledgement are preserved instead of being overwritten with SENT.
- `drainRfqResends(send, client?)`: claims up to 25 queued resend attempts, rechecks eligibility, invokes the same provider adapter and records the acknowledgement independently. No network call runs in the API transaction.

The provider adapter must use a finite timeout, return the actual provider message ID and, where supported, attach attemptId as provider-echoed callback context. Ambiguous outcomes are not blindly retried; crashes after claim leave SENDING for reconciliation. A verified callback with matching attemptId can associate a provider message ID with an otherwise ambiguous attempt without resending.

**The actual WhatsApp provider adapter and worker host from Phase 5 are still deployment integration requirements.** Creating a queue entry does not call Meta by itself. No real WhatsApp messages were sent during implementation/testing.

## Receipt ingestion and delivered/read semantics

`recordDispatchReceipt` validates trusted normalized events, locks the specific ledger message and handles duplicates/out-of-order statuses monotonically. READ implies logical delivery evidence for counts, but a READ event does not fabricate deliveredAt or sentAt. A later DELIVERED event can supply its actual timestamp without downgrading READ. A definite failed notification remains distinct from an ambiguous network outcome. Legacy conversation statuses such as CLOSED/DECLINED/SHORTLISTED are not overwritten by delivery callbacks.

Optional signed internal bridge:

`POST /api/v1/internal/rfq-dispatch-receipts`

Payload: `{ "messageId": "provider-id", "status": "SENT|DELIVERED|READ|FAILED", "at": "ISO UTC timestamp", "failureCode"?: "numeric code", "attemptId"?: "UUID echoed by provider" }`.

Configure a server-only `ADMIN_DISPATCH_RECEIPT_SECRET` on the admin backend and the existing verified webhook service. Headers are `x-mylonex-timestamp` (current epoch seconds) and `x-mylonex-signature` (hex HMAC-SHA256 over `timestamp + '.' + JSON.stringify(canonicalEvent)`). Canonical key order is messageId, status, at, then optional failureCode, then optional attemptId. Timestamp window is five minutes; body limit is 4 KiB. With no configured secret the endpoint is unavailable. This internal bridge uses its own HMAC guard, not browser/admin JWTs.

`docs/phase7-receipt-bridge-example.ts` shows server-side forwarding after the existing Meta webhook signature verification. Persist the incoming receipt/retry job before acknowledging the provider. An unknown message returning `recorded: false` must be retried/reconciled: its send acknowledgement may not yet be committed. Use provider-echoed attemptId to resolve an ambiguous acknowledgement where possible. Do not expose the bridge secret or call this helper from browser code.

The existing webhook service has NOT been modified or connected to this bridge. Existing legacy match receipts remain visible, but per-attempt live receipt verification requires this connection. Older superseded provider messages absent from the database cannot be reconstructed.

## Deployment artifacts and validation

Prepared, not applied:

- `docs/rfq-dispatch-ledger-schema.sql`: new ledger table, provider-ID uniqueness, match/time and queue indexes.
- `docs/phase7-canonical-schema.patch`: matching canonical marketplace Prisma model/relation; passes `git apply --check` against the unchanged reference project.
- `docs/phase7-receipt-bridge-example.ts`: normalized verified-webhook forwarding example.

Reconcile these with the shared migration owner and earlier Phase 5/6 schema changes, regenerate Prisma clients, configure worker/provider/receipt wiring and confirm `/ready`. Readiness now checks the ledger model's scalar columns as well. No shared db push or migration deployment was executed.

Validation:

- **114 backend automated tests passed**, including registry bounds, independent lifecycle evidence, manual routing, concurrent duplicate protection, durable resend limits, worker claims/revocation, per-message receipts, early-read races, ambiguous reconciliation, signed bridge authentication and protected HTTP endpoints.
- **35 browser tests passed**, including five new registry/tracking/manual-route/resend/log flows and mobile feedback.
- Backend and frontend production builds plus TypeScript lint checks passed.
- Screenshots: `phase7-rfq-registry.png`, `phase7-rfq-tracking.png`, `phase7-mobile-resend.png`.
- Logs: `phase7-test-results.txt`, `phase7-browser-results.txt`, `phase7-backend-build-results.txt`, `phase7-frontend-build-results.txt`.
- Tests used synthetic Prisma substitutes, HTTP fixtures and injected senders. Actual PostgreSQL contention, live provider callbacks and real delivery were not exercised. The external canonical project and shared database remain unchanged.
