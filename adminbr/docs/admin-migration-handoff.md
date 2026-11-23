# MyloNex Admin Migration Handoff Report
**Source-Backed Specification for Standalone Admin Panel (`adminfr` / `adminbr`)**  
*Date of Audit: November 19, 2026 | Scope: Supplier Management, Catalog Engine & Excel Bulk Importer*

---

## A. Executive Findings

1. **Architecture Decoupling**: The current admin side in `mylonex-nextjs` is tightly coupled with Next.js App Router Server Actions, Server Components, and Supabase SSR cookies. Decoupling into a standalone **React/Vite (`adminfr`)** and **Fastify/Prisma (`adminbr`)** is completely feasible because the underlying database entities (`SupplierProfile`, `SupplierCatalog`, `FabricCollection`, `SystemCounter`) and core business routines in `src/domains/catalog/` are clean and isolated.
2. **Catalog Excel Import Engine**: The spreadsheet parsing, mapping, and validation logic in `src/domains/catalog/excel/` is highly refined, deterministic, and pure TypeScript. It parses files entirely client-side using SheetJS (`xlsx`), enforces strict 2-way dimensional math (GLM/OZ to GSM and cm to inches), merges directional Warp/Weft into free-text construction, proposes explicit defaults requiring user confirmation, and rejects invalid cells prior to serialization.
3. **Storage Discrepancies & Intent vs Implementation**:
   - `SupplierCatalog.sampleAvailability` and original dimensions (`weightUnit`, `weightValue`, `widthUnit`, `widthValue`) are persisted to PostgreSQL columns, but **never exposed in buyer browsing (`buyer-repo.ts`)** or admin fabric cards.
   - `count` has no dedicated column in `SupplierCatalog`; it is concatenated directly into `construction` (e.g. `count / construction`).
   - Legacy fields `fabricType` and `materialPurity` are explicitly set to `null` during Excel import.
   - Weave type is a free-text string (up to 200 chars) in `SupplierCatalog`, not an enum.
4. **Performance Bottlenecks**:
   - Batch import executes sequentially row-by-row on the server. For each row, an independent interactive transaction (`db.$transaction`) is opened, acquiring a row-level lock on `system_counters` for `mylonex_fabric_code`.
   - Admin listing queries (`getSuppliers()`, `getSamplingRequests()`) are unpaginated.
   - Client-side revalidation in `useExcelImportWorkspace.ts` triggers full array rescans (`detectAndMarkBatchDuplicates`) on every keystroke.

---

## B. Current Architecture and Flow

### 1. Layers & Data Flow
```
Browser (React Client Component)
  │  (Upload / Inline Spreadsheet / Review)
  ▼
Next.js Route Handler / Server Action
  [app/api/admin/.../excel-import/route.ts]
  │  (Role check: requireRole("ADMIN"))
  ▼
Admin Domain Service
  [src/domains/admin/catalog-excel-service.ts]
  │  (Resolve supplierId -> userId)
  ▼
Catalog Excel Engine
  [src/domains/catalog/excel/import-service.ts]
  │  (Payload Zod validation: excelImportPayloadSchema)
  │  (Duplicate signature lookup: getExistingSupplierCatalogSignatures)
  ▼
Catalog Service
  [src/domains/catalog/service.ts] -> CatalogService.importExcelRow()
  │  (Ownership verification, shape normalization)
  ▼
Excel Import Repository
  [src/domains/catalog/excel-import-repo.ts] -> createImportedCatalogEntry()
  │  (Interactive transaction: db.$transaction)
  │  (Atomic MYLO counter increment: generateMylonexCode)
  │  (Optional FabricCollection upsert)
  ▼
Database (Prisma / PostgreSQL)
  [prisma.supplierCatalog.create]
```

### 2. File Map & Responsibilities
- `app/admin/layout.tsx`: Layout shell enforcing `ADMIN` role and rendering `AdminSidebar`.
- `app/admin/suppliers/page.tsx`: Entry point for supplier list, rendering `CreateSupplierForm` and `SupplierTable`.
- `app/admin/suppliers/[supplierId]/page.tsx`: Supplier detail, profile metrics, and `SupplierWhatsAppConsentCard`.
- `app/admin/suppliers/[supplierId]/catalog/page.tsx`: Catalog control dashboard for a specific supplier.
- `app/admin/suppliers/[supplierId]/catalog/excel-import/`: Complete 4-step wizard UI components (`Dropzone`, `MappingWorkspace`, `EditableGrid`, `BuyerPreview`, `ConfirmPanel`).
- `src/domains/catalog/excel/`: Headless parsing, unit conversion, range parsing, validation, and staging state machine.
- `src/domains/catalog/repo.ts`: Data access layer for catalog listings, MYLO counter, and duplicate checks.

