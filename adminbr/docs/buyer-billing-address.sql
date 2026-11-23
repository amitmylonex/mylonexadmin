-- Prepared only; not applied. Coordinate with the canonical shared-schema owner.
-- Nullable extension: existing buyer records remain unchanged and read as NULL.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'BuyerProfile' AND column_name = 'billing_address'
      AND (data_type NOT IN ('text', 'character varying') OR is_nullable <> 'YES')
  ) THEN RAISE EXCEPTION 'Existing billing_address column is incompatible; review before deployment'; END IF;
END $$;
ALTER TABLE public."BuyerProfile" ADD COLUMN IF NOT EXISTS billing_address TEXT;
COMMIT;
