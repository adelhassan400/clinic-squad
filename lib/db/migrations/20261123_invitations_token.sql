-- Align invitations table with lib/db/src/schema/invitations.ts (merged 2026-11-23).
-- The production database predates the plain-token invitation flow and only had
-- token_hash; the API inserts/looks up `token`, so every team invitation failed
-- with a 500. Applied to production on 2026-11-23 when the invitations table had
-- zero rows; token_hash is kept for history but no longer written by the app.

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token text;

-- Backfill nothing: no rows existed when this was applied. For safety on other
-- environments, existing rows keep a NULL token and simply cannot be accepted
-- through the new token flow.

ALTER TABLE invitations ALTER COLUMN token_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_unique ON invitations (token);

-- On production (table was empty) the column was additionally set NOT NULL to
-- match the drizzle schema exactly:
--   ALTER TABLE invitations ALTER COLUMN token SET NOT NULL;
-- Apply that too if invitations is empty in your environment.