---

## C. Supplier Field & Governance Rule Matrix

### 1. Supplier Account Creation (`CreateSupplierForm.tsx` & `create-account.ts`)
| UI Field | Form / Request Name | Prisma Model Field | Type | Validation / Constraints | Default | Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Full Name | `fullName` | `User.fullName` | String | 1–200 chars, trimmed | None | Created on `User` record |
| Company Name | `companyName` | `SupplierProfile.companyName` | String | 1–200 chars, trimmed | None | Primary display name |
| Company Email | `email` | `User.email` | String | Valid email, max 254 chars, lowercased | None | Unique constraint in Supabase & Prisma |
| Phone Number | `phone` | `SupplierProfile.phone` | String | 1–50 chars, trimmed | None | Stored as contact phone |
| GST Number | `gstNumber` | `SupplierProfile.gstNumber` | String? | Max 50 chars, optional | `null` | Tax identifier |
| Supplier Type | `supplierType` | `SupplierProfile.supplierType` | Enum | `manufacturer`, `trader`, `buying_house` | Required | Classifies supplier business model |

**Authentication Provisioning Flow** (`src/domains/suppliers/create-account.ts#L20-L65`):
1. Admin enters supplier details.
2. Server verifies `User.email` does not exist (`hasAccountWithEmail`).
3. Calls Supabase Auth Admin API: `supabase.auth.admin.createUser({ email, password: randomBytes(32).toString("base64url"), email_confirm: true })`.
4. Creates atomic Prisma record: `User` with `role: "SUPPLIER"` and attached `SupplierProfile` with `status: "PENDING"`.
5. If profile creation fails, compensates by deleting the Supabase auth user (`supabase.auth.admin.deleteUser`).
6. If `POSTMARK_ENABLED` is true, sends password reset email so the supplier can set their password.

### 2. Supplier Profile & Settings Matrix (`SupplierProfile`)
| Field | DB Column | Type | Default | Mutability / Admin Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | `uuid()` | Immutable primary key |
| `userId` | `user_id` | UUID | None | Unique relation to `User.id` |
| `companyName` | `companyName` | String | None | Editable by admin / supplier |
| `city` | `city` | String? | `null` | Displayed on browse & detail |
| `address` | `address` | String? | `null` | Registered office address |
| `phone` | `phone` | String? | `null` | Normalized when WhatsApp consent is recorded |
| `gstNumber` | `gstNumber` | String? | `null` | Optional GSTIN |
| `supplierType` | `supplier_type` | `SupplierType` | `null` | `mill`, `dealer`, `manufacturer`, `trader`, `buying_house` |
| `fulfillmentRegions` | `fulfillmentRegions` | String[] | `[]` | Geographies supplier ships to |
| `warehouseLocation` | `warehouse_location` | String? | `null` | City/state of main warehouse |
| `dispatchLocation` | `dispatch_location` | String? | `null` | Dispatch mill/hub |
| `status` | `status` | `SupplierStatus` | `PENDING` | `PENDING`, `APPROVED`, `SUSPENDED` |
| `whatsappConsent` | `whatsapp_consent` | Boolean | `false` | True only with explicit admin checkbox |
| `whatsappConsentAt`| `whatsapp_consent_at` | DateTime? | `null` | Timestamp when consent was recorded |
| `phoneCountryCode` | `phone_country_code` | String? | `"91"` | International dial code |
| `preferredLanguage`| `preferred_language` | String | `"en_US"` | Localization tag |

### 3. Status Enforcement Rules
- **Status Enum**: `PENDING`, `APPROVED`, `SUSPENDED` (`prisma/schema.prisma#L22-L26`).
- **Buyer Visibility**:
  - `src/domains/catalog/buyer-repo.ts#L59`: All public fabric browse queries filter `where: { isActive: true, supplier: { status: "APPROVED" } }`.
  - `src/domains/catalog/buyer-repo.ts#L282`: Direct single fabric detail query (`getPublicCatalogEntryById`) enforces `supplier: { status: "APPROVED" }`. Suspended or pending suppliers return `404 Not Found`.
- **Inquiry & RFQ Matching**:
  - `src/domains/catalog/repo.ts#L247`: `getActiveCatalogListingsForMatching()` excludes any supplier where `status !== "APPROVED"`.
  - `src/domains/inquiries/matching.ts#L27`: Matching algorithm strictly joins approved suppliers only.
  - `src/domains/requests/repo.ts#L443`: RFQ automated routing ignores suspended suppliers.
- **WhatsApp Inbound Quotes**:
  - `src/domains/notifications/whatsapp-inbound.ts#L144`: If a WhatsApp message comes from a supplier whose status is not `APPROVED`, the inbound quote parser rejects the message.
