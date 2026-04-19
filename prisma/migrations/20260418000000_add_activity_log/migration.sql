-- User-facing activity log — one row per user-initiated mutation.

CREATE TABLE "activity_log" (
    "id"          TEXT         NOT NULL,
    "profileId"   TEXT         NOT NULL,
    "action"      TEXT         NOT NULL,
    "entityType"  TEXT         NOT NULL,
    "entityId"    TEXT,
    "entityLabel" TEXT         NOT NULL,
    "summary"     TEXT         NOT NULL,
    "changes"     JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_log_profileId_createdAt_idx"
  ON "activity_log"("profileId", "createdAt");

ALTER TABLE "activity_log"
  ADD CONSTRAINT "activity_log_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
