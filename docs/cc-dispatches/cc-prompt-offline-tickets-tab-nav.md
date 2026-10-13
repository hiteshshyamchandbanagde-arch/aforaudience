# CC dispatch: offline tickets fail on a real phone (BUG-2610-001 reopened)

> **New branch `fix/offline-tickets-tab-nav` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next. Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (must include this file). Read `HANDOFF.md` Parts 56-57, `docs/design.md` "Offline tickets (11 Oct, PR #751)", `public/sw.js`, `src/app/tickets/page.tsx`, `src/lib/offline-tickets.ts`, `e2e/offline-tickets.spec.ts`.

## What Hitesh saw (14 Oct 00:02, Android Chrome, Atul, qa.aforaudience.com)
1. Online: opened My Tickets **from the bottom tab bar**; ticket card + QR shown.
2. Airplane mode on, page still open: red "You're offline — showing saved content" banner, but the page is the **live** view: Download PDF / Message Organiser / Cancel ticket still shown, no "last updated" line.
3. Reopened My Tickets offline: got **`/offline.html`** ("You're offline … tickets you've already opened are still saved"), not the saved tickets. **This is the blocker.**

## Root cause (chat, verify it)
- `sw.js` `networkFirstWithOfflineFallback` only caches HTML for `request.mode === 'navigate'`. Reaching `/tickets` by tapping the tab is a client-side (RSC) navigation, which the SW skips on purpose (`isRouterRequest`), so the `/tickets/` HTML is never in the cache unless the user once loaded it with a full page load. Offline, the navigation falls through to `/offline.html`.
- `e2e/offline-tickets.spec.ts` uses `page.goto("/tickets/")` (a full navigation) both online and offline, so it never covers the real path. Also check trailing-slash cache keys (`/tickets` vs `/tickets/`).

## Fix 1 (blocker): the My Tickets shell is always available offline
- Whenever My Tickets saves a snapshot (`saveOfflineTickets`), make sure the `/tickets/` HTML is in the SW cache, independent of how the user got there. Preferred: the page posts a message to the SW (e.g. `{type: 'CACHE_URL', url: '/tickets/'}`) and the SW does `fetch` + `cache.put` into `RUNTIME` with the same rules as navigations (ok + basic only). Alternative if cleaner: the SW's offline navigation fallback for `/tickets` matches the cached shell with `ignoreSearch` and both slash forms. Pick one, say why in the handoff.
- The cached HTML must not contain another user's data (check: is the `/tickets/` HTML user-agnostic, with data loaded client-side from `/api`? If not, stop and report).
- Bump `CACHE_VERSION`.
- On sign-out, nothing extra is needed for the HTML (the snapshot is already cleared), but confirm sign-out + offline still shows the "connect once" state, not someone's tickets.

## Fix 2: going offline with the page open switches to the offline view
- Listen for `window` `offline` / `online` events on My Tickets. On `offline`, show the same `renderOffline(...)` view (saved cards, QR, no actions, "last updated" banner). On `online`, refetch and return to the live view.

## Tests (T1)
- Rewrite the main offline spec path to match a phone: sign in as Atul, open home, **tap the Tickets tab** (client navigation, no `goto` to `/tickets`), wait for the snapshot save, `setOffline(true)`, then do a fresh navigation to `/tickets/` (new page in the same context is fine). Expect saved card + QR + "last updated", no Cancel / Message / Download. Must fail on `origin/qa`, pass on the branch (show both).
- Spec for Fix 2: on the open page, `setOffline(true)` + dispatch the `offline` event: actions disappear, "last updated" shows; back online: live view returns.
- Keep the existing sign-out + offline = "connect once" check.
- 390 and 1440, screenshot baselines where they change.

## Finish
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.
- Status file `cc-autopilot-status.md` (T7) with the Human check: Hitesh repeats the phone test (tab to My Tickets online → airplane → close the tab → reopen My Tickets).
- Do not touch the Feedback table.
