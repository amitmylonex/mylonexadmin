# Admin implementation summary

Date: 2026-11-18. Status: core supplier/catalog authoring restored in code; **not ready for production deployment** until database alignment and authenticated integration verification are completed.

## Implemented

- Organization-scoped create/edit APIs and React editors for collections, quick-add fabrics, detailed woven products/specs and capabilities. Existing collections can be archived/restored. Collection links are validated against supplier ownership and archive status; the collection selector has independent search/pagination.
- Quick-add fields cover material/composition/construction/weave/GSM/width/purity, greige/RFD/dyed/printed, dye method, finishes, buyer notes, stock/production model, MOQ/lead time/price, location and optional collection. Buyer preview and required-field readiness hint are provided. Server validation is authoritative.
- Detailed woven editor persists yarn count/ply and EPI/PPI atomically with the product. Material family is selectable instead of silently hardcoded. Capability editor supports custom tags, processing and material arrays, ranges and commercial values. Existing capability linked-product ownership is checked; the editor preserves existing links, colours and quantities.
- Authenticated supplier-scoped image uploads to configurable Supabase storage, 10MB/image, JPG/PNG/WEBP only, content-signature checks, random organization-prefixed object names and no overwrite. Collection cover upload and multi-image fabric/capability upload are supported.
- Explicit publish/deactivate endpoint; activation revalidates legacy records before making them active. Imported/new manual records default to inactive. Buyer eligibility continues to use shared `isActive` and `SupplierProfile.status === APPROVED`. Capabilities remain internal and excluded from matching. Greige/RFD save projects empty shade variants; dyed/printed edits preserve existing variants unless explicitly replaced via API.
- Excel/CSV workflow supports file bounds, sheet selection, column mapping, explicit defaults, editable paged rows, server validation preview, downloadable row error report and confirmation. Up to 500 rows per request. Required prices/MOQs/lead times are not invented. Import material/weave/supply model must be mapped or explicitly defaulted. All writes run in one transaction under an organization lock. Duplicate name/weave/GSM rows are counted and skipped, or reject the entire transaction with `skipDuplicates:false`. Retrying a successful batch skips its existing fabrics. Imports save inactive listings.
- Supplier creation normalizes email/GST, validates phone/location, checks email/company/GST duplicates, serializes concurrent admin account creation and sends a secure Supabase invitation. Provider failures stop profile creation; no password is returned. Supplier city/state are captured; state is stored in the existing dispatch-location string because the shared profile has no state column.
- Search now covers company/contact name/email/GST/phone/city/dispatch location and recognized statuses. Supplier type, city and active/empty-catalog filters are server-driven. Query pagination/status/type bounds are validated. Existing status and WhatsApp consent views are retained.
- Approval/suspension/reactivation now use atomic expected-status updates and require trimmed reasons. RFQ forwarding rejects nonpending matches and nonapproved suppliers in its conditional database update.
- Fresh server-side ADMIN verification remains mandatory. Added per-admin write rate limits (60/minute, single process), safe public domain errors, sanitized database errors, request IDs, authorization-header redaction, React error boundary, retry feedback and stale-list-response guards. Catalog supplier selector and catalog overview are paginated.
- Shared browser-safe transport types live in `shared/admin-contracts.d.ts`. No frontend database client was introduced. Existing `adminfr` and `adminbr` physical folder names are retained to preserve deployments; they remain the frontend/backend boundary. Catalog business rules run on the backend.

## Database blocker and migration

A read-only schema comparison against the configured database found these missing objects:

- `supplier_catalog`: `mylonex_code`, `weight_unit`, `weight_value`, `width_unit`, `width_value`, `sample_availability`.
- `system_counters` table (`id`, `value`).

Prepared migration: `adminbr/prisma/migrations/20261118083000_restore_catalog_projection/migration.sql`. It adds nullable columns, a unique nullable fabric-code index, and the canonical counter table. Counter initialization preserves the maximum existing numeric MYLO code and never reduces a counter. It neither deletes data nor backfills or renames existing listings. **This migration has not been applied.** No application schema fields were invented for this repair; these objects are already referenced by the checked-in Prisma schema and old marketplace implementation.

Do not blindly run `prisma migrate deploy` on a shared database with an unknown migration baseline. Reconcile this additive SQL with the canonical marketplace migration history first. A deployment operator can apply the reviewed file using `prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261118083000_restore_catalog_projection/migration.sql` from `adminbr`, against the explicitly selected environment. This command is documentation, not a command run during this work. Do not use `db push`, `migrate reset` or any reset/seed script.

`GET /health` is process liveness. `GET /ready` now returns 503 with `database_schema_upgrade_required` while these objects are missing; it no longer reports the app ready merely because `SELECT 1` succeeds.

## Verification

