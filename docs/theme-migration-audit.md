# Theme migration audit — remaining Theme Phase 0 tokens

Audit-only pass, no fixes applied. Grepped the whole `src/` tree (app routes,
`src/components/`, `src/lib/`) for every pattern listed in the brief, then
cross-checked hits against `docs/design.md`, `docs/afa-design-tokens-reference.md`,
and the QA Supabase `Feedback` table (project `nqiyrypmjtogoocerxtu`) so
already-tracked items aren't re-reported as new. Snapshot: qa @ `bc9cb21`
(post-#544, Wall of Fame merged).

## How to read this

- **Status** column: `NEW` = not tracked anywhere I could find; `TRACKED` =
  already has an open Feedback entry, confirmed still present in code;
  `TRACKED (drift)` = Feedback entry status doesn't match actual code state
  (usually DB lagging behind a real fix).
- Line numbers point at a representative sample, not every occurrence, for
  the large mechanical sweeps (`--afa-terracotta`, literal white
  backgrounds) — those are called out as file-level counts instead, same as
  how the original Phase 0/2b sweeps were tracked.
- Dashboard pages are evaluated only for token/background correctness, not
  corner radius — `12px` cards / `999px` pills are the dashboard family's
  own deliberate convention (`afa-design-tokens-reference.md` §7), not a bug.

---

## 1. New, high-priority — full pages still on the pre-dark-reskin design

These are the same bug class as Wall of Fame before PR #544 (white cards,
`--afa-plum-black`/`--afa-terracotta` gradient headers, 16px radius, emoji
hero icons) and aren't covered by any existing Feedback entry. GEN-2608-073/
074 covered the Artists/Venues *directory* pages — these are the sibling
Organisers/Venue-Owners directories and the post-event rating flow, which
never got the same pass.

