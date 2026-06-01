-- Native iOS (APNs) push notifications support
-- push_subscriptions dotad trzymal tylko Web Push (VAPID): endpoint + p256dh + auth.
-- Dodajemy native iOS device tokens (APNs) jako alternatywny format.

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS apns_token TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'ios', 'android'));

-- endpoint/p256dh/auth byly NOT NULL bo zakladalismy tylko web. Native ich
-- nie ma - relaxujemy.
ALTER TABLE public.push_subscriptions
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

-- Validacja: web wymaga endpoint+p256dh+auth, native wymaga apns_token.
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_sub_platform_format;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_sub_platform_format CHECK (
    (platform = 'web' AND endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL)
    OR (platform IN ('ios', 'android') AND apns_token IS NOT NULL)
  );

-- Unique per user+token (zeby nie duplikowac przy re-register)
CREATE UNIQUE INDEX IF NOT EXISTS push_sub_user_apns_uniq
  ON public.push_subscriptions(user_id, apns_token)
  WHERE apns_token IS NOT NULL;

-- Index dla query "ktore tokeny ma user" przez send-push
CREATE INDEX IF NOT EXISTS push_sub_user_platform_idx
  ON public.push_subscriptions(user_id, platform);