- **Existing Orders & Accepted Quotes**:
  - `src/domains/admin/accepted-orders.ts#L10-L49`: Orders and accepted quotes do **not** filter out suspended suppliers. Existing commitments remain visible for fulfilment and dispute resolution.

### 4. WhatsApp Consent Governance (`SupplierWhatsAppConsentCard.tsx` & `actions.ts#L165-L240`)
- **Enforcement**: In `src/domains/notifications/whatsapp-rfq.ts`, automated WhatsApp RFQ dispatches check `supplier.whatsappConsent === true`. If false, dispatch is bypassed.
- **Recording Process**:
  1. Requires valid phone number normalized via `normalizePhoneNumber(phone, countryCode)`.
  2. Requires explicit confirmation: Admin must check `explicitConfirmation: true` confirming supplier agreed to notifications.
  3. Updates `whatsappConsent: true` and `whatsappConsentAt: new Date()`.
  4. Revocation sets `whatsappConsent: false` and `whatsappConsentAt: null`.
- **Audit Logging**: Emits structured console audit log:
  `[Audit:AdminSupplierConsent] Admin <adminId> (<email>) RECORDED/REVOKED WhatsApp consent for supplier <supplierId>.`
  *(Note: No persistent database audit table currently exists).*

---

## D. Catalog Field & Persistence Matrix

### 1. Catalog Types in MyloNex
1. **`SupplierCatalog` (Flow 2 / Quick-Add / Excel)**: Supplier fabric offerings. Table: `supplier_catalog`.
2. **`FabricCollection`**: Groupings of fabrics (e.g., "Summer 2026"). Table: `fabric_collections`.
3. **`WovenProduct`**: Technical woven fabric with detailed specifications (`WovenProductSpec`). Table: `woven_products`.
4. **`SupplierCapability`**: Supplier manufacturing envelope (e.g. GSM min/max, weave types). Table: `supplier_capabilities`.

### 2. Comprehensive Field Matrix for `SupplierCatalog`
| UI Label | Request Key | DB Column | DB Type | Required Condition | Stored Default | Buyer Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Fabric Name | `fabricName` | `fabric_name` | String | Optional in Excel; Required in Manual | `""` or assigned MYLO fallback | Visible |
| MyloNex Code | `mylonexCode` | `mylonex_code` | String? (Unique) | System generated | `MYLOXXXX` | Visible |
| Blend / Composition | `composition` | `composition_text` | String? | **Required** in Excel & Manual | None | Visible |
| Weight (Canonical) | `gsm` | `gsm` | Int | **Required** (> 0) | `100` | Visible |
| Source Weight Value | `weightValue` | `weight_value` | Decimal(8,2)? | Stored from import cell | `null` | **Hidden** (Not in browse query) |
| Source Weight Unit | `weightUnit` | `weight_unit` | String? | GSM, OZ, GLM | `null` | **Hidden** (Not in browse query) |
| Width (Canonical) | `widthInches` | `width_inches` | Decimal(8,2)? | **Required** (> 0) | None | Visible |
| Source Width Value | `widthValue` | `width_value` | Decimal(8,2)? | Stored from import cell | `null` | **Hidden** (Not in browse query) |
| Source Width Unit | `widthUnit` | `width_unit` | String? | inches, cm | `null` | **Hidden** (Not in browse query) |
| Count | `count` | *None* | *None* | Either Count or Construction req. | Combined into `construction` | **Not persisted separately** |
| Construction | `construction` | `construction` | String? | Either Count or Construction req. | `null` | Visible |
| Weave | `weaveType` | `weave_type` | String | **Required** (1–200 chars free text) | `"plain"` | Visible |
| Fabric State | `fabricState` | `fabric_state` | Enum? | Optional (`greige`, `rfd`, `dyed`, `printed`) | `greige` | Visible |
| Dye Method | `dyeMethod` | `dye_method` | Enum? | **Required** if `fabricState == dyed` | `null` | Visible |
| Production Cycle | `productionCycle` | `production_cycle`| Enum | Optional (`ready_stock`, `made_to_order`, `running_production`)| `made_to_order` | Visible |
| Stock Quantity | `stockQuantity` | `stock_quantity` | Int | **Required > 0** if `ready_stock` | `0` | Visible |
| Price per Meter | `pricePerMeter` | `price_per_meter` | Decimal(12,2) | **Required** (> 0) | None | Visible |
| Minimum Order Qty | `minimumOrderQuantity`| `minimum_order_quantity` | Int | Optional (> 0) | `1000` | Visible |
| Lead Time (Days) | `leadTimeDays` | `lead_time_days` | Int | Optional (> 0) | `21` | Visible |
| Sample Availability | `sampleAvailability`| `sample_availability`| String? | **Required** in Excel import | `null` | **Hidden** (Stored in DB, not projected to buyer) |
| City | `city` | `city` | String? | Optional | `null` | Visible |
| State / Province | `locationState` | `location_state` | String? | Optional | `null` | Visible |
| Buyer Notes | `description` | `description` | String? | Optional | `null` | Visible |
| Image URL | `imageUrl` / `imageUrls`| `image_urls` | String[] | Optional (HTTP/HTTPS only; blocked if dyed/printed) | `[]` | Visible |
| Collection Name | `fabricCollectionName`| `fabric_collection_id`| UUID? | Optional; upserts `FabricCollection` | `null` | Visible |
| Active Status | `isActive` | `is_active` | Boolean | System set | `true` | Internal filter |
| Fabric Type | `fabricType` | `fabric_type` | Enum? | Ignored in import | `null` (Excel) / `cotton` (Manual) | Visible |
| Material Purity | `materialPurity` | `material_purity` | String? | Ignored in import | `null` (Excel) / `"pure"` (Manual) | Visible |
| Blend Description | `blendDescription` | `blend_description`| String? | Ignored in import | `null` | Visible |
| Yarn Type | `yarnType` | *None* | *None* | Blocked by import validation | Discarded | **No DB column exists** |

