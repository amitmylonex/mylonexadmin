# Phase 5 — RFQ moderation

Implemented locally on November 19, 2026. Frontend UI stays in `adminfr`; authorization, validation, scoring, persistence and notification queue processing stay in `adminbr`.

## API and UI

All endpoints require the existing Supabase session plus database ADMIN role check.

- `GET /api/v1/admin/rfq-approvals?page=1&pageSize=10&search=&sort=newest`: pending BUYER CommunicationRequests, global pending/high-or-urgent metrics, sanitized specs and up to eight distinct eligible supplier previews. Maximum page size is 25. Search covers RFQ number, fabric title and anonymized buyer reference.
- `POST /api/v1/admin/rfq-approvals/:rfqId/approve`: optional `{ "note": "Reviewed" }`.
- `POST /api/v1/admin/rfq-approvals/:rfqId/reject`: required `{ "reason": "Incomplete specification" }`, trimmed, 1–2000 characters.
- `POST /api/v1/admin/rfq-approvals/bulk`: `{ "ids": ["RFQ UUID"], "decision": "approve" }`, or decision `reject` with a required `reason`. Maximum 50 unique UUIDs; validate the whole payload before writes. Each RFQ has its own transaction and result; failures leave other successful reviews committed.

`/admin/rfq-approvals` now reviews RFQs, rather than individual match records. It includes search/sort/pagination, pending and urgent counts, page selection, batch actions, detailed specification dialog, buyer reference, matched mills with scoring explanation, rejection dialog, per-item failures and queued-versus-delivered wording. Empty/missing-spec states support inspecting the RFQ and adding an explicitly audited manual match via the existing detail page.

Legacy match-level review APIs are isolated under `/api/v1/admin/rfq-match-approvals`, including `/:matchId/forward`, `/:matchId/reject` and `/bulk`. Clients of the former match-level endpoints must migrate to these paths; the RFQ-level `/reject` and `/bulk` contracts are deliberately different.

## Matching and transaction boundaries

The pure matcher was ported from the marketplace matching rules. Hard gates include fabric category, weave, composition identity/percentage tolerances, GSM and width; construction and business fit affect scoring as in the existing engine. The port fixes percentage comparisons that previously could confuse different fibers having the same percentages. Existing fabric state is used during catalog normalization. Unsupported or incomplete automatic specs do not fabricate a match; explicit approved manual matches remain available.

Catalog and woven candidates must be active with an APPROVED supplier. Candidates are scanned in keyset pages of 200; only the best eight distinct suppliers are retained. A queue page resolves previews sequentially to bound concurrent DB work. This bounds memory, but matching cost still grows with eligible catalog size; production volume/latency should be measured before adding a persistent matching cache or dedicated matching worker.

Exact `fabric_quick_rfq` requests route only to the selected catalog ID and never broaden to similar fabrics when that listing disappears or becomes ineligible.

Approval locks the RFQ row, detects changes during scoring, locks supplier rows in sorted order and revalidates current APPROVED status and active listings/spec fit. It saves FORWARDED_TO_SUPPLIER matches, 72-hour quote deadlines, RFQ approval and reviewer metadata atomically. As of November 24, 2026, an RFQ with no candidates can be approved for later sourcing: the same transaction records approval metadata, creates no supplier matches and queues no notifications. The single response includes `routingPending: true`; bulk responses include `awaitingSupplierCount`. The RFQ leaves the pending queue and remains in All RFQs, where approved suppliers can be manually routed later. If candidates existed but become ineligible during commit, approval-and-routing still returns a conflict to avoid silently dropping the promised routes. Repeat approvals return `alreadyReviewed` and do not duplicate routing or queueing. Opposing decisions conflict. Rejection records reason/actor/time, rejects pending matches, and refuses to erase already-forwarded routing history.

Buyer identity is anonymous by default (`RFQ_ANONYMIZE_BUYERS` defaults to true). Setting it to `false` permits identity only when `buyerIdentityDisclosed` is also true. Queue responses use whitelisted spec fields and omit raw buyer/contact objects and selected-fabric snapshots. Email/phone patterns are scrubbed from anonymous free text; arbitrary prose is not a general-purpose identity-redaction guarantee.

## Durable WhatsApp queue and delivery boundary

Approval stores `CommunicationRequestMatch.whatsappStatus = QUEUED` in the same transaction as routing. No network send runs in the API approval transaction. Consent requires the boolean, recorded timestamp and a valid normalized phone. Other suppliers receive dashboard routes with `SKIPPED_NO_CONSENT` or `SKIPPED_INVALID_PHONE`; this is not an API delivery failure.

`adminbr/src/modules/notifications/rfq-queue.ts` exports `drainQueuedRfqNotifications(send, client?, limit?)`, processing at most 25 entries per drain. An injected provider adapter receives match ID, RFQ ID, normalized phone and quote deadline, and must return a provider message ID. It must provide a finite network timeout and use the deployment's approved message template/payload and credentials.

The consumer atomically claims QUEUED -> SENDING, checks current supplier approval, consent, phone, RFQ approval and deadline before invoking the adapter, and records SENT only after a provider message ID. Revoked/suspended/expired entries are skipped. Ambiguous sends become AMBIGUOUS_ERROR and are never blindly retried. A crash after claiming leaves SENDING for provider reconciliation; no automatic lease recycling may resend an uncertain delivery. Existing delivered/read callbacks must continue to reconcile provider IDs without being overwritten by the drain's conditional completion update.

**The provider adapter, scheduled worker host and production callback integration are not connected in this phase.** The exported consumer is tested with an injected sender. Queued messages will remain queued until deployment wires this consumer to the existing verified WhatsApp provider integration. The existing marketplace sender does not automatically consume the new QUEUED state. No real WhatsApp messages were sent during implementation or tests.

## Shared schema deployment

Prepared SQL: `docs/rfq-moderation-schema.sql`. It adds nullable RFQ reviewer fields and queue indexes, preserving existing request/match/order history. The local Prisma projection and generated client include the reviewer fields. This SQL has NOT been applied to the shared database. Reconcile these additive changes with the canonical marketplace schema/migration owner before deployment, then run readiness checks. `/ready` detects the missing scalar fields and stays unavailable until the database is compatible. No shared `db push` or migration deployment was executed.

## Validation

- Backend automated suite: 84 passed, including 13 moderation/matching/queue tests.
- Browser suite: 26 passed, including 5 new RFQ queue flows.
- Backend and frontend builds and TypeScript lint checks passed.
- Transaction tests use an in-memory Prisma substitute; browser tests use synthetic identities and HTTP fixtures. Shared production data, actual PostgreSQL contention and live provider delivery were not exercised.
- Evidence: `phase5-test-results.txt`, `phase5-browser-results.txt`, `phase5-build-results.txt`, `phase5-rfq-queue.png`, `phase5-rfq-mobile-empty.png`.
