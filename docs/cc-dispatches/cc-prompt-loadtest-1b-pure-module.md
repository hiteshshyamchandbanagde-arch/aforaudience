# CC dispatch: #792 red — email-suppress test needs DATABASE_URL in CI

> **Work on the existing branch `feat/loadtest-email-suppress`** (PR #792, head 5fd42ed). Check it out from origin, no rebase, add commits on top. One or two small commits + push. 25-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.**

## Failure
Design Token Check run 46135074039: `== scripts/email-suppress.test.ts` → `Error: Missing DATABASE_URL environment variable`. The test dynamically imports `src/lib/email.ts`, which imports `@/lib/design-tokens.server` → builds a Prisma client at import time. CI's self-test step has no DATABASE_URL (correct — self-tests must not need a DB).

## Fix
- Move `SUPPRESSED_TEST_EMAIL_DOMAINS`, `recipientDomain` and `isSuppressedTestRecipient` into a new **pure** module `src/lib/email-suppress.ts` (no imports beyond none/std). `email.ts` imports them from there and keeps `suppressTestRecipient` + the 4 early returns exactly as they are. Re-export `isSuppressedTestRecipient` / `SUPPRESSED_TEST_EMAIL_DOMAINS` from `email.ts` only if something else already imports them from there (nothing should yet).
- `scripts/email-suppress.test.ts`: import the pure module for the behaviour checks; keep the **source check** on `email.ts` (read as text, each `send*` starts with the guard). No dummy DATABASE_URL, no env hacks.
- Run it **with DATABASE_URL unset** (`env -u DATABASE_URL npx tsx scripts/email-suppress.test.ts`) plus the full `for f in scripts/*.test.ts` loop the way design-tokens.yml runs it; tsc, eslint (touched files).

## Finish
Status file: the env-unset run output line, pushed head.
