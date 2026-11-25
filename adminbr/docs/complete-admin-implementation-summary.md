# Admin parity implementation and verification

2026-11-18. Old source: `../mylonex-nextjs`. Destination: `adminfr` and `adminbr`. The source audit covers 91 Admin route, action, API and domain files; see `old-admin-source-inventory.json` and `complete-admin-parity-audit.md`.

## Delivered code

| Module | Implementation | Verification boundary |
|---|---|---|
| Auth | Fresh verified ADMIN gate, fail-closed session restoration, server authorization, bounded token checks and write limits | Unit tests; authenticated browser pending |
| Dashboard | Original legacy/current inquiry and response totals, weighted response hours, buyer KPIs and moderation shortcuts | Disposable DB aggregate execution |
| Suppliers | Search/paging, invitations, approval/suspension, scoped detail/catalog and consent validation; separated route/service/repository | Synthetic invitation adapter and persisted approval; external Auth invitation not exercised |
| Buyers | User-based directory including users without profiles, original engagement semantics, accepted quote/sample counts, paginated activity detail | Synthetic persistence and old-client reads |
| RFQs | Bounded searchable lists, original derived status, single/bulk guarded review, notes/actors, detail and manual approved-supplier selection | Pending-state and duplicate-match guards in local DB |
| Tracking | Original query/state/projection model, metric definitions, date filters, paginated detail, quote expiry and actual delivery evidence | Local SQL and focused state/privacy tests |
| Quotes | Review/edit/release/reject dialog; original supplier-price snapshot; protected WhatsApp metadata and public terms | Concurrent local review releases once; original price preserved |
| Catalog | Retained restored old collection/preview/quick-add/woven/capability workspace and supplier scope | Earlier schema-repair/catalog local evidence retained; no new live saves |
| Import/images | Retained validated bounded upload/import flows; Excel chunk loads on demand | Existing focused validation tests pass; advanced importer gaps below |
| Samples | Itemized quote/rejection review with future expiry, Decimal rate-times-quantity pricing and state guards | Local persistence, repeat-release prevention and old-client read |
| Orders | Original Order Master View remains default; documents/milestones, accepted production/sample views and guarded delivery confirmation | Local records and concurrent delivery guard; actual old Prisma adapter reads outcomes |

The UI follows the old Admin terminology, sidebar, content styling and operational workflows. This is not a pixel-perfect browser comparison of every screen. Source parity and visual verification are separate.

## Internal structure

Frontend: `src/app` owns the shell; `features/<module>/pages` owns screens; `features/catalog/components` owns catalog editors; `components/layout`, `components/tables` and `components/ui` contain shared presentation; `hooks` owns debounced/cancellable lists; `routes` owns deep links/back navigation; `services/admin-api.ts` owns authenticated HTTP transport. `lib/api.ts` preserves existing imports. Views are lazy-loaded; Excel has its own build chunk.

Backend: `src/server.ts` starts the app; `app.ts` configures transport, errors and module registration; `config` validates runtime settings; `database` owns Prisma; `common` owns errors, paging, request limits and audit logging; `modules/<domain>` separates HTTP routes, validation/services and repositories. Existing infrastructure paths remain compatibility exports. The catalog's legacy route adapter and some older catalog components remain larger than the new modules and are recorded as incremental cleanup, not claimed fully decomposed.

## Verification results

| Level | Result |
|---|---|
| Build | Backend TypeScript and frontend Vite production build passed |
| Typecheck | Both packages passed |
| Lint | Both configured scripts passed; these scripts currently run TypeScript, not ESLint |
| Focused tests | 31 passed, 0 failed; authorization, ownership, validation, metadata, state and pricing tests |
| Disposable DB | 14 checks passed; `127.0.0.1:55489/schema_repair_test`; synthetic fixtures only, zero external messages |
| Old application compatibility | Actual old-project Prisma/pg adapter read persisted quote, sample and order outcomes in the disposable DB |
| Shared database | Public schema inspected read-only; repaired catalog objects present; no shared DML, DDL, migrations or business saves performed by this work |
| Authenticated browser | Blocked: Chrome tab activation failed and Codex covered the target; see `complete-admin-browser-verification.md` |
| Production readiness | Not ready: outstanding parity, browser and operational checks remain |

