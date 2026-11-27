# CC dispatch: 2 prod nits — OTP hint flash on /register, 308 on every /api call

> **Create branch `fix/prod-nits-2711` from `origin/qa`** (@ the commit that adds this file). Small chunks, commit + push after each. 60-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** QA personas only (T6), never prod. Never write the QA `PlatformSettings` row. Follow `docs/testing-rules.md` (T1–T7).

## Nit 1 — OTP hint flashes on /register (prod has `smsOtpEnabled=false`)
`src/app/(auth)/register/RegisterForm.tsx:249` — `useState(true)` for `smsOtpEnabled`, so `tr.registerPage.otpHint` renders under Mobile number until `GET /api/auth/sms-otp` resolves, then vanishes (visible flash on prod).
- Make the initial state "unknown" (`boolean | null`, start `null`): hint renders only when `=== true`.
- Validation at line ~297 (`smsOtpEnabled || phoneGiven`) must keep today's server-is-final-word behaviour: while `null`, treat as **required** only if the user submits before the flag loads (same as today's default) — or block submit until loaded; pick the simpler and say which in the status file.
- Regression test (T1): Playwright spec that delays/stubs `/api/auth/sms-otp` → `{enabled:false}` and asserts the hint is **never** visible (check before and after the response). Must fail on `origin/qa`, pass on the branch — show both. Also one assertion that with `{enabled:true}` the hint appears.

## Nit 2 — every /api call 308s (`trailingSlash: true`)
`next.config` has `trailingSlash: true`; ~275 client `fetch("/api/…")` call-sites have no trailing slash → each one round-trips a 308 to `/api/…/` (POST bodies survive 308, but it's a wasted hop on every call).
- **Preferred fix (confirm against `node_modules/next/dist/docs/` first — this Next is newer than your training data):** `skipTrailingSlashRedirect: true` plus keep the trailing-slash redirect for **pages only** in the existing proxy/middleware (exclude `/api/`, `/_next/`, files with extensions). Verify `/api/x` and `/api/x/` both resolve 200 without a redirect, and that page URLs still redirect to the slash form (SEO/canonical unchanged).
- If the docs show that's unsupported or risky in this version, **stop and report** in the status file with the alternative (e.g. a codemod of the call-sites in small per-folder commits) — don't start a 275-site codemod in this run.
- Tests (T1): a spec asserting `GET /api/auth/sms-otp` (no slash) returns 200 with **no** redirect, and `/events` (no slash) still 308s to `/events/`. Fails on `origin/qa`, passes on branch.
- **Out of scope:** the apex→www 308 is Vercel domain config (apex `aforaudience.com` redirects to `www`). Just list in the status file any code that builds **absolute** URLs to the apex host for client fetches (e.g. from `NEXTAUTH_URL` / `NEXT_PUBLIC_*`), with file:line. Chat handles env/domain.

## Tests
Run only the specs you touch (both projects, 390 + 1440). tsc, eslint (touched files), design-tokens green.

## Finish
Status file: what changed per nit, the null-state choice, which Next doc confirmed `skipTrailingSlashRedirect`, tests added with before/after results, absolute-apex-URL list, pushed head, Human check list (prod /register on a phone after deploy).