---

## E. Excel Mapping and Validation Specification

### 1. File Limits and Supported Formats
- Formats accepted: `.xlsx`, `.xls`, `.csv` (`ExcelImportDropzone.tsx#L25`).
- Enforced file size limit: **10 MB** (`ExcelImportDropzone.tsx#L35`).
- Worksheet detection: Selects first non-empty sheet or user-chosen sheet (`analyzer.ts#L29-L33`).
- Row / Column limits: Enforced only by client memory; no hardcoded row cut-off.

### 2. Header Matching and Guardrails (`matcher.ts`)
- **Matching Pipeline**:
  1. Exact string match against canonical field label.
  2. Normalized exact match (stripped whitespace and symbols).
  3. Canonical aliases match (e.g. `BASIC RATE`, `SELLING PRICE`, `RATE/M` -> `pricePerMeter`).
  4. Semantic fuzzy matching based on cell sample patterns (scores >= 0.5 assigned).
- **Confidence Levels**:
  - `matched`: High confidence exact/alias match.
  - `review`: Fuzzy/semantic match; requires operator review.
  - `unmapped`: Column ignored unless manually mapped.
- **Critical Guardrails**:
  - `isShadeColumn()`: Any column containing `/colou?r|shade|pantone/i` is **strictly blocked** from mapping to `fabricName`.
  - `weaveType`: Semantic fuzzy matching is explicitly disabled (`matcher.ts#L98`). Must match exact alias or be manually selected.

### 3. Dimensional Units and Conversion Math (`units.ts`)
- **Ounces per Square Yard (OZ)**:
  - Constant: `OUNCES_PER_SQUARE_YARD_TO_GSM = 28.349523125 / (0.9144 ** 2)` (~`33.906 g/m²` per `oz/yd²`).
  - Conversion: `GSM = Math.round(weightValue * OUNCES_PER_SQUARE_YARD_TO_GSM)`.
- **Grams per Linear Metre (GLM)**:
  - Requires valid width in inches: `validGlmWidth = widthInches > 0`.
  - Formula: `GSM = Math.round(weightValue / (widthInches * 0.0254))`.
  - Recalculation: If width or width unit is edited or cleared in review, calculated GSM is instantly recomputed or invalidated.
- **Centimeters to Inches**:
  - `widthInches = Math.round((widthCm / 2.54) * 100) / 100`.

### 4. Range Handling (`range-parser.ts`)
- **Standard Ascending Ranges** (`10K-20K`, `60-69 days`, `120-125 GSM`):
  - Normalized value takes the **lower bound** (`min`) for database scalar persistence.
- **Tolerance Notation** (`122 (+-5)`, `122 ± 5%`):
  - Normalized value takes the **base value** (`122`).
- **Inverted Ranges** (`20K-10K`):
  - Flagged as `isInvertedRange: true`. Produces a blocking validation error.

### 5. Proposed Defaults Engine (`fields.ts#L90-L104` & `staging.ts#L70-L84`)
- Proposes defaults for empty cells:
  - `fabricState`: `"greige"`
  - `productionCycle`: `"made-to-order"`
  - `minimumOrderQuantity`: `1000`
  - `leadTimeDays`: `21`
  - `stockQuantity`: `0`
  - `weightUnit`: `"GSM"`
  - `widthUnit`: `"inches"`
- **Confirmation Mechanism**: Rows with unconfirmed defaults receive warning issues and `status: "review"`. The operator must click "Confirm Defaults", which stores field keys in `row.defaultedFields` and transitions status to `ready`.

