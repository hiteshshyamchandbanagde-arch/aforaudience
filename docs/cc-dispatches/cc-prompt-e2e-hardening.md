# CC dispatch: e2e hardening — fail fast on wrong QA state, no date drift (Part 71 Next #3)

> **Branch off `origin/qa`: `test/e2e-hardening`.** Small chunks, commit + push after each. 45-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** No product code changes. Never write the QA `PlatformSettings` row. Don't re-run `scripts/qa-seed.ts`.

## Why (chat's nightly analysis, HANDOFF Part 71)
- 21 Oct – 8 Nov: 23 red nightlies on one unchanged commit, all date drift. Seeded fixture dates aged, dated text inside screenshots changed, and a "vs last period" line appeared on 1 Nov. #762 fixed the five specs case by case; `seat-total.spec.ts` now owns its own row dated `now + 60 d`. That is the pattern to follow.
- 11 Nov: 2 red nightlies across all 6 shards because launch wave W1 was left OFF on QA. The failure showed up as about 50 unrelated errors instead of one clear message.

## 1. Pre-flight in `e2e/global-setup.ts` (fail fast, one message)
Before any spec runs, read the QA `PlatformSettings` singleton (read-only, same DB access global-setup already uses, or `GET /api/platform-settings/launch-waves`). If any of `waveDiscoveryOpen`, `waveOnboardingOpen`, `waveTicketsOpen`, `waveDirectBookingsOpen` is false, throw:
`QA pre-flight: launch wave <name> is OFF on QA. The suite expects all four waves open. Turn it back on in Admin → Settings → Launch waves, then re-run.`
Add a unit/self-test for the message builder. Don't check fixtures here that specs create themselves.

## 2. Date-drift audit (no masking, no thresholds)
- Find every spec that depends on **seeded** rows' dates or on today's date showing inside a screenshot or text assertion. Grep for `toHaveScreenshot` near dated UI (tickets, unfinished checkout, revenue "this month", calendars, countdowns) and for specs picking "any upcoming …" from the API. List them in the status file.
- Fix each with the #762 / `seat-total` pattern:
  - **spec-owned rows dated relative to now**, created in the spec and cleaned up after (T6);
  - or, for a pure-display date, Playwright `page.clock.setFixedTime(...)` / `clock.install` (see `e2e/clock-forward.spec.ts`) where the page renders client-side.
  
  Pick whichever is smaller per spec. Don't mask, don't add `maxDiffPixels`, don't loosen.
- Keep it small. If the list runs past about 6 specs, fix the riskiest 6 and list the rest in the status file for a follow-up dispatch.

## 3. Prove it
- Pre-flight: a test that the message names the closed wave (unit level; never flip QA waves).
- Drift: for each converted spec, run it locally with the clock pushed forward (e.g. `FAKE_NOW=+30d` or a fixed future date, whatever the existing clock-forward spec does) and show it still passes. Also show the before state where cheap (a spec that fails on qa with time moved forward).
- Run locally only the specs you touched. tsc, eslint (touched files) and design-tokens must be green.

## Finish
Status file: the pre-flight message, the audit list (fixed / left for later), proof per spec, and the pushed head. No Human check needed beyond the next nightly being green.
