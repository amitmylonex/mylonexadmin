# Admin migration audit

Audit date: 2026-11-18. Source: `../mylonex-nextjs` (Next.js admin pages, domain services/repos, Prisma schema); destination: this workspace (`adminfr`, `adminbr`). The sibling `../Mylonex` contains a separate older split implementation; the supplied screenshots and catalog workflow correspond to `mylonex-nextjs/app/admin`. No production database writes were performed for this audit.

## Architecture and source of truth

Old: Next.js server actions -> role check -> catalog service -> repository -> shared PostgreSQL through Prisma; Supabase Auth and product-images storage. New: Vite React -> bearer-authenticated Fastify -> Prisma. Keep existing physical directory names to preserve scripts/deployment; `adminfr` is frontend and `adminbr` is backend. No React database calls. Both schema projections contain SupplierProfile, SupplierCatalog, FabricCollection, WovenProduct/Spec and SupplierCapability. Catalog records already use supplier organization IDs. SupplierProfile.userId is unique: future multi-user organization membership needs a coordinated marketplace schema change, not a second admin-only organization table.

## Feature gaps before implementation

| Feature | Old Project Status | New Admin Status | Required Action | Risk/Dependency |
|---|---|---|---|---|
| Auth/admin protection | requireRole ADMIN on server actions | Supabase getUser + fresh DB ADMIN role | Preserve on every route | Supabase connectivity |
| Supplier search/page | List/status controls | Paged; unchecked query numbers; name/email/city only | Validate bounds, add GST/phone/name/type/catalog filters | Profile has no dedicated state column |
| Supplier creation | Validated server action | Random password auth create; failure silently ignored | Fail closed, normalize/duplicate checks, secure invite | Auth email/provider configuration; cross-system writes |
| Status moderation | Approval/suspension | Reason + pre-read status check | Atomic compare-and-set, preserve reasons | Only PENDING/APPROVED/SUSPENDED exist |
| Consent | Explicit WhatsApp consent | Present | Preserve | Consent is not permission to send arbitrary messages |
| Collections | Create/edit/archive/restore + cover | Read + archive toggle | Restore create/edit + scoped lookup | Unique supplier/name |
| Quick-add | Full commercial/material/state/shades/finishes | Read + toggle only | Restore forms, create/edit APIs, readiness validation | Preserve existing shade JSON on edits |
| Woven | Detailed listing + four technical specs | Read + toggle only | Restore create/edit, atomic spec persistence | Existing material family required in DB |
| Capabilities | Product line, arrays/custom values, ranges, linked products | Read + toggle only | Restore forms/API, range and ownership checks | Capabilities are INTERNAL, excluded from matching |
| Images | Supabase product-images upload, JPG/PNG/WEBP <=10MB | No upload API | Scoped authenticated upload, size/type/signature checks | Storage bucket/key required |
| Excel | Sheet detection, source mapping, editable review, preview | First sheet, inferred mapping, guessed prices, row loop | Mapping/edit/preview + authoritative server validation, bounded atomic import, explicit duplicate handling | Existing source import has extensive semantic/unit normalization |
| Draft/archive | Active boolean; collection archive boolean | Same schema | Do not invent persistent listing status | True draft vs inactive needs coordinated schema/reader change |
| Codes | Shared SystemCounter MYLO#### | Import uses random MYLO-hex | Use canonical counter transactionally | Never reset counter |
| Buyer eligibility | Active catalog/woven AND supplier APPROVED | Status persists in shared database | Preserve exact source eligibility; guard RFQ forwarding | No admin-only matching replica |
| RFQ/quote approvals and tracking | Full review and notification services | Routes/pages exist; direct updates | Preserve existing modules; document notification parity gap | External WhatsApp/email integrations not migrated |
| Sampling/orders | Sample quote drawers/milestones | Read-only lists | Explicit remaining parity gap | Payment/notification workflows outside catalog scope |
| Error handling | Domain service results | Fastify defaults; potential DB detail leaks | Central safe errors + request IDs | Existing API clients expect string error |
| Logs/history | No shared durable admin audit/import model | Console audit only | Keep structured logs; explicitly flag retention dependency | Durable transactional history needs additive coordinated migration |
| Scale | Some source catalog reads unbounded | Catalog/supplier selector unbounded | Bounded paged catalog and selector | Indexes exist on supplierId/active/collection; supplier search needs coordinated index migration |
| Validation/tests | Source catalog/import tests | No test directory despite test script | Focused route/service validation and authorization tests | Live DB checks require isolated test DB |

## Environment and integrations

Backend existing keys: DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, PORT, HOST, FRONTEND_ORIGIN. Frontend uses VITE_API_URL, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see source config). Do not copy secrets into docs or browser code. Storage bucket is configurable with SUPABASE_PRODUCT_IMAGES_BUCKET. No destructive or automatic schema migrations.

## Implementation plan (saved before coding)

1. Introduce bounded validation and safe centralized API errors; keep existing directory/deployment names.
2. Implement organization-scoped collection, quick-add, woven and capability create/edit services/routes using existing shared models, canonical counter, transactions and audit events.
3. Add reusable catalog editor/upload forms, buyer preview/readiness and edit controls to supplier detail; preserve existing inspection/moderation.
4. Replace unsafe import writes with bounded validation, explicit review, duplicate checks and atomic saves. Improve supplier filtering, input validation and status concurrency.
5. Add focused automated checks, run both builds/typechecks and tests; report browser/live integration verification accurately and enumerate unresolved coordinated-schema/integration dependencies.

## Limits requiring coordinated follow-up

Dedicated supplier state, organization memberships, durable audit/import history, persistent draft status and new indexes must be designed with the old marketplace owner because this database is shared. Do not alter deployed schema automatically. Full old importer semantic parity and sampling/order/notification parity must be verified separately; source presence of a page is not evidence of destination parity.


## Live verification findings after implementation

The configured PostgreSQL database is reachable, but it differs from the checked-in schema. A read-only information_schema comparison found missing supplier_catalog columns: mylonex_code, weight_unit, weight_value, width_unit, width_value, sample_availability. The system_counters table is absent. Other supplier/catalog model columns inspected were present. A real persistence smoke test failed with Prisma P2022 on mylonex_code and its entire test transaction rolled back. This is a deployment blocker, not a successful save verification. An additive repair SQL file is supplied under adminbr/prisma/migrations/20261118083000_restore_catalog_projection, and has NOT been applied. Readiness now checks schema compatibility rather than database reachability alone.

Browser smoke check reached the actual standalone login page on port 5173. That browser has no authenticated admin session; authenticated forms, invitations and storage uploads have not been manually exercised. The 20 unit/route tests exercise authorization and domain validation with controlled dependencies; they do not replace live end-to-end verification.
