-- User.displayName — human-readable name, distinct from `name` which
-- is the login username (3-20 chars, alphanumeric+underscore).
--
-- Nullable so existing rows aren't affected. Every user-facing surface
-- that shows a "name" will read displayName-or-fallback-to-name, so
-- current users just keep seeing their username on tickets/emails
-- until they set a display name from Profile.

ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
