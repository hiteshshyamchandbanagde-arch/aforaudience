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
| `competition-show.spec.ts` | fixture Organiser | competition toggle and prizes: save, public page (restores the fixture) |
| `waitlist-wallet-credit.spec.ts` `@needs-db` | Hrithik, Shahrukh, fixture Organiser | apply, approve, waitlist, cancel, refund to wallet credit, apply to platform fee |
| `filter-sheet-focus.mobile.spec.ts` | guest | BUG-2609-065 focus trap in the filter sheet |
| `organiser-tab-bar.mobile.spec.ts` | Omkar | BUG-2609-084 organiser bottom bar on event detail |
| `organiser-events.spec.ts` | Omkar | BUG-2609-071 dates in India time; BUG-2609-083 half-hour billing and long-event note |
| `location-chip.spec.ts` | guest | BUG-2609-078 chip change relists `/venues` |
| `venue-revenue.spec.ts` | Vinayak | BUG-2609-087 Bookings and Sales month totals agree |
| `events-search.spec.ts` | Atul | BUG-2610-004 `?search=` shown and searched in every city |
