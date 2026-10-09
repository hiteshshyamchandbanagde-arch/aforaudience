# CC dispatch: UI/UX bundle 5 (BUG-2610-024, -025, -027, -028, -031)

> **New branch `fix/uiux-bundle-5` off `origin/qa`** (bundle 4 merged as #746). Push after EVERY commit. One commit per ticket, ticket ID in the message. Chat merges. Autopilot. Budget about 200 turns. Do not edit `.github/workflows/`. QA DB only, never production (`cncumfwwnjcwacggrgsr`). If origin/qa moves, rebase, never merge. Run the specs you add or touch locally before each push.

**FIRST ACTION:** status file `RESULT: PARTIAL fix/uiux-bundle-5 none`. Update it after each ticket. Read the FULL text of all five tickets in the QA Feedback table, plus `docs/testing-rules.md` and `docs/design.md` (bundles 3a/3b/4 sections are new). Order is priority.

1. **BUG-2610-028 LOW: page-title style across role dashboards.** Venue Owner page titles (Revenue Overview, Your Venues, Edit Your Profile, Venue Booking Requests) use plain sans; Organiser/Artist titles use the display serif; stat labels differ (mono vs sans bold). Pick the style design.md specifies for dashboard page titles (if it doesn't, use the Organiser/Artist one: display serif) and apply it through ONE shared PageTitle (or existing component), not per page. Stat-card labels the same way. "Change Photo" on Edit Your Profile: secondary variant, not CTA orange (orange is commit/payment only). Screenshots at 390 + 1440 for the touched dashboard pages.
2. **BUG-2610-025 LOW: emoji as icons.** Venue Past Requests uses the calendar emoji (Android renders "July 17" next to the real date) and a speech-bubble emoji on Message Organiser; use the app's icon set. Sweep `src/app/dashboard` and shared components for emoji used as icons and replace them; list what you changed. Money: use the shared formatter (₹37,417, never ₹37417) — sweep the same files.
3. **BUG-2610-027 LOW: money axis ticks.** Round "nice" ticks (₹0 ₹10K ₹20K ₹30K ₹40K, not 10K/19K/29K/38K) from one helper used by every money axis. Unit test the helper.
4. **BUG-2610-031 LOW: hero highlighted word overlap.** /venues in hi: "जहाँ शो होता है" — the gold italic "शो" has no space after it and its slant overlaps "होता". Fix the split so the space is outside the highlighted span and the italic overhang is allowed for, for every locale's hero strings on every page that uses the highlighted-word pattern.
5. **BUG-2610-024 LOW: offline fallback page.** Restyle to the dark surface and AFA fonts (tokens inlined at build, since the service worker serves it static); keep copy, Try again, and the My Tickets tip; translate if the page has a locale (else note it).

**Tests (T1):** regression checks at 390 and 1440 with baselines, ticket ID in titles, new copy in 12 locales, persona state restored (T6).

Status file: `RESULT: PUSHED fix/uiux-bundle-5 <sha>`, per ticket change + test (before/after), the emoji/money sweep list, e2e-preview result, and the **Human check** list.
