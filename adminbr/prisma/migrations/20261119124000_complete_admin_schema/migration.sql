-- Complete the standalone admin schema without fabricating historical events.

ALTER TABLE public."BuyerProfile" ADD COLUMN IF NOT EXISTS billing_address TEXT;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE public.communication_requests
  ADD COLUMN IF NOT EXISTS admin_review_note TEXT,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS admin_reviewed_by_user_id TEXT;
CREATE INDEX IF NOT EXISTS communication_requests_moderation_queue_idx
  ON public.communication_requests(status, requester_role, created_at, id);
CREATE INDEX IF NOT EXISTS request_matches_whatsapp_queue_idx
  ON public.communication_request_matches(whatsapp_status, status, forwarded_at, id);

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE public.communication_request_responses
  ADD COLUMN IF NOT EXISTS valid_until_date TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS buyer_notification_status TEXT,
  ADD COLUMN IF NOT EXISTS buyer_notification_message_id TEXT,
  ADD COLUMN IF NOT EXISTS buyer_notification_queued_at TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS quote_buyer_notification_queue_idx
  ON public.communication_request_responses(buyer_notification_status, status);

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE IF NOT EXISTS public.rfq_dispatch_attempts (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES public.communication_request_matches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  requested_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_by_user_id TEXT,
  reason TEXT,
  sent_at TIMESTAMP(3),
  delivered_at TIMESTAMP(3),
  read_at TIMESTAMP(3),
  failure_code TEXT,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS rfq_dispatch_attempts_provider_message_id_key ON public.rfq_dispatch_attempts(provider_message_id);
CREATE INDEX IF NOT EXISTS rfq_dispatch_attempts_match_id_requested_at_idx ON public.rfq_dispatch_attempts(match_id,requested_at);
CREATE INDEX IF NOT EXISTS rfq_dispatch_attempts_status_requested_at_idx ON public.rfq_dispatch_attempts(status,requested_at);

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS courier_tracking_number TEXT;
CREATE INDEX IF NOT EXISTS samples_queue_idx ON public.samples(status,created_at,id);

ALTER TABLE public.supplier_catalog ALTER COLUMN weave_type DROP DEFAULT;
ALTER TABLE public.supplier_catalog ALTER COLUMN weave_type TYPE TEXT USING weave_type::text;
ALTER TABLE public.supplier_catalog ALTER COLUMN weave_type SET DEFAULT 'plain';