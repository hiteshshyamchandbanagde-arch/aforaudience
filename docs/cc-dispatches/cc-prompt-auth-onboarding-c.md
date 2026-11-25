# CC dispatch: run C, sign-up and onboarding (Hitesh phone pass 13-14 Oct)

> **New branch `fix/auth-onboarding-c` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next; one locale file per tool call. **45-min hard limit, push after every commit** (autopilot token lives 60 min). Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (must include this file, #756 and #757). Read `HANDOFF.md` Part 60 (batch C), `docs/design.md`, `docs/onboarding-guidelines.md`, `src/app/api/auth/username-suggestions/route.ts`, `src/lib/auth-helpers.ts`, `src/lib/auth.ts`, `src/app/(auth)/register/RegisterForm.tsx`, `src/app/verify-phone/page.tsx`, `src/components/PhoneVerifyNudge.tsx`, and the existing auth/signup e2e specs.

Out of scope: the open question 'No account found → offer create account' (Hitesh hasn't decided). Don't touch it.

## 1. Username suggestions must be valid
- On Hitesh's phone the suggestions included "tq" (under 3 characters) and "tq.matinee" (has a dot). Every suggestion must pass the same validator the username field uses on submit (find it; don't write a second rule).
- Generate, filter through the validator, de-duplicate, and check availability. If filtering leaves fewer than the usual count, generate more valid ones rather than showing fewer.
- Unit test: a short first name, names with dots or other punctuation, and non-Latin names all give only valid suggestions.

## 2. Sign-up signs you in (no second OTP)
- After a successful sign-up the person is asked for a code again to sign in. The sign-up OTP already proves the phone, so a successful sign-up must leave the person signed in and continue into onboarding.
- Use the existing session mechanism (NextAuth or whatever `src/lib/auth.ts` uses). Do not add a bypass that could sign anyone in without a verified OTP: the sign-in must be bound to the account just created in the same verified flow, server-side. Explain the mechanism in the status file; chat will review it closely.

## 3. Onboarding skips "Verify your phone" when already verified
- If the account's phone is already verified (including when it was just verified during sign-up), skip that step and don't show `PhoneVerifyNudge` for it. Unverified accounts keep the step.

## Tests (T1)
- Unit: username suggestion validity (item 1).
- e2e (QA personas or `e2e.fixture.*` accounts only; tests create and clean up their own accounts, T6): sign-up → lands signed in without a second code → onboarding has no "Verify your phone" step. An unverified account still sees the step.
- Negative test: the auto sign-in can't be reached without the sign-up OTP having been verified.
- Screenshots at 390 + 1440 for any onboarding screen that changes; update baselines that change and list them (T2).
- Each regression must fail on `origin/qa` and pass on the branch (show both).

## Finish
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.
- Status file `cc-autopilot-status.md` (T7) with a Human check for Hitesh, phone: new sign-up with a fresh number → signed in straight away, no second code, no "Verify your phone" step; suggested usernames all look valid.
- Do not touch the Feedback table. No seed or data changes.
