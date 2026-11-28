# CC dispatch: load test step 2a — organic account runner (sign-up → verify → roles → approval → profile)

> **Create branch `feat/loadtest-runner` from `origin/qa`** (after #792 email suppression is merged — check `isSuppressedTestRecipient` exists in `src/lib/email.ts`; if not, stop and say so). Small chunks, commit + push after each. 90-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Read `docs/load-test-user-seed-spec.md`, `scripts/qa-seed-load-test-users.ts` (guard pattern), `e2e/helpers/roles.ts`, `docs/testing-rules.md` first. **Do not run against QA in this dispatch except the `--scale 0.001` smoke below.**

## Goal (Hitesh, 28 Nov)
Organic QA volume test: **1,000 artists, 100 venue owners, 100 organisers, 10,000 audience**, created the way real people do it — through the **same HTTP endpoints the website calls**, never direct DB inserts (two allowed exceptions below). Runs against the QA deployment (`https://qa.aforaudience.com`), driven from a GitHub Actions workflow.

## Build (in `scripts/loadtest/`)
1. **Guards** (first thing, before any network/DB): target host must be `qa.aforaudience.com` (or a `*.vercel.app` preview of this project); `DATABASE_URL` must contain the QA ref `nqiyrypmjtogoocerxtu`; refuse anything containing the prod ref `cncumfwwnjcwacggrgsr` or host `aforaudience.com`/`www.aforaudience.com`. Self-test for the guards.
2. **Identity**: every account `lt-<role>-<runId>-<n>@loadtest.aforaudience.qa`, username `lt_<role>_<n>_<runId>`, one shared password from a workflow secret/env (never committed), plausible Indian names/cities (Pune-heavy, mix of Mumbai/Bengaluru/Delhi/Hyderabad) from a fixed seeded RNG so runs are reproducible. `runId` short and unique per run.
3. **HTTP client** with cookie jar per account: next-auth credentials sign-in (csrf → callback/credentials → session), Vercel protection bypass header if the e2e workflows use one (reuse their secret). Retries only on network errors / 5xx (max 2, logged as retried); never retry 4xx.
4. **Journey per account (audience = all; roles add on top)**:
   a. `POST /api/auth/register` (no phone — run assumes SMS OTP **off**; if the response asks for OTP, record `BLOCKED_SMS_ON` and stop that account).
   b. Email verification: **allowed exception 1** — read that account's `EmailVerificationToken` from the QA DB (read-only SELECT), then `GET /api/auth/verify-email?...` exactly as the emailed link would. Record the time from register to verified.
   c. Sign in, `PATCH /api/users/me/` profile basics (display name, city), `POST /api/user/location/`.
   d. Artists: `POST /api/artists/apply` + profile (genres, bio). Organisers: `POST /api/organisers/apply`. Venue owners: `POST /api/venue-owners/apply`. Use the payloads the real forms send — read the form components, don't guess.
   e. **Approval**: as the load-test admin, use the same endpoint the admin dashboard uses (`/api/admin/approvals` …) to approve each pending application. **Allowed exception 2** — the load-test admin account itself: create once via a guarded, idempotent seed step (`lt-admin@loadtest.aforaudience.qa`, role ADMIN, verified) since admin can't sign up organically. Nothing else is seeded.
   f. Photos: one shared small test image per role uploaded through the real upload endpoint **only for the first 20 accounts per role**; the rest skip photos (Blob cost) — record `photo: skipped-by-design`.
5. **Scale + concurrency**: `--scale <f>` (1.0 = 1000/100/100/10000), `--roles`, `--concurrency` (default 5, hard max 10 — this is a volume test, not a stress test), resumable (`--resume <runId>` skips accounts already done, from the results file).
6. **Results**: one JSONL line per step (`runId, account, role, step, status: PASS|FAIL|BLOCKED|SKIPPED, httpStatus, ms, error (truncated, no secrets/tokens)`), plus `summary.json` (counts per role/step, p50/p95/max ms per endpoint, failures grouped by step+status+message) and `results.csv` (same as JSONL, Excel-friendly).
7. **Workflow** `.github/workflows/loadtest.yml`: `workflow_dispatch` only, inputs `scale`, `roles`, `concurrency`, `resume`; QA secrets only; uploads `scripts/loadtest/out/<runId>/` as an artifact **and** writes `summary.json` highlights as `::notice::` annotations (chat reads annotations). 300-min timeout; job stops cleanly (results flushed) before it.

## Tests (T1)
`scripts/loadtest-guards.test.ts` (prod host/ref refused, QA accepted), identity generator determinism, results writer (CSV escaping). tsc, eslint, `for f in scripts/*.test.ts` green.

## Smoke (the only live run in this dispatch)
`--scale 0.001` (1 artist, 1 organiser, 1 venue owner, 10 audience) against QA **only if** QA `PlatformSettings.smsOtpEnabled` is false at that moment (read it; never write it). If it's true, skip the smoke and say so — chat switches settings for the test window.

## Finish
Status file: files added, each endpoint used per step (with the form component it was copied from), guards, smoke result or why skipped, pushed head. Next dispatch (2b) does venues, events, bookings, tickets, check-in.
