-- Repair only the existing canonical public catalog projection. No business-row backfill.
-- REQUIRED: pause ALL catalog/code writers; confirm backup, target and historical code floor.
-- Supply PGOPTIONS='-c mylonex.repair_code_floor=<confirmed high-water mark>'.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(73118083000);
DO $$
DECLARE floor_text text := current_setting('mylonex.repair_code_floor', true);
BEGIN
  IF floor_text IS NULL OR floor_text !~ '^[0-9]{1,10}$'
     OR floor_text::numeric > 2147483646 THEN
    RAISE EXCEPTION 'Set mylonex.repair_code_floor to the reviewed historical high-water mark (0..2147483646); never guess zero';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p','v','m','S','f')
      AND lower(regexp_replace(c.relname, '[^a-zA-Z0-9]', '', 'g'))
        IN ('systemcounters','systemcounter','mylonexcounters','mylonexcodecounter')
      AND NOT (n.nspname = 'public' AND c.relname = 'system_counters' AND c.relkind = 'r')
  ) THEN RAISE EXCEPTION 'Alternate counter relation exists; reconcile it before repair'; END IF;
END $$;
LOCK TABLE public.supplier_catalog IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.supplier_catalog
  ADD COLUMN IF NOT EXISTS mylonex_code TEXT,
  ADD COLUMN IF NOT EXISTS weight_unit TEXT,
  ADD COLUMN IF NOT EXISTS weight_value DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS width_unit TEXT,
  ADD COLUMN IF NOT EXISTS width_value DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS sample_availability TEXT;
CREATE TABLE IF NOT EXISTS public.system_counters (
  id TEXT NOT NULL PRIMARY KEY,
  value INTEGER NOT NULL
);
LOCK TABLE public.system_counters IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='supplier_catalog'
        AND is_nullable='YES' AND column_default IS NULL
        AND ((column_name IN ('mylonex_code','weight_unit','width_unit','sample_availability') AND data_type='text')
          OR (column_name IN ('weight_value','width_value') AND data_type='numeric' AND numeric_precision=8 AND numeric_scale=2))) <> 6
  THEN RAISE EXCEPTION 'Catalog columns differ from reviewed nullable Prisma projection'; END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='system_counters' AND is_nullable='NO'
        AND ((column_name='id' AND data_type='text') OR (column_name='value' AND data_type='integer'))) <> 2
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.system_counters'::regclass
       AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (id)')
  THEN RAISE EXCEPTION 'Existing counter table is incompatible; do not replace it'; END IF;
  IF EXISTS (SELECT 1 FROM public.system_counters WHERE value < 0)
  THEN RAISE EXCEPTION 'Negative existing counter requires investigation'; END IF;
  IF EXISTS (SELECT 1 FROM public.supplier_catalog WHERE mylonex_code ~ '^MYLO[0-9]+$'
      AND length(substring(mylonex_code FROM '^MYLO([0-9]+)$')) > 10)
  THEN RAISE EXCEPTION 'Oversized numeric code requires manual reconciliation'; END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_catalog_mylonex_code_key
  ON public.supplier_catalog(mylonex_code);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attname='mylonex_code'
    WHERE i.indexrelid='public.supplier_catalog_mylonex_code_key'::regclass
      AND i.indrelid='public.supplier_catalog'::regclass AND i.indisunique AND i.indisvalid
      AND i.indisready AND i.indnatts=1 AND i.indkey::text=a.attnum::text
      AND i.indpred IS NULL AND i.indexprs IS NULL
  ) THEN RAISE EXCEPTION 'Existing code index is incompatible; do not replace it'; END IF;
END $$;
-- Only technical allocation metadata is inserted/advanced. Never reduce an existing counter.
INSERT INTO public.system_counters(id,value)
SELECT 'mylonex_fabric_code', GREATEST(
  current_setting('mylonex.repair_code_floor')::numeric,
  COALESCE(MAX(substring(mylonex_code FROM '^MYLO([0-9]+)$')::numeric),0)
)::integer
FROM public.supplier_catalog
ON CONFLICT(id) DO UPDATE
SET value=GREATEST(public.system_counters.value, EXCLUDED.value);
DO $$
BEGIN
  IF (SELECT value FROM public.system_counters WHERE id='mylonex_fabric_code') >= 2147483647
  THEN RAISE EXCEPTION 'Counter is exhausted; widen schema and generators before deployment'; END IF;
END $$;
COMMIT;
