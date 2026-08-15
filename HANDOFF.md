# AforAudience — Session Handoff

Written for whoever (human or Claude) picks this up next. Covers what changed, current state, and what's still open. Replaces all prior content in this file - that content is stale (from an earlier, now-superseded stage of the project) and fully superseded by `docs/design.md` and Claude's memory for anything not repeated here.

## qa HEAD as of this handoff

`7973c580` - 11 PRs merged this session (#457-#466 + one earlier), all CI-green, all deployed with zero runtime errors.

## What this session did: Theme Phase 2 - full dark reskin (FEAT-2608-051)

Green-lit by Hitesh mid-session as its own real project (not a same-day token swap), after a scope audit found it was the exact thing `docs/design.md`'s Theme Phase 0/1 notes had already anticipated and deferred pending explicit go-ahead. Full plan and Phase 2a/2b/2c writeups are in `docs/design.md`.

**Phase 2a (PR #459)** - additive semantic token layer in `globals.css` (`--afa-surface-page`, `-raised`, `-inverse`, `--afa-text-primary`, `-secondary`, `-muted`, `-inverse`, `--afa-fill-solid`, `--afa-on-fill-solid`). Zero visual change - every token aliased its Phase 0 source value.

**Phase 2b (PR #460)** - reclassified ~1,147 `--afa-ink`/`--afa-cream` usages across 100 files onto the Phase 2a tokens. Still zero visual change, pure semantic rename. Verified structurally (insertions==deletions, brace/quote parity - same method as the original Phase 0 hex->var migration).

**Phase 2c (PR #461)** - assigned real dark values. This is the first commit where anything actually looks different, and it's now the default (Hitesh's explicit call, not opt-in): `--afa-surface-page: #141414`, `-raised: #1F1F1F`, `-inverse: #0A0A0A` (deliberately darker, for footer/ticker/splash bands), `--afa-text-primary/-inverse: #F5F5F0`, `--afa-fill-solid: #FF5A36` (the signature accent), `--afa-on-fill-solid: var(--afa-brown-black)`. Also added Noto Sans Devanagari/Tamil/Telugu/Kannada/Malayalam/Gujarati/Bengali fonts (`layout.tsx`), chained into the real inherited font-family on `html` in `globals.css` - fixes the multi-script gap for the default/inherited text case (see open item below for what's not yet covered).

**Bug-fix sweep (PRs #462-#466)**, found by actually loading the deployed qa preview in a browser and screenshotting - not by more regex:
- `FacilitiesPicker.tsx`/`GenrePicker.tsx`: selected-chip border was raw `var(--afa-ink)` on transparent - invisible on the new dark page.
- `SiteNav.tsx`: nav bar background was a hardcoded literal `rgba(247,243,238, alpha)` - never a token reference at all, so it escaped every regex pass. Nav was unreadable (light text on a leftover cream bar).
- Events page filter bar + 22 form inputs sitewide (login, register, forgot-password, search boxes, etc.): literal `background: "white"` paired with `color: var(--afa-text-primary)` (now light) - invisible typed text in real inputs, not just labels.
- Events page "Past" tab: same literal-white pattern.
- Login/forgot-password/reset-password/verify-email: `bg-white` as a Tailwind class (a third, different escape pattern - not inline style, not a CSS var) - "Sign in" heading and field labels were invisible.

## Confirmed working live (actually screenshotted, hard-reload to bypass Vercel's aggressive branch-alias caching)

Homepage hero, nav bar, events browse (hero/search/filter chips/city+sort dropdowns/Upcoming-Past tabs), and all 4 auth pages (login, forgot-password, reset-password, verify-email).

## NOT yet checked this session - start here

Same bug class (light text or invisible borders against the new dark default) is likely still present in pages nobody has loaded yet:
- All 5 role dashboards (audience, artist, organiser, venue-owner, admin)
- Checkout flow
- Event detail page
- Profile page
- Seat-map builder
- Venue pages

Recommended method: don't blind-regex this. Load each page in a real browser, screenshot, zoom into anything that looks washed-out or low-contrast, grep for the specific broken pattern, fix, verify live, repeat. Three known escape patterns to grep for specifically: `rgba(14,12,10,` (dark-tinted, invisible on dark bg - ~300 unaudited spots estimated out of 561 total found), literal `background: "white"` (~57 of 79 total unaudited), and `bg-white` as a Tailwind className (only checked in `src/app/(auth)/` so far - needs a full-codebase grep).

## Also not done

- Accent-theme picker (Indigo/Peacock/Vermilion/Royal Purple/Midnight Sapphire/Noir) - designed for the cream base, not yet reconciled against the new dark default. Needs a look once the base itself is confirmed stable.
- Inline `fontFamily: "var(--font-sans)"` overrides (common pattern) still resolve Manrope-only, bypassing the Phase 2c multi-script fix which only fixed the inherited case.

## Gotcha for next session

Vercel's `aforaudience-git-qa-...vercel.app` branch-alias URL caches aggressively - a fix that's genuinely merged and deployed can still screenshot as broken. Hard-reload (Ctrl+Shift+R) before concluding a fix didn't work; confirm the deployment SHA via list_deployments/Contents API first if a screenshot looks wrong right after a merge.
