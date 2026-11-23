-- Prepared only, not applied to the shared database.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS courier_tracking_number TEXT;
CREATE INDEX IF NOT EXISTS samples_queue_idx ON public.samples(status,created_at,id);
COMMIT;
-- Existing quote_refund_policy, monetary columns, and orders.sample_id uniqueness
-- are reused. No legacy buyer acceptance or payment records are fabricated.
