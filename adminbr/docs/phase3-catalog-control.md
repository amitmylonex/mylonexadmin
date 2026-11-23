# Phase 3: catalog control and Excel import

## API connections

All routes inherit ADMIN authentication. Existing management endpoints remain
available for collections, woven listings and supplier capabilities.

| Route | Final behavior |
| --- | --- |
| GET /api/v1/admin/suppliers/:id/catalog | Supplier metadata plus paginated collections, fabrics, woven listings and capabilities; deterministic ordering, maximum pageSize 50 |
| GET /api/v1/admin/suppliers/:id/catalog/excel-template | Supplier existence check, binary XLSX attachment with sample columns and Instructions sheet; no-store |
| POST /api/v1/admin/suppliers/:id/catalog/excel-import | Maximum 500 rows; up to 10 MB JSON payload; complete payload validation before writes, independent row transactions and detailed counts/skips/failures |
| POST /api/v1/admin/suppliers/:id/catalog/quick-add | Manual fabric creation using the existing validated service and code allocator; isActive defaults false, explicit publish supported |
| PATCH /api/v1/admin/suppliers/:id/catalog/products/:productId | Explicit isActive boolean, supplier-scoped item; optional sourceType fabrics/woven/capabilities, default fabrics |

The product URL uses distinct `id` and `productId` parameter names because the
supplier and listing identifiers cannot share a Fastify parameter name. Its
external URL structure matches the requested endpoint.

## Storage and transactions

Manual catalog writes and imports now follow the same supplier → system counter
lock order. Each importer transaction locks the supplier, updates the existing
`mylonex_fabric_code` counter by zero (PostgreSQL row lock), checks active
supplier/name/weave/GSM duplicates case-insensitively, and increments the counter
only for a new listing. Collection linking/upsert and row creation commit together.
The counter must already be initialized above the confirmed historical code floor;
neither manual creation nor import guesses a starting floor.

The import repository preserves free-text weave (maximum 200 characters), original
normalized source weight/width values and units, sample availability, and merged
Count / Construction. Blank supplier names remain blank while an independent unique
MYLOXXXX code supplies the display fallback. Generated GSM and inches are calculated
again on the server from submitted source dimensions. Imported fabrics are active;
buyer visibility still requires an approved supplier.

Invalid payloads write nothing. Once validation succeeds, a failed save rolls back
that row only; previous successes remain committed and later rows continue.
Retries skip already-active successes using the same duplicate signature. Error
diagnostics retain physical sheet/row and client row identity without exposing
private database error text.

Woven listings retain their own enum-based weave schema and four technical specs
(warp count/ply, weft count/ply, EPI, PPI). Only SupplierCatalog fabric weave uses
free text. Supplier scoping and transaction handling remain in the backend.

## Frontend workflow

1. Upload accepts XLSX/XLS/CSV, rejects files above 10 MB, and downloads the official
   server template through the authenticated API client. The old local template
   writer was removed. The file picker also has a keyboard-accessible browse button.
2. Upload always opens Mapping. Worksheet/header selectors and aliases/fuzzy
   suggestions remain available; color/shade cannot become Fabric Name.
3. Review retains inline edits, GLM/OZ conversion, warp/weft fallback and fixed
   source coordinates. Proposed defaults can be reviewed per row or confirmed in
   one displayed batch. Insertion/duplication/removal retain source identity.
   Batches above 500 are rejected; row insertion/duplication also enforce the cap.
4. Buyer Preview leads to a native modal for confirmation and line-item results.
   Background catalog/profile refresh preserves the wizard and results. The
   completion callback fires once; closing the result does not submit again.

The review table renders 25 rows per page and mounts only the desktop or mobile
editor at a time. New/duplicated rows are revealed on the appropriate review page.
Enter/Shift+Enter navigate rows and Alt+Arrow navigates cells within the current
desktop page. This bounds rendered controls; workbook parsing still runs in the
browser's main thread. No claim of worker-based parsing or measured production
latency is made.

## Verification

- `npm test`: 62 passing tests, including all prior suites. Added binary template
  round-trip through the actual browser/server validation engines, authenticated
  route injection, quick-add/code allocation, 501-row rejection, source coordinates,
  conversions, binary Fetch handling and woven technical-spec persistence.
- `npm run test:browser`: 17 Chromium checks across foundation, suppliers and
  catalog. Catalog cases cover XLSX template download, worksheet/header detection,
  shade guard, defaults, blank-name/free-weave import, isolated failures, row edits,
  GLM/OZ calculations, row operations/keyboard navigation, quick-add, publication,
  woven forms, XLS/CSV support, upload limits and bounded review pages.
- `npm run build`, `npm run lint`, `npm run typecheck`.

One browser scenario sends the actual browser payload through the real backend
import service/repository with a simulated transaction client: one row commits
with MYLO0042, one active duplicate skips, and one synthetic database failure is
isolated. Tests assert stored source units, sample availability, merged construction,
free-text weave and the blank-name/code pair. This is not a live PostgreSQL test.

Evidence: `phase3-test-results.txt`, `phase3-browser-results.txt`,
`phase3-build-results.txt`, `phase3-review-grid.png`, `phase3-import-results.png`.
Screenshots and fixtures contain synthetic data only.

## Deployment prerequisites

No shared database schema or business records were changed. The earlier catalog
source-column/counter repair and the prepared free-text weave conversion still
require target verification and coordinated deployment. `/ready` continues to
report incompatible schemas. The historical counter floor must be confirmed.

All applications writing this shared catalog should adopt the same locking and
duplicate-check order. The old Next.js writer is outside this change; without
coordination, cross-application duplicate races remain possible. Existing saved
text with surrounding whitespace is not silently rewritten. Cache invalidation
or live push refresh in the separate buyer/supplier application is also outside
this phase; its deployment integration must be verified separately.
