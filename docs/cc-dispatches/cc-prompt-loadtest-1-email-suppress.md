# CC dispatch: load test step 1 — never send real email to test-domain addresses

> **Create branch `feat/loadtest-email-suppress` from `origin/qa`.** Small chunks, commit + push after each. 40-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** No DB writes. Follow `docs/testing-rules.md`.

## Why
Hitesh approved (28 Nov) an organic QA volume test: 1,000 artists, 100 venue owners, 100 organisers, 10,000 audience, created through the real API (register → verify email → role request → approval → …). QA sends through Resend on the same `mail.aforaudience.com` domain as prod, so 11,200 sends to made-up addresses would bounce and hurt prod's sender reputation. Test accounts must never reach Resend.

## Do
1. In `src/lib/email.ts`, add one helper, e.g. `isSuppressedTestRecipient(to: string)`: true when the address's domain is one of a **fixed list** — `loadtest.aforaudience.qa`, `aforaudience.qa` (QA personas), `example.com` (e2e fixtures). Case-insensitive, exact domain match (no suffix tricks: `x@evilaforaudience.qa` is NOT suppressed). Put the list in one exported constant.
2. Every send function in `email.ts` (password reset, verification, corporate inquiry, the one at ~L94, ticket) checks it **first**: if suppressed → `console.info("[email] suppressed test recipient", { kind, domain })` (domain only, never the full address or the URL/token) and return as if sent. No other behaviour change. Applies in every environment (these domains never belong to real users).
3. Don't touch the register/verify flow: the verification token is still created in the DB as today (the load runner will read it from the QA DB to "click" the link).

## Tests (T1)
- `scripts/email-suppress.test.ts` (tsx, like the other self-tests): suppressed for each listed domain incl. mixed case; NOT suppressed for `gmail.com`, `x@evilaforaudience.qa`, `x@aforaudience.qa.evil.com`, `x@sub.loadtest.aforaudience.qa`; and a source check that each exported `send*` function calls the helper before `resend.emails.send`. Must fail on `origin/qa` (helper missing), pass on branch — show both.
- tsc, eslint (touched files), `for f in scripts/*.test.ts` green.

## Finish
Status file: the domain list, each send function covered, test before/after, pushed head.
