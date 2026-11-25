# CC dispatch: run S1b-c2 — launch waves polish from Hitesh's phone check (10 Nov)

> **New branch `fix/launch-waves-s1b-c2` off `origin/fix/launch-waves-s1b-c1`** (PR #776, not merged yet). If origin/qa already contains S1b-c1 (`isPrerenderRevalidate` in `src/lib/launch-waves.ts`), branch off `origin/qa` instead. Small chunks, commit + push after each; **one dictionary file per call**. 40-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never `git stash pop` on a clean tree. No DB changes. **Never write the QA PlatformSettings row.** Payments decision (10 Nov): all payments direct cash/UPI, no AFA transaction — keep copy consistent ("with a fee", never "pay through AFA").

## Do (one commit each)
1. **Admin → Settings, Launch waves Save looks active when nothing changed.** The button is already `disabled={wavesSaving || !isWavesDirty}` (`src/app/dashboard/admin/settings/page.tsx` ~l.675), but on a phone (390) it rendered full-orange. Find why: the shared `Button` solid variant's disabled style (check `src/components/ui/Button*`), or `isWavesDirty` being true on load (e.g. initial state set before the GET resolves). Fix at the root; if it's the Button's disabled style, it affects every Save on the page — that's intended, verify they all look disabled when clean.
2. **Profile "Create" links while W2 is closed** (`src/app/profile/page.tsx` ~l.745: List an event / Register a venue / Artist profiles). Add a small "Opening soon" badge (existing badge/chip pattern, tokens) next to each title when `applicationsClosed`; links still scroll to the card.
3. **Artist apply card while W2 is closed:** hide the sentence "Goes live immediately, no approval wait." Split `artistUpgradeDesc` into the base sentence + a separate `artistUpgradeInstant` key (all 12 dictionaries, one file per call), and render the second only when W2 is open.
4. **W4 closed: Paid / Buy-in options must look clearly unavailable** (edit + create event pages, `paymentTypeBlocked`, ~l.1181 in edit). They are `disabled` but look nearly identical to Free. Use the existing disabled-control look (reduced opacity + not-allowed cursor + muted border via tokens), plus `aria-disabled`. Same on the create page and on the artist-profile invite control and tour add-stop if they share the pattern.

## Tests (T1)
- Item 1: e2e (390 + 1440) — load settings, assert the Launch waves Save is `disabled` **and** its computed style differs from the enabled state (e.g. opacity < 1 or the disabled token colour); toggle a box → enabled; toggle back → disabled. Never click Save. This must fail on the base if the bug is visual/dirty-state.
- Items 2–4: e2e with `page.route` on `/api/platform-settings/launch-waves` (W2 / W4 false) — badge visible on the three Create links; Artist card lacks the "immediately" sentence; Paid/Buy-in `aria-disabled="true"` with the muted style, Free enabled. Screenshots 390 + 1440.
- Latin-leak hi + mr on touched pages. Existing specs unchanged and green. tsc, self-tests, eslint (touched), design-tokens green. Run only touched specs locally.

## Finish
Status file (T7): item-1 root cause, files changed, before/after, pushed head. Human check (Hitesh): the four items on phone (chat flips W2 then W4 off briefly). Do not touch the Feedback table or any DB.
