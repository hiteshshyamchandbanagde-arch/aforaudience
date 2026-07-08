-- Browse-first model: registration no longer collects a role. Default new
-- User rows to AUDIENCE at the database level too, as a safety net for any
-- future direct inserts (seed scripts, admin tooling) that omit role.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'AUDIENCE';
