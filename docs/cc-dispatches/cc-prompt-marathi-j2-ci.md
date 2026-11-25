# CC dispatch J2: wire the i18n dictionary self-test into CI (PR #737 fix-up)

> **Existing branch `feat/marathi-j`** (PR #737, head `ddcf07f`). Check it out, add one commit, push. Do not rebase or force-push. Chat merges. Autopilot. Budget about 15 turns.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/marathi-j none`. Read `docs/testing-rules.md` and `.github/workflows/design-tokens.yml`.

Chat review of #737 found `scripts/i18n-dictionaries.test.ts` is committed but **no workflow runs it**. T1/T3 require logic self-tests to run in CI on every push.

1. In `.github/workflows/design-tokens.yml`, add a step after "Tab-bar route self-tests", following the same pattern: `name: i18n dictionary self-tests`, `run: npx --yes tsx@^4.23.1 scripts/i18n-dictionaries.test.ts`.
2. Run it locally and confirm it passes on the branch. Also show that it **fails** when one `mr.ts` value is blanked (revert that edit; don't commit it).
3. Change nothing else.

Status file at the end: `RESULT: PUSHED feat/marathi-j <sha>`, the local pass/fail output in one line each, and **Human check: none**.
