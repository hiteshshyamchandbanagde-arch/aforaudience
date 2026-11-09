# CC dispatch: run S1b-b1-fix — move the W1 holding check into a proxy so public pages stay cached

> **Work on the existing branch `feat/launch-waves-s1b-b1`** (check it out from origin; do NOT branch off qa, do NOT rebase). Small chunks, commit + push after each. 45-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never `git stash pop` on a clean tree. No DB changes. **Do not touch `feat/launch-waves-s1b-b2`.**

## The bug (chat, from e2e-preview run 42679534542: 30 failed, 500 passed)
Almost every failure is `page.waitForLoadState("networkidle")` timing out after 15s (account-locale, artist-browse-events, colour-closeout, dashboard-i18n-artist/organiser, use-my-location…), including dashboard pages that are **not** held. Cause: `WaveHoldingGate` in `src/app/page.tsx` and in ~12 held-segment `layout.tsx` files calls `shouldShowHoldingPage()` → `await connection()` + `getServerSession()` on **every** request, so every public page became dynamic. Every `<Link>` to a public page now prefetches a full dynamic render (DB + session), so pages with many links never reach network idle. Public pages were static/ISR before and must stay that way.

## Fix
1. **Read `node_modules/next/dist/docs/` on `proxy.ts`** (Next 16.2.9: middleware is now `proxy`, Node runtime) before writing it.
2. Add `src/proxy.ts` with a **matcher limited to the held prefixes** (`/`, `/events`, `/artists`, `/organisers`, `/tours`, `/venue-owners`, `/wall-of-fame`, `/venues`, `/blog`, `/livestreams`, `/for-artists`, `/careers` — exactly the held list from your b1 status). It must never run on `/api`, `/_next`, static/PWA files, `/.well-known`, or the always-reachable routes. Exclude RSC prefetch requests from any extra work only if the docs say how; otherwise the cheap path below is fine.
3. In the proxy: W1 state from a **module-level cache (30s TTL)** of a read-only Prisma `findUnique` on the singleton (missing row / read error ⇒ treat as **open**, same as `isW1OpenForDisplay`). If open → `NextResponse.next()` immediately. If closed → admin check via `getToken` from `next-auth/jwt` (session strategy is JWT; no DB); ADMIN → next; else `NextResponse.rewrite` to a new static route `/launching-soon` (renders `LaunchHoldingPage`, `noindex`). Keep `holdingPageApplies()` as the single decision (self-tested).
4. **Remove** `WaveHoldingGate` from `src/app/page.tsx` and **delete** the held-segment `layout.tsx` files b1 added (restore `export const revalidate = 300` behaviour on `/` — no `connection()`), and remove `shouldShowHoldingPage` if now unused. `/register` keeps `signupsClosedForViewer()` (it's one page, dynamic is fine there). Admin save keeps busting what's still cached; note in a comment that the proxy cache is per-instance, ≤30s stale.

## Tests (T1)
- Regression: a self-test that fails on the current b1 head and passes after — e.g. asserts `src/app/page.tsx` and no file under the held segments imports `WaveHoldingGate`/`connection`, and that the proxy matcher list equals the held list in `holdingPageApplies`' self-test fixture (one source of truth: export the list from `src/lib/launch-waves.ts` and use it in both — the matcher must be a static literal per Next rules, so the self-test checks they're equal).
- Self-tests for the proxy decision (open → pass; closed + admin → pass; closed + non-admin → rewrite; read error → pass).
- Locally re-run the specs that failed: `account-locale.spec.ts`, `artist-browse-events.spec.ts`, `use-my-location.spec.ts:161`, `dashboard-i18n-artist.spec.ts` (hi only), plus `launch-waves-ui.spec.ts`. Report before/after.
- tsc, self-tests, eslint (touched), design-tokens green.

## Finish
Status file (T7): what moved where, matcher list, specs before/after, pushed head. Human check: none new. Do not touch the Feedback table or any DB.
