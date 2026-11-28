# CC dispatch: PR #790 red — update `scripts/sms-otp-ui.test.ts` to the null-state

> **Work on the existing branch `fix/prod-nits-2711`** (PR #790). Check it out from origin, do NOT rebase, add commits on top. One small commit + push. 20-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.**

## Failure (design-tokens run 46013578395, head 2fe1f3a)
`scripts/sms-otp-ui.test.ts` — 3 source-pattern assertions still encode the old `useState(true)` default that #790 intentionally changed:
- L37–40 `RegisterForm reads the flag, defaulting to ON` → expects `useState(true)`
- L41–44 → expects `(smsOtpEnabled || phoneGiven) && …`
- L53–55 → expects `{smsOtpEnabled && (`

## Do
Update **only those 3 assertions** to the new intended behaviour (justify in the commit message — "intended: #790 null initial state, hint only when known ON"):
- rename test 1 to "…starting unknown (null)" and match `useState<boolean | null>(null)`;
- test 2 match `(smsOtpEnabled !== false || phoneGiven) && …` (phone still required until the flag is known OFF);
- test 3 match `{smsOtpEnabled === true && (`.
Don't touch any other assertion. Run `npx tsx scripts/sms-otp-ui.test.ts` plus the full `for f in scripts/*.test.ts` loop locally — all green.

## Finish
Status file: the 3 before/after regexes and the pushed head.