---

## F. Backend API Contracts, Security & Examples

### 1. Route Inventory
| Route Path | Method | Auth | Handler Location | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `/api/admin/suppliers` | `GET` | Admin | `src/domains/admin/actions.ts` | List all suppliers |
| `/api/admin/suppliers` | `POST` | Admin | `createSupplierAccountAction` | Provision supplier account |
| `/api/admin/suppliers/:id/status` | `PATCH` | Admin | `updateSupplierStatus` | Approve or suspend supplier |
| `/api/admin/suppliers/:id/catalog` | `GET` | Admin | `getAdminSupplierCatalog` | Get supplier collections and fabrics |
| `/api/admin/suppliers/:id/catalog/excel-template` | `GET` | Admin | `app/api/.../excel-template/route.ts` | Stream XLSX template buffer |
| `/api/admin/suppliers/:id/catalog/excel-import` | `POST` | Admin | `app/api/.../excel-import/route.ts` | Batch import validated rows |
| `/api/admin/suppliers/:id/catalog/quick-add` | `POST` | Admin | `app/api/.../quick-add/route.ts` | Single fabric manual quick add |
| `/api/admin/suppliers/:id/catalog/products/:id` | `PATCH` | Admin | `app/api/.../products/[id]/route.ts` | Toggle listing active status |

### 2. Anonymized Request & Response Examples

#### A. Excel Batch Import Submission
- **Request**: `POST /api/admin/suppliers/550e8400-e29b-41d4-a716-446655440000/catalog/excel-import`
```json
{
  "skipDuplicates": true,
  "rows": [
    {
      "sourceSheet": "Sheet1",
      "sourceRowNumber": 2,
      "clientRowId": "source:Sheet1:2",
      "fabricName": "Eco Bamboo Poplin",
      "composition": "70% Poly / 30% Bamboo",
      "gsm": 126,
      "weightValue": 126,
      "weightUnit": "GSM",
      "widthInches": 58,
      "widthValue": 58,
      "widthUnit": "inches",
      "count": "40s Warp x 40s Weft",
      "construction": "96 x 72",
      "weaveType": "1/1 Plain",
      "fabricState": "greige",
      "dyeMethod": null,
      "productionCycle": "made-to-order",
      "stockQuantity": 0,
      "pricePerMeter": 145.5,
      "minimumOrderQuantity": 1000,
      "leadTimeDays": 21,
      "sampleAvailability": "Available",
      "city": "Surat",
      "locationState": "Gujarat",
      "fabricCollectionName": "Spring 2026",
      "finishOptions": ["Bio-wash"],
      "imageUrl": null,
      "description": "High tear strength"
    }
  ]
}
```
- **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "totalRows": 1,
    "importedCount": 1,
    "createdCount": 1,
    "updatedCount": 0,
    "skippedCount": 0,
    "failedCount": 0,
    "failures": [],
    "skipped": []
  }
}
```

#### B. Supplier Status Change
- **Request**: Server action `updateSupplierStatus("550e8400-...", "APPROVED")`
- **Response**: Updated `SupplierProfile` object.

### 3. Authentication & Security for Fastify API (`adminbr`)
- **Current App**: Reads cookies via `@supabase/ssr` (`requireRole("ADMIN")`).
- **New Fastify Backend**:
  - Implement a Fastify preHandler hook (`fastify.authenticate`) that verifies the incoming Bearer JWT against Supabase JWT Secret (`SUPABASE_JWT_SECRET`) or custom Admin Auth Provider.
  - Verify that `user.role === "ADMIN"` in the database before executing any controller logic.
  - Ownership Guard: Fastify service must replicate `resolveSupplierId(userId)` to ensure the supplier profile exists.

---

## G. Answers to the Specific Questions

#### 1. Is `sampleAvailability` actually saved and later returned/displayed?
- **Evidence**: `prisma/schema.prisma#L440`, `service.ts#L194`, `buyer-repo.ts#L18-L49`.
- **Answer**: It is **saved** into `SupplierCatalog.sampleAvailability` in PostgreSQL. However, it is **never returned or displayed** to buyers; `buyer-repo.ts` omits it from `CATALOG_SELECT`. Admin supplier catalog page fetches it via full model query but does not render it on the fabric card.

#### 2. Is `count` stored independently, merged into construction, or lost?
- **Evidence**: `prisma/schema.prisma#L400-L450`, `row-schema.ts#L28-L31`.
- **Answer**: `count` is **not stored independently** (no `count` column exists on `SupplierCatalog`). It is **merged into `construction`**:
  ```ts
  const combined = count && construction ? (construction.includes(count) ? construction : count + " / " + construction) : construction || count || undefined;
  ```