| Check | Result |
|---|---|
| Root `npm run build` (backend tsc + frontend tsc/Vite) | Passed |
| Root `npm run typecheck` | Passed |
| Root `npm run lint` | Passed; these scripts run TypeScript checks, not ESLint (no ESLint setup exists) |
| Root `npm test` | 20 passed, 0 failed; log in `docs/backend-test-results.txt` |
| API /health | 200 |
| API /ready | 503, expected schema blocker |
| Browser | Actual standalone sign-in page renders at port 5173; no signed-in session available |
| Live database persistence smoke | FAILED with Prisma P2022 missing mylonex_code; transaction rolled back all test writes |
| Live invitation/storage upload/authenticated browser flows | Not verified; no test account/session/storage writes performed |

Tests cover unauthenticated routes, fresh DB role checks and forged metadata, expired sessions, supplier creation/duplicates/provider failure, trimmed reason and status concurrency, listing commercial/state validation, invalid activation/deactivation, foreign edits and collection/capability ownership, capability ranges, woven technical specs, import validation/duplicates and upload signatures/size/type. Service tests use controlled dependencies and do not claim live transaction verification. `npm --prefix adminbr run test:db` is an opt-in real database smoke test that creates test records inside a transaction and always rolls it back, including counter changes. Run it after schema alignment, preferably against a dedicated test database. It is separate from ordinary unit tests so ordinary tests never modify live data.

## Remaining gaps and operational dependencies

1. **Durable audit/status/import history:** actions emit structured audit events but no durable, transactional history model exists. Import filename is accepted by the request but no import-job record is persisted. A coordinated additive model/outbox migration and retention policy are still required. In particular, do not advertise this as complete audit retention or downloadable historical import jobs.
2. **Draft vs inactive/archive:** listing schema has only `isActive`; this implementation labels records inactive and does not misrepresent them as durable drafts. Only collections have archive support. A separate draft lifecycle needs a coordinated shared-schema change. Rejected suppliers are not offered because the actual enum has only PENDING/APPROVED/SUSPENDED.
3. **Normalized supplier state and multi-user memberships:** no separate supplier state field or organization-membership table exists. No dedicated state filter is supplied; dispatch-location text is searchable. Future memberships, normalized state and company uniqueness/indexes must be shared with the marketplace, not duplicate organization tables in admin. Application locking prevents duplicates through this API; legacy writers still need a shared normalized DB uniqueness constraint.
4. **Advanced importer parity:** old automatic semantic sheet/header detection, range parsing, unit conversions (oz/GLM), honest nullable import-material projection, advanced buyer preview and full workbook fixture coverage are not ported. The new importer requires explicit supported values and rejects invalid/missing values instead of approximating conversions. Browser parsing is bounded by file size/sheets/rows/columns, but worker-isolated or server-side workbook parsing is still needed for robust protection from compressed workbook expansion.
5. **Shade editing and richer capability UI:** existing shade JSON is preserved for dyed/printed edits; new shades can be supplied through the validated API but there is no visual shade editor. Capabilities use comma-separated custom tags, support the shared model's single supply model/MOQ/lead time, and preserve existing linked records/colour quantities. They do not invent capacity or MOQ/lead-time range fields absent from the source schema. A richer linkage/colour editor remains future work.
6. **RFQ/quote notifications, sampling and orders:** existing routes/pages are retained; the old complete notification actions, sample quote drawer and order fulfillment operations are not restored by this catalog change. RFQ approved-supplier eligibility is guarded, but notification parity needs integration-specific migration and tests. Other existing RFQ/buyer/sample/order lists remain unbounded; they were not rewritten under this supplier/catalog scope.
7. **Cross-system invitation recovery:** Supabase email/auth and PostgreSQL cannot share a transaction. If invitation succeeds then the DB commit fails, the API explicitly reports reconciliation required; it does not delete users or falsely report success. A retry/reconciliation outbox and operational recovery UI are still needed. Default invitation redirect uses existing Supabase site settings; verify it points to the supplier marketplace onboarding flow.
8. **Storage lifecycle and deployment scale:** storage matches the old public product-image URL contract. Validate bucket public-read policy and configure quotas/retention; uploaded-but-unsaved objects are not deleted automatically. Private signed-download support needs a coordinated buyer-reader contract. Per-process rate limiting needs a shared gateway/Redis limiter for multiple replicas. Editing currently uses last-write-wins except supplier status; catalog optimistic version checking remains future hardening.
9. **Full QA:** database migration review/application, real save verification, storage permissions, email delivery, responsive/keyboard QA of authenticated forms and regression tests of matching/RFQ/sample/order integration remain prerequisites before production release.

## API inventory

