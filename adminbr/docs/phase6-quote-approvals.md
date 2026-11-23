# Phase 6 — Quote approval and commercial markups

Implemented locally, November 19, 2026. Frontend presentation/calculator lives in `adminfr`; role checks, input validation, Decimal persistence and delivery live in `adminbr`. Reusable arithmetic and buyer serialization contracts live in `shared`.

## API contracts

All endpoints retain the existing Supabase session plus database ADMIN role guard.

- `GET /api/v1/admin/quote-approvals`: pending CommunicationRequestResponses only. Supports page/pageSize (maximum 50), search (RFQ number, fabric, supplier company), newest/oldest ordering. Returns supplier company, original/current price, lead time, MOQ, sample availability, dispatch location, response fabric images and buyer target price range. WhatsApp provider identifiers remain withheld from displayed terms.
- `POST /api/v1/admin/quote-approvals/:id/approve`: optional `markupPriceInr` (positive JSON number, maximum 9,999,999,999.99, at most two decimal places), `adminReviewNote` (maximum 2000 characters), `validUntilDate` (`YYYY-MM-DD`, inclusive through the IST calendar day). Unknown fields, malformed dates and expired dates are rejected. An existing expired admin expiry must be replaced before release.
- `POST /api/v1/admin/quote-approvals/:id/reject`: required, trimmed `rejectionReason` (1–2000 characters). Rejection never edits commercial terms or queues a buyer quote-ready email.

Example approval: `{ "markupPriceInr": 125, "adminReviewNote": "Commercial review complete", "validUntilDate": "2027-01-01" }`. Example rejection: `{ "rejectionReason": "Please revise MOQ" }`.

The previous HTTP `note`/`edits` contract is replaced with these explicit approval/rejection inputs. The old pure `buildQuoteReview` helper remains for historical parity tests; the HTTP workflow does not expose arbitrary edits to supplier lead time, metadata or notes.

## Financial integrity and transactions

Approval locks the quote row and updates only a still-pending quote. Every approval snapshots `supplierOriginalPrice` from the persisted supplier price when the snapshot is null, including approvals without markup. Previously stored original values are never overwritten. A supplied markup becomes `response.price` through Prisma Decimal; absent markup preserves the current price. Review actor/time/internal notes and optional expiry are saved with APPROVED_FOR_REQUESTER. Duplicate/concurrent decisions return conflict rather than changing the price or notifying twice.

Original supplier WhatsApp metadata, free-text notes and totalValueEstimate are kept unchanged for internal audit. Those fields must not be serialized to buyers: supplier estimates can contain the original commercial total even if the unit price was marked up.

The review modal compares the supplier bid against the buyer target, displays dispatch/sample details and HTTPS fabric images, and calculates:

- Gross profit per metre = final buyer price − supplier bid.
- Platform margin = gross profit / final buyer price × 100.
- Markup = gross profit / supplier bid × 100.
- Estimated gross profit = gross profit per metre × RFQ quantity.

These figures exclude taxes, delivery and operating costs. A below-bid buyer price is allowed and displays a negative-margin warning; no undocumented minimum-markup policy is imposed. Rejection has a separate required-reason form, so an invalid proposed buyer price does not prevent rejecting the quote. Server errors remain visible inside the modal.

## Buyer notification

Approval atomically stores buyerNotificationStatus=QUEUED, queue timestamp and a reset provider ID. Delivery runs after commit, so delivery trouble cannot roll back quote release or its financial audit snapshot.

When existing `POSTMARK_ENABLED`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`, `POSTMARK_MESSAGE_STREAM` and `APP_BASE_URL` configuration is complete, the service attempts a quote-ready email immediately after commit. It uses final buyer price only, a role-appropriate authenticated portal link, a ten-second timeout, and validates both HTTP and Postmark ErrorCode/MessageID. Provider acceptance is recorded as SENT; this is not proof of inbox delivery.

Disabled/incomplete configuration leaves the event QUEUED without claiming it. `drainBuyerQuoteNotifications` in `quote-notification.ts` can be called by the deployment's scheduled worker to drain up to 25 queued approved quotes. Conditional QUEUED -> SENDING prevents duplicate concurrent workers. Expired/non-actionable quotes are skipped. Ambiguous sends become AMBIGUOUS_ERROR and are not automatically retried. A crash after claim leaves SENDING for provider reconciliation, rather than risking a duplicate. Production scheduling remains a deployment integration step. Supplier rejection becomes visible through the persisted rejection decision; no new supplier rejection email is sent by this phase.

## Buyer portal boundary — deploy together

The separate `mylonex-nextjs` reference project currently loads complete response records into its requester service. Admin-only changes cannot guarantee confidentiality at that external serialization boundary.

Prepared integration patch: `docs/phase6-buyer-privacy.patch`. The reference project was left unchanged. The patch:

1. Adds the explicit `buyerQuote` serialization contract to the marketplace and applies it in the existing requester service used by buyer listing/detail and supplier-as-requester views.
2. Exposes final `price`, approved/accepted status and buyer-facing commercial fields; omits supplierOriginalPrice, admin notes/reviewer metadata and notification identifiers. Pending/rejected supplier quotes remain hidden.
3. Sets supplier-originated notes, additionalNotes and totalValueEstimate to null in buyer responses. Existing buyer totals UI then derives material value from final unit price and RFQ quantity; unreviewed supplier charge estimates are not presented as approved buyer totals.
4. Adds an atomic, database-side expiry condition to buyer acceptance, shared by buyer and supplier-as-requester acceptance paths. Existing accepted history is preserved.
5. Adds matching schema fields/index to the canonical marketplace Prisma model.

The patch passes `git apply --check` against the current reference project. Its shared serialization contract has automated privacy tests, but the patch has NOT been applied or end-to-end tested inside the buyer project. **Buyer-price-only verification in the live portal remains pending deployment and buyer-project tests. Deploy the projection/expiry patch with the admin release, not afterward.** The projection intentionally withholds unreviewed supplier free text; any future buyer-visible commercial notes or shipping/tax totals need an explicit reviewed projection.

## Database deployment

Prepared additive SQL: `docs/quote-commercial-schema.sql`. It adds quote expiry and durable buyer-notification fields/index. The existing supplierOriginalPrice audit column is reused. SQL was NOT applied to the shared database; no db push or migration deployment was executed. Reconcile the prepared SQL and the canonical schema patch through the shared database migration owner, regenerate both projects' Prisma clients and confirm `/ready` before deploying the new API. The new required scalar fields are covered by the existing readiness inspection.

## Verification

- Backend automated suite: **98 passed**, including 14 new commercial quote tests.
- Browser suite: **30 passed**, including 4 new quote review flows.
- Backend/frontend production builds and TypeScript lint checks passed.
- Buyer integration patch: `git apply --check` passed, reference project unchanged.
- Backend tests use synthetic Prisma substitutes and injected email providers. Browser tests use synthetic sessions/HTTP fixtures. PostgreSQL lock contention, the external buyer-project runtime and real email delivery were not exercised.
- No real buyer emails were sent by implementation tools/tests.

Evidence: `phase6-test-results.txt`, `phase6-browser-results.txt`, `phase6-backend-build-results.txt`, `phase6-frontend-build-results.txt`, `phase6-quote-review.png`, `phase6-quote-mobile.png`.
