-- Prepared only. Reconcile with canonical marketplace migrations before deployment.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE public.communication_request_responses
  ADD COLUMN IF NOT EXISTS valid_until_date TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS buyer_notification_status TEXT,
  ADD COLUMN IF NOT EXISTS buyer_notification_message_id TEXT,
  ADD COLUMN IF NOT EXISTS buyer_notification_queued_at TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS quote_buyer_notification_queue_idx
  ON public.communication_request_responses(buyer_notification_status, status);
COMMIT;
