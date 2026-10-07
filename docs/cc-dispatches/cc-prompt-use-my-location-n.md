# CC dispatch N: "Use my location", nearest city with shows, and a travel prompt (GEN-2610-005)

> **New branch `feat/use-my-location-n` off `origin/qa`**, started after M. Push after every commit. Chat merges. Autopilot. Budget about 120 turns. Do not edit `.github/workflows/`. QA DB only, never production (`cncumfwwnjcwacggrgsr`).

**FIRST ACTION:** status file `RESULT: PARTIAL feat/use-my-location-n none`. Update it after each step. Read the full GEN-2610-005 text in the QA Feedback table, and also `src/lib/location.ts`, `src/app/api/user/location/route.ts`, `src/components/LocationChip.tsx`, `/api/venues/cities`, `docs/testing-rules.md` and `docs/design.md`.

Hitesh was in Mumbai. Context: the QA TWA and the installed PWA each keep their own cookies, so a guest's picked city doesn't carry across apps. Signed in, the account city does. That's expected; don't change it.
Hitesh was in Mumbai. AFA kept his saved city (Jaipur). Signed out, IP detection said **Pune**, because Indian mobile carriers resolve to their gateway city. Mumbai wasn't pickable, since the picker lists only cities with approved venues. **Decided by Hitesh (6 Oct):**

1. **"Use my location"** is the first row of the LocationChip picker. It calls `navigator.geolocation` only on that tap, never on page load. If permission is denied or the call errors, show a short message and keep the current city.
2. **Nearest city with shows.** Map the coordinates to the nearest city that has approved venues, using haversine distance on venue lat/lng. **No external geocoding API** (the Google keys are dead). Pune venues have null lat/lng, so add city centroids for every city that has an approved venue: either a small committed table in `src/lib`, or by backfilling venue lat/lng in `scripts/qa-seed.ts`. Explain which you chose and why.
   - Within about 50 km of a city that has venues, select that city. This behaves like a manual pick: it POSTs and uses the manual cookie.
   - Further away, say **"No shows near you yet. Nearest: {city}, {n} km"** with a button to switch.
3. **Travel prompt.** When a GPS fix from step 1, or a later tap, differs from the saved city, show "You seem to be in {city}. Switch?" Switch acts like a manual pick. **Not now** remembers that detected city, so the prompt doesn't come back for it. **Never overwrite a saved city automatically.** IP detection alone never triggers the prompt, because it's unreliable on Indian mobile networks.
4. **Label consistency:** a detected city and a picked city show in the same format. Today you get "PUNE" for one and "JAIPUR (IN)" for the other. Pick one format and apply it everywhere the chip renders.
5. **Top-bar squeeze (seen on Hitesh's phone, 7 Oct):** with "MUMBAI (IN)" showing, the 390-wide top bar shrank the search box to "Sea". Give the chip label a max width with an ellipsis, or drop "(IN)" on mobile only for Indian cities, so the search box keeps a usable minimum width. Add a 390 check using the longest current city label.
6. **Seed:** add `qa-mumbai-venue-0001` "Bandra Basement Stage" (Mumbai, owner `qa-demo-vo-full-role`, lat 19.0544, lng 72.8344, approved) to `scripts/qa-seed.ts`, matching the row chat inserted into QA on 7 Oct, so a reseed keeps it.

**Tests (T1):** stub geolocation with Playwright `context.setGeolocation` and permissions. Cover: in Pune, which selects Pune; in Bandra, which selects Mumbai; in Lonavala, which selects Pune with the distance message; permission denied, where the city stays unchanged; and the prompt appearing once, then staying away after Not now. Add a unit self-test for the nearest-city logic as `scripts/*.test.ts`. Check at 390 and 1440 with baselines. Put new copy in all 12 locales, with English fallbacks marked `// TODO i18n`.

Status file at the end: `RESULT: PUSHED feat/use-my-location-n <sha>`, the tests with before/after, the CI link, any TODO i18n strings, and the **Human check**: Hitesh taps "Use my location" on his phone in Mumbai and in Pune.