All `/api/v1/admin/*` routes require verified ADMIN authentication.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/v1/admin/catalog/suppliers` | Paged/searchable supplier selector |
| GET | `/api/v1/admin/suppliers` | Validated paging/search/status/type/city/catalog filters |
| POST | `/api/v1/admin/suppliers` | Validated pending profile + secure invitation |
| POST | `/api/v1/admin/suppliers/:id/status` | Atomic reasoned status change |
| GET | `/api/v1/admin/suppliers/:id/catalog` | Bounded page of each catalog section, totalPages |
| GET | `/api/v1/admin/suppliers/:id/catalog/manage/collections` | Independent active-collection search/pagination |
| POST | `/api/v1/admin/suppliers/:id/catalog/manage/:kind` | Create collection/fabric/woven/capability |
| GET/PUT | `/api/v1/admin/suppliers/:id/catalog/manage/:kind/:itemId` | Scoped editor payload / validated update |
| POST | `/api/v1/admin/suppliers/:id/catalog/manage/:kind/:itemId/active` | Explicit validated publish/deactivate (noncollection kinds) |
| POST | `/api/v1/admin/suppliers/:id/catalog/images` | Validated base64 image upload |
| POST | `/api/v1/admin/suppliers/:id/catalog/excel-import` | `preview:true` validates; otherwise atomic inactive import |
| POST | Existing item toggle / collection toggle-archive | Retained for compatibility; activation now revalidates |
| POST | Existing RFQ forward route | Requires pending match + approved supplier |
| GET | `/ready` | Schema-aware readiness |

`:kind` is one of `collections`, `fabrics`, `woven`, `capabilities`. Upload JSON is `{contentType,data}` with raw base64 data, not a data URL. New successful authoring responses use `{ok:true,item}`; errors use a safe string `error` and requestId where provided by central middleware. Existing unrelated response contracts are retained.

## Environment and local running

No existing environment variables were removed or changed. No additional package dependencies were installed.

Backend `adminbr/.env`: DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY; optional PORT (4000), HOST, FRONTEND_ORIGIN. Optional `SUPABASE_PRODUCT_IMAGES_BUCKET` defaults to `product-images`. The secret key stays backend-only. Supabase email delivery and supplier onboarding site settings must be configured.

Frontend `adminfr/.env`: VITE_API_URL (default http://localhost:4000), VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY. Never put service-role/database credentials here.

From the workspace root, run `npm run dev:backend` and `npm run dev:frontend` in separate terminals. Open http://localhost:5173 and sign in with an existing ADMIN account. The development servers were started during verification. Complete database alignment before expecting catalog pages to load/save. For installation, run `npm --prefix adminbr ci` and `npm --prefix adminfr ci`; the backend postinstall generates the Prisma client. Run `npm run build`, `npm run lint`, `npm run typecheck` and `npm test`. There is no standalone frontend test runner configured.

## Changed files

Source/config/documentation files created or updated (generated build output excluded):

- `package.json`
- `shared/admin-contracts.d.ts`
- `adminbr/package.json`
- `adminbr/prisma/migrations/20261118083000_restore_catalog_projection/migration.sql`
- `adminbr/src/app.ts`
- `adminbr/src/common/errors/public-error.ts`
- `adminbr/src/infrastructure/readiness.ts`
- `adminbr/src/modules/auth/admin-session.ts`
- `adminbr/src/modules/auth/verify-admin.ts`
- `adminbr/src/modules/auth/write-limit.ts`
- `adminbr/src/modules/suppliers/supplier.routes.ts`
- `adminbr/src/modules/suppliers/supplier.schema.ts`
- `adminbr/src/modules/suppliers/supplier-create.service.ts`
- `adminbr/src/modules/suppliers/supplier-status.service.ts`
- `adminbr/src/modules/catalog/catalog.routes.ts`
- `adminbr/src/modules/catalog/catalog.schema.ts`
- `adminbr/src/modules/catalog/catalog.service.ts`
- `adminbr/src/modules/catalog/catalog.import.ts`
- `adminbr/src/modules/catalog/catalog.upload.ts`
- `adminbr/src/modules/catalog/constants.ts`
- `adminbr/src/modules/catalog/templates.ts`
- `adminbr/src/modules/rfqs/rfq.routes.ts`
- `adminbr/test/auth.test.ts`
- `adminbr/test/catalog.test.ts`
- `adminbr/test/database-smoke.ts`
- `adminfr/package.json`
- `adminfr/src/App.tsx`
- `adminfr/src/main.tsx`
- `adminfr/src/lib/api.ts`
- `adminfr/src/components/CreateSupplierForm.tsx`
- `adminfr/src/components/ExcelCatalogImport.tsx`
- `adminfr/src/components/ErrorBoundary.tsx`
- `adminfr/src/features/catalog/fields.ts`
- `adminfr/src/features/catalog/CatalogEditor.tsx`
- `adminfr/src/features/catalog/ImageUpload.tsx`
- `adminfr/src/pages/SuppliersPage.tsx`
- `adminfr/src/pages/SupplierDetailPage.tsx`
- `adminfr/src/pages/CatalogControlPage.tsx`
- `docs/admin-migration-audit.md`
- `docs/admin-implementation-summary.md`
- `docs/backend-test-results.txt`

Builds regenerated `adminbr/dist` and `adminfr/dist`. This workspace has no Git metadata, so no commit/diff was created. No environment files, old-project source files or existing production records were changed. The only live write attempt was the deliberately rolled-back persistence test.
