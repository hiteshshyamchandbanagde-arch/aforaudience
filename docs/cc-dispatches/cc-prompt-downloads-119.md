# CC dispatch: GEN-2609-119, downloads follow admin colour edits (last central-control goal ticket), plus #720 follow-ups

> **New branch `feat/downloads-119` off `origin/qa`.** One commit per lettered part. Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:**
- `git fetch && git reset --hard origin/qa`. It must contain #720 (`6e220fa`) and the commit carrying this file. **If older, stop: stale checkout.**
- Read `HANDOFF.md` parts 33-34, `docs/design.md` "Decisions 29 Sep" (GEN-2609-119) and "Decisions 2 Oct", and the Feedback message GEN-2609-119 (QA DB).

**Goal (Hitesh, 29 Sep):** what users receive or download follows admin colour edits: share posters, emails, the ticket PDF, the PWA manifest and the theme colour. **Logo colours stay fixed by design.** Everything here is server-rendered, so it can read resolved DesignToken values at render time. `var()` can't work in any of these surfaces (ImageResponse/satori, email clients, pdf-lib, the manifest JSON, the meta tag).

## A. One resolver
In `src/lib/design-tokens.server.ts`, add:
- **`resolveDesignColor(key)`**: takes the DB rows from `getDesignTokensSafe()`, falls back to `DEFAULT_TOKEN_VALUES`, and follows `var(--x)` chains (cycle-safe, max depth) to a concrete `#hex` / `rgb()` / `rgba()`.
- **`resolveDesignColors(keys)`**: the same for a batch, with one token read.
- **`toPdfRgb(value)`**: returns pdf-lib `rgb(0..1)` plus a separate opacity.
- **Self-tests:** chain resolution, cycle, unknown key → default, rgba parsing, `toPdfRgb`.
- **Caching:** the existing tag plus the 300s revalidate is already the freshness contract; reuse it, don't add a cache.

## B. Share posters
`src/app/api/posters/organiser/[eventId]/route.tsx` (26 hex) and `.../artist/[performanceId]/route.tsx` (25 hex):
- Map every literal to its token, e.g. page surface, primary text, muted text, `--afa-fill-solid`, `--afa-amber`, tints. Resolve once per request.
- **Logo/wordmark colours stay literal**, each marked `// token-ok(hex-color-literal): logo, fixed by design`. List them in the handoff.
- **Response caching:** check the poster responses' `Cache-Control`. An admin edit must show on the next poster request within the token revalidate window, not after a long CDN max-age.

## C. Transactional email (`src/lib/email.ts`, 16 hex)
- Resolve colours at send time and inline concrete values; email clients don't support `var()`.
- Keep a single `emailColors()` helper rather than threading values through every template.

## D. Ticket PDF (`src/lib/ticket-pdf.ts`, 7 `rgb()`)
- Use `toPdfRgb(resolveDesignColor(...))`.
- The QR stays pure black on white for scannability; mark it `token-ok` with that reason.

## E. PWA manifest and theme colour
- **`src/app/manifest.ts`:** make it async and read `theme_color` from `--afa-fill-solid`.
- **`background_color`:** use `--afa-surface-page` instead of the legacy cream `#F7F3EE`. Decided 2 Oct by chat under Hitesh's delegation: the app is dark, so the splash should be too.
- **`layout.tsx` `themeColor`** (L280, currently a literal with a token-ok comment): move it to an async `generateViewport` reading the same token, so the meta tag and manifest can't drift.
- **Note:** installed PWAs cache the manifest; that's browser behaviour, so don't try to defeat it.

## F. Exemptions
- After B-E, remove each file from the checker/ratchet exemption list wherever it is now clean, apart from the `token-ok` lines.
- Keep `email.ts` on the codemod's never-rewrite list, so the codemod still doesn't turn its values into `var()`.

## G. #720 follow-ups (decided 2 Oct by chat under Hitesh's delegation)
1. **Organiser and venue "+ Follow"** → outline, as on the artist profile.
2. **Profile role-application CTAs** ("Become an Artist", the "Apply" buttons) → outline. The profile's one primary is a card Save while that card is dirty.
3. **On-states:** the lineup "★ Featured" toggle and the hero carousel's active dot → `--afa-selected*`, since they're on-states. **Rating stars stay `--afa-amber`**: they're data, not a selection.
4. **`src/lib/design-token-meta.ts`:**
   - Update `usedFor` for `--afa-selected` / `-bg` / `-border`, to cover the nav active tab, sidebar link, drawer row and calendar selected day.
   - Re-check `--afa-scrim`, `--afa-sage-bright` and `--afa-fill-solid` (it now also drives the manifest, theme colour, posters and emails).
   - Update `afa-design-tokens-reference.md` to match. (#720's CC couldn't read these.)

## H. Seed hygiene (from BUG-2608-050 notes)
- The QA seed must set `country: 'India', state: 'Maharashtra'` on `qa-demo-venue-omkar-1` and `qa-demo-venue-partial-1`. Chat fixed the rows by hand on 2 Oct; without this, a reseed brings the duplicate "Pune" city back.
- The seed and e2e helper set `qa-jaipur-event-0001`'s date relative to the run (now + 30 days). It's the only numbered-venue event; chat moved it by hand to 14 Nov.
- **Don't reseed QA in this ticket.** Hitesh holds a real CONFIRMED booking on Jaipur (F5-F8, AFA-DGHJ-PFFM). Change the scripts only.

## Verify (the goal check)
**Admin round-trip on downloads:**
- In QA, set `--afa-fill-solid` and `--afa-surface-page` to obvious test colours (e.g. via a direct QA `DesignToken` update, then the admin "Refresh site cache").
- Capture all of these:
  - an organiser poster PNG and an artist poster PNG;
  - a rendered booking-confirmation email HTML: **render to a file, do not send**;
  - a ticket PDF for AFA-DGHJ-PFFM, rendered locally, **not emailed**;
  - `/manifest.webmanifest`;
  - the `theme-color` meta.
- All of them should show the test colours; logos unchanged.
- **Revert both tokens to their exact previous values and confirm.** Live QA shares the DB, so keep the window short and note the times.

**Checks:**
- tsc, `next build` (`CIRCLE_NODE_TOTAL=3` locally is fine), checker vs `origin/qa`, ratchet at or below baseline everywhere, all self-tests including the new resolver tests, ESLint per-line diff, e2e smoke.
- Screenshots of G1-G3 at 390 and 1280.

## Handoff (delta-only)
- Compare link and commits.
- The logo literals kept.
- Before/after of each download with the test colours.
- The revert confirmation with times.
- The exemption-list changes.
- The poster `Cache-Control` finding.
- The G and H results.
