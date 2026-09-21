# Token migration status audit — GEN-2609-093

Read-only audit. Base: `origin/qa` @ `29aaa22` (includes #691 category-first ordering, #692 checker shorthand-counting fix, #693 wire `--afa-white` in `dashboard/messages/[id]`). No `src/`, `prisma/`, `scripts/` file was modified to produce this report; every number below comes from either the repo's existing `check-design-tokens.js` / `design-token-ratchet.js` / `migrate-tokens.js` (required as modules or run read-only) or a throwaway analysis script that duplicated their exported logic for counting purposes only. Every command is given so any number here can be reproduced exactly.

## 0. Known-state check

The dispatch's "Known state" block is **confirmed exactly**, with one caveat:

| Category | Dispatch said | Live (`node scripts/design-token-ratchet.js`) |
|---|---:|---:|
| hex-color-literal | 73 | 73 |
| rgb-rgba-literal | 925 | 925 |
| hardcoded-font-family | 10 | 10 |
| font-size-literal | 854 | 854 |
| spacing-literal | 2055 | 2055 |
| radius-literal | 351 | 351 |
| raw-button | 211 | 211 |

All 7 match the committed baseline exactly — no drift.

**Caveat: the committed `TOKEN_COVERAGE` data in `src/lib/design-token-coverage.ts` is already stale relative to this same base commit.** It still lists `--afa-white` as `unused` (0 consumers), but commit `20116da` (#693, already in `origin/qa` under this HEAD) wired it into `dashboard/messages/[id]`. A live regeneration (§1) shows it as `site-wide` with 1 consumer. This is exactly the kind of staleness GEN-2609-091's own header comment already warned about ("watch for recurrence") — it recurred within two commits of that regeneration. **Flagging this now: whoever owns coverage regeneration should re-run it after #693, not treat the committed file as current.**

## 1. Token coverage now

Method (per `design-token-coverage.ts`'s own header comment):
```
for key in DEFAULT_TOKEN_VALUES: git grep -l --fixed-strings -- "var(<key>)" -- src
# drop src/app/globals.css; button-only = every remaining consumer is Button.tsx; unused = 0 consumers
```
Regenerated to a temp file (`coverage-live.json`, not committed) via a driver script that parses `DEFAULT_TOKEN_VALUES` out of `src/lib/design-tokens.ts` (84 entries, confirmed by `awk '/DEFAULT_TOKEN_VALUES/,/^}/' src/lib/design-tokens.ts | grep -c '"--'`) and shells out to the exact `git grep` above per key.

Live result: **80 site-wide, 3 button-only, 1 unused** (vs. the committed file's 79/3/2, because of the `--afa-white` staleness above).

Per-group breakdown (grouped by the token's own key-prefix/value shape — color / font / size / spacing / radius / button, matching the app's own `TokenGroup` taxonomy, not the ratchet's literal-rule categories used in §2):

| Group | site-wide | button-only | unused | total |
|---|---:|---:|---:|---:|
| color | 45 | 0 | 0 | 45 |
| size (`--afa-text-*px`) | 12 | 0 | 0 | 12 |
| spacing (`--afa-space-*`) | 14 | 0 | 0 | 14 |
| radius | 5 | 0 | 1 | 6 |
| button (`--afa-btn-padding-*`) | 0 | 3 | 0 | 3 |
| font (`--font-*`) | 4 | 0 | 0 | 4 |
| **Total** | **80** | **3** | **1** | **84** |

**Unused (1):**

| Token | Value |
|---|---|
| `--afa-radius-sharp` | `0px` |

**Button-only (3):**

| Token | Value |
|---|---|
| `--afa-btn-padding-sm` | `4px 10px` |
| `--afa-btn-padding-md` | `9px 17px` |
| `--afa-btn-padding-lg` | `12px 24px` |

### Wire-up count for the 1 unused token

`--afa-radius-sharp` (value `0px`) is **not** a "0 literals anywhere" dead token. It has real, migratable sites, but they're invisible to the ratchet/checker's own count because `isAllowlistedLength()` treats a bare `0` as free (never counted as debt) — a filter that lives in `check-design-tokens.js`, not in `migrate-tokens.js`'s `migrateValue()`, which has no such exclusion. Confirmed by running the real script:

```
node scripts/dev/migrate-tokens.js "src/app/dashboard/venue/[id]/seat-map/page.tsx" --categories=radius
node scripts/dev/migrate-tokens.js "src/app/dashboard/venue/create/page.tsx" --categories=radius
```

Both convert real `0`s sitting inside mixed corner-radius shorthands:
- `seat-map/page.tsx:1532` — `borderRadius: '0 var(--afa-radius-md) var(--afa-radius-md) 0'` → both `0`s become `var(--afa-radius-sharp)` (2 sites)
- `venue/create/page.tsx:486` — `borderRadius: '0 0 var(--afa-radius-12px) var(--afa-radius-12px)'` → both leading `0`s become `var(--afa-radius-sharp)` (2 sites)

**Real wire-up count: 4 literal sites across 2 files.** Converting them is a genuine, zero-visual-change token adoption (this is exactly why GEN-2609-090 re-added `0: '--afa-radius-sharp'` to `RADIUS_MAP` after GEN-2609-079 had excluded it) — but doing so will **not** move the `radius-literal` ratchet count (351), since these `0`s were never counted as debt in the first place. Not a delete candidate; it's just invisible to the ratchet, not to the migration tool.

## 2. Remaining literals, by category

All totals below come from directly requiring `check-design-tokens.js`'s exported `RULES`/`isCheckedFile`/`isExemptFile`/`extractPropValues`/`extractLengthTokensFromValue`/`isAllowlistedLength` and walking `git ls-files -- src` (382 checked files after exemptions) — the same code path the ratchet uses, so every "total" row below reconciles to the baseline exactly (confirmed, 0 discrepancy in every category).

"Script-convertible today" was computed by re-deriving `migrate-tokens.js`'s own matching logic (its exported `SPACING_MAP`/`FONT_SIZE_MAP`/`RADIUS_MAP`/`COLOR_MAP`/`FONT_FAMILY_MAP`, applied with the same prop-name scoping and exact-value-match rule its `processLine`/`migrateValue`/`migrateExactStringValue` use), then spot-verified against 3 real dry runs (`node scripts/dev/migrate-tokens.js <file> --categories=...`, no `--apply`) which matched exactly, including a correctly-skipped `17px` (no map entry) alongside a correctly-converted `16px` on the same line.

| Category | Total (reconciles to baseline) | Script-convertible today | Not convertible |
|---|---:|---:|---:|
| hex-color-literal | 73 | 0 | 73 |
| rgb-rgba-literal | 925 | 0 | 925 |
| hardcoded-font-family | 10 | 0 | 10 |
| font-size-literal | 854 | 710 | 144 |
| radius-literal | 351 | 232 | 119 |
| spacing-literal | 2055 | 1745 | 310 |

### hex-color-literal (73 total, 0 convertible)
`COLOR_MAP` in `migrate-tokens.js` has exactly one entry: `'#FFF' → --afa-white`. **Zero `#FFF`/`#fff` literals remain anywhere in `src/`** (verified: `git grep -nE "#[fF]{3}\b" -- src` returns nothing outside `var(--afa-white)` references) — the one mapped value was already fully migrated by #692/#693. So convertible = 0 by construction, not because of a bug.

Of the 73 not-convertible:
- **5 are structurally invisible by syntax shape**, not by value: JSX presentation attributes `fill="#..."`/`stroke="#..."` (`src/components/BrandLoader.tsx` ×4, `src/app/dashboard/venue/sales/page.tsx` ×1). `migrate-tokens.js`'s `MATCH_RE_JS`/`MATCH_RE_CSS` only match colon-based `prop: value` pairs — JSX attributes use `=`, a shape the script was never built to parse (its own header comment says this explicitly for `fill=`/`stroke=`). Measured via `git grep -noE 'fill="#[0-9a-fA-F]{3,8}"|stroke="#[0-9a-fA-F]{3,8}"' -- src` (17 raw hits; 8 are the already-`token-ok`'d Google-logo paths in login/register, 4 are `icon.svg` which isn't a `.ts(x)` file at all and was never in the checked set).
- **68 are (a) "no token exists for the value"** — real `color:`/`backgroundColor:`/etc. colon-syntax hex literals whose exact value has no `COLOR_MAP` key. This is effectively all of colour's real remaining debt.

### rgb-rgba-literal (925 total, 0 convertible)
`COLOR_MAP` has **no `rgb()`/`rgba()` entries at all** — 0 convertible by construction, uniformly (a) "no token exists," no per-value nuance needed since the map can't match any rgba string regardless of context.

Top 15 values (occurrences / file span) — candidates ≥20 occurrences flagged:

| Value | Count | Files | ≥20? |
|---|---:|---:|:---:|
| `rgba(245,245,240,0.08)` | 172 | 71 | ✅ |
| `rgba(245,245,240,0.1)` | 100 | 41 | ✅ |
| `rgba(245,245,240,0.15)` | 68 | 44 | ✅ |
| `rgba(245,245,240,0.2)` | 45 | 23 | ✅ |
| `rgba(245,245,240,0.06)` | 39 | 26 | ✅ |
| `rgba(245,245,240,0.5)` | 36 | 12 | ✅ |
| `rgba(245,245,240,0.12)` | 34 | 20 | ✅ |
| `rgba(245,245,240,0.6)` | 29 | 14 | ✅ |
| `rgba(201,151,58,0.15)` | 28 | 19 | ✅ |
| `rgba(179,38,30,0.1)` | 21 | 17 | ✅ |
| `rgba(245,245,240,0.4)` | 20 | 9 | ✅ |
| `rgba(245,245,240,0.55)` | 20 | 9 | ✅ |
| `rgba(179,38,30,0.3)` | 15 | 13 | |
| `rgba(74,103,65,0.12)` | 14 | 12 | |
| `rgba(10,10,10,0.7)` | 11 | 7 | |

12 of the top 15 values already clear the ≥20 bar. The `rgba(245,245,240,*)` family (10 of the top 12 rows) is literally `--afa-text-primary`'s RGB triple at varying opacities — this is `--afa-text-secondary`/`--afa-text-muted`/`--afa-border-resting`'s own color family reused ad hoc at other opacities never captured as named tokens.

### hardcoded-font-family (10 total, 0 convertible)
`FONT_FAMILY_MAP` is `{}` — deliberately empty per GEN-2609-090's own comment (none of that ticket's named tokens were font-family tokens). All 10 are (a) by construction (no map exists at all, not merely no match):
- `inherit` ×9 — every site is a `<textarea>`/`<input>` style object (`fontFamily: 'inherit'`), consistently used to defer to the surrounding font. Arguably not real "debt" at all (see §6).
- `SF Mono` ×1 — inside `src/lib/email.ts` (already excluded, see §3).

### font-size-literal (854 total, 710 convertible, 144 not)
- **710 convertible**: property-scoped (`fontSize:`) literals with exact matches in `FONT_SIZE_MAP` (10/11/12/13/14/15/16/18/20/24/28/32px).
- **136 (a) no token exists**: property-scoped but value has no map entry.
- **8 (b) structurally invisible**: Tailwind arbitrary-value syntax `text-[Npx]`/`text-[Nrem]`. `migrate-tokens.js` never scans `className` strings for bracket syntax at all — its regexes only match colon-based `prop: value`. This is the same shape-gap as hex's attribute-syntax case, just for a different rule.

Top 15 non-convertible values (all property-scoped `fontSize:`, no map entry):

| Value | Count | ≥20? |
|---|---:|:---:|
| `22px` | 24 | ✅ |
| `17px` | 24 | ✅ |
| `9px` | 15 | |
| `10.5px` | 12 | |
| `19px` | 9 | |
| `12.5px` | 9 | |
| `13.5px` | 6 | |
| `9` (bare) | 5 | |
| `12.5` (bare) | 5 | |
| `11.5px` | 5 | |
| `26px` | 4 | |
| `9.5px` | 4 | |
| `22` (bare) | 2 | |
| `34px` | 2 | |
| `36px` | 2 | |

Two values (`22px`, `17px`) clear ≥20 and are the strongest new-token candidates — `17px` in particular sits right between the existing `--afa-text-title` (16px) and `--afa-text-18px` tokens.

### radius-literal (351 total, 232 convertible, 119 not)
- **232 convertible**: `borderRadius:`(+corner longhands) literals matching `RADIUS_MAP` (0/6/8/10/12/999px).
- **115 (a) no token exists.**
- **4 (b) structurally invisible**: Tailwind `rounded[-side]-[Npx]` bracket syntax, same gap as font-size's.

Top 15 non-convertible values:

| Value | Count | ≥20? |
|---|---:|:---:|
| `3px` | 45 | ✅ |
| `2px` | 15 | |
| `4px` | 11 | |
| `16px` | 9 | |
| `20px` | 8 | |
| `16` (bare) | 7 | |
| `14px` | 5 | |
| `99px` | 3 | |
| `5px` | 3 | |
| `14` (bare) | 2 | |
| `24` (bare) | 2 | |
| `3` (bare) | 1 | |
| `4` (bare) | 1 | |
| `20` (bare) | 1 | |
| `7px` | 1 | |

Only `3px` clears ≥20 — a plausible `--afa-radius-3px` scale-extension token, same pattern as GEN-2609-081's earlier px-suffixed additions.

### spacing-literal (2055 total, 1745 convertible, 310 not)
Included for completeness per the dispatch even though spacing is the deferred/last category in the migration convention.
- **1745 convertible**: matches `SPACING_MAP`'s 14 exact px values.
- **297 (a) no token exists.**
- **13 (c) other — explicit script exclusion by design**: negative values (e.g. `-8px` margins). `check-design-tokens.js`'s `isAllowlistedLength()` does **not** exclude negatives (they count as real debt), but `migrate-tokens.js`'s `migrateValue()` explicitly refuses to touch any negative value regardless of whether the magnitude has a map entry ("negative margins are a real, intentional layout technique, never a token-scale value" — its own comment). This is a deliberate design choice, not a bug, but it means these 13 will **never** convert via this script even if a token existed.
- **0 (b) structurally invisible**: no Tailwind spacing-bracket hits found this pass.

Top 15 non-convertible values:

| Value | Count | ≥20? |
|---|---:|:---:|
| `40px` | 37 | ✅ |
| `5px` | 36 | ✅ |
| `9px` | 34 | ✅ |
| `80px` | 32 | ✅ |
| `7px` | 23 | ✅ |
| `64px` | 20 | ✅ |
| `3px` | 19 | |
| `56px` | 16 | |
| `22px` | 12 | |
| `36px` | 11 | |
| `26px` | 10 | |
| `11px` | 7 | |
| `-8px` | 6 | |
| `112px` | 6 | |
| `96px` | 5 | |

6 spacing values clear ≥20 — a much denser new-token opportunity than any other category, consistent with spacing being 2055 of the ~4,500-literal total.

### A caveat outside all of the above
The ratchet's own extraction only recognizes a value shape of "bare number/unit, or a single quoted string" immediately after `prop:`. A hardcoded size/spacing/radius value hidden behind a ternary, `calc()`, or a plain JS variable is **invisible to the ratchet/baseline count itself**, not just to `migrate-tokens.js` — meaning these are real debt that has never been part of the 854/2055/351 totals at all. A bounded grep found: 13 ternary-shaped `fontSize|padding|margin|borderRadius|gap:` assignments, and 18 files using `calc(`. Not quantified further (out of scope — this is pre-existing debt invisible to both tools, not something this section's convertibility split covers), but worth flagging as a known blind spot in the whole-program count, not just this audit.

## 3. Contexts where `var()` cannot work

| Context | Files found | Literals currently counted in the baseline | Currently excluded? |
|---|---|---:|---|
| `next/og` `ImageResponse` (poster generation) | `src/app/api/posters/artist/[performanceId]/route.tsx`, `src/app/api/posters/organiser/[eventId]/route.tsx`, `src/lib/poster-fonts.ts` | 0 | **Yes** — already in `EXEMPT_FILES` via `isExemptFile()`'s `src/app/api/posters/` prefix rule (documented in `docs/afa-design-tokens-reference.md` §8.1). No change needed. |
| PDF generation (`pdf-lib`) | `src/lib/ticket-pdf.ts` (uses `rgb()` from `pdf-lib`, a totally separate rendering pipeline with no CSS engine at all) | 8 (6 rgb-rgba + 2 hex, both in code comments naming the hex next to the `rgb()` call) | **No** — not in `EXEMPT_FILES`. Must be added. |
| Email HTML sent through Resend | `src/lib/email.ts` (`resend.emails.send({ html: \`...\` })`, inline `style="..."` attributes — CSS custom properties are unsupported by most email clients, Outlook especially) | 68 (26 spacing + 15 hex + 24 font-size + 1 rgba + 1 radius + 1 font-family) | **No.** This is the single biggest exclusion by literal count, and a real footgun: a naive whole-tree `migrate-tokens.js --categories=all --apply` run would currently "successfully" convert 23 of these (22 font-size + 1 radius; verified: `propConvertibleByFile['src/lib/email.ts']`) into `var(--afa-*)` references that would silently fail to render color/spacing in every transactional email. |
| Manifest / theme-color / PWA icon generation | `src/app/manifest.ts` (`background_color: '#F7F3EE'`, `theme_color: '#FF5A36'`) | 2 hex | **No.** The file's own header comment already documents *why* — BUG-2609-015: "manifests are static JSON, not CSS-aware — CSS variable strings here were silently ignored by the browser" — but the exemption was never added to `check-design-tokens.js`'s `EXEMPT_FILES`, so it's silently exposed to any future colour-category batch. |
| Canvas 2D context | `src/components/SupportWidget.tsx` (`canvas.getContext('2d')`) | 0 | N/A — checked and cleared. The canvas here is only used to downscale an attached image (`ctx.drawImage` + `toDataURL`), never sets `fillStyle`/`strokeStyle` with a color. The file's other rgba/radius/raw-button literals (7/1/7) are all in ordinary JSX inline styles outside the canvas path and are legitimately in-scope for migration. |
| SVG / data-URI strings | `src/app/profile/page.tsx`, `src/components/SupportWidget.tsx` (both: a chevron `stroke='rgba(245,245,240,0.65)'` inlined into a URL-encoded `data:image/svg+xml` string) | 0 (already suppressed via `// token-ok:` comments, both correctly documented) | **Yes**, already handled. |

**Net effect on convertible totals**: excluding `src/lib/ticket-pdf.ts` and `src/lib/email.ts` from all future migration batches removes **76 literals** from the pool a batch could ever legitimately target (8 + 68), of which **23 were showing as "script-convertible today"** in §2's font-size/radius figures above — meaning those 23 must be subtracted from any "safely convertible" total, not just excluded by file count. Adding `src/app/manifest.ts` removes a further **2 hex literals** (0 of which were convertible, since `#F7F3EE`/`#FF5A36` don't match `COLOR_MAP`'s one entry anyway — but it must still be excluded so a future colour-category token addition doesn't accidentally start matching it).

**Recommendation, not yet applied**: add `src/lib/ticket-pdf.ts`, `src/lib/email.ts`, and `src/app/manifest.ts` to `check-design-tokens.js`'s `EXEMPT_FILES` set (mirroring the existing poster-route prefix exemption) as a follow-up ticket — this audit does not modify `scripts/`.

### An unrelated correctness bug surfaced by this same question
`src/app/layout.tsx:142` sets `viewport.themeColor: "var(--afa-fill-solid)"` in Next.js's static `Viewport` metadata export. This renders literally as `<meta name="theme-color" content="var(--afa-fill-solid)">` — a `<meta>` tag's `content` attribute is not a CSS context, so the browser cannot resolve the custom property; the tag is effectively broken and Android/iOS chrome tinting silently falls back to default instead of `--afa-fill-solid`. This was introduced by GEN-2609-067 specifically *to* keep it in sync with `manifest.ts`'s hardcoded `theme_color: '#FF5A36'` — the comment names the intent correctly but the implementation uses the wrong value shape (should be the resolved hex, like `manifest.ts` itself uses). Flagging only — not fixed here (read-only task, and not exclusively a token-migration item).

## 4. Per-file ranking — script-convertible count, default categories (colour, font-size, font-family, radius)

Excludes `src/lib/email.ts` and `src/lib/ticket-pdf.ts` (§3). "Risk" flags checked against: (a) shared-component usage, (b) the admin design-system page itself, (c) real unmerged diffs on `origin/qa`-based branches (`git branch -r --no-merged origin/qa`, cross-checked with `git diff origin/qa...origin/<branch> --stat -- src` for branches that looked active; most of the ~90 unmerged branch names are old and, per this repo's own recurring squash-merge false-negative pattern, likely already landed under different SHAs — only the 4 `toast-rollout/*` branches were confirmed to carry real, currently-unmerged diffs touching files in this ranking).

| # | File | Convertible | Remaining after | Categories | Risk |
|---|---|---:|---:|---|---|
| 1 | `src/app/dashboard/admin/settings/page.tsx` | 29 | 0 | font-size, radius | ⚠️ `origin/toast-rollout/admin-settings` has a real unmerged diff on this exact file |
| 2 | `src/app/dashboard/admin/design-system/page.tsx` | 24 | 0 | font-size, radius | ⚠️ this is the admin design-system page itself — the UI that edits these very tokens |
| 3 | `src/app/(public)/events/[id]/rate/RatePromptClientPage.tsx` | 22 | 4 | font-size, radius, font-family | — |
| 4 | `src/app/dashboard/admin/revenue/page.tsx` | 22 | 4 | font-size, radius | — |
| 5 | `src/app/dashboard/admin/artists/page.tsx` | 21 | 1 | font-size, radius | — |
| 6 | `src/app/dashboard/venue/[id]/page.tsx` | 21 | 2 | font-size, radius | — |
| 7 | `src/app/my-feedback/page.tsx` | 21 | 2 | font-size, radius, hex-color | — |
| 8 | `src/app/dashboard/organiser/events/[id]/lineup/page.tsx` | 19 | 0 | radius, font-size | ⚠️ `origin/toast-rollout/organiser-pages` touches this file |
| 9 | `src/app/dashboard/venue/sales/page.tsx` | 19 | 15 | font-size, hex-color, radius | — |
| 10 | `src/app/dashboard/artist/edit/page.tsx` | 18 | 0 | radius, font-size | ⚠️ `origin/toast-rollout/artist-pages` touches this file |
| 11 | `src/app/dashboard/organiser/page.tsx` | 18 | 2 | font-size, radius | — |
| 12 | `src/app/dashboard/organiser/payouts/page.tsx` | 18 | 1 | font-size, radius | — |
| 13 | `src/components/SeatPicker.tsx` | 18 | 3 | font-size, radius | shared component (audience seat-selection, multiple call sites) |
| 14 | `src/components/dashboard/VenuePortalUI.tsx` | 18 | 9 | font-size, radius, hex-color | shared component (venue dashboard shell) |
| 15 | `src/app/dev/razorpay-test/page.tsx` | 17 | 1 | font-size, radius | dev-only test page — low real-world visual-check value |
| 16 | `src/components/AudienceChoiceVoting.tsx` | 17 | 0 | radius, font-size | shared component |
| 17 | `src/app/dashboard/admin/users/page.tsx` | 16 | 0 | font-size, radius | — |
| 18 | `src/app/dashboard/artist/events/page.tsx` | 16 | 0 | font-size, radius | ⚠️ `origin/toast-rollout/artist-pages` touches this file |
| 19 | `src/app/dashboard/artist/corporate-inquiries/page.tsx` | 15 | 0 | font-size, radius | — |
| 20 | `src/app/dashboard/venue/bookings/page.tsx` | 15 | 5 | font-size, radius | ⚠️ `origin/toast-rollout/venue-pages` touches this file |

## 5. Batch 9 proposal

Following the standing convention (3 files, 1 PR each, exact-value only via `node scripts/dev/migrate-tokens.js <file> --apply` with the default categories, zero visual change, category-first ordering — colour is a no-op this batch since 0 hex/rgba literals in these 3 files match any map entry):

| File | Before (default-cat literals) | Expected after | Convertible this batch |
|---|---:|---:|---:|
| `src/app/dashboard/admin/revenue/page.tsx` | 26 | 4 | 22 (font-size, radius) |
| `src/app/dashboard/admin/artists/page.tsx` | 22 | 1 | 21 (font-size, radius) |
| `src/app/my-feedback/page.tsx` | 23 | 2 | 21 (font-size, radius) |

All 3 avoid the 4 known active `toast-rollout/*` branches and aren't shared components or the design-system page itself — lowest-risk batch on the current ranking. **64 literals convert, ratchet total (default categories) drops from 1288 to 1224.**

Rough sequence for batches 10–12 (same convention, next-highest non-risky/flagged candidates from §4's ranking; "risky" files are deliberately deferred until the `toast-rollout/*` branches land or are abandoned, and the design-system page is deferred pending a explicit go-ahead per its own risk flag):

| Batch | Files | Convertible | Cumulative remaining (default categories, of 1288 baseline) |
|---|---|---:|---:|
| 9 | admin/revenue, admin/artists, my-feedback | 64 | 1224 |
| 10 | `RatePromptClientPage.tsx`, `venue/[id]/page.tsx`, `dev/razorpay-test/page.tsx` | 60 | 1164 |
| 11 | `organiser/page.tsx`, `organiser/payouts/page.tsx`, `admin/users/page.tsx` | 52 | 1112 |
| 12 | `artist/corporate-inquiries/page.tsx`, `SeatPicker.tsx`, `admin/bookings/page.tsx` (14 convertible, not shown in top-20 table above but next in rank) | ~47 | ~1065 |

By batch 12, the design-system page (24), the 4 `toast-rollout`-flagged files (~82 combined), and the two shared components already used (`SeatPicker.tsx` used, `VenuePortalUI.tsx`/`NearYouTabs.tsx`/`SeatSectionEditor.tsx` still pending) remain as the main pool of default-category convertible literals, alongside a long tail of files with single-digit convertible counts. **None of batches 9–12 touch spacing at all** — spacing's 1745 script-convertible literals (of 2055 total) are entirely untouched by this sequence, per the standing "spacing last" convention; that phase starts fresh once the default-category pool is meaningfully drawn down.

## 6. Decisions this surfaces for Hitesh

1. **New tokens for high-frequency non-matching values.** The clearest, lowest-risk next move: add `--afa-text-17px`, `--afa-text-22px`, `--afa-radius-3px`, and 6 new spacing scale points (40/5/9/80/7/64px) to `DEFAULT_TOKEN_VALUES` + `globals.css` + the maps, following the exact GEN-2609-081 pattern. *Recommendation: do this before batch 10* — it's cheap and immediately raises every subsequent batch's convertible rate the same way GEN-2609-081 unblocked batch 2.
2. **Whether rgba literals get a token family at all.** 925 of ~4,273 total literals (excluding raw-button) are rgba, and `COLOR_MAP` has zero entries for any of them — 0% convertible today, permanently, until someone decides this. The dominant pattern (10 of the top-12 values) is `--afa-text-primary`'s own RGB triple at different opacities never captured as named tokens (e.g. `--afa-text-primary-08`, `-15`, `-20`...). *Recommendation*: this is a bigger design decision than a batch (naming convention for opacity variants) — worth its own small ticket before any rgba migration batch is attempted, rather than ad hoc per-batch token additions.
3. **`raw-button` adoption (211) as its own track.** This audit didn't touch it (out of scope per dispatch), but it's the only category with 0% tooling coverage of any kind (no migrate-tokens.js category exists for it at all — it's a shared-component-adoption problem, not a value-token swap). *Recommendation*: scope as a separate ticket once the value-token batches (9–12+) are further along, per the existing docs/design.md GEN-2609-089 Phase 2 note.
4. **`font-family: inherit` (9 sites) — is this even debt?** Every site is a textarea/input deferring to ambient font, which is arguably correct behavior, not a hardcoded-literal problem the checker should be flagging at all. *Recommendation*: either add `inherit` to the checker's own allowlist (like `0`/`1px`/`%` already are) or explicitly decide it should stay flagged as intentional debt to migrate to a real `--font-*` role token — either way, it shouldn't sit ambiguous in the count.
5. **3 exempt-file additions found in §3** (`ticket-pdf.ts`, `email.ts`, `manifest.ts`) should go into `EXEMPT_FILES` as their own small, uncontroversial follow-up PR — not blocking, but real (email.ts in particular has a live footgun if anyone runs the migration script against it without knowing).

## Reproducing this report

```
git fetch origin qa
git checkout -b docs/gen-2609-093-token-status-audit origin/qa   # 29aaa22

node scripts/design-token-ratchet.js                              # §0 baseline reconciliation

# §1 — coverage regen (driver script parses DEFAULT_TOKEN_VALUES from
# src/lib/design-tokens.ts, then per key runs:)
git grep -l --fixed-strings -- "var(<KEY>)" -- src

# §1 — --afa-radius-sharp wire-up verification
node scripts/dev/migrate-tokens.js "src/app/dashboard/venue/[id]/seat-map/page.tsx" --categories=radius
node scripts/dev/migrate-tokens.js "src/app/dashboard/venue/create/page.tsx" --categories=radius

# §2 — per-file/category totals + convertibility: required check-design-tokens.js's
# exported RULES/isCheckedFile/isExemptFile/extractPropValues/extractLengthTokensFromValue/
# isAllowlistedLength and migrate-tokens.js's exported *_MAP objects directly in a throwaway
# node script, walking `git ls-files -- src`; spot-verified against:
node scripts/dev/migrate-tokens.js src/app/dashboard/venue/sales/page.tsx --categories=font-size,radius,spacing,colour

# §3 — var()-unsafe contexts
git grep -rl "next/og" -- src
git grep -rl "getContext(['\"]2d['\"]" -- src
git grep -rl -i "pdfkit\|PDFDocument" -- src
git grep -l "from 'resend'" -- src
git grep -ln "theme-color\|manifest.ts" -- src
git grep -noE 'fill="#[0-9a-fA-F]{3,8}"|stroke="#[0-9a-fA-F]{3,8}"' -- src

# §4 — open-branch risk
git branch -r --no-merged origin/qa
git diff origin/qa...origin/toast-rollout/admin-settings --stat -- src
git diff origin/qa...origin/toast-rollout/artist-pages --stat -- src
git diff origin/qa...origin/toast-rollout/organiser-pages --stat -- src
git diff origin/qa...origin/toast-rollout/venue-pages --stat -- src
```
