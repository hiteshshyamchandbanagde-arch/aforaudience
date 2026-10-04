# E2E tests (Playwright)

The rules these tests exist under are in `docs/testing-rules.md`.

## Run

```bash
npm install
npx playwright install --with-deps chromium   # one-time, downloads the browser binary
npm run test:e2e
```

Defaults to running against the live QA deployment
(`aforaudience-git-qa-...vercel.app`) — no local dev server needed.

To run against localhost or a PR preview instead:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
PLAYWRIGHT_BASE_URL=https://<preview-url>.vercel.app npm run test:e2e
```

`npm run test:e2e:ui` opens Playwright's UI mode — useful for writing new
tests interactively and seeing exactly which selector matched.

## How a run works

1. **Global setup** (`global-setup.ts`): one warm-up request (60 s budget; if
   the site is down the run stops there with one message), then one login
   per QA persona, saved to `e2e/.auth/<persona>.json` (git-ignored).
   With `E2E_DATABASE_URL` it also creates the run's temp admin,
   `e2e.admin.<run-id>@example.com`, with a random in-memory password
   (`helpers/temp-admin.ts`); **global teardown** (`global-teardown.ts`)
   deletes it and anything it wrote. Hitesh's real ADMIN account is never
   used.
2. **Two projects**: `chromium-desktop` and `mobile-chrome` (Pixel 7).
   `*.mobile.spec.ts` runs on the phone project only; the two long
   data-flow specs (`waitlist-wallet-credit`, `competition-show`) run on
   desktop only. Both lists are in `playwright.config.ts`.
3. **Timeouts**: a test may take 60 s, but a missing element fails in 10 s
   (`expect`) or 15 s (click, fill, navigation). Do not raise these to get a
   test through; if a flow is honestly longer, say why next to
   `test.setTimeout` (see `competition-show.spec.ts`).

## Environment

| Variable | Default | What for |
|---|---|---|
| `PLAYWRIGHT_BASE_URL` | the QA deployment | site under test |
| `E2E_PERSONA_PASSWORD` | the QA personas' shared password | persona logins (QA only, never production) |
| `E2E_FIXTURE_PASSWORD` | the fixture Organiser's password | fixture login |
| `E2E_DATABASE_URL` | locally: `DATABASE_URL` from `.env.local` | QA Postgres URL for cleanup (see below) |

**`E2E_DATABASE_URL`** lets the suite do the two things the app has no UI
for: delete the account `registration.spec.ts` registers, and put the
waitlist/wallet fixture back (`helpers/qa-db.ts`; it refuses any database
that is not the QA project). Without it the run still passes, but says so
with a warning: `@needs-db` specs are left out and the registered accounts
stay in QA.

## Writing a spec

- A test that verifies a ticket puts its ID in square brackets in the
  title: `test("[BUG-2609-077] ...")` (several IDs allowed). The CI
  summary lists the tickets whose tests passed and failed; the map is
  `docs/test-coverage-map.md`.

- Import `test` and `expect` from `./helpers/test`, not from
  `@playwright/test`: it starts every page with the first-visit state
  settled (intro splash, install banner, nudges; `helpers/first-visit.ts`).
  `registration.spec.ts` is the one exception, because it tests that first
  visit.
- Signed-in specs reuse a saved session:
  `test.use({ storageState: authFile("omkar") })` (`helpers/personas.ts`).
  Do not log in through the form per test; `login-code-case.spec.ts` covers
  the form.
- Dashboard pages: open them with `gotoDashboard(page, url)`; after a save,
  pass `AFTER_WRITE` to the assertion that waits for the result.
- One file per user-facing flow, not per page. Prefer role and text
  locators (`getByRole`, `getByText`) over CSS.
- Never change a persona's saved state without restoring it, and never
  register accounts outside `registration.spec.ts`.
- A real app bug found by a test is not fixed in the test: quarantine that
  one test with `test.fixme` and a Feedback ticket, in the same PR.

## Current coverage

| Spec | Who | Covers |
|---|---|---|
| `smoke.spec.ts` | guest | homepage, events listing, numbered event detail |
| `registration.spec.ts` | new account | intro splash, register, dev OTP, sign in, welcome sequence, seat picker, checkout (stops before Razorpay) |
| `login-code-case.spec.ts` | fixture Organiser | login form; AFA code accepted in any case |
| `language-rollout.spec.ts` | guest | 11 locales through both language pickers, persistence, proper nouns and ₹ |
| `competition-show.spec.ts` | fixture Organiser | competition toggle and prizes: save, public page; BUG-2610-006 listing-card badge (restores the fixture) |
| `waitlist-wallet-credit.spec.ts` `@needs-db` | Hrithik, Shahrukh, fixture Organiser | apply, approve, waitlist, cancel, refund to wallet credit, apply to platform fee |
| `filter-sheet-focus.mobile.spec.ts` | guest | BUG-2609-065 focus trap in the filter sheet |
| `organiser-tab-bar.mobile.spec.ts` | Omkar | BUG-2609-084 organiser bottom bar on event detail |
| `organiser-events.spec.ts` | Omkar | BUG-2609-071 dates in India time; BUG-2609-083 half-hour billing and long-event note |
| `location-chip.spec.ts` | guest | BUG-2609-078 chip change relists `/venues` |
| `venue-revenue.spec.ts` | Vinayak | BUG-2609-087 Bookings and Sales month totals agree |
| `events-search.spec.ts` | Atul | BUG-2610-004 `?search=` shown and searched in every city; BUG-2610-007 clearing the box clears the address |
| `events-load.spec.ts` | guest | BUG-2609-077 normal, slow and failed `/api/events` never show "No events published yet" |
| `chat-bubble.mobile.spec.ts` | Omkar, Atul, Vinayak | BUG-2609-068/081 the chat button covers no bottom action on 6 pages at 390 |
| `fonts.spec.ts` | guest, Vinayak, Omkar | BUG-2609-055 no text in a browser-default font on 7 pages |
| `plurals.spec.ts` | guest, Vinayak | BUG-2609-082 "1 event" / "2 events" on /events, venue Sales counts |
| `unified-tab-bar.mobile.spec.ts` | guest, Atul | GEN-2609-013/017 the bar on / is the one Atul gets on /tickets, /profile |
| `artist-tour.mobile.spec.ts` | Hrithik | BUG-2608-049 Tour fields fit at 390 (row added, never saved) |
| `contrast.spec.ts` | Omkar | BUG-2609-050 special-notes badge contrast, all three statuses |
| `seat-legend.spec.ts` | guest | GEN-2609-010 price-tier legend on Jaipur Mic Gala 100 |
| `role-menu-ssr.spec.ts` | Omkar, Atul | BUG-2609-020 role menu and held roles in the first server response |
| `discover-carousels.mobile.spec.ts` | guest | GEN-2609-012 no carousel under 3 events; all-sparse shows the list |
| `design-system-goal.spec.ts` `@needs-db` | temp admin, guest, Atul | the central-control goal: a Design System save reaches `/`, `/events/`, `/venues/` with no redeploy, manifest/theme-color/poster follow their own tokens, reverted; Admin Settings Save buttons at 390 and 1440 |
| `design-system-restore.spec.ts` `@needs-db` | temp admin | GEN-2609-115 a version restore runs the contrast check: passes silently, reports a failing pair; token reverted |
| `design-system-spacing-hidden.spec.ts` `@needs-db` | temp admin, guest | GEN-2609-107 phase 2: no Spacing group or `--afa-space-*` field in Admin -> Design System at 1440 and 390 (search finds none); the spacing rows and runtime injection stay. Read-only |
| `visual-equivalence.spec.ts` | guest, Omkar, Atul | Skipped unless `VISUAL_BASE_URL` is set. Full-page 390 + 1440 shots of 10 key pages on `VISUAL_BASE_URL` vs the run's base URL, pixel diff must be 0 above anti-aliasing (GEN-2609-107 phase 2 proof; reusable). `VISUAL_CONTROL_CSS` is the negative control |
| `auth-submit-contrast.spec.ts` | guest | GEN-2609-115 Sign In / Create Account text contrast ≥ 4.5 |
| `scrim-backdrops.mobile.spec.ts` | guest, Omkar | GEN-2609-114 filter sheet and More sheet backdrops are `--afa-scrim` |
| `colour-closeout.spec.ts` | Omkar, Hrithik, Atul, Vinayak | GEN-2609-113 gold/error tone text on its tint ≥ 4.5 (5 places); GEN-2609-114 sage text is `-bright` |
| `saved-events.spec.ts` | Atul | GEN-2609-007 heart saves, `/saved` lists, unsave (restored) |
| `profile-hub.mobile.spec.ts` | Atul | GEN-2609-008 Profile hub rows at 390; fee sheet traps focus |
| `ticket-qr.spec.ts` | Atul | GEN-2609-006 each confirmed card's QR is its bookingId; actions per status |
| `artist-tour-stop.spec.ts` | Hrithik | FEAT-2608-047 tour stop abroad reaches the public profile; removed (restored) |
