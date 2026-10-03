# CC dispatch: repair the e2e suite and make it a real gate (Testing Rule, transition step)

> **New branch `chore/e2e-repair` off `origin/qa`.** Commits in the order below. Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa`. **Base must be `6bded82` or later; if older, stop (stale checkout).** Fresh CC conversation. Read `docs/testing-rules.md` first: **this ticket must itself follow it**, except the e2e merge gate, which this ticket is building. Then `HANDOFF.md` part 39, `playwright.config.ts`, `.github/workflows/e2e*.yml`, `e2e/**`.

No app code changes unless a spec exposes a real app bug: then **stop and report it** (chat logs a ticket); don't fix app bugs here. No DB schema changes.

## What chat already established (3 Oct, from the GitHub API, DB and code; don't re-derive)
- `e2e.yml` (push to `qa` + nightly cron): **1 green run ever (26 Jul), 413 failures, and every run since mid-Sep killed at the 20-minute job limit.** Step 6 ("Run e2e suite") runs ~19 min and is cancelled; `playwright-report/` is never written, so there is no evidence of which tests fail. ~100 recent runs show only "cancelled".
- The arithmetic fits: 9 tests × 2 projects (Desktop Chrome, Pixel 7) × 2 attempts (`retries: 1`) × 60 s timeout ≈ 36 min if most tests hang to timeout. So most tests are timing out, not failing fast.
- **The nightly cron has never fired:** GitHub runs `schedule` only from the default branch, which is `main`.
- **Every docs-only push to `qa` queues a full e2e run** (handoffs, dispatches), so runs pile up and supersede each other.
- Ruled out: Vercel password/SSO protection (both off on the project). Login and register selectors still match the current pages (`identifierPlaceholder`, `passwordPlaceholder`, "QA Mode — dev OTP", `input[name=…]`). QA is reachable: e2e registrations last succeeded 25 Sep (5 `e2e.*@example.com` users exist in total).
- Specs are stale: all but `login-code-case` (23 Sep) were last touched 23 Jul-15 Aug, before Mobile Nav v3, the SW rewrite, the new sheets, tab bars, focus trapping, the location chip etc.
- **Chat can't read Actions logs or artifacts** (they're served from a blocked host). Chat *can* read check-run annotations through the GitHub API, so failures must surface as annotations.

## 1. Diagnose first (no fixes in this step)
Run each spec locally against QA, one at a time, both projects, `--retries=0 --reporter=line`, and record time and result per test. Write the table into the handoff: spec / test / project / pass-fail / seconds / failure cause in one line (selector gone, overlay intercepts click, flow changed, data assumption broken, real app bug, slow QA). **Classify every failure before fixing anything.** A real app bug → stop that test, `test.fixme` with a new Feedback ticket number reserved by chat (list them in the handoff), carry on with the rest.

## 2. Fast, informative failures
- `playwright.config.ts`: keep `timeout` 60 s for a test but `expect.timeout` 10 s and `actionTimeout`/`navigationTimeout` 15 s, so a missing element fails in 10-15 s, not 60. Reporters: `github` (annotations chat can read) + `list` + `html` + `json` (`test-results/results.json`).
- **Global setup** (`e2e/global-setup.ts`): one warm-up request to the base URL with a 60 s budget; if QA is down, fail the whole run in about a minute with one clear message instead of timing out test by test.
- `maxFailures` ~10 in CI, so a broken deploy stops early but still writes the report.
- Workflow: job `timeout-minutes: 30`; upload the report and `results.json` with `if: always()`; add a final step that writes a one-line summary (passed/failed/flaky counts) as a check-run annotation (`::notice::`).

## 3. Shared login and first-visit state (the likely time sink)
- **Log in once per persona, in global setup,** and save `storageState` files (Atul, Omkar, Vinayak, Hrithik; others as specs need them). Specs reuse them instead of logging in per test. Password `QaPass!2026`, from env (`E2E_PERSONA_PASSWORD`) with that QA default; never production.
- **Pre-set first-visit flags in that state** (intro splash seen, welcome sequence done, install prompt dismissed, any nudge dismissed; read the actual keys from `layout.tsx`, `WelcomeSequence.tsx`, `pwa/InstallPrompt.tsx`, `NudgeStack`) so overlays never block clicks. Keep **one** dedicated spec that tests the first-visit flow itself.
- `registerTestAudience` stays only in the registration spec; each registered user is deleted at the end of that spec (afterAll, by its unique email) so QA isn't polluted.

## 4. Repair or retire every existing spec
For each of the 6 specs: fix it to the current UI, or retire it with a reason in the handoff (only if its flow no longer exists or is covered elsewhere). **No silent deletions, no loosened assertions without a stated reason** (Testing Rule T2). `competition-show` and `waitlist-wallet-credit` have their own manual workflows: decide whether they rejoin the main suite (preferred, if they can run reliably and clean up) and say why.

## 5. Bring the #722 checks into the suite
CC ran 82 live Playwright checks for #722 and kept none. Re-create the important ones as permanent specs (Testing Rule T1): filter-sheet focus trap (065); organiser dates not US order (071); location-chip change updates `/venues` (078, signed out, so no persona state changes); long-event note (083, create page, without saving); organiser event-detail tab bar (084, Omkar); Vinayak Bookings vs Sales same October total (087, read-only); `?search=rajapalayam` visible, clearable, all cities (2610-004). These also close those tickets' retests (T5).

## 6. Run where it matters
- **Docs-only pushes skip e2e:** `paths-ignore: ['docs/**', '**/*.md']` on the push trigger.
- **Per-PR gate on the preview:** a workflow on `deployment_status` (Vercel's GitHub integration already posts these) that runs when `state == 'success'` and the environment is not Production, with `PLAYWRIGHT_BASE_URL` set to the deployment's `target_url`. Its check name must be stable (e.g. `e2e-preview`) so chat can require it on the pinned head.
- **Nightly:** keep the `schedule` in `e2e.yml`. It will start firing once the default branch is `qa`: chat will change that repo setting with Hitesh's OK, which is not a code change and not a `main` deploy. Don't commit anything to `main`.
- Concurrency: one group per ref, `cancel-in-progress: true` for push/preview runs (a newer head makes the old run pointless), never for the nightly.
- Bump actions off Node 20 (`actions/checkout@v5`, `setup-node@v5`, `upload-artifact@v5` or current), since CI warns about it.

## 7. Prove it
- The full suite runs green **twice in a row** locally against QA, and once in CI on the pushed head (`workflow_dispatch` on the branch). Target **under 12 minutes**.
- Show it can go red: temporarily break one selector on a throwaway commit, confirm the run fails fast with a readable annotation naming the test, then drop that commit before pushing the final head.
- Then the usual: tsc, `next build`, checker and ratchet unchanged, all unit self-tests.

## Handoff (delta-only, per Testing Rule T7)
Compare link; base SHA; commits; the step-1 diagnosis table; per spec: fixed or retired, and why; new specs added (file, test name, what each covers); CI run link and result on the pushed head, with duration; flaky or quarantined tests with ticket numbers; real app bugs found; the names of the check runs chat should treat as required. Human check items: none expected (this is test infrastructure), so say so if there are none.
