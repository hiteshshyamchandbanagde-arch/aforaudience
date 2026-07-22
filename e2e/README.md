# E2E tests (Playwright)

## Run

```bash
npm install
npx playwright install --with-deps chromium   # one-time, downloads the browser binary
npm run test:e2e
```

Defaults to running against the live QA deployment
(`aforaudience-git-qa-...vercel.app`) — no local dev server or `.env` needed.

To run against localhost or a PR preview instead:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
PLAYWRIGHT_BASE_URL=https://<preview-url>.vercel.app npm run test:e2e
```

`npm run test:e2e:ui` opens Playwright's UI mode — useful for writing new
tests interactively and seeing exactly which selector matched.

## Current coverage

- `smoke.spec.ts` — no-auth checks (homepage, events listing, event detail
  page load). These always run and are the fastest signal something is
  actually broken vs. a test needing an update.
- `numbered-seat-booking.spec.ts` — registers a fresh throwaway audience
  account, verifies its phone using the real on-screen QA dev-OTP (see
  `helpers/auth.ts` — this is the actual code the app generated, read off
  the DOM, not a bypass), logs in, selects a seat on "Jaipur Mic Gala 100",
  and confirms checkout shows the correct seat + amount. **Runs for real,
  not skipped.**
  A second test in the same file (`test.skip`) is the one remaining gap:
  completing the actual Razorpay payment. Selectors for Razorpay's hosted
  checkout iframe aren't guessed/hardcoded here — run
  `npx playwright codegen <qa-url>/events/<event-id>` once, click through a
  real test-mode payment (card `4111 1111 1111 1111`), and the real
  selectors fall out of the recording. Unskip once that's done.

## Adding a new test

One file per user-facing flow, not per page. Prefer text/role-based
locators (`getByText`, `getByRole`) over CSS selectors where the UI doesn't
already have `data-testid`s — they're more resilient to styling changes and
read closer to what a real user does.
