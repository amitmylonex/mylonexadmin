# Phase 2: supplier governance and provisioning

## API contracts

All endpoints require the Phase 1 ADMIN identity and return the shared success/error envelope.

| Method / path | Behavior |
| --- | --- |
| GET /api/v1/admin/suppliers | page (default 1), pageSize (default 15, max 50), search, status ALL/APPROVED/SUSPENDED/PENDING; company, nested user email, city, status, consent and entity counts |
| POST /api/v1/admin/suppliers | fullName, companyName, email, phone, optional GST, supplierType manufacturer/trader/buying_house; optional city/locationState retained for compatibility |
| PATCH /api/v1/admin/suppliers/:id/status | status APPROVED/SUSPENDED; optional expectedCurrentStatus and reason. Older nextStatus request shape and POST method remain compatible |
| GET /api/v1/admin/suppliers/:id | profile, address, warehouse/dispatch location, account metadata and entity counts |
| POST /api/v1/admin/suppliers/:id/whatsapp-consent | consent true requires explicitConfirmation true and valid phone (supplied or already configured). Revocation clears the flag and timestamp |

Status updates use an atomic expected-status predicate and change only
SupplierProfile.status. Existing orders, RFQ history and catalog records are
preserved. The existing buyer application filters approved suppliers on subsequent
reads; this phase does not add push updates to already-open buyer screens.

## Provisioning lifecycle

1. Validate and normalize input; preflight duplicates by email/company/GST.
2. Supabase Admin creates a new identity using 32 random bytes as a temporary
   password and email_confirm=true. The password is neither returned nor emailed.
3. A short database transaction acquires the existing supplier-create advisory
   lock, rechecks duplicates, and creates User(role SUPPLIER) plus nested
   SupplierProfile(status PENDING, fulfillmentRegions []). External requests run
   outside database transactions.
4. On profile failure, check whether the identity owns a committed profile before
   compensating. Delete only the newly created auth identity when no committed
   profile exists. Cleanup failures or uncertain database outcomes return a
   reconciliation message rather than inviting a blind retry.
5. After commit, optionally generate the Supabase recovery token hash and send a
   password setup message through Postmark. The link targets the existing supplier
   app's `/auth/confirm?token_hash=…&type=recovery&next=/auth/reset-password` handler.
6. Return emailSent and emailStatus (sent/disabled/failed). Delivery failure retains
   the committed account and tells the operator to use the supplier password reset
   flow. Account creation is not falsely reported as failed because email failed.

Server settings: existing SUPABASE_URL and SUPABASE_SECRET_KEY; POSTMARK_ENABLED=true
enables email, requiring POSTMARK_SERVER_TOKEN, POSTMARK_FROM_EMAIL and APP_BASE_URL
(the existing supplier application's public base URL, not the admin SPA).
POSTMARK_MESSAGE_STREAM defaults to outbound. Missing enabled-mail configuration
blocks provisioning before creating an auth identity. Postmark requests have a
10-second timeout and check ErrorCode as well as HTTP status. No credentials,
temporary passwords or recovery links are written to audit logs.

Postmark request contract reference: [official Email API](https://postmarkapp.com/developer/api/email-api).

## Consent and interface

Consent recording persists normalized international digits (without a plus sign,
matching the existing notification sender), timestamp and consent flag in one
profile update. Local ten-digit Indian numbers gain 91; invalid/short Indian local
numbers and invalid international digit shapes are rejected. This validates number
shape, not carrier ownership or WhatsApp registration. Revocation requires no new
opt-in checkbox and clears the timestamp. Structured audit events identify record
versus revoke without logging phone or message content.

The supplier list provides debounced search, status buttons, page-size selection,
pagination, real company/settings/catalog deep links, consent pills and an Actions
dropdown. Requests are aborted on filter changes or unmount. Supplier creation uses
client Zod validation and loading states. Location is optional; legacy mill/dealer
types remain valid for existing records, but new accounts use the three specified types.

The detail view includes registered address, city, GST, warehouse, dispatch,
creation date and activity counts. Both phone displays mask subscriber digits.
The consent card uses +91 ******8099-style display, permits phone edits even after
consent, and requires fresh explicit confirmation for a changed phone. Revocation
uses the shared modal with cancel/confirm and busy states.

## Verification and deployment limits

- 55 backend/domain/API-client tests: pending account creation, random credentials,
  compensation, ambiguous commit handling, email failure, Postmark response handling,
  search/pagination composition, status-only mutation, phone normalization and
  explicit consent enforcement.
- Ten Chromium browser tests (six foundation plus four supplier scenarios): list
  pagination/search/filter/catalog link, suspension, client validation/provisioning,
  and consent recording/edit/revocation.
- Root build/lint/typechecks; build retains the existing lazy Excel bundle warning.

Tests use synthetic identities, transaction doubles and intercepted browser API
responses. No real Supabase account was created/deleted, Postmark email sent, or
shared database record changed. The unchanged-order verification is against a test
fixture and the status service's mutation shape, not a live order dataset.
Real identity provisioning, recovery-link acceptance and email delivery require
configured services and deployment verification. Shared schema prerequisites from
the catalog handoff remain pending; this phase creates no new database migration.
