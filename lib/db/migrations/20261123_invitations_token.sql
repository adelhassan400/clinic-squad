-- Align invitations table with lib/db/src/schema/invitations.ts (merged 2026-11-23).
-- The production database predates the plain-token invitation flow and only had
-- token_hash; the API inserts/looks up `token`, so every team invitation failed
-- with a 500. Applied to production by hand on 2026-11-23 when invitations had
-- zero rows. token_hash is kept for history but is no longer written by the app.
--
-- Empty-table environments: safe as-is. Nonempty legacy tables: existing rows get
-- NULL token, the unique index still builds (Postgres treats NULLs as distinct),
-- no data is lost, and legacy pending invites simply cannot be accepted through
-- the new token flow (accept them manually or re-invite).

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token text;

ALTER TABLE invitations ALTER COLUMN token_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_unique ON invitations (token);

-- ACTUAL PRODUCTION STATE (verified 2026-11-23, project wandering-hill-53830531):
--   token      text NOT NULL   (column was added NOT NULL because the table was
--                              empty; stricter than this migration leaves it)
--   token_hash text NULL       (NOT NULL dropped)
--   indexes    invitations_token_unique UNIQUE (token)
-- If you are applying this to an EMPTY table and want to match production
-- exactly, also run:
--   ALTER TABLE invitations ALTER COLUMN token SET NOT NULL;
-- Do NOT run that on a nonempty table: rows with NULL token would fail it.
