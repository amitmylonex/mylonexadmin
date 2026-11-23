-- Prepared only; not applied to the shared database.
BEGIN;
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
-- Actor is retained as historical metadata; there is no cascading history deletion.
-- Existing match.whatsapp_status stores QUEUED jobs; no external message is sent here.
COMMIT;