Disposable results: `complete-admin-test-db-results.json`. Reproduction: `tools/admin-parity/verify-workflows.mts` refuses any target other than the explicit loopback test database. Supplier Auth invitation is stubbed; accepted buyer decisions are synthetic local fixtures, not an end-to-end buyer browser test. Existing live business rows were not copied into the disposable DB.

The task-owned PostgreSQL cluster was stopped after verification; its fixtures and evidence remain under ignored `.schema-repair`. No other PostgreSQL instance was stopped. The earlier unit transcript contains the preceding 30-test run; the final run added the quote-provider-identifier privacy regression and passed all 31 tests. The final machine-readable summary records this distinction.

Current source files and API route templates are enumerated in `complete-admin-code-and-api-inventory.json`. There is no Git metadata in this workspace, so this is a current implementation inventory rather than an invented historical diff. New/expanded API families include buyer detail, RFQ detail/manual match/bulk review, tracking list/detail, quote review, sample detail/quote/reject and accepted production/sampling delivery, alongside retained supplier/catalog endpoints.

## Remaining gaps and blockers

1. External supplier email/WhatsApp and buyer notifications are not dispatched. Mutations and screens explicitly disclose this. Reuse and verify the old canonical claim/retry/provider behavior before enabling dispatch; do not deploy moderation workflows that operators expect to notify recipients until this is resolved.
2. Automatic supplier rematching is deferred; manual approved-supplier selection is implemented. Port the canonical matching engine with its dependencies and regression fixtures before exposing rematch.
3. Advanced Excel semantic unit conversion/ranges, visual shade editor, full capability colour/linkage controls and private image signed-reader contract remain catalog parity gaps.
4. Durable general audit/outbox/import-job history needs a separately reviewed additive design. Existing domain actor/timestamp fields and structured audit logs are retained.
5. Shared drift still includes unused `account_deletion_requests.reason`; migration history has 34 entries and does not prove the manual catalog repair was recorded. No deletion-request Admin module was added. Catalog code-floor provenance still requires authorized review; an example value is not historical evidence.
6. Tracking parents are paged but their supplier-match fanout can be large. Profile real cardinalities before claiming large-scale query performance. No speculative shared index changes were made.
7. Authenticated old/new desktop/mobile visual comparison, keyboard flows, external provider delivery and shared persistence testing remain pending.

## SQL and deployment discipline

No new migration was authored for this parity implementation. Existing prepared catalog repair: `adminbr/prisma/migrations/20261118083000_restore_catalog_projection/migration.sql`; its exact SQL/review/rollback are in `schema-repair-plan.md`, `schema-repair-sql-review.md`, `schema-repair-rollback.md`. This work did not apply it to the shared database. Do not blindly reapply it or mark it resolved because objects now exist.

Production application checklist:

- Resolve notification/rematch and required catalog parity gaps against the source audit.
- Review the current target, schema drift, existing migration ledger and historical MYLO high-water mark with an authorized operator.
- Confirm a current restorable backup before any separately approved shared SQL; use the existing SQL review and rollback prerequisites.
- Validate production origins, Auth redirect/invitation settings, storage policies and provider credentials without logging secrets.
- Run authenticated Admin/buyer/supplier browser tests on a disposable environment, including old/new reads and every listed workflow; test stale/concurrent actions and delivery status.
- Obtain separate explicit authorization for any shared writes or schema changes; then rerun readiness and authenticated checks against that intended target.
- Keep the previous application build available; application rollback should preserve additive schema and all existing codes. Never reset counters or reseed.

Next safe action: authenticated read-only old/new screen comparison and disposable-browser workflow verification. This does not authorize shared business mutations or production deployment.


RFQ follow-up (24 November 2026): persisted staged re-matching, transactional match forwarding, structured detail/navigation and an explicit WhatsApp worker adapter are now implemented. See `../../docs/rfq-admin-workflow-implementation-report.md` for verified results and remaining integration/performance limits. Earlier gap lists above describe their original implementation stage.
