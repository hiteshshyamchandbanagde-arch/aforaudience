# CC dispatch: small bug batch (BUG-2608-090, BUG-2609-051, BUG-2609-085)

> **One branch, these three tickets only. Do NOT stack. Do NOT start another ticket.** Small chunks (AGENTS.md): one small edit, commit, push, next. Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (must include the commit carrying this file; if older, stop: stale checkout). Read `HANDOFF.md` Part 56 and `docs/testing-rules.md`.
**Branch:** `fix/bug-batch-090-051-085`, off `origin/qa`. One commit per ticket, in this order, plus test commits.

## 1. BUG-2608-090: "no platform cut on rentals" sits on the wrong card
- `src/app/dashboard/venue/sales/page.tsx` ~L190-193: `sub={v.venuesSub}` is on the **Venues count** card. It is revenue copy (the venue owner keeps the whole rental; AFA's fee is audience-only, still true under the 11 Oct payments decision).
- **Decision (chat):** remove `sub` from the Venues card. Total Revenue's sub becomes `` `${tr.common.byEventDate} · ${v.venuesSub}` ``.
- **No dictionary edits.** Reuse both existing keys (the key name `venuesSub` stays; add a one-line comment saying it now belongs to the revenue card).
- Test (T1): e2e at 390 and 1440 as Vinayak on `/dashboard/venue/sales`: the Total Revenue card contains the no-cut text, the Venues card does not. Update the affected screenshot baselines and say which in the handoff.

## 2. BUG-2609-051: admin Settings shows an expired Direct payouts toggle as ON
- `src/app/dashboard/admin/settings/page.tsx` ~L161 sets `dpEnabled = !!data.settings.directPayoutsEnabled`, ignoring `directPayoutsEnabledUntil`. Real consumers use `isDirectPayoutsEnabled()` in `src/lib/platform-settings.ts` (~L294), which applies the expiry.
- **Decision (chat):** the toggle shows the effective state. When the stored flag is on but the date has passed, show the toggle OFF plus a short muted note under it: "Expired on {date} — currently off." (new i18n key; add it to every locale file, **one file per tool call**, same pattern as neighbouring admin settings keys; English text in non-en files is acceptable only if that is what the neighbouring admin keys already do, otherwise translate).
- Use `isDirectPayoutsEnabled()` (it's a pure function; import or move it somewhere client-safe if `platform-settings.ts` pulls server-only code). Don't duplicate the date logic.
- Saving the page must not silently re-enable it: if the admin saves without touching the toggle, the stored values stay consistent with what was shown (OFF). State in the handoff exactly what is written on save.
- Test (T1): unit self-test for the expired / not-expired / no-date cases of whatever helper the page uses; regression must fail on `origin/qa` and pass on the branch (show both).
- Context only, **do not act on it:** the 11 Oct decision routes all money through AFA's account, so the Direct payouts feature itself may be retired later. This ticket only makes the display truthful.

## 3. BUG-2609-085: "Check approval status" nearly invisible on organiser event detail (390px)
- `src/app/dashboard/organiser/events/[id]/page.tsx` ~L558-585: the publish Button renders `d.checkApproval` when `event.status === 'PENDING_APPROVAL'`. The 10 Oct BUG-2610-023 sweep may already have fixed the contrast.
- **First verify:** screenshot at 390 and 1440 as Omkar on an event in `PENDING_APPROVAL` (find or set one up on QA personas only, restore afterwards). Measure the text/background contrast.
  - If ≥ 4.5:1 and the bubble doesn't cover it (the BUG-2609-081 clearance should handle that): no code change; commit only the e2e check + screenshot baseline, and say "already fixed by #<PR>" in the handoff.
  - If not: use a real Button variant (no inline colour overrides) that passes 4.5:1, then add the same test.
- Make sure the button row carries `data-afa-action-row` so the support bubble lifts clear of it.

## Finish
- Required green on the pushed head: tsc, unit self-tests, eslint (no new warnings in touched files), checker/ratchet (no category may go up).
- Status file `cc-autopilot-status.md` (T7): commits, tests added, before/after results, screenshot baselines changed, Human check list (expect: Hitesh glance at the venue Sales cards on a phone; admin Settings Direct payouts card).
- Do not touch the Feedback table; chat updates statuses after merge.
