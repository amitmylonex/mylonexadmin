# Phase 8 — Sampling requests, costs and delivery

Implemented locally on November 19, 2026. The React/Vite frontend owns presentation; Fastify/Prisma owns validation, financial persistence and state transitions. The shared sample cost calculator uses integer cents and is packaged into the backend build for independent deployment.

## Admin API

All endpoints retain the existing verified session plus database ADMIN role guard.

- `GET /api/v1/admin/samples`: paginated list with search, newest/oldest sorting and validated status filter: requested, quoted, accepted_by_buyer, rejected_by_buyer, rejected, delivered, or all. Maximum page size is 50. Returns buyer/fabric/yardage/pincode, quote terms, resolved fulfillment supplier and a small linked-order reference. Supplier lookups are scoped to the requested page.
- `POST /api/v1/admin/samples/:id/quote`: accepts quoteSampleCostInr, quoteCourierCostInr, quoteDeliveryTimeline, quoteRefundPolicy (`full`, `partial`, `none`), quoteValidUntil and optional quoteInternalNotes. Optional supplierId explicitly assigns an approved fulfillment supplier where necessary.
- `POST /api/v1/admin/samples/:id/reject`: requires trimmed rejectionReason, 1–1000 characters. Only a still-requested sample can be rejected through this admin workflow.
- `POST /api/v1/admin/samples/:id/delivered`: requires courierName and courierTrackingNumber. Confirms physical delivery of an accepted, undelivered sample with a real linked order. Updates Sample and Order delivery state, tracking number and a delivery milestone atomically.
- Existing `GET /api/v1/admin/samples/:id` remains available for admin inspection.

Example quote:

```json
{
  "quoteSampleCostInr": "100.55",
  "quoteCourierCostInr": "20.10",
  "quoteDeliveryTimeline": "3-5 business days",
  "quoteRefundPolicy": "full",
  "quoteValidUntil": "2027-01-01T07:00:00.000Z",
  "quoteInternalNotes": "Administrative cost review",
  "supplierId": "33333333-3333-4333-8333-333333333333"
}
```

Charges accept JSON numbers or decimal strings, normalize to two decimal places, reject negative amounts/more than two decimal places, and cap the combined amount at INR 9,999,999,999.99. Zero-cost samples are allowed. The example supplier UUID is synthetic; replace it with an actual approved supplier profile ID.

The sample charge is the **total yardage charge**, not a per-metre rate. A request for 2.5m quoted at INR 100.55 stores INR 100.55, rather than multiplying it by yardage again. Total cost is sample charge plus courier charge. The API returns totalSampleCostInr as an exact decimal string; INR 0.10 + INR 0.20 returns `0.30`. The earlier rate/courier/internalNotes/reason HTTP field names are replaced by the explicit Phase 8 contract. The old pure sampleMaterialCost helper remains only for historical parity checks, not the quote endpoint.

Quote/rejection changes use a locked, still-requested sample row. Quoting records quotedAt/quotedByUserId, persists refund terms and internal notes, and moves to quoted. Already-reviewed samples cannot be silently overwritten. The server checks future expiry again inside the transaction; the UI labels its local picker as IST and submits an absolute timestamp.

## Fulfillment supplier and order integrity

The reference marketplace creates some generic requests with the requester's ID as a placeholder supplierId, while catalog-specific samples use an actual SupplierProfile ID. Order.supplierId is a real supplier-profile foreign key. Reusing the placeholder would make order creation fail or attach fulfillment incorrectly.

The quote drawer therefore supports searching approved suppliers and selecting fulfillment. A valid existing approved supplier is preselected. If the stored supplier is a placeholder/unavailable, quoting requires an explicit approved assignment. Approval is checked under a supplier lock before saving the quote. No supplier is guessed from the buyer identity.

## Frontend workflow

`/admin/samples` now includes sample reference, buyer, fabric, metres, delivery pincode, status and actions. It preserves stored sample numbers rather than manufacturing new references.

- Prepare Sample Quote opens a responsive right-side drawer with total yardage charge, courier charge, exact total, timeline, full/partial/no-refund policy, IST expiry, approved supplier search and admin internal notes.
- Rejection has a separate required-reason form, so invalid draft quote values do not prevent rejecting a request.
- Details show saved terms, refund policy, order reference and any courier/delivery evidence.
- Mark Delivered opens a courier/tracking modal. Errors stay inside the modal and preserve entered tracking values.
- Accepted samples without a real linked order cannot be delivered silently; they require reconciliation.
- The Accepted Orders sampling view links to the tracked delivery workflow, with a prefilled sample search. Its existing sampling delivery endpoint delegates to the same validated service and no longer bypasses courier requirements. Production delivery behavior is unchanged.

