# CC dispatch: amend fix/offline-polish (PR #755) — one stale spec

> **Same branch `fix/offline-polish`** (`git fetch && git checkout fix/offline-polish && git reset --hard origin/fix/offline-polish`). One small commit, push, status file, stop. **Never `git stash pop` on a clean tree.**

e2e-preview on 490de6b: 542 passed, 4 failed.

1. **Fix (caused by this branch):** `e2e/nudge-banners.spec.ts:111` "[BUG-2610-017] the offline banner stays pinned while the page scrolls" (both projects) still looks for the old text `You're offline — showing saved content`. The banner now says the translated `t.common.offlineBanner` ("You're offline"). Change the locator to the `data-afa-network-banner` hook (preferred, survives copy changes) and assert the new text once. Keep every pinned/scroll assertion unchanged. Grep `e2e/` for any other `showing saved content` and fix the same way.
2. **Do not touch** `use-my-location.spec.ts:118` and `city-picker-loading.spec.ts:57` (desktop screenshot 1px flake, BUG-2610-033; chat is tracking it under Rule 4).

Run only `e2e/nudge-banners.spec.ts` locally (both projects). Status file: before/after for that spec, list of edited lines (T2: existing-test change, justified by the copy change).
