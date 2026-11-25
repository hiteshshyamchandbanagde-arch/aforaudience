# CC dispatch: run S1b-c1 — launch waves fixes from Hitesh's phone check (10 Nov)

> **New branch `fix/launch-waves-s1b-c1` off `origin/qa`.** Small chunks, commit + push after each; **one dictionary file per call**. 45-min limit (push a working part, list what's left). **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never `git stash pop` on a clean tree. No DB changes. **Never write the QA PlatformSettings row** (QA is all-open; tests inject state).

## Decision (Hitesh, 10 Nov 21:10 IST) — frame for every string you touch
**All payments are direct cash or UPI between the parties. No AFA transaction, ever, at launch.** AFA only shows who pays whom, how much, and how (UPI ID/QR or cash), and records "I've paid" / "Received". "Paid" in UI copy must never suggest paying through AFA.

## 1. BUG — home page shows the holding page to ADMIN while W1 is closed (Hitesh, confirmed)
Evidence: `GET /` with no cookies → `x-matched-path: /launching-soon`, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`; an admin signed in got the holding page on `/` (but `/events`, `/artists`, `/venues` — force-dynamic — were fine). `/` is ISR (`revalidate = 300`). Chat's diagnosis: the ISR background revalidation of `/` goes through `src/proxy.ts` with no session → rewritten to `/launching-soon` → that output is stored as `/`'s prerender for everyone (and would linger ≤5 min after W1 reopens). **Read `node_modules/next/dist/docs/` (proxy + ISR/revalidation) and confirm or correct this before fixing.** Expected fix: the proxy must pass through revalidation/prerender requests untouched (e.g. the `x-prerender-revalidate` header or whatever the docs name), so `/`'s cache always holds the real home page and only real visitor requests are rewritten. If the docs show the rewrite itself can be cached under `/`, also make the rewritten response non-cacheable for that path. Add the decision to `w1ProxyAction` (pure) so it's self-tested.
- Regression: self-test `revalidation request + W1 closed + no token → next` fails on origin/qa, passes on branch.

## 2. Holding page = clean full screen
While the holding page renders (`/launching-soon`), hide the site header search, **Sign up** button, bottom tab bar, the support/chat bubble and the notification nudge. Keep the wordmark, the line, About/Contact links, and a small **Sign in** link (admins need it). Find how other chrome-less pages do it (auth pages / `AuthLayout`, offline page) and reuse that mechanism — don't fork the layout. 390 + 1440 screenshots via `/dev/launch-holding`.

## 3. Wording: "paid" ≠ "through AFA"
- `launchWaves.paidSlotsSoon` → "Artist slots with a fee open soon"; `paidVenueSoonNote` → "Venue bookings with a fee open soon — ₹0 venue bookings are allowed." (all 12 dictionaries, one file per call; keep keys).
- On every screen that shows an amount one party owes another in the direct-pay flows (venue booking pay step, artist fee pay step, pay-at-entry ticket notice — find them: grep the D1–D3 direct-pay components, "I've paid", UPI QR display), add one line: **"Pay {name} directly by UPI or cash. AFA doesn't collect this money."** (pay-at-entry variant: "Pay the organiser at the venue. AFA doesn't collect this money."). New key(s) under an existing direct-pay namespace, 12 dictionaries.

## Tests (T1)
- Self-tests: item 1 (above); any pure helper you add for 2.
- e2e: extend `e2e/launch-waves-ui.spec.ts` — holding page (via `/dev/launch-holding` or the component path b1 used) has no `[data-afa-tab-bar]`/search/sign-up/chat bubble (use the real selectors) and has a Sign in link; direct-pay spec(s) you touch assert the new disclosure line on at least one venue and one artist pay step (existing fixtures, read-only).
- Latin-leak specs hi + mr on touched pages. Existing specs unchanged and green. tsc, self-tests, eslint (touched), design-tokens green. Run only touched specs locally.

## Finish
Status file (T7): item-1 root cause as confirmed from the docs (quote the doc file), every screen given the disclosure line (file:line), before/after, pushed head. Human check (Hitesh): holding page full-screen on phone (chat flips W1 off briefly); admin sees real home with W1 off; disclosure line wording on one pay step. Do not touch the Feedback table or any DB.
