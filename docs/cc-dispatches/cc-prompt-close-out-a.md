# CC dispatch A: close-out (goal proof as a test, BUG-2610-006/007, test-infra fixes)

> **New branch `fix/close-out-a` off `origin/qa`.** One commit per part. Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.** This may run unattended on the CC autopilot (GitHub runner): no questions possible, and "stop and report" means write it in the handoff and status file.

**Start:** `git fetch && git reset --hard origin/qa`. **Base must be `3c44fb6` or later; if older, stop (stale checkout).** Read `docs/testing-rules.md` (always applies, in full: the e2e gate is live), `HANDOFF.md` part 42, `e2e/README.md`, `e2e/helpers/*`.

QA only. No DB schema change. QA personas from `e2e/helpers/personas.ts`.

## 1. The central-control goal proof as a permanent test
Today the goal (GEN-2609-114/118/119/121, BUG-2609-055) waits on Hitesh doing a manual edit-check-revert. Under Testing Rule T4 a machine does this.
- **Temporary admin, per run, no stored credential.** The only ADMIN on QA is Hitesh's real account: **never use it, never read or change it.** In `global-setup` (only when `E2E_DATABASE_URL` is set, and only if the DB host is the QA project, so it guards against anything else), create `e2e.admin.<run-id>@example.com` with role ADMIN and a random password generated in memory (bcrypt-hashed the same way the app does; read `src/lib/auth*`), log in once, and save its `storageState`. In global teardown, delete that user (and anything it created) using the existing cleanup helpers. The password is never written to disk, logs or the repo. Tag specs that need it `@needs-db`.
- **Spec `e2e/design-system-goal.spec.ts`:**
  1. Record the current value of `--afa-selected` (via `GET /api/admin/design-tokens`).
  2. As the temp admin, change it through the **Admin → Design System UI** (`/dashboard/admin/design-system`) to an obvious test value, and save.
  3. With **no redeploy**, as a signed-out visitor and as Atul, assert the new value is the computed `--afa-selected` on `/`, `/events/` and `/venues/`, and on a visibly affected element (the active nav item).
  4. Downloads and metadata: `/manifest.webmanifest` (or the manifest route) and the browser `theme-color` follow their token if one is mapped; check one share poster route and the ticket PDF/email render route if a test-safe endpoint exists. Read #721 (GEN-2609-119) for which tokens each follows; **assert only what's actually mapped**, and list it.
  5. **Revert** to the recorded value in `finally`. Teardown also restores it straight in the DB as a last resort, using the value recorded at the start, then calls the revalidate route as the admin.
  - Never touch locked tokens (`LOCKED_TOKEN_KEYS`), and never use `confirmLocked`.
- **Admin Settings Save check:** at 390 × 844 and at 1440, on `/dashboard/admin/settings`, the Save button(s) are visible, not covered (e.g. by the tab bar or chat bubble: check `elementFromPoint` at the button's centre) and clickable. Don't change real settings; if a no-op save is safe (same values), do it and assert success, else assert enabled state only, and say which.
- Both run in `e2e.yml` (QA, nightly) and `e2e-preview`.

## 2. BUG-2610-006: Competition badge missing on listing cards
`EventCard.tsx` still has `isCompetitionShow` and the `competitionBadge` string, but nothing renders it since #514. Find where listing cards are built (`/events`, home rails, venue and artist pages), pass the flag through, and render a token-styled badge. Un-`fixme` `competition-show.spec.ts` "listing card shows the Competition badge" and put the ticket ID in its title. It must fail on `origin/qa` and pass on the branch (T1).

## 3. BUG-2610-007: clearing the `/events` search leaves `?search=` in the address
**Lead to check first:** `next.config` has `trailingSlash: true`, so the canonical page is `/events/`. The #722 fix calls `router.replace("/events")`. After a hard load of `/events/?search=x`, a navigation to `/events` (no slash) may be normalised to the current route and dropped. Try `router.replace(pathname)` / `"/events/"` (or remove only the `search` param from the current URL), and check the Events nav link's `href` too. Confirm the real cause on a production build (`next build && next start`), not the dev server, since that's where it differed. Un-`fixme` the test, ticket ID in the title, red on `origin/qa`, green on the branch.

## 4. Test-infra fixes
- **Preview/QA overlap (pt42):** `e2e-preview.yml` skips only when the commit is the tip of `qa`. Make it skip when the commit is **contained in `qa`** (`git merge-base --is-ancestor <sha> origin/qa` after a full fetch), so a merge commit that's no longer the tip isn't tested twice at once on shared fixtures.
- **Leftover test accounts:** delete the `e2e.*@example.com` users in QA that no current run owns (9 as of 3 Oct), using `deleteRegisteredTestUsers` (not raw SQL) in a one-off script run once; commit the script only if it's reusable, under `scripts/dev/`. Report the count before and after. **Never** delete `e2e.fixture.organiser@example.com` or any `@aforaudience.qa` persona.
- **Flaky watch:** if `language-rollout.spec.ts:131` or `competition-show.spec.ts:99` flake again in your runs, fix the cause if you can find it; otherwise leave them and report.

## Verify
- The full suite, twice, against QA (and the preview if you can), with the new specs. Report the duration.
- Show the goal test going red: temporarily make the assertion expect the old colour, see it fail with a readable annotation, and drop that change before pushing.
- tsc; `next build`; checker and ratchet unchanged; unit self-tests.

## Handoff (T7, delta-only)
Compare link; base; commits; tests added (file and name, one line each); red-on-qa/green-on-branch evidence for 006, 007 and the goal test; CI result on the pushed head; the list of what the goal test asserts (pages, manifest, posters, PDF/email) and what it couldn't; accounts deleted (count); any quarantines with tickets. **Human check** list: expected to be just "glance at the Competition badge's look on a phone", or say so if otherwise.
