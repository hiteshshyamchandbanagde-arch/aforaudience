# CC dispatch: PR #790 e2e-preview red — 5 tests, all caused by the /api 308 change

> **Work on the existing branch `fix/prod-nits-2711`** (PR #790, head 7d61729). Check it out from origin, do NOT rebase, add commits on top. Small chunks, commit + push after each. 60-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** QA personas only. Never write the QA `PlatformSettings` row. Rule 4: these failed on both attempts and the QA nightly on qa (run 46014793571, 14:18Z) is green, so treat them as **real** — no retries, no loosening.

## Failures (e2e-preview run 46021095136)
1. `account-locale.spec.ts:48` — `waitForResponse(r => r.url().endsWith("/api/users/me/") && PATCH)` times out.
2. `location-chip-accounts.spec.ts:56` and `:101` — same, `endsWith("/api/user/location/")` POST.
3. `footer-legal.spec.ts:26` — `footer a[href="/privacy/"]` count 0 (expected 1).
4. `design-system-goal.spec.ts:115` — "active nav item /events/ on /events/ as a signed-out visitor": element not found.

## Read it as
- 1–2: expected side-effect. The client fetch is now answered at `/api/users/me` (no slash, no redirect), so a predicate that only matches the slashed URL never fires. Fix the **predicates** to match the API path with or without a trailing slash (e.g. `new URL(r.url()).pathname.replace(/\/$/, "") === "/api/users/me"`). Justify each test change in its commit (intended: #790 removes the /api redirect hop).
- 3–4: **product regression, not a test problem.** Rendered `href`s lost their trailing slash (`/privacy` instead of `/privacy/`, nav `/events` instead of `/events/`). Suspect `skipTrailingSlashRedirect: true` also stops Next adding the trailing slash to `<Link>` hrefs. Confirm in `node_modules/next/dist/docs/` and/or by building and checking the footer/nav hrefs.
  - If confirmed, the config approach is wrong for this Next version. Revert `skipTrailingSlashRedirect` + the custom `redirects()` in `next.config.ts` and instead do the fix in the **proxy** (`src/proxy.ts`): for `/api/...` paths with no trailing slash, `NextResponse.rewrite` to the slashed path (a rewrite, not a redirect). Check the proxy matcher actually covers `/api/` (the status note said it's pinned for W1 — widen only as needed, and say exactly how). If a rewrite in the proxy still can't stop Next's built-in redirect (it runs before the proxy), **stop** and report — fallback is to leave nit 2 unfixed and ship nit 1 alone (revert the config + its spec in a separate commit).
  - Pages must keep their slash URLs and hrefs exactly as on `origin/qa`.
- Keep `e2e/api-trailing-slash.spec.ts` meaningful for whichever approach lands (or remove it with the reverted config if nit 2 is dropped, saying so).

## Tests
Run locally against `next build && next start`: the 4 failing specs + `api-trailing-slash` + `register-otp-hint`, both projects. tsc, eslint (touched files), `for f in scripts/*.test.ts` all green.

## Finish
Status file: root cause of 3–4 (with the doc line), which approach landed (proxy rewrite / nit 2 dropped), each test change with justification, before/after results, pushed head.
