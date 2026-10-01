# CC dispatch: BUG-2609-088 (HIGH) service worker serves cached RSC payloads + BUG-2609-077 (HIGH) /events shows 0 events

> **New branch `fix/sw-088-events-077` off `origin/qa`. One commit per bug (088 first).** Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (≥ `3d98375`, HANDOFF part 23). **If your base is older than that, stop: you are on a stale checkout.** Read `HANDOFF.md` parts 22-24 and both Feedback messages in full (QA DB, `displayId` BUG-2609-088 and BUG-2609-077).

Context: `main` (production) has no service worker, so this is QA-only. No DB changes in this ticket.

## 1. BUG-2609-088: `public/sw.js`
**Root cause (chat-verified, read the file end to end):**
- Next client-side navigations fetch RSC payloads for page URLs (`RSC: 1` header, `Next-Router-*` headers, `?_rsc=`) with `mode !== 'navigate'`. They fall into the catch-all `staleWhileRevalidate`, so a **cached** payload is served first. That gives stale page data, and cross-user data after a sign-out/sign-in on the same device. The `/api/` exclusion never covered this.
- `staleWhileRevalidate`'s `.catch(() => cached)` resolves `undefined` when nothing is cached, so `respondWith(undefined)` throws `TypeError: Failed to convert value to Response` (seen in Hitesh's console on `/events/` and `/dashboard/venue/[id]/seat-map/`). `cacheFirst` throws the same way on a network failure.

**Fix:**
- **RSC/router requests: `return` (network only, no `respondWith`).** Detect via the `RSC` header, any `Next-Router-*` header, or the `_rsc` search param. Also bypass any non-GET request.
- **Catch-all becomes an allowlist.** Only static public files get `staleWhileRevalidate`: `/_next/image`, icons/PNGs/SVGs/fonts by extension, `/manifest.webmanifest`, `robots.txt`, `sitemap.xml`. Everything else same-origin that isn't a navigation: `return`.
- **`respondWith` never resolves to `undefined`.** SWR with no cache falls back to the network result, or a 503 `Response` if that fails. `cacheFirst` catches network failure the same way.
- **Keep navigation network-first plus offline fallback (decision: keep it).** The install prompt promises "offline tickets", and that works only because `/tickets` HTML is cached for offline use. It is served **only** when the network fails, so it isn't stale on a healthy connection. The cross-user risk is closed by the next point instead.
- **Clear the runtime cache on identity change.**
  - Add one helper, e.g. `src/lib/sw-cache.ts` `clearSwRuntimeCache()`. It deletes `afora-runtime-*` from the page via `caches.keys()` and doesn't need a SW message round-trip.
  - Call it before every `signOut` (7 call sites: SiteNav ×2, HomeHeader, SessionGuard ×2, IdleTimeoutGuard, MobileTopBar, profile/page). Route them through one wrapper rather than 7 copies if that's cleaner.
  - Also call it when the signed-in user id differs from the last one seen on this device (store the last id in `localStorage`, try/catch). This covers session expiry followed by a different user signing in.
- **Bump `CACHE_VERSION`** (e.g. `v3-2026-10-01`) so every client drops the poisoned runtime cache on activate. Update the header comment's strategy list to match the new behaviour, and drop the stale "If stale-content reports persist..." paragraph, since this is the confirmed cause.

**Verify (Playwright Chromium, SW enabled, production build against QA):**
- **(a) Cross-user:**
  - Sign in as Vinayak, then client-side nav to `/dashboard` and a venue page.
  - Sign out, sign in as Omkar, then client-side nav to the same routes.
  - Omkar's data shows, never Vinayak's.
  - Prove that this test **fails on `origin/qa`** (or report that it doesn't reproduce).
- **(b) Stale:** load `/events`, update an event's title in QA via SQL, client-side nav away and back. The new title shows. Revert the SQL after.
- **(c) Offline:**
  - With context `offline=true`, a client-side nav shows no `Failed to convert value to Response` in the console, and a hard nav gives `offline.html`.
  - A previously visited `/tickets` still loads offline.
- **(d) Upgrade:** a context that has the old SW plus a populated `afora-runtime-v2-2026-08-16` has that cache gone after the new SW activates.
- QA personas are in `e2e/helpers/roles.ts`, password `QaPass!2026`.

## 2. BUG-2609-077: `src/app/(public)/events/page.tsx` (~L219-235, ~L396, ~L620-626)
`/api/*` is not cached by the SW, so 077 is **not** 088. Fix the page itself:
- **Race:** use an `AbortController` per `selectedCity` effect, aborted in cleanup, and ignore any response whose city ≠ the current `selectedCity`. The auto-applied location city (the effect at ~L204) and the initial "All Cities" fetch currently race.
- **Error state:** `setError("")` at the start of each load (today it is never cleared). If the load failed, render the error plus a **Retry** button **instead of** the empty state. The "No events published yet" copy may only render after a successful load returned 0 events. Ignore aborts (`AbortError`), so they never surface as errors.
- **Repro first:** Hitesh hit it twice by toggling DevTools desktop ↔ Pixel 9 Pro emulation on `/events`. Try that, report whether it reproduces on `origin/qa`, and report which path produced the 0 (stale response vs. caught error).
- Same pattern exists in `src/app/dashboard/artist/events/page.tsx` ~L118. Apply the abort/error fix there only if it's the same 5-line shape; otherwise list it.

## Verification
- tsc; `next build`; checker vs `origin/qa`; ratchet unchanged (all categories at baseline; no new literals); all self-tests; ESLint per-line diff on touched files.
- Run `e2e` smoke locally once.
- All new UI (Retry) goes through `Button` and tokens.

## Handoff (delta-only)
- Compare link and commits.
- The (a)-(d) results, each with its before-on-`origin/qa` result.
- 077: repro result and root path.
- Whether the artist events page was fixed or listed.
- The final `CACHE_VERSION`.
