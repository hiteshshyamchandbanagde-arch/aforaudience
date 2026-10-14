# CC dispatch: Rule 4 quarantine for BUG-2610-033 (on PR #755's branch)

> **Same branch `fix/offline-polish`** (`git fetch && git checkout fix/offline-polish && git reset --hard origin/fix/offline-polish`). One small commit, push, status file, stop.

BUG-2610-033 (desktop 1px screenshot flake) recurred after its fix: nightly 11 Oct 16:30 and both e2e-preview runs on PR #755 today (490de6b, 4d018aa), each time only:
- `[chromium-desktop] e2e/city-picker-loading.spec.ts:57` (182x30 vs 182x31 clip)
- `[chromium-desktop] e2e/use-my-location.spec.ts:118` (749 px diff, use-my-location-far-1440.png)

Testing Rule 4 applies (failed twice in CI, flaky): **quarantine, don't delete**.
1. In both specs, quarantine **only the desktop screenshot assertion(s)**, not the whole test: keep every non-screenshot assertion running on both projects. If the screenshot can't be split out, `test.fixme(testInfo.project.name === 'chromium-desktop', 'BUG-2610-033 quarantined 14 Oct: 1px desktop screenshot flake (Rule 4)')` on that test only. Mobile screenshots stay live.
2. Comment at each site: `// BUG-2610-033 quarantined 14 Oct (Rule 4) - un-quarantine when the root cause (sub-pixel clip / font rasterisation on desktop runner) is fixed.`
3. No other edits. No `test.skip`, no threshold loosening.

Run the two specs locally once (both projects). Status file: exact lines changed (T2 existing-test change, justified by Rule 4), and what still runs.
