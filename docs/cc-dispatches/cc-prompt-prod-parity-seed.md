# CC dispatch: prod-parity migration (PlatformSettings 'default' row + DesignToken drift)

> **Branch off `origin/qa`: `fix/prod-parity-seed`.** Small chunks, commit + push after each. 45-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never write the QA `PlatformSettings` row. Don't touch prod. No skip/fixme, no loosened tests.

## Why
Prod gets a fresh schema built only from `prisma migrate deploy`. Replaying our 83 migrations does **not** reproduce QA (chat found this 16 Nov while deriving the prod seed list; QA was fixed out-of-band and the migrations never caught up):

1. **PlatformSettings:** `20260709070000_venue_event_economics_model` inserts id `'default'` (flatVenueBookingFee 199); `20260713190000_…` inserts `'singleton'`. QA has only `'singleton'`. Three call sites use `prisma.platformSettings.findFirst()` with no `where`, so on prod they could read the dead `'default'` row:
   - `src/app/api/events/route.ts:506` → `platformFeeAmount` would become 199 (QA: 0)
   - `src/app/api/venue-booking-requests/[id]/route.ts:119` → `paidBookingsEnabled` and `platformFeeAmount` read from the wrong row (turning paid ON in admin would not reach this route)
   - `src/app/api/platform-settings/route.ts:8`
2. **DesignToken** (the root layout injects every row as a runtime CSS override): replay gives 82 rows; QA has 115 and matches `globals.css` exactly.
   - 2 stale values that would **override** globals.css on prod: `--afa-amber-tint` = `#FFF8E1` (should be `rgba(201, 151, 58, 0.15)`), `--afa-text-muted` = `rgba(245, 245, 240, 0.4)` (should be `0.5`).
   - 10 keys on replay that QA doesn't have and globals.css doesn't define: `--afa-error-border --afa-radius-10px --afa-radius-12px --afa-red-alt --afa-terracotta --afa-text-10px --afa-text-15px --afa-text-18px --afa-text-20px --afa-text-inverse`.
   - 42 keys QA has that no migration inserts (table below). They fall back to globals.css on the page, but the admin design-system editor can't see or edit them on prod.

## 1. Migration `prisma/migrations/20261117120000_prod_parity_settings_tokens/migration.sql`
It must be idempotent and a **no-op on QA** (chat applies it to QA via Supabase `apply_migration` after merge and checks that 0 rows change).
- `DELETE FROM "PlatformSettings" WHERE "id" = 'default';`
- `UPDATE "DesignToken"` the 2 stale values above (`WHERE key = … AND value <> …`).
- `DELETE FROM "DesignToken" WHERE key IN (` the 10 stale keys `);`
- `INSERT INTO "DesignToken" ("key","value","group","type","locked","updatedAt") VALUES … ON CONFLICT ("key") DO NOTHING;` for the 42 rows below (exact values and metadata from QA):

| key | value | group | type |
|---|---|---|---|
| --afa-amber-border | rgba(201, 151, 58, 0.4) | color | color |
| --afa-amber-strong | rgba(201, 151, 58, 0.6) | color | color |
| --afa-amber-wash | rgba(201, 151, 58, 0.08) | color | color |
| --afa-blue-tint | rgba(74, 111, 165, 0.15) | color | color |
| --afa-btn-padding-pill-md | 10px 18px | button | dimension-shorthand |
| --afa-btn-padding-pill-sm | 6px 14px | button | dimension-shorthand |
| --afa-error-edge | rgba(179, 38, 30, 0.3) | color | color |
| --afa-error-tint | rgba(179, 38, 30, 0.1) | color | color |
| --afa-fill-tint | rgba(255, 90, 54, 0.2) | color | color |
| --afa-radius-2xl | 20px | radius | dimension |
| --afa-radius-lg | 12px | radius | dimension |
| --afa-radius-xl | 16px | radius | dimension |
| --afa-radius-xs | 3px | radius | dimension |
| --afa-sage-tint | rgba(74, 103, 65, 0.12) | color | color |
| --afa-scrim | rgba(10, 10, 10, 0.7) | color | color |
| --afa-scrim-strong | rgba(10, 10, 10, 0.9) | color | color |
| --afa-selected | var(--afa-amber) | color | color |
| --afa-selected-bg | rgba(201, 151, 58, 0.08) | color | color |
| --afa-selected-border | rgba(201, 151, 58, 0.4) | color | color |
| --afa-shadow | rgba(0, 0, 0, 0.3) | color | color |
| --afa-space-36px | 36px | spacing | dimension |
| --afa-space-40px | 40px | spacing | dimension |
| --afa-space-56px | 56px | spacing | dimension |
| --afa-space-64px | 64px | spacing | dimension |
| --afa-space-80px | 80px | spacing | dimension |
| --afa-success-tint | rgba(39, 103, 73, 0.15) | color | color |
| --afa-text-body-lg | 15px | size | dimension |
| --afa-text-caption | 10px | size | dimension |
| --afa-text-display | 26px | size | dimension |
| --afa-text-lead | 18px | size | dimension |
| --afa-text-soft | rgba(245, 245, 240, 0.8) | color | color |
| --afa-text-subheading | 22px | size | dimension |
| --afa-text-subtitle | 20px | size | dimension |
| --afa-tint-04 | rgba(245, 245, 240, 0.04) | color | color |
| --afa-tint-06 | rgba(245, 245, 240, 0.06) | color | color |
| --afa-tint-12 | rgba(245, 245, 240, 0.12) | color | color |
| --afa-tint-20 | rgba(245, 245, 240, 0.2) | color | color |
| --afa-tint-30 | rgba(245, 245, 240, 0.3) | color | color |
| --font-display | var(--font-phys-young-serif) | font | font-family |
| --font-mono | var(--font-phys-jetbrains-mono) | font | font-family |
| --font-sans | var(--font-phys-instrument-sans) | font | font-family |
| --font-ui | var(--font-phys-schibsted-grotesk) | font | font-family |

All have `locked = false`.

## 2. Code: read the singleton explicitly
Change the 3 `findFirst()` calls to read `id: "singleton"` (prefer the existing helper in `src/lib/platform-settings.ts` if it fits without upserting on a hot path; otherwise `findUnique({ where: { id: "singleton" } })`). Keep the existing `?? fallback` behaviour.

## 3. Tests (T1)
- **Unit self-test** `scripts/migration-seed-parity.test.ts`: replay every `prisma/migrations/*/migration.sql` statement touching `DesignToken` (INSERT, UPDATE, DELETE) in order, in memory, and assert the resulting key→value map equals the token set in `src/app/globals.css` (`:root` plus wherever the 4 `--font-*` vars live), with whitespace normalised. It must **fail on `origin/qa`** (2 value diffs + 10 extra + 42 missing) and pass on the branch. Show both results.
- In the same test: replaying the `PlatformSettings` INSERT/DELETE statements leaves exactly one row, `'singleton'`.
- Guard: no `platformSettings.findFirst(` left in `src/` (source-grep assertion, same style as the existing source tests).
- Wire it into the existing unit-test run (same place as the other `scripts/*.test.ts`).
- tsc, eslint (touched files), design-tokens checker green.

## Finish
Status file: what changed, the test fail-on-qa / pass-on-branch output, and the pushed head. Note for chat: apply the migration to QA via Supabase `apply_migration` after merge and verify that `DesignToken` stays at 115 rows with no value changes and `PlatformSettings` stays at 1 row. No Human check (no visible change on QA).
