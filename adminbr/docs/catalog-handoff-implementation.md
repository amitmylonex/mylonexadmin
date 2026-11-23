# Catalog handoff alignment

Implemented on 2026-11-19 against the supplied domain rules and the original
project's `docs/admin-migration-handoff.md` (copied here for reference).

## Application behavior

- The four-step frontend wizard is retained. Browser code has no database access.
- Backend-owned Excel validation mirrors the pure frontend engine. A regression
  test compares these modules to prevent drift; change both copies together.
- Server validation recalculates dimensions from source values, applies range
  normalization, requires weave/composition/sample availability/count or
  construction, and rejects missing unconfirmed defaults and unsupported yarn.
- Count is merged into construction once. The browser submits the untransformed
  staged row; the backend performs the authoritative merge and conversions.
- Entire payload validation happens before writes. A malformed payload causes no
  writes. After validation, each row has its own transaction; save failures are
  reported and later rows continue. At most 500 rows are accepted per request.
- The repository locks the existing SystemCounter row via UPDATE before checking
  active duplicates, then increments it and saves the listing in the same transaction.
  The historical counter floor must already be initialized; no floor is guessed.
- Duplicate comparison is scoped to supplier + active name/weave/GSM with
  case-insensitive text comparison. Input text is trimmed by validation. Existing
  legacy records with surrounding whitespace require separate data cleanup.
- Named collections are upserted transactionally. Archived collections require
  explicit restoration instead of silently publishing into them.
- Imports save active listings, null legacy material classification, normalized
  source dimensions, sample availability and finishes. Blank source names stay
  blank, with independent `MYLOXXXX` code for display, matching the handoff.
- WhatsApp consent now persists the normalized phone, including when the admin
  confirms consent using the supplier's existing phone.
- Existing supplier status transitions update SupplierProfile only, preserving
  orders. Buyer browsing and matching remain owned by the original application;
  its source checks supplier APPROVED and listing isActive. No buyer app code was changed.

## Schema and deployment status

The previous workspace inspection documented a live enum `weave_type`, missing
source columns, and an absent counter table. These historical observations are
not a fresh live inspection. The handoff's Prisma String declaration alone does
not establish the actual deployed column type.

The local Prisma projection now uses String for fabric weave; the generated
client was updated. Manual fabric weave validation/editor accepts free text.
WovenProduct's separate enum remains intact. `/ready` detects an incompatible
fabric weave column in addition to missing columns.

`catalog-free-text-weave.sql` is a prepared deployment artifact, NOT an applied
migration. Shared database writes, schema deployment and live imports were not
performed. Before deployment: verify actual target schema, complete the existing
reviewed source-column/counter repair with confirmed historical code floor if
needed, review/apply the weave conversion through the canonical migration owner,
and coordinate every application using that column. Conversion takes a table lock.
An application rollback must retain text storage once free-text weaves exist;
converting back to an enum can lose valid data.

Concurrency tests here use transaction doubles. They establish service ordering,
rollback handling and continuation, not a measured PostgreSQL concurrency result.
The original application's older duplicate-check writer must also acquire the
counter lock before its duplicate query for cross-application race protection.

## Verification and remaining integration

Run root `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
The tests cover conversions, validation, source persistence, counter-lock ordering,
partial save failures, retries and consent normalization without a live database.

Authenticated browser verification, live-schema checks and cross-app cache behavior
remain deployment checks. The handoff recommends cache invalidation integration;
no unverified webhook endpoint or secret configuration was invented here. Supplier
suspension is enforced on subsequent database reads; existing open browser screens
do not receive a push refresh. Large workbook parsing and grid virtualization are
separate performance work and have not been claimed as completed.
