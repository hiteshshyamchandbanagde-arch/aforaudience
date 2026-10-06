# CC dispatch K2: make K's own meta-test reliable (BUG-2610-011)

> **Existing branch `test/e2e-hygiene-k`** (head `3a2f791`). Add commits and push. Do not rebase or force-push. Chat merges. Autopilot. Budget about 30 turns. Do not edit `.github/workflows/`.

**FIRST ACTION:** status file `RESULT: PARTIAL test/e2e-hygiene-k 3a2f791`. Update the status file **before** you run out of turns. K ended with an empty status line even though both parts were pushed.

Chat reviewed K and both fixes look right. One blocker: K's new `e2e/context-timeout.spec.ts` was itself **flaky** in e2e-preview on `3a2f791`. Its old-pattern assertion `/browserContext\.close: (Target page, context or browser has been closed|Test ended)/` did not match on the first attempt. T2 doesn't allow a new test that flakes.

1. Find out why the inner run's error text varies, for example timing in the inner run or the order of close and timeout. Make the assertion match what the old pattern really produces in every case, or make the inner test deterministic. Don't loosen the test until it can't fail.
2. Run `context-timeout.spec.ts` 20 times in a row (`--repeat-each=20`) and report the pass count. It must be 20/20.
3. Note: `colour-closeout.spec.ts` GEN-2609-113 also failed on that run. That's cross-run interference on the shared QA database (three e2e-preview runs overlapped at 10:40). The scheduled QA run at 11:49 passed it, so don't touch it.

Status file at the end: `RESULT: PUSHED test/e2e-hygiene-k <sha>`, the 20× result, the CI link, and **Human check: none**.
