# Phase 4: buyer directory and profile activity

## API

Both endpoints inherit the namespace-wide ADMIN guard. Buyer identifiers are User
IDs, not BuyerProfile IDs. Users with another role return 404 on the buyer detail
endpoint. Accounts without a BuyerProfile remain visible as buyer accounts with
missing business details.

`GET /api/v1/admin/buyers` accepts page, pageSize (default 25, maximum 50), search,
sort (newest/oldest/name-asc/name-desc), from and to (YYYY-MM-DD). Search covers
name, email, company and city, plus the existing phone search. Calendar dates
include complete days in India Standard Time; the upper database bound is the
start of the following day. Invalid calendar dates and reversed ranges return 400.

Each row returns id, fullName, email, company, phone, city, gstNumber, createdAt,
totalInquiries, totalRfqs, sampleCount and actual orderCount. Existing rfqCount,
inquiryCount and engagement fields remain compatible. Legacy inquiry counts come
from Inquiry; production RFQ counts come from CommunicationRequest with
requesterRole BUYER. Actual Order counts are distinct from legacy accepted-quote
counts. Existing global directory metrics are retained as database aggregates.

`GET /api/v1/admin/buyers/:id` returns the business/account profile, verification
evidence, all-time order summary and a paginated activity tab:

- tab=rfqs (default): production RFQ number, fabric, quantity, status and date.
- tab=samples: sample number, fabric, sample type, status and date.
- tab=orders: actual order number/type, status, created date and value estimate.
- tab=production remains the legacy accepted-production quote view for existing
  consumers; it is not the new Orders tab.

Activity supports page/pageSize, newest/oldest sorting, search and optional date
filters. The all-time order summary is independent of the selected activity page.

## Bounded queries and values

The directory queries one page (at most 50 users), uses relation counts rather
than child arrays, and restricts grouped activity enrichment to those page IDs.
Empty pages skip enrichment. Each detail activity table has its own LIMIT/OFFSET
and count; no complete buyer RFQ/sample/order history is loaded into application
memory. Sorting includes an ID tie-breaker. Client requests are aborted when
filters or pages change, and pagination clamps when the result set shrinks.

Order summaries are one buyer-scoped PostgreSQL aggregate over actual Order
records. Production values use a valid recorded quote total when available,
otherwise quote price × RFQ quantity. Sampling values use recorded sample cost
plus courier. Calculations use database numeric / Prisma Decimal and expose
two-decimal strings. Missing values remain null, with an unknownValueCount;
they are not treated as zero. These are estimates across order history, including
cancelled records if present, not receipts, paid totals, or revenue.

## Verification and billing schema

Email verified badges require a matching Supabase identity/email and
email_confirmed_at. A phone-confirmed timestamp or mere email presence is not
email verification. Missing provider configuration or provider failures produce
unknown verification. Default provider reads have a three-second request timeout
and a bounded, 500-entry, 60-second cache. ADMIN role verification is independent
and remains fresh on every protected API request.

GST presence is displayed as GST recorded; no business/GST verification is
fabricated. Supabase service credentials remain backend-only.

The original BuyerProfile schema had no billing address. The local Prisma
projection now contains nullable billingAddress mapped to billing_address, and
the generated client has been updated. The detail response reads that field and
shows Not recorded when absent; shipping addresses are never substituted.

`buyer-billing-address.sql` is prepared, NOT applied. Coordinate the additive
nullable TEXT column with the canonical shared-schema owner before deploying
this backend client. Existing rows remain NULL; there is no guessed backfill.
Existing old clients can continue inserting without the optional column. The
shared /ready schema check detects the missing column until deployment.
No buyer edit/provision/delete endpoints were added because this phase specifies
directory/profile inspection endpoints only.

## Frontend

The directory has search, joined-date filters, four sort choices, bounded page-size
selection, pagination, requested business columns, inquiry/RFQ totals and real
View Profile deep links. Invalid date ranges suppress directory requests until
corrected. A compact directory table keeps actions accessible on desktop while
retaining horizontal scrolling on smaller screens.

The profile shows company/contact/GST/billing details, evidence-based email badges,
order count/value cards, and Production RFQs / Sample Requests / Orders tabs.
Tabs have keyboard arrow/Home/End navigation and reset to page 1 on selection.
Response tab identity prevents rendering a previous tab's rows under a new header;
buyer identity keys prevent carrying a previous profile into a different buyer.
Empty RFQ, sample, order, directory and missing-buyer states have explicit messages.

## Verification

- `npm test`: 71 passing automated tests, including all prior phases. New cases
  cover page/ID bounds, role scoping, filters and IST boundaries, page-scoped
  enrichment, empty pages, decimal estimates and unknown values, order aggregation,
  sample-type projection, billing values, verification evidence and API errors.
- `npm run test:browser`: 21 passing Chromium tests across all four phases.
  Buyer cases cover pagination/search/sort/date filters, View Profile links,
  verification and billing, all activity tabs, unknown values, mobile empty states
  and missing profiles.
- Root build, lint and TypeScript checks pass.

Tests use synthetic users, injected repository/verification providers and browser
network interception. Aggregate query shape and projections are tested, but this
phase does not claim live PostgreSQL execution or actual Supabase verification.
Screenshots: phase4-buyer-directory.png and phase4-buyer-profile.png. Logs:
phase4-test-results.txt, phase4-browser-results.txt, phase4-build-results.txt.

No shared database schema or real buyer records were changed. Billing schema
deployment and the earlier catalog migrations remain deployment prerequisites.