| File | Old-theme pattern(s) | Type | Tracked? |
|---|---|---|---|
| `src/app/(public)/organisers/page.tsx` | `background: "white"` + `borderRadius: "16px"` card (L122-123), `--afa-plum-black` header block (L138), `--afa-terracotta` hero emphasis (L59) + spinner `borderTopColor` (L134) + section label | Full-page migration | **NEW** |
| `src/app/(public)/venue-owners/page.tsx` | Identical twin pattern: white card + 16px radius (L120-121), `--afa-plum-black` header (L136), `--afa-terracotta` hero/spinner (L56, L132), 🏛️ emoji hero icon (L92) | Full-page migration | **NEW** |
| `src/app/(public)/venue-owners/[id]/page.tsx` | `--afa-plum-black` hero band (L54), white cards (L74, L89), 🏛️ emoji (L40), `--afa-terracotta` back-link (L42) | Full-page migration | **NEW** |
| `src/app/(public)/events/[id]/rate/RatePromptClientPage.tsx` | White cards + 16px/12px radius (L149, L168, L191), `--afa-terracotta` buttons/links/text (L132, 158, 162, 194), ⭐ emoji star-rating buttons instead of the `★`/`☆` glyph convention used everywhere else (Wall of Fame's `stars()`, etc.) (L26, L204), 🎤 emoji hero icon (L128) | Full-page migration | **NEW** |

Note: `OrganisersGridEmbed.tsx`/`VenueOwnersGridEmbed.tsx` (the tab-embedded
grid versions used elsewhere, e.g. inside `/venues`) and `VenuesGridClient.tsx`
/`VenueFollowButton.tsx` (GEN-2608-074) are **already migrated** — only the
standalone `/organisers` and `/venue-owners` top-level pages were missed,
consistent with GEN-2608-048's note that search was added to "the actual
nav-reached embeds" but these standalone routes weren't revisited.

---

## 2. New — shared components with old tokens (highest blast radius)

Per the brief's own warning, these are the ones a page-level sweep misses
and that silently reintroduce the bug on every importer.

| File | Old-theme pattern(s) | Imported by / blast radius | Tracked? |
|---|---|---|---|
| `src/components/SiteNav.tsx` | `--afa-terracotta` on active nav-link color, notification badge dots (×5), locale-picker border/bg, mobile menu active state — L444, 501, 505, 510, 515, 606, 610, 713, 726, 755, 759, 764, 769 | **Every page in the app** (global nav) | **NEW** |
| `src/components/SupportWidget.tsx` | `--afa-terracotta` across chat bubble, icon fill, send button — L49, 513, 545, 561, 563, 596, 636, 828, 861 | Global (support/chat widget) | **NEW** |
| `src/app/globals.css:305` | `outline: 2px solid var(--afa-terracotta);` — sitewide default focus-ring color | Every focusable element, every page | **NEW** |
| `src/components/Toast.tsx:96` | `t.kind === 'error' ? 'var(--afa-terracotta)' : ...` — the border-left accent for error toasts still uses terracotta, while the adjacent `text` on the same line correctly uses `var(--afa-error)` | Global (toast notifications) | **TRACKED (drift)** — BUG-2608-097's *background* bug is fixed (confirmed: `bg`/`text` now use the correct translucent-on-dark tokens), but this one accent line was missed by that fix. DB still shows `NEW`, which is actually still accurate for this residual line. |
| `src/components/AuthPromptSheet.tsx` | `--afa-terracotta` CTA/border/links (L126, 156, 163); white input background (L147, likely fine — see §5) | Login-gate sheet, shown from multiple pages | **NEW** |
| `src/components/CorporateInquiryModal.tsx` | `--afa-terracotta` CTA buttons (L183, 200, 284) | Used from both artist and venue corporate-inquiry flows | **NEW** |
| `src/components/SeatPicker.tsx` | `--afa-terracotta` selected-seat legend/color (L350, 413); `--afa-cream-tint-1` zone-legend chip backgrounds (L263, 300) | Booking-critical, every Numbered-seat event page | **NEW** |
| `src/components/NotificationOptIn.tsx`, `PosterShareCard.tsx`, `NearYouTabs.tsx`, `TonightNearYou.tsx`, `ArtistsNearYou.tsx`, `ComingSoon.tsx`, `AudienceChoiceVoting.tsx`, `PhoneVerifyNudge.tsx`, `BackLink.tsx`, `DisplayNameNudge.tsx`, `EnvBadge.tsx`, `LegalDocLayout.tsx` | `--afa-terracotta` (accent/CTA color), several also literal white cards (`AudienceChoiceVoting.tsx` L99/170) or `--afa-cream-tint-2` (`LegalDocLayout.tsx` L36/96) | Homepage rails, QA ribbon, legal pages, various prompts | **NEW** (part of the same sweep, lower individual blast radius) |
| `src/app/organisers/[id]/OrganiserFollowButton.tsx`, `src/app/venues/[id]/VenueFollowButton.tsx`, `src/app/venues/VenuesGridClient.tsx` | Only reference `--afa-terracotta` inside a comment documenting that it was **already removed** | — | Not a hit — confirmed already migrated |
| `src/app/(public)/artists/[id]/ArtistProfileClientPage.tsx:524` | `{notifyEnabled ? "🔔" : "🔕"}` — still the raw emoji toggle | Artist profile (high-traffic page) | **NEW** — `VenueFollowButton.tsx`, `OrganiserFollowButton.tsx`, and `VenueIcons.tsx`'s `BellIcon`/`BellOffIcon` comments all say this exact emoji pattern was replaced with real icons elsewhere; this one call site was missed. Reuse `BellIcon`/`BellOffIcon` from `VenueIcons.tsx` rather than building new ones. |
| `src/components/NotificationOptIn.tsx:133` | Bare `🔔` | Notification opt-in prompt | **NEW**, same fix as above |

---

## 3. Already-tracked, confirmed still open (don't re-report, but not fixed either)

| Item | File(s) | Status confirmed |
|---|---|---|
| 5 white-card dashboard files (found during the admin/settings dark-shell fix, PR #542) | `dashboard/admin/diary/page.tsx` (L132, 163), `dashboard/artist/edit/page.tsx` (L296), `dashboard/artist/corporate-inquiries/page.tsx` (L109), `dashboard/organiser/events/[id]/edit/page.tsx` (L881, 938 — autocomplete dropdowns), `dashboard/admin/settings/page.tsx` (L545, 627, 696, 866, 944, 997) | **Confirmed still present**, all 6 occurrences in `admin/settings/page.tsx` alone. Left deliberately unfixed per the #542 handoff note — this audit found nothing new here beyond what's already logged. |
| `--afa-cream-tint-1`/`-2` in `SeatPicker.tsx`/`LegalDocLayout.tsx` | `SeatPicker.tsx:263,300`, `LegalDocLayout.tsx:36,96` | **Confirmed still present** — matches the brief's own known-item list exactly. |
| BUG-2608-096 "admin/settings has no dark shell at all" | `dashboard/admin/settings/page.tsx` | **TRACKED (drift)** — Feedback DB still shows `NEW`, but the code now has a correct `<main style={{ background: 'var(--afa-surface-raised)' }}>` wrapper (L496, L516). The shell itself is fixed; only the inner white-card residue above is still open. DB status should be updated to reflect this, but that's a bookkeeping note, not a code finding. |
| `--afa-terracotta` ~69-file sweep | See §6 appendix | **Confirmed still open**, 68 real hit-files found (72 raw grep matches minus `globals.css`'s own definition and 3 comment-only false positives) — consistent with the scale already known and logged. |

---

## 4. Dashboard pages — token-only findings (background/accent, not corner radius)

Per the reference doc, dashboards deliberately keep `12px`/`999px` rounded
corners — not flagged here. What *is* flagged: literal `--afa-terracotta`
still used as an accent color in ~25 dashboard files, where the documented
current pattern (`afa-design-tokens-reference.md` §5) uses
`var(--afa-gold)` on `rgba(201,151,58,0.15)` for exactly this kind of status
accent instead.

`dashboard/organiser/{tours,tours/create,tours/[id],payouts,page,events/create,events/[id]/edit,edit,events/[id]/sales,events/[id],events/[id]/lineup,events/[id]/checkin,sales}`, `dashboard/venue/[id]/{edit,sales}`, `dashboard/messages/page.tsx`, `dashboard/audience/page.tsx`, `dashboard/artist/{page,events,edit,corporate-inquiries}`, `dashboard/admin/{page,users,revenue,feedback,diary,artists,settings}`, `dashboard/artist/events/page.tsx` — all still reference `var(--afa-terracotta)` somewhere (buttons, links, active-state borders). Full line numbers in the terracotta sweep dump (§6).

**Separate, more substantive finding — not in the brief's checklist, flagging anyway:**
`var(--afa-gold)` (`#8A6A1F`, a muted brownish-gold designed as *text-on-cream*)
is used as **text color directly on `--afa-surface-raised`/`--afa-surface-page`**
dark backgrounds in ~20 dashboard files (e.g. `dashboard/organiser/page.tsx:139`,
`dashboard/admin/page.tsx:369`, `dashboard/artist/page.tsx:313`). This is the
documented *current* pattern per §5 of the tokens reference, but `#8A6A1F` on
`#1F1F1F` is a dark-on-dark pairing — the same contrast-bug shape as
BUG-2608-093 (Seat Map wizard dark-on-dark text), just not yet reported for
this token. Worth a real contrast check (WCAG small-text needs ~4.5:1) before
the next dashboard pass touches these files — this may need a brighter gold
value for dark surfaces rather than a straight token-name swap.

---

## 5. Not flagged — checked and ruled out

- **Form-input white backgrounds** (`AuthPromptSheet.tsx:147`, `CorporateInquiryModal.tsx:66`, `OrganisersGridEmbed.tsx:135`, `SearchBox.tsx:68`, login/register/reset-password input fields) — paired with `color: var(--afa-ink)` (dark text), a deliberate raised-white-input-on-dark-page pattern, not a Theme Phase 0 leftover. Not a hit.
- **The 4 auth pages** (`login`, `register`/`RegisterForm.tsx`, `reset-password`, `forgot-password`, `verify-email`) — literal `bg-white rounded-[16px]` card shells, confirmed present. **Explicitly already deferred** per BUG-2608-095: *"entirely still on the pre-dark-redesign light theme... not a token bug... a separate full-page redesign item."* Not re-reported as new; still open, just not in scope for a quick token swap.
- **`--afa-gold` in dashboard `STATUS_STYLE` maps** (Draft/Pending/Featured pills) — this is the *documented, current* dashboard pattern (tokens reference §5), not a legacy-token misuse. Flagged separately above only for the dark-on-dark contrast concern, not as an old-theme hit.
- **`EventCard.tsx`'s `TYPE_META` emoji map** — comment confirms this is deliberately kept for the homepage bento tiles (a separate, already-shipped project), not an oversight.
- **`app/page.tsx:59` (`borderRadius: "16px"` bento tile)** — background is `meta.color` (a themed dark fill), not a white/legacy card; this is the current homepage-bento convention (PR #543, 2 Sep), not a Theme Phase 0 leftover.
- **`GEN-2608-073`** (Feedback DB, status `NEW`) — title is "Artist directory cards read as too basic/ordinary," a visual-interest/design request (add photos, depth), not a token-migration bug. `/artists` itself (and `ArtistNoPhoto.tsx`) already reads correctly on the locked token system — confirmed via grep, no old tokens found there.
- **Bare `fontFamily: "monospace"`** — initial broad grep over-matched (58 files); the precise pattern found only **6 real hits**: `profile/page.tsx:458`, `ComingSoon.tsx:28`, `checkout/[bookingId]/page.tsx:440`, `admin/FeedbackDetailPanel.tsx:198`, `dashboard/organiser/payouts/page.tsx:122,169`. Small, cheap fix, not previously tracked. **NEW**, low priority.
- **`Georgia`** — zero hits in `src/` (the only file that ever used it, `wall-of-fame/page.tsx`, was migrated in PR #544). Confirmed clean.
- **`--afa-maroon-black`** — only real usage is `EventCard.tsx`'s `TYPE_META` (deliberately kept, see above) and `placeholder-image.ts`'s `MONOGRAM_TONES` array (a legitimate categorical color set, not a surface/text role — same reasoning `TIER_COLORS` was deliberately left alone in the Phase 2b sweep). Not a hit.

---

## 6. Appendix — full file list, `--afa-terracotta` sweep (already tracked, confirmed still open)

68 files confirmed (72 raw matches minus `globals.css`'s definition and 3
comment-only references in already-migrated files). Grouped by area; run
`grep -rn "\-\-afa-terracotta" src/` for exact line numbers per file — this
audit doesn't reproduce every line here since the sweep is a known,
already-logged item, not a new finding.

**Public-facing / auth:** `verify-phone/page.tsx`, `tickets/page.tsx`, `profile/page.tsx`, `checkout/[bookingId]/page.tsx`, `(public)/tours/[slug]/page.tsx`, `(auth)/{verify-email,reset-password,register/RegisterForm,login,forgot-password}`, `about/page.tsx`, `dev/razorpay-test/page.tsx` (dev-only)

**Shared components:** see §2 above (listed individually there since they're the higher-priority half of this sweep)

**Dashboard:** see §4 above

---

## Prioritized fix sequence (by user-visible surface area / import fan-out)

1. **`SiteNav.tsx`** — global nav, every page. Highest fan-out in the codebase.
2. **`globals.css:305`** focus-outline color — one line, affects every focusable element sitewide.
3. **`SupportWidget.tsx`** — global chat widget, second-highest fan-out.
4. **`Toast.tsx:96`** — one-line fix, global component, cheap.
5. **`src/app/(public)/organisers/page.tsx` + `venue-owners/page.tsx` + `venue-owners/[id]/page.tsx`** — same severity class as the just-shipped Wall of Fame fix (PR #544), same build-brief pattern would apply directly. Public discovery surfaces.
6. **`RatePromptClientPage.tsx`** — full page, post-event engagement flow.
7. **`ArtistProfileClientPage.tsx:524` + `NotificationOptIn.tsx:133`** bell emoji — cheap, reuses existing `BellIcon`/`BellOffIcon`.
8. **`AuthPromptSheet.tsx`, `CorporateInquiryModal.tsx`, `SeatPicker.tsx`** — shared components with real (if smaller) fan-out; `SeatPicker.tsx` is booking-critical.
9. Remaining shared components in §2 (homepage rails, nudges, `EnvBadge.tsx`, `LegalDocLayout.tsx`) — lower individual blast radius, batch together.
10. Dashboard `--afa-terracotta` accent sweep (§4/§6) — internal-facing, smaller audience; batch as one mechanical pass once the `--afa-gold` dark-on-dark contrast question (§4) is resolved, so both don't need two separate touches of the same files.
11. Bare `monospace` fontFamily (6 files, §5) — trivial, bundle into whichever pass touches those files next rather than a dedicated PR.
12. Auth-page full white shell (`login`/`register`/etc.) — deliberately deferred, not a quick fix; needs its own design pass, same bucket as the Artists-directory visual-interest request (GEN-2608-073).
