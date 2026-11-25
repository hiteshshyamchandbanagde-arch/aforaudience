# CC dispatch: run A, Events page copy + live city count on the home hero (Hitesh phone pass 13-14 Oct; decision 14 Oct)

> **New branch `fix/events-copy-a` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next; one locale file per tool call. **45-min hard limit, push after every commit** (autopilot token lives 60 min). Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (must include this file). Read `HANDOFF.md` Part 60 (follow-up batch A) and Part 58 ("DECIDED"), `docs/design.md`, `src/app/(public)/events/page.tsx`, the `events` and home-hero sections of `src/lib/i18n/dictionaries/en.ts` (`countNear*`, `showingCount*`, `emptyInCity`, `emptyCityYet`, `heroIssueTag`), and the existing events e2e specs.

## 1. Events: zero-count eyebrow (BUG-2610-020 regression)
- With 0 results the page still shows "Showing 0 events". When the count is 0, render no count line at all; the empty state carries the message.
- Find why the BUG-2610-020 fix stopped applying (it was built in `504bc73`) and say so in the status file.

## 2. Events: one count, not two
- Today the page shows both "{n} events happening near you" and "Showing {n} events". Keep **one** count line. Use the "near you" form only when a city filter is actually applied; otherwise the plain "Showing {n} events" form.

## 3. Events: "near you" after Show all cities
- After "Show all cities" the copy must not say "near you". Covered by item 2's rule; add an explicit test.

## 4. Past tab empty copy
- Upcoming empty says "No shows in {city} yet"; Past empty says "No events in {city}". Past should read **"No past shows in {city}"**. New key, all 12 locales, translated (not English copies; `scripts/i18n-untranslated.test.ts` must pass). Remove `emptyInCity` only if nothing else uses it.

## 5. Home hero: live city count (Hitesh decision, 14 Oct)
- Replace the hard-coded "Live, right now — six cities and counting" (`heroIssueTag`).
- Count the cities with at least one upcoming APPROVED event, computed server-side and cached for a few minutes (`revalidate` or the app's existing cache helper; no client fetch).
  - 2 or more cities: **"Live, right now — {n} cities and counting"** with digits.
  - Exactly 1 city: **"Live, right now in {city}"**.
  - 0 cities: hide the tag.
- New keys for the three forms, all 12 locales, translated, with digits as digits in every locale.
- Count only events whose city is a real listed city (no null or blank city).

## Tests (T1)
- e2e (`@needs-db` where data-dependent): 0 results show no "Showing 0" line; exactly one count line; no "near you" after Show all cities; Past empty copy.
- Unit test for the hero tag rule (0/1/2+ cities → hidden / "in {city}" / "{n} cities"), separate from the data query.
- Screenshots at 390 + 1440 for the events page and home hero; update baselines that change and list them.
- Each regression must fail on `origin/qa` and pass on the branch (show both).

## Finish
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.
- Status file `cc-autopilot-status.md` (T7) with a Human check for Hitesh, phone: home hero city count reads right; Events page Upcoming and Past in Pune, then "Show all cities"; check one Indic locale.
- Do not touch the Feedback table. No seed or data changes.
