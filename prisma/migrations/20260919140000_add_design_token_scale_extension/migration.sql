-- GEN-2609-081 (provisional) - extend the central spacing/size/radius
-- scales with the highest-frequency OFF-SCALE values found by
-- GEN-2609-079's own batch-1 migration. Applied directly via
-- Supabase:apply_migration against aforaudience-qa
-- (nqiyrypmjtogoocerxtu) only - see 20260906120000_add_event_follow_
-- target's own header for why this project never uses
-- `prisma migrate dev` / `_prisma_migrations`. This file documents what
-- ran; it does not auto-run on its own.
--
-- Rule (Hitesh, via dispatch): a value gets a token if it has 50+
-- non-tokenized occurrences repo-wide. 14 new rows: 8 spacing, 4 font-
-- size, 2 radius - every value's real repo-wide count is >= 50 (51 as
-- the lowest, --afa-text-20px), reconciled by a precise AST-free
-- extraction (the same extractPropValues/extractLengthTokensFromValue
-- check-design-tokens.js already uses, not a separate hand-written
-- regex) - see docs/design.md's GEN-2609-081 entry for the full table.
--
-- Every default value here is BYTE-IDENTICAL to the literal it names -
-- zero visual change, same "reset to defaults" contract as every other
-- DesignToken row (src/lib/design-tokens.ts's DEFAULT_TOKEN_VALUES
-- mirrors these 1:1, same as GEN-2609-075's own seed). None of these 14
-- keys is locked - none is one of the 5 core brand tokens.
--
-- Naming: px-suffixed (--afa-space-10px, not a step index like the
-- existing --afa-space-3) - see globals.css's own comment on this
-- ticket's tokens for the full reasoning (no clean slot in either the
-- existing index-based spacing scheme or the semantic-role-based
-- size/radius scheme, and the dispatch's own instruction was not to
-- rename or re-value any existing token).
--
-- No migration of any page file in this ticket - every new row is
-- correctly "unused" (0 real consumers) until a future batch adopts
-- one, per src/lib/design-token-coverage.ts.

INSERT INTO "DesignToken" ("key", "value", "group", "type", "locked", "updatedAt") VALUES
('--afa-space-2px', '2px', 'spacing', 'dimension', false, now()),
('--afa-space-6px', '6px', 'spacing', 'dimension', false, now()),
('--afa-space-10px', '10px', 'spacing', 'dimension', false, now()),
('--afa-space-14px', '14px', 'spacing', 'dimension', false, now()),
('--afa-space-18px', '18px', 'spacing', 'dimension', false, now()),
('--afa-space-28px', '28px', 'spacing', 'dimension', false, now()),
('--afa-space-32px', '32px', 'spacing', 'dimension', false, now()),
('--afa-space-48px', '48px', 'spacing', 'dimension', false, now()),
('--afa-text-10px', '10px', 'size', 'dimension', false, now()),
('--afa-text-15px', '15px', 'size', 'dimension', false, now()),
('--afa-text-18px', '18px', 'size', 'dimension', false, now()),
('--afa-text-20px', '20px', 'size', 'dimension', false, now()),
('--afa-radius-10px', '10px', 'radius', 'dimension', false, now()),
('--afa-radius-12px', '12px', 'radius', 'dimension', false, now());