#### 3. Are original `weightUnit`, `weightValue`, `widthUnit`, and `widthValue` saved?
- **Evidence**: `prisma/schema.prisma#L436-L439`, `service.ts#L193`.
- **Answer**: **Yes**, they are persisted in `weight_unit`, `weight_value`, `width_unit`, `width_value`. They are stored for traceability, but excluded from buyer catalog projections.

#### 4. Are missing `fabricType`, `materialPurity`, and `weave` values defaulted, left null, or rejected?
- **Evidence**: `create-schema.ts#L9-L12`, `catalog-create-data.ts#L18-L34`, `weave-text.ts#L6-L10`.
- **Answer**:
  - `fabricType`: Explicitly set to `null` (not defaulted).
  - `materialPurity`: Explicitly set to `null` (not defaulted).
  - `weave`: **Rejected if missing**. It is required (1–200 characters); rows without weave fail validation.

#### 5. Can free-text weave values be imported, or are only enum values allowed?
- **Evidence**: `prisma/schema.prisma#L416`, `weave-text.ts#L6-L10`.
- **Answer**: **Free-text weave values are fully allowed** and preserved. `SupplierCatalog.weaveType` is a `String` column, validated only for length (<= 200 chars) and rejection of control characters.

#### 6. Does ready-stock require a positive stock quantity?
- **Evidence**: `validation.ts#L58`.
- **Answer**: **Yes**. `if (normalized.productionCycle === "ready-stock" && (!stock || Number(stock) <= 0)) error("stockQuantity", "Stock quantity must be greater than 0 for Ready Stock.");`

#### 7. Can a blank fabric name be imported? How is its final name/code assigned?
- **Evidence**: `validation.ts#L18`, `create-schema.ts#L8`, `excel-import-repo.ts#L15-L16`.
- **Answer**: **Yes**, Excel permits an empty fabric name. It is stored as an empty string `""`. An independent unique code (e.g. `MYLO0042`) is assigned atomically in the transaction via `generateMylonexCode(tx)`. The UI uses this `MYLO` code as the fallback display title.

#### 8. What is the exact MYLO code format, counter mechanism, and concurrency protection?
- **Evidence**: `src/domains/catalog/repo.ts#L22-L29`, `excel-import-repo.ts#L8-L17`.
- **Answer**:
  - **Format**: `MYLO${String(counter.value).padStart(4, "0")}` (e.g. `MYLO0001`, `MYLO0042`).
  - **Counter Mechanism**: Table `system_counters` with row `id: "mylonex_fabric_code"`.
  - **Concurrency Protection**: Uses `prisma.systemCounter.upsert` with `{ update: { value: { increment: 1 } } }` inside PostgreSQL interactive transaction (`db.$transaction`). PostgreSQL locks the `system_counters` row for the duration of the transaction (`SELECT ... FOR UPDATE`), preventing race conditions.

#### 9. Does duplicate matching include inactive/archived listings?
- **Evidence**: `src/domains/catalog/repo.ts#L276-L284`.
- **Answer**: **No**. The query strictly filters `where: { supplierId, isActive: true }`. Inactive or archived listings are ignored.

#### 10. Is its signature exactly supplier + fabric name + weave + GSM?
- **Evidence**: `validation.ts#L106-L108`, `repo.ts#L282`.
- **Answer**: **Yes**, scoped to the supplier:
  `${text(fabricName).toLowerCase()}|${text(weaveType).toLowerCase()}|${gsm}`.

#### 11. How are case, whitespace, and duplicate rows within one file handled?
- **Evidence**: `validation.ts#L110-L122`, `import-service.ts#L26-L44`.
- **Answer**: Text is trimmed and lowercased. In frontend, subsequent duplicates within the same file receive `isDuplicateInFile: true` and a warning. In backend, the first row saves and its signature is stored in a `saved` Set; subsequent identical rows in the batch hit `saved.has(signature)` and are counted as `skipped` (`reason: "Duplicate fabric in import batch"`).

#### 12. Does any validation failure reject the complete payload?
- **Evidence**: `import-service.ts#L11-L14`.
- **Answer**: **Yes**. `excelImportPayloadSchema.safeParse(rawPayload)` validates every row before any database interaction begins. If even one row fails schema validation, the entire payload is rejected with HTTP `400 VALIDATION_ERROR`.

#### 13. After validation succeeds, can individual save failures coexist with successful rows?
- **Evidence**: `import-service.ts#L27-L45`.
- **Answer**: **Yes**. The backend iterates through rows sequentially. Each row is saved in its own transaction. If row 3 encounters a database error, it is recorded in `failures`, but previously saved rows 1 and 2 remain committed, and row 4 continues.

