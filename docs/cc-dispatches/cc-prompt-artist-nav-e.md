# CC dispatch: run E, artist navigation (Hitesh phone pass 13-14 Oct)

> **New branch `fix/artist-nav-e` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next; one locale file per tool call. **45-min hard limit, push after every commit** (autopilot token lives 60 min). Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (must include this file and #756-#759). Read `HANDOFF.md` Part 60 (batch E), `docs/design.md` (role bars), `src/components/mobile/tabBarRoutes.ts`, `src/components/mobile/MobileTabBar.tsx`, the desktop artist dashboard sidebar or role bar (find it), `src/app/dashboard/artist/page.tsx` and `src/app/dashboard/artist/events/`, and `e2e/tab-bar-labels.mobile.spec.ts` + `e2e/dashboard-i18n-artist.spec.ts`.

## The problem
- The artist bar's **"My Events"** item goes to `/dashboard/artist/events`, which is a page for browsing gigs to apply to, not the artist's own events. Hitesh tapped it expecting his own events.
- The artist overview, `/dashboard/artist`, has no item in the bar (`tabBarRoutes.ts` returns `active: null` there), so once you leave it you can't get back from the bar.

## 1. Rename "My Events" → "Find gigs" (artist bar only)
- New i18n key for the artist bar label, **"Find gigs"**, in all 12 locales, translated (not English copies; `scripts/i18n-untranslated.test.ts` must pass). Short enough to fit the 390 px tab slot in every locale; `e2e/tab-bar-labels.mobile.spec.ts` must stay green, Malayalam included.
- Do not change the shared `myEvents` key if organisers or others use it; give the artist bar its own key.
- If the page heading on `/dashboard/artist/events` also says "My Events", make it match ("Find gigs").

## 2. Add "Overview" to the artist bar
- First item, linking to `/dashboard/artist`, active on that route (update `tabBarRoutes.ts` so `/dashboard/artist` returns an active key instead of `null`). Use an existing "Overview" key if one exists (organiser and venue bars may have one); otherwise add one, translated in 12 locales.
- Same on the desktop artist sidebar or role bar if it has the same gap.
- The bar now has one more item: check it still fits at 390 px in all 12 locales without wrapping (the tab-bar spec covers this). If it can't fit, say so and stop rather than shrinking text below the design-system minimum.

## Tests (T1)
- e2e (Hrithik, QA persona): the artist bar shows Overview first and "Find gigs"; tapping Overview goes to `/dashboard/artist` and marks it active; tapping "Find gigs" goes to `/dashboard/artist/events`.
- Extend the tab-bar label fit check to the artist bar in all 12 locales at 390.
- Screenshots of the artist bar at 390 + 1440; update baselines that change and list them with the reason (T2).
- Each regression must fail on `origin/qa` and pass on the branch (show both).

## Finish
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.
- Status file `cc-autopilot-status.md` (T7) with a Human check for Hitesh, phone (Hrithik): the bar reads Overview / Find gigs / …, and each item goes where its name says; check it in Hindi or Marathi too.
- Do not touch the Feedback table. No seed or data changes.
