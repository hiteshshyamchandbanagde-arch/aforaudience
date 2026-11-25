-- GEN-2609-099 - 2 new general-purpose translucent-tint colour tokens.
-- Applied directly via Supabase:apply_migration against
-- aforaudience-qa (nqiyrypmjtogoocerxtu) only - see
-- 20260906120000_add_event_follow_target's own header for why this
-- project never uses `prisma migrate dev` / `_prisma_migrations`. This
-- file documents what ran; it does not auto-run on its own.
--
-- These are the 2 rgba(245,245,240,*) alpha values (0.08, 0.1) that
-- clear GEN-2609-081's approved 50-occurrence bar for a new token -
-- see docs/token-migration-status.md's GEN-2609-093 audit and
-- docs/design.md's GEN-2609-099 entry for the full occurrence count
-- and the `--afa-tint-*` naming rationale (checked real property
-- context before naming: both are border-property-dominant but
-- genuinely mixed with background usage, not a single role).
--
-- Every default value here is BYTE-IDENTICAL to the literal it names -
-- zero visual change, same "reset to defaults" contract as every
-- other DesignToken row (src/lib/design-tokens.ts's
-- DEFAULT_TOKEN_VALUES mirrors these 1:1). Neither key is locked -
-- neither is one of the 5 core brand tokens.
--
-- Group 'color' / type 'color' - src/lib/design-tokens.ts's
-- isValidTokenValue() RGB_COLOR regex accepts this exact shape
-- (rgba(N, N, N, 0.NN)), same as --afa-text-secondary/-muted/
-- --afa-border-resting's own rows.

INSERT INTO "DesignToken" ("key", "value", "group", "type", "locked", "updatedAt") VALUES
('--afa-tint-08', 'rgba(245, 245, 240, 0.08)', 'color', 'color', false, now()),
('--afa-tint-10', 'rgba(245, 245, 240, 0.1)', 'color', 'color', false, now());