#### 14. What transaction boundaries exist, and what happens on retry?
- **Evidence**: `excel-import-repo.ts#L8-L17`, `import-service.ts#L31-L35`.
- **Answer**:
  - **Boundary**: Transaction boundary is **per row**, not per batch. Collection upsert, counter increment, and fabric creation commit together per row.
  - **Retry**: Because `skipDuplicates` defaults to `true`, retrying the exact payload skips the already-created rows and attempts only the previously failed rows.

#### 15. Are imported listings active immediately or saved as drafts?
- **Evidence**: `catalog-create-data.ts#L37`.
- **Answer**: They are **immediately active** (`isActive: true`).

#### 16. Which buyer/supplier pages or caches must refresh after import?
- **Evidence**: `catalog-excel-service.ts#L24-L29`.
- **Answer**:
  1. `/admin/suppliers/${supplierId}/catalog`
  2. `/admin/suppliers/catalog`
  3. `/supplier/catalog`
  4. `/buyer/fabrics`

---

## H. Defects, Inconsistencies & Migration Risks (Prioritized)

### Priority 0 (Blocking / Data Integrity)
1. **Unbounded Sequential Row Transactions**: Batch import processes rows one-by-one in an async loop with individual interactive transactions. A batch of 500 rows takes 500 DB roundtrips and 500 row-lock acquisitions on `system_counters`.
   - *Recommendation*: Batch collection upserts, batch counter increment by `N`, and use `prisma.supplierCatalog.createMany()` or chunked transactions.
2. **Cache Invalidation Split**: The new Fastify backend cannot call Next.js `revalidatePath()`.
   - *Recommendation*: Expose a secret-protected cache invalidation webhook on Next.js (`POST /api/internal/revalidate`) that Fastify triggers after successful catalog imports.

### Priority 1 (High Architectural Risk)
3. **No Database Audit Table**: WhatsApp consent and supplier status changes currently only log to `console.log`.
   - *Recommendation*: Create an `AdminAuditLog` table in Prisma: `(id, adminUserId, action, entityType, entityId, payload, createdAt)`.
4. **Missing Pagination on Admin Queries**: `getSuppliers()` returns all rows in memory without `take` or `skip`.
   - *Recommendation*: Implement cursor or offset pagination (`page`, `pageSize`, `search`, `statusFilter`) in Fastify endpoints.

### Priority 2 (Medium / UX Discrepancies)
5. **Yarn Type Schema Gap**: `yarnType` is supported in mapping and template, but rejected during import because no column exists.
   - *Recommendation*: Add `yarnType String? @map("yarn_type")` to Prisma `SupplierCatalog` model.
6. **Sample Availability Projection**: `sampleAvailability` is required during Excel import and saved, but completely hidden from buyers.
   - *Recommendation*: Either add `sampleAvailability` to `CATALOG_SELECT` in `buyer-repo.ts` or make it optional in Excel import.

---

## I. Tests and Anonymized Fixtures

### 1. Existing Test Suites Map
- `src/domains/catalog/excel/__tests__/importer-revision.test.ts`: Verifies material/purity exclusion and weave text retention.
- `src/domains/catalog/excel/__tests__/import-service.test.ts`: Verifies duplicate skipping and partial failure reporting.
- `src/domains/catalog/excel/__tests__/oz-conversion.test.ts`: Tests `28.349523125 / 0.9144²` GSM conversions.
- `src/domains/catalog/excel/__tests__/glm-basis.test.ts`: Tests GLM width-based recalculations.
- `src/domains/catalog/excel/__tests__/phase2-source-inputs.test.ts`: Tests Warp/Weft directional count merging.
- `src/domains/admin/__tests__/catalog-excel-service.test.ts`: Verifies admin authorization and template streaming.
- `e2e/catalog-import.spec.ts`: End-to-end Playwright harness testing full browser dropzone-to-database lifecycle.

### 2. Anonymized Fixtures for New Admin Test Suite

#### Fixture 1: Valid Import Row
```json
{
  "fabricName": "Premium Organic Twill",
  "composition": "100% Organic Cotton",
  "gsm": 180,
  "weightValue": 180,
  "weightUnit": "GSM",
  "widthInches": 58,
  "widthValue": 58,
  "widthUnit": "inches",
  "count": "30s x 30s",
  "construction": "120 x 60",
  "weaveType": "2/1 Twill",
  "fabricState": "greige",
  "productionCycle": "made-to-order",
  "stockQuantity": 0,
  "pricePerMeter": 210,
  "minimumOrderQuantity": 1000,
  "leadTimeDays": 21,
  "sampleAvailability": "Available"
}
```

