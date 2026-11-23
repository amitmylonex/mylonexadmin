-- Additive repair for columns already referenced by the shared marketplace Prisma schema.
-- Review database target and backup/rollout plan before applying. No rows are deleted.
ALTER TABLE "supplier_catalog" ADD COLUMN IF NOT EXISTS "mylonex_code" TEXT;
ALTER TABLE "supplier_catalog" ADD COLUMN IF NOT EXISTS "weight_unit" TEXT;
ALTER TABLE "supplier_catalog" ADD COLUMN IF NOT EXISTS "weight_value" DECIMAL(8,2);
ALTER TABLE "supplier_catalog" ADD COLUMN IF NOT EXISTS "width_unit" TEXT;
ALTER TABLE "supplier_catalog" ADD COLUMN IF NOT EXISTS "width_value" DECIMAL(8,2);
ALTER TABLE "supplier_catalog" ADD COLUMN IF NOT EXISTS "sample_availability" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_catalog_mylonex_code_key" ON "supplier_catalog"("mylonex_code");
CREATE TABLE IF NOT EXISTS "system_counters" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "value" INTEGER NOT NULL DEFAULT 0
);
-- Preserve the highest existing numeric fabric code and never decrease a counter.
INSERT INTO "system_counters" ("id", "value")
SELECT 'mylonex_fabric_code', COALESCE(MAX(SUBSTRING("mylonex_code" FROM '^MYLO([0-9]+)$')::INTEGER), 0)
FROM "supplier_catalog"
ON CONFLICT ("id") DO UPDATE SET "value" = GREATEST("system_counters"."value", EXCLUDED."value");
