# CC dispatch: run S2, OTP signup-verify must bind the phone to the user (security, 8 Nov)

> **New branch `fix/otp-verify-s2` off `origin/qa`.** Small chunks: one edit, commit, push, next. 30-min limit. Push, status file, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Bug:** `src/app/api/auth/otp/verify/route.ts` verifies the code for `phone`, then runs `prisma.user.update({ where: { id: userId }, data: { isVerified: true } })` for whatever `userId` the client sent. A valid code for phone A therefore verifies any other unverified account B. (No session is issued, but verification is a trust signal and gates features.)

## Fix
- After `verifyOtp(...)` succeeds, load the user by `userId`; reject (400, generic error, same shape as other errors, no account enumeration) unless the user exists AND its stored phone matches `phone` after the SAME normalisation the request/OTP code uses (read `src/lib/otp.ts` and the request route to find it; don't invent a new normaliser).
- Do the check BEFORE marking verified; ideally `updateMany({ where: { id: userId, phone: normalised }, data: { isVerified: true } })` and treat `count === 0` as reject, so it is one atomic statement.
- Consider order: if you check the user/phone first, make sure a wrong pairing doesn't consume the OTP for the legitimate user; say what you chose in the status file.

## Tests (T1)
- Regression test that FAILS on origin/qa and PASSES on the branch: valid code for phone A + userId of user B → 400 and B stays unverified. Plus the happy path (A's code + A's userId → verified). Use the existing unit-test style (`scripts/*.test.ts`) with the route's logic factored into a testable function if needed, or an e2e `@needs-db` spec using QA fixture accounts that cleans up after itself (T6). No real SMS.
- tsc, unit self-tests, eslint (touched files), checker/ratchet green.

## Finish
Status file `cc-autopilot-status.md` (T7): change, test before/after, pushed head. Human check: none (server-only). Do not touch the Feedback table.