#### Fixture 2: GLM to GSM Conversion (310 GLM @ 58 inches -> 210 GSM)
- Input: `{ "weightValue": 310, "weightUnit": "GLM", "widthValue": 58, "widthUnit": "inches" }`
- Calculation: `310 / (58 * 0.0254) = 210.42`
- Expected Normalized: `{ "gsm": 210, "widthInches": 58 }`

#### Fixture 3: OZ to GSM Conversion (6 OZ -> 203 GSM)
- Input: `{ "weightValue": 6, "weightUnit": "OZ" }`
- Calculation: `6 * (28.349523125 / 0.9144²) = 203.43`
- Expected Normalized: `{ "gsm": 203 }`

#### Fixture 4: Warp & Weft Directional Merge
- Source Mapping: `countWarp = "2/60s"`, `countWeft = "40s"`, `count = ""`
- Step 1 Merge: `count = "Warp: 2/60s / Weft: 40s"`
- Step 2 Construction Merge with `"132 x 72"`:
- Stored `construction` in DB: `"Warp: 2/60s / Weft: 40s / 132 x 72"`

---

## J. Recommended Migration Sequence

1. **Phase 1: Database & Model Verification in Fastify (`adminbr`)**
   - Copy `prisma/schema.prisma` to `adminbr`.
   - Verify connection pool and `SystemCounter` model compatibility.
2. **Phase 2: Fastify Admin Auth & RBAC Middleware**
   - Implement Supabase JWT verification or standalone JWT token guard.
   - Enforce `role === "ADMIN"` on all `/api/v1/admin/*` endpoints.
3. **Phase 3: Port Excel Engine (`src/domains/catalog/excel`) to Shared Module**
   - Copy pure domain logic (`units.ts`, `range-parser.ts`, `validation.ts`, `semantic.ts`) into a shared package or directly into `adminfr` (for client parsing) and `adminbr` (for payload validation).
4. **Phase 4: Supplier Management Endpoints & UI (`adminfr`)**
   - Implement supplier table, search, pagination, and status toggling in React/Vite.
   - Implement `SupplierWhatsAppConsentCard` with normalization.
5. **Phase 5: Catalog Management & Excel Importer**
   - Implement 4-step wizard in `adminfr` with SheetJS.
   - Wire `POST /api/v1/admin/suppliers/:id/catalog/excel-import` with per-row atomic transaction and duplicate suppression.
6. **Phase 6: Next.js Cache Invalidation Bridge**
   - Set up internal webhook on Next.js so Fastify notifies Next.js to purge ISR buyer fabric caches upon import.

---

## K. Remaining Questions Requiring a Business Decision

1. **Yarn Type Persistence**:
   - *Question*: Should a migration add `yarnType` to `SupplierCatalog`, or should operators continue clearing it or moving it to Buyer Notes?
2. **Sample Availability on Buyer Cards**:
   - *Question*: `sampleAvailability` is currently collected and stored in the database but never shown to buyers. Should it be added to the buyer fabric card and filter drawer?
3. **Batch Import Draft Mode**:
   - *Question*: Currently, imported listings go live immediately (`isActive: true`). Would operators benefit from an optional "Import as Inactive / Draft" toggle?
4. **Audit Log Persistence**:
   - *Question*: Should admin actions (approving suppliers, suspending accounts, revoking WhatsApp consent) be stored in a permanent database audit table?

---

## Quick-Start Summary for New Admin IDE

> Copy and paste this block into your new Admin project prompt:

```text
We are building the standalone MyloNex Admin Panel (React/Vite 'adminfr' + Fastify/Prisma 'adminbr').
Refer to the complete source investigation report at docs/admin-migration-handoff.md.

Key Rules to follow:
1. DB Entities: Use existing Prisma schema for SupplierProfile, SupplierCatalog, FabricCollection, and SystemCounter.
2. Supplier Status: APPROVED is required for buyer visibility and matching. Suspending a supplier cuts off matching but preserves active order history.
3. WhatsApp Consent: Requires phone normalization and explicitConfirmation=true.
4. Excel Import: 4-step wizard (Upload -> Mapping -> Review/Edit -> Buyer Preview).
5. Dimensional Units: GLM calculates GSM via 'weight / (widthInches * 0.0254)'. OZ converts via 'weight * 33.906'. cm converts to inches via '/ 2.54'.
6. Merged Count: Count is not a separate DB column; merge into construction ('count / construction').
7. Weave: Free-text string up to 200 chars. Missing weave must block import.
8. Blank Fabric Name: Permitted in Excel; fallback is the unique MYLOXXXX code generated atomically from SystemCounter.
9. Duplicate Rule: Skip exact match of (fabricName + weaveType + gsm) within the supplier's active catalog.
10. Transaction Safety: Interactive transaction per row with row-level lock on SystemCounter. Valid rows succeed even if individual rows fail.
```
