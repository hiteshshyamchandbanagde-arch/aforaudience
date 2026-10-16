# CC dispatch: run F, QA seed data (Hitesh phone pass 13-14 Oct). Code only, NO DB writes.

> **New branch `fix/seed-f` off `origin/qa`.** Small chunks (AGENTS.md); push after every commit; 45-min hard limit. Push, write the status file, stop. Chat opens the PR and merges.
>
> **Hard rule for this run: do not write to any database.** No `prisma db seed`, no running `scripts/qa-seed.ts` against QA, no UPDATE/INSERT/DELETE through any client. Read-only SELECTs are fine. The QA row fixes are applied by chat later, only after Hitesh approves the exact rows (destructive-data rule: any User/Venue/Event/Booking change needs his OK on real samples).

**Start:** `git fetch && git reset --hard origin/qa` (must include this file). Read `HANDOFF.md` Part 60 (batch F), `docs/design.md`, `docs/qa-seed-script-spec.md`, `scripts/qa-seed.ts`, `e2e/helpers/roles.ts`.

## Findings (chat, read-only, 16 Oct)
- `Booking` `qa-demo-booking-full-atul-1`: CONFIRMED, `seats` = `{}` (no tier, no quantity), `createdAt` 2026-09-10 01:45 but `checkedInAt` 2026-09-06 01:45. Booked 4 days after check-in, which is impossible.
- `Event`: 3 of 30 rows have Latin placeholder ("lorem ipsum") descriptions.

## 1. Fix `scripts/qa-seed.ts` so a fresh seed can't produce this
- That booking (and any seeded booking) gets a real seat or tier selection matching how the app writes `seats` for a real booking (copy the shape from the booking API, don't invent one), and `createdAt` before `checkedInAt` and before the event date.
- Seeded event descriptions: realistic, short, India-first copy for each seeded event, in the platform's voice (`docs/design.md`); no Latin placeholder. Keep it to what the event is (comedy, theatre, music…), 2–3 sentences, no invented facts about real people.
- Add a unit self-test that runs the seed's data builders (not the DB) and asserts: every booking has a non-empty `seats` in the real shape, `createdAt < checkedInAt` where checked in, and no description matches `/lorem|ipsum|dolor sit|consectetur/i`.

## 2. Prepare the QA fix, don't apply it
- In the status file, list the 4 QA rows (that booking + the 3 events, found with a read-only SELECT) with their **current values** and the **exact proposed new values**, plus the exact SQL `UPDATE` statements (by id, one per row). Chat will show these to Hitesh and apply them only on his OK.

## Finish
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.
- Status file `cc-autopilot-status.md` (T7): what changed in the seed, the 4-row before/after table and SQL, and a Human check for Hitesh: Atul's past ticket shows a real seat/tier; the 3 events read naturally.
- Do not touch the Feedback table.
