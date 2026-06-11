-- Add delivery-transport discriminator for Expo (native) push alongside Web Push.
-- The DEFAULT backfills every existing row to 'web_push' in the same statement,
-- satisfying the deploy order requirement (schema -> backfill -> code).
ALTER TABLE "push_subscriptions" ADD COLUMN "transport" TEXT NOT NULL DEFAULT 'web_push';

-- Expo subscriptions carry a token in "endpoint" and no encryption keys.
ALTER TABLE "push_subscriptions" ALTER COLUMN "p256dh" DROP NOT NULL;
ALTER TABLE "push_subscriptions" ALTER COLUMN "auth" DROP NOT NULL;