Delivered samples remain in the accepted sampling order queue. Existing records with deliveredAt but legacy accepted_by_buyer status appear as delivered in the sample queue/filter without fabricating timestamps or rewriting historical records.

The refund dropdown records agreed policy only; this phase does not execute payment refunds or infer the value of a partial refund.

## Buyer acceptance integration — prepared, not applied

The current separate buyer project changes sample status on acceptance but does not create an Order. It also historically displays quoteInternalNotes as customer notes. Those behaviors require changes outside this admin workspace.

Prepared patch: `docs/phase8-buyer-sample-integration.patch`. It leaves the reference project unchanged and passes `git apply --check` against its current files. The patch includes:

1. Atomic owned-sample acceptance under a row lock: recheck quoted/undecided status, future expiry, complete costs and current approved fulfillment supplier.
2. Exactly one sampling Order linked by unique sampleId, with PENDING_PAYMENT status and an initial milestone, in the same transaction as accepted_by_buyer. Order failure rolls back acceptance; competing decisions cannot create duplicate orders.
3. The authenticated requester ID passed into the transaction for both buyer and supplier-as-requester sample decision routes. Rejection creates no order.
4. Requester sample list/detail/decision and requester order views mask administrative sample notes and actor IDs. Existing admin sample quote notification code stops including internal notes in customer email content.
5. Requester sample pages show refund policy and courier tracking instead of administrative notes.
6. Matching canonical Prisma courier fields/index plus updates to the canonical schema/API documentation.

The actual acceptance implementation is in `adminbr/src/modules/samples/sample-buyer-decision.ts` and is exercised directly by automated tests; the patch copies that implementation and the shared arithmetic into the buyer project. No ADMIN endpoint impersonates a buyer's acceptance.

**Live acceptance-to-order behavior and private-note isolation in the buyer portal remain pending application of this patch and buyer-project checks. Deploy the buyer integration with the new admin workflow before entering new administrative notes.** The patch itself has not been executed or tested end-to-end in the external project. Earlier phase migration/privacy requirements remain applicable.

Existing accepted legacy samples lacking Order rows are not automatically backfilled with invented supplier/payment/acceptance history. The delivery API explicitly requests reconciliation for those records. Cancelled/already-delivered orders cannot be marked delivered again. Physical confirmation updates delivery records; it does not invent a payment receipt or introduce an unrelated payment-state gate.

## Shared schema and build deployment

Prepared SQL: `docs/sample-cost-delivery-schema.sql`. It adds nullable courier_name/courier_tracking_number and a sample queue index. Existing monetary/refund columns, delivery timestamps, Order linkage and unique sampleId are reused. The local Prisma projection/client include these changes, and `/ready` detects missing required scalar columns.

No shared database migration or db push was performed. Coordinate the additive SQL/canonical schema patch with the shared migration owner, regenerate both clients, run the buyer-project checks and confirm readiness before deployment.

`shared/sample-money.mjs` is the single canonical arithmetic implementation. Frontend builds bundle it. Backend `npm run build` runs a postbuild copy to dist/common/money, so the built service can load the calculator without frontend source or the root shared folder at runtime. Compiled sample-service imports were verified after packaging.

Sample quotes are persisted for requester review. This phase does not enable a new sample email/WhatsApp delivery pipeline; the API reports the existing not-dispatched notification state. No live messages, payment operations or production data changes were performed by implementation tests.

## Verification

- **128 backend automated tests passed**, including 14 new tests for exact money, total-versus-rate semantics, supplier assignment, quote/rejection transitions, owned acceptance, duplicate decisions, order rollback, delivery/order synchronization, legacy evidence, privacy and protected HTTP routes.
- **40 browser tests passed**, including five sample flows: exact quote/refund/IST payload, invalid precision and rejection, courier delivery, Accepted Orders deep link and mobile conflict recovery. The drawer is also checked against viewport bounds.
- Backend/frontend builds and TypeScript lint checks passed; compiled backend sample service imports successfully with its packaged calculator.
- External integration patch applicability check passed. The reference buyer project and shared database remain unchanged.
- Tests use synthetic Prisma substitutes and HTTP fixtures. Actual PostgreSQL contention, deployed buyer acceptance, live courier integration, payments and external notification delivery were not exercised.

Evidence: `phase8-test-results.txt`, `phase8-browser-results.txt`, `phase8-backend-build-results.txt`, `phase8-frontend-build-results.txt`, `phase8-sample-quote.png`, `phase8-sample-delivery.png`.
