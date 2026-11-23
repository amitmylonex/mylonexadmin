-- PREPARED ONLY. Do not apply without verifying the shared target and backup.
-- Apply after the existing reviewed catalog/source-column + counter repair.
-- Coordinate deployment with all applications using this shared column.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.supplier_catalog IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.supplier_catalog ALTER COLUMN weave_type DROP DEFAULT;
ALTER TABLE public.supplier_catalog
  ALTER COLUMN weave_type TYPE TEXT USING weave_type::text;
ALTER TABLE public.supplier_catalog ALTER COLUMN weave_type SET DEFAULT 'plain';
-- Existing values and nullability are retained. Retain the old enum type for
-- compatibility with unrelated objects; do not drop it or rewrite fabric values.
COMMIT;
