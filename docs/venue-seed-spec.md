# Venue Seed Spec (10 venues per Venue Owner)

Companion to `docs/load-test-user-seed-spec.md`. Separate, additive script — does NOT
touch existing Users, Artists, or the 12 pre-existing Venues. Layers new rows on top.

Decided with Hitesh, session 62 (1 Aug), chat only — hand this spec to Claude Code
(local repo) to build. Do not use Copilot for any part of this (standing rule, session 60/61).

## Scope

Two-step script:
1. Backfill missing `VenueOwner` profile rows for the 100 load-test `User` rows
   (`role: VENUE_OWNER`) that have no `VenueOwner` yet — confirmed gap, session 62
   (113 Users at this role, only 13 `VenueOwner` rows exist).
2. Create Venues so every `VenueOwner` (all ~113, after step 1) ends up with exactly
   10 Venues.

## Step 1 — VenueOwner backfill

- For every `User` with `role: VENUE_OWNER` and no existing `VenueOwner` row
  (`userId` unique, check before insert): create one, `isApproved: true`.
- Additive/idempotent — safe to re-run, skips Users that already have a row.

## Step 2 — Venue generation rules (from Hitesh, session 62)

- **Exactly 10 Venues per VenueOwner.** Additive/idempotent — if an owner already has
  N Venues (e.g. the 13 original owners' 1 each from base seed), top up to 10 rather
  than duplicating or reducing.
- **Capacity:** random integer 100–1000 per venue.
- **Photo required:** every Venue gets a non-empty `photos` array. Per Hitesh's call
  this session — placeholder image URLs, not a real upload (Lorem Picsum deterministic
  seed URL keyed to the venue's id/slug, e.g. `https://picsum.photos/seed/{venueId}/1200/800`
  — stable per venue, no API key, no license/copyright concern for internal QA data).
- **3 "types" per owner, city-scoped:**
  - `GA` → `seatingMode: GENERAL_ADMISSION`
  - `Numbered (Guided)` → `seatingMode: NUMBERED`, seats generated via the existing
    grid-generator path (rows × columns)
  - `Manual Canvas` → `seatingMode: NUMBERED`, seats generated via organic/irregular
    x,y placement (not a perfect grid) — mirrors the real Manual Canvas builder's
    output shape, not the grid one. **Note:** schema only has two `VenueSeatingMode`
    values (`GENERAL_ADMISSION`/`NUMBERED`) — "Manual Canvas" vs "Guided" is a
    generation-method distinction for seed realism only, not a stored field. Worth a
    one-line code comment in the script so a future reader doesn't go looking for a
    third enum value.
  - A single city for one owner may never repeat the same type twice, and every city
    used gets a minimum of 2, maximum of 3 venues (types can't repeat within a city, so
    3 is the hard ceiling).
- **Deterministic per-owner city/type layout** (reaches exactly 10, satisfies all of
  the above — this is my proposed default, flag if you want a different split):

  | City # | Types present | Count |
  |--------|---------------------------------|-------|
  | 1      | GA + Numbered(Guided) + Canvas   | 3     |
  | 2      | GA + Numbered(Guided) + Canvas   | 3     |
  | 3      | GA + Numbered(Guided)            | 2     |
  | 4      | GA + Canvas                      | 2     |

  → 4 distinct cities per owner, 10 venues total, no type repeats within a city.

- **City pool** (Pune-first, per product philosophy), cycled deterministically per
  owner index so re-runs are reproducible: Pune, Mumbai, Bengaluru, Delhi, Hyderabad,
  Chennai, Kolkata, Ahmedabad, Jaipur, Nagpur, Indore, Chandigarh. Cities **do**
  repeat across different owners (that's fine/expected) — only "not twice for the
  same owner" is the actual rule.
- **Naming:** `{OwnerName} — {City} {Type} Venue` (e.g.
  `VenueOwner00000005 — Pune GA Venue`) — greppable/deterministic, matches the
  load-test naming philosophy.
- **Seats for NUMBERED venues:** generate real `Seat` rows summing to ~the venue's
  capacity, using the existing `defaultZoneName()` helper (Front → Middle → Back →
  Recliner → Zone N, per design.md §9.5) for zone labels. Reuse whatever internal
  helper/logic the real Guided Setup and Manual Canvas builders already use for shape
  generation, if one is exposed/importable — don't hand-roll a divergent algorithm the
  app doesn't otherwise produce.
- **Not specified by Hitesh, my default (flag to override):** `rateType: HOURLY`,
  `hourlyRate` scaled loosely to capacity (e.g. ₹500 + capacity × 2), `minDurationHours: 2`,
  `isApproved: true`. Needed for the venue to be usable elsewhere in the app (booking
  flow expects a rate); left unset otherwise the venues would be half-configured.
  Address/state/country/lat/lng left null (no real Places API resolution needed for
  seed data) — `city` alone populated.

## Guards (carry over from existing seed scripts)

- Hard-block anything but QA project ref (`nqiyrypmjtogoocerxtu`); never prod
  (`cncumfwwnjcwacggrgsr`).
- Never touch `Feedback`/`FeedbackChangeLog`.
- No DELETE/TRUNCATE — additive only.
- git fetch/status/reset --hard origin/qa before running, per standing checklist.
- ~1130 Venues + ~thousands of Seat rows across NUMBERED venues is a real volume —
  show a row-count/sample preview and get explicit go-ahead before the first real run,
  same as the load-test user script.
- Route to Claude Code only, never Copilot.
- After running, verify independently against Supabase QA DB (via chat) — don't trust
  only the script's self-reported summary.
