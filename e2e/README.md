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
- `numbered-seat-booking.spec.ts` — the real audience seat-booking flow.
  **Currently `test.skip`'d** — completing a real booking requires passing
  phone OTP verification (`requireVerifiedPhone`), and there's no QA-only
  OTP bypass yet. See the file header for the three options; needs a
  decision from Hitesh before this can be unskipped. Do not add a bypass
  without an explicit decision — a standing test-auth shortcut is exactly
  the kind of thing that must never leak into prod.

## Adding a new test

One file per user-facing flow, not per page. Prefer text/role-based
locators (`getByText`, `getByRole`) over CSS selectors where the UI doesn't
already have `data-testid`s — they're more resilient to styling changes and
read closer to what a real user does.
