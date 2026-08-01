# Artist Reputation & Audience Engagement System — Design Summary (pending approval)

Session 52 discussion, AforAudience. This covers everything agreed on across the thread — for your read + approve before any schema/build work starts.

---

## 1. Reputation Tier (profile-level badge, slow-moving)

Purpose: a trust signal for organisers deciding who to book, and for audiences deciding who to see. Not self-declared, not follower-count-based.

**Inputs (weighted, exact formula TBD once we see real data volume):**
- Completed-gig count (Performance rows, not cancelled)
- Average Review rating, all-time
- Verified Attendees + Repeat Attendees count (see §3) — weighted **higher** than star rating, since repeat real-money attendance is a stronger authenticity signal than a single star rating
- Organiser rating (private input — see §2)
- No unexplained cancellations (existing cancellation data)

**Rules:**
- Recomputed periodically (batch), not live on every profile load
- Tier itself is public (badge on profile); the underlying organiser-rating input is never shown publicly (see §2)

**Suggested tier ladder** (names open to change):
- New/Emerging — default, no badge
- Rising — automatic, based on gig count + rating threshold
- Featured — organiser/admin manually vouches
- Celebrity/Headliner — admin-only tag

**Explicitly rejected:** self-declared "influencer" tags, public leaderboard/ranking (cuts against "never tax the scene" — don't gamify who gets stage time).

---

## 2. Organiser Rating (new schema — the one genuine gap)

- Does **not** exist in the schema today. Needs a new model (e.g. `OrganiserArtistRating`) — the only piece of this whole design that's pure net-new data, not just querying what's already there.
- **Never displayed publicly** — raw score and any comment stay private. Feeds the Reputation Tier calculation only. Artist can see their own; public/audience never sees the number or text.
- Reasoning: a public negative organiser rating on a named artist, with no dispute/appeal flow, is a defamation/dispute risk we don't need to take on.
- Minimum sample size required before an organiser rating counts toward tier (protects against one bad-faith rating swinging things).

---

## 3. Verified Attendees / Repeat Attendees (public, on profile)

Replaces the original "gate Follow behind attendance" idea — kept `Follow` exactly as-is, unchanged, no new NOTIFY/FOLLOWER split needed.

- **Verified Attendees** = distinct audience accounts with a checked-in booking (`Booking.checkedInAt`) at any event this artist performed at
- **Repeat Attendees** = subset of the above who've done it 2+ times, across different events
- **Counted by distinct user, not by seat** — a 4-seat group booking = 1 verified attendee, not 4. Otherwise group bookings inflate the number and it stops being an authentic signal.
- **Show raw counts, not percentages/ratios**, at least until volume is real — a ratio on small numbers reads as broken or manipulated. Counts always read fine.
- **Known technical limitation, accepted as-is for now:** check-in is tracked at the *event/booking* level, not per-artist-slot or per-person. Someone who attended for the headliner and left before the opener still counts as a "verified attendee" of the opener, and a 4-seat group booking checked in by one person only produces one verified attendee, not four. Naming it "Verified Attendees" (not "Watched") is deliberately honest about this. **This limitation is directly addressed by Phase 2 of §7 (companion tagging + per-seat check-in)** — until that lands, treat these counts as a reasonable floor, not an exact figure.

---

## 4. Hype Score (per-show, fast-moving)

- Definition (yours, confirmed): average rating of Reviews submitted **within 2 hours of that specific show's end time**
- Measures immediate emotional reaction/buzz — a different thing from Reputation Tier's long-run average rating
- **Minimum threshold before it's shown**: ~5 reviews. Below that, show "Not enough ratings yet" rather than a misleading number from 1–2 reviews.
- Displayed per-event/per-performance, not on the artist's overall profile.

**Separately, not folded into Hype Score:** a plain **response-rate** metric (% of checked-in audience who ever left a rating for that show, no time limit) — this measures engagement volume, a different thing from immediate-reaction speed. Both can exist as separate, clearly-labeled numbers rather than one blended metric.

*(Rejected: the original "24hrs from show start" window — anchoring to start time instead of end time captures ratings submitted mid-show through ~22hrs post-show, which conflates two different signals. Anchoring to show end time for both Hype Score and response-rate is the fix.)*

---

## 5. Post-show rating prompt (drives all of the above)

- **Trigger timing:** fires once the event's date/startTime + expected duration has passed — ideally within the same 2-hour window Hype Score reads from. Uses existing web-push/VAPID infra, no new push infrastructure needed — just a scheduled trigger (or check-on-next-app-open).
- **Audience:** checked-in attendees only. Naturally excludes no-shows/refunds.
- **What's asked, for multi-act lineups:**
  1. Default/required-feeling prompt: rate the show overall (general event-level Review, `performanceId` null — schema already supports this)
  2. Optional secondary: "want to rate any specific performers?" — shows the lineup, not required, not re-nagged if skipped
  - Reasoning: avoids forcing a rating on an artist someone didn't actually watch, which would undermine the authenticity this whole system is built on.
- **Frequency:** one push per event. If no action, at most one passive in-app banner reminder next open — no second push. Repeat pestering risks eroding trust in the push channel generally (booking confirms, waitlist promotions, etc.).
- **Open question — not yet decided, needs your call:** voluntary only, or a small non-monetary nudge (e.g. early access to that artist's next drop) to lift response rates? Recommend against anything monetary, given no-commission philosophy.

---

## 6. Audience Voting for Competition Winners ("Audience Choice")

New idea, ties into the Competition Show feature already shipped (PR #300).

**Scoped to Competition Show events only** (`isCompetitionShow: true`), not available more broadly — ranking is inherently competitive framing, and applying it to a normal lineup that was never meant to be adversarial would gamify stage time the same way a public artist leaderboard would (already rejected in §1).

- **Timing:** voting opens once the show *ends* (not "on event start" — you can't meaningfully rank 1st/2nd/3rd until everyone's performed). Auto-closes after a fixed window — reusing the same 2-hour post-show window as Hype Score (§4), for consistency across the whole system.
- **Three voter categories, each with their own ballot:** Audience, Panelist, Celebrity. Each ranks their top 3 performers (1st/2nd/3rd) from their own AFA account.
- **Eligibility:**
  - Audience: checked-in attendees only. Given the per-booking check-in limitation (§3), a group booking currently yields **one vote for the whole booking**, not one per person — the same gap §7 (Phase 2) is built to close.
  - Panelist / Celebrity: must have an AFA account **and** have accepted their invite for this specific event — see §8. Unclaimed/unaccepted entries simply don't get a ballot.
- **Counting method — Borda count within each category:** 3/2/1 points for 1st/2nd/3rd picks, summed within that category, then **normalized to a common 0–100 scale per category** before blending — so a category with 5 panelists and one with 200 audience members both contribute a comparable signal, not a raw-count-skewed one.
- **Organiser-set weighting across categories** (e.g. Audience 70% / Panelist 20% / Celebrity 10%), with two guardrails:
  - **Audience weight floor (~50% minimum)** — otherwise the feature stops being genuinely "Audience Choice" and becomes a panelist decision with extra steps, undermining its own premise.
  - **Automatic redistribution when a category is empty** — most events won't have a celebrity attending; if that category has zero eligible voters, its allotted weight folds back proportionally into the categories that do, rather than 10% of the result silently going to nobody.
- **Results are public immediately on close** — raw vote tallies shown per category, not just a blended final number. That's what "nothing hidden" means in practice.
- **Relationship to the existing Panelist-declares-winner flow (PR #300):** kept as a **separate, parallel result**, not a replacement. Displayed as two distinct results side by side: **"Panelist Decision"** (the organiser/panelist's own call, as already built) and **"Audience Choice"** (this new weighted vote). Avoids an awkward tie-break scenario where the two disagree and one has to override the other.
- **New schema needed:** a vote-record model (e.g. `CompetitionVote`: voterId — bookingId for audience, userId for panelist/celebrity, category, eventId, ranked performanceId, rank 1–3) — net-new, doesn't exist today.

---

## 7. Companion Tagging at Checkout

New idea — directly fixes the per-booking check-in limitation flagged in §3 and §6, so it's worth sequencing early even though it touches more than just checkout.

**Phase 1 — capture companion identities at checkout (schema + UI only):**
- Optional, skippable, per extra seat on a multi-seat booking: "Add a companion's AFA account?"
- Implemented as **lookup-and-confirm** (search by phone/email, show the matched name back to the buyer before attaching) — not free-typing an AFA ID, to avoid silently attaching a stranger's account by mistake.
- **Consent required from the companion, not just the buyer** — this connects to the existing backlog item ("Take consent from user while booking ticket," Feedback `cms3jym9100ax04jy7gvqw1uc`). Attaching someone else's identity to a purchase without their own opt-in is the same category of problem that consent item already flags — build these together, not separately.
- At the end of Phase 1: better guest-list data captured, but check-in is still per-booking, so Verified Attendees/voting are **not yet** affected.

**Phase 2 — check-in becomes per-seat/per-person (the real unlock):**
- Door check-in flow changes from "this booking arrived" (one scan, one timestamp) to "these specific people arrived" (confirm which named companions are present).
- This is what actually fixes the undercounting in §3 and the one-vote-per-group problem in §6, and additionally unlocks individual Hype Score ratings per attendee rather than per booking.
- This is a real change to the venue-side check-in UI/flow, not a checkout-only tweak — flagging it now so it isn't scoped as a small addition later.

**Recommended sequencing:** Phase 1 can ship independently and adds value on its own (better data, consent-respecting). Phase 2 should be scoped as its own PR once Phase 1's data model is in place and stable.

---

## 8. Panelist & Celebrity Consent ("Accept-to-Appear")

New idea — closes a real gap in what's already shipped: today (PR #300) an organiser can add *any* name and upload *any* photo as Panelist or Celebrity Attending with zero verification from that person. Not public yet (still on `qa`, freeze in effect), but needs closing before publish — naming a real person as attending an event without their consent is a live reputational/legal exposure once this ships.

**Flow:**
1. Organiser looks up the panelist/celebrity by phone/email (same lookup pattern as §7's companion tagging) and sends an invite
2. Status starts **PENDING** — visible only to the organiser in their own dashboard while building the event, never on the public page
3. Person accepts or declines from their own AFA account
4. **Only ACCEPTED entries appear on the public poster/event page** — presence on the poster *is* the proof of consent, nothing else needed

**Refinements:**
- **Name/photo pulled from the person's own AFA profile once accepted**, not from organiser-typed text — so an organiser can invite someone, but can't put words or an image in their mouth that the person didn't put there themselves
- **Per-event consent, not standing consent** — accepting for one event doesn't carry over to a future one; each event sends its own invite
- **Decline/no-response** notifies the organiser so they can find someone else or quietly remove the pending entry before publishing — no poster slot sits empty-but-claimed
- **This satisfies §6's "must have an account" thumb rule for free** — acceptance requires logging into an AFA account, so poster visibility and voting eligibility both key off the same ACCEPTED status; one mechanism does both jobs

**Schema decision needed:**
- `EventPanelist` already has room to add `status` (PENDING/ACCEPTED/DECLINED) + `userId` cleanly
- `Celebrity` today is just two scalar strings on `Event` (`celebrityAttendingName`/`celebrityPhotoUrl`), not its own row. **Open question for you:** promote it to its own small model mirroring `EventPanelist` (adds status/userId the same way, and opens the door to multiple celebrities per event later), or keep it singular and just bolt on the two new fields to the existing scalars?

---

1. Exact Reputation Tier weighting formula (needs real data volume to calibrate — can't finalize on zero data)
2. Incentive or no incentive on the rating prompt (§5)
3. Live-computed vs. cached/periodically-recomputed for Verified/Repeat Attendee counts and Tier (same architectural choice applies to both — decide once, reuse)
4. Naming — "Reputation Tier," "Hype Score," "Verified Attendees," "Audience Choice" are working names, open to change before anything ships publicly
5. Whether Phase 2 of §7 (per-seat check-in) is in scope for this build at all, or deferred as its own later project — it's the biggest single piece of new surface area in this whole doc
6. Exact Audience/Panelist/Celebrity default weighting (70/20/10 used as your example) — confirm as the actual default or adjust
7. Whether Celebrity gets promoted to its own model (§8) or stays as scalar fields on Event with two new columns bolted on

## Suggested build order (once approved)

1. `OrganiserArtistRating` schema + migration (the one real net-new piece from §2)
2. Post-show rating prompt (push trigger + prompt UI, §5) — everything else depends on ratings actually coming in
3. Verified/Repeat Attendee counts (pure query against existing `Booking`/`Performance` data — no new schema, §3) — with the known undercounting caveat until §7 Phase 2 lands
4. Hype Score display (depends on #2 generating real data, §4)
5. Companion tagging at checkout, Phase 1 only (§7) — schema + consent-gated UI, no check-in change yet
6. Reputation Tier badge (depends on #1, #2, #3 all having real data to weight, §1)
7. Panelist & Celebrity Accept-to-Appear (§8) — must land **before** #8 below, since voting eligibility depends on it
8. `CompetitionVote` schema + weighted Audience/Panelist/Celebrity voting flow (§6) — reuses the same post-show timing window as #2/#4
9. Companion tagging Phase 2 — per-seat check-in (§7) — largest single change, own dedicated build once everything above is stable
