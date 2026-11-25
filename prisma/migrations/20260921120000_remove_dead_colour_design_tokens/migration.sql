-- GEN-2609-091 - remove the 23 dead colour design tokens' DB rows.
-- Applied directly via Supabase:apply_migration against aforaudience-qa,
-- same as every other migration in this repo (see
-- 20260906120000_add_event_follow_target's header for why
-- `prisma migrate dev` / `_prisma_migrations` isn't used here). This
-- file documents what ran; it does not auto-run on its own, and it is
-- deliberately NOT applied by this PR - the code change (removing these
-- keys from DEFAULT_TOKEN_VALUES) ships and deploys first, this
-- migration is applied to QA after merge. That ordering matters: the
-- reset route (src/app/api/admin/design-tokens/reset/route.ts) iterates
-- DEFAULT_TOKEN_VALUES and calls `update` per key, which would throw if
-- a key were present in defaults but missing as a row - removing the
-- defaults first, then deleting the rows, avoids that ever being true.
--
-- Zero real consumers by every mechanism checked: `var(--afa-x)`, a bare
-- string anywhere in src/scripts/e2e/tests, a Tailwind arbitrary-value
-- reference, dynamic name construction, an `@theme inline`/--color-*
-- alias in globals.css (incl. its .dark block), and the admin
-- design-system page's own rendering (no hardcoded per-key lists there).
-- Full per-token evidence in docs/design.md's GEN-2609-091 entry.
--
-- Does NOT touch "DesignTokenVersion" - the revert route already skips
-- snapshot keys with no live row, so old snapshots referencing these
-- keys are left as historical record, untouched.
--
-- CARRY-FORWARD: prod's "DesignToken" table (frozen, ref
-- cncumfwwnjcwacggrgsr) still has these 23 rows. This same migration
-- must run there too once the freeze lifts. Not done as part of this
-- change.

DELETE FROM "DesignToken" WHERE key IN (
  '--afa-amber-tint',
  '--afa-cream-tint-1',
  '--afa-cream-tint-2',
  '--afa-cream-tint-3',
  '--afa-gold-bright',
  '--afa-maroon',
  '--afa-terracotta-tint',
  '--afa-orange-tint',
  '--afa-gray-warm',
  '--afa-green-forest',
  '--afa-indigo-gray',
  '--afa-ink-a8',
  '--afa-ink-a13',
  '--afa-ink-a40',
  '--afa-error-bg',
  '--afa-success-bg',
  '--afa-mint-tint-2',
  '--afa-olive',
  '--afa-pink-dark',
  '--afa-purple',
  '--afa-tan',
  '--afa-teal',
  '--afa-mist'
);
