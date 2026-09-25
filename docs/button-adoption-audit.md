# Button adoption audit — GEN-2609-096 phase 1, step 2

Every raw `<button\b` site in `src/` (excluding `Button.tsx` itself), classified against `Button.tsx`'s 9 real variants. Read-only classification pass — no code changed in this doc's own commit.

**Method:** `git ls-files -- src` -> every `.tsx` file, line-scanned for `<button\b`. The same regex the `raw-button` ratchet rule itself uses (`check-design-tokens.js`) also matches literal text inside code comments that happen to mention `<button` — found 2 such false positives (`EventSaveButton.tsx:88`, `VenuePortalUI.tsx:426`, both prose explaining button behaviour, not real JSX). Real physical `<button>` element count: **209** (the ratchet's own live count is 211, 2 higher, for that reason — a pre-existing quirk in a regex this ticket didn't write and isn't in scope to fix here, flagged for awareness).

## Class counts

| Class | Count | Disposition |
|---|---|---|
| A — exact variant match | 0 | none found — every raw button's inline style deviates from a locked variant's shape in at least one property (padding/radius/font-size/colour-token). Consistent with Button.tsx's own history: its variants were themselves consolidated from real duplicate sites (GEN-2609-058/066/075/076/053), so what's left raw is the residue those passes already found didn't fit. |
| B — new variant, 3+ sites | 4 | 1 new variant: `link` (4 sites, byte-identical style, verified via grep before deciding) |
| C — icon-only | 43 | 1 new variant: `icon` |
| D — structural | 162 | 1 new variant: `bare` (reset-only, caller keeps its own styling) |
| E — exempt | 0 | none — no third-party markup or test fixtures found among raw buttons |
| **Total** | **209** | |

## Near-miss note: the 2-site "follow-cta" pair

`OrganiserFollowButton.tsx:73` and `VenueFollowButton.tsx:97` are byte-identical to each other (padding `10px 20px`, no border-radius set, `fontSize: var(--afa-text-ui)`, `fontWeight: 600`, follow/unfollow colour swap) but only 2 sites — below the 3-site threshold for a new variant, and no existing variant matches (none of the 9 have zero border-radius). Classified D per the dispatch's own rule ("map to nearest existing variant and note the visual delta" — there is no near variant close enough to avoid a visible corner-radius change, so both stay raw rather than force a visual regression).

## Proposed new variants

- **`link`** — the 4-site amber alt-action link (`width:100%, background:transparent, color:var(--afa-amber), padding:var(--afa-space-3), borderRadius:var(--afa-radius-md), fontSize:var(--afa-text-ui), fontWeight:500`). Login (3x) + RegisterForm (1x), all byte-identical.
- **`icon`** — square/circle hit-area, transparent background (ghost), `color: inherit`, sized via the existing `size` prop's number form (reusing `close`'s own diameter convention rather than inventing a second sizing mechanism). Covers all 43 Class-C sites: password show/hide, prev/next arrows, close/dismiss ×, notify-bell, zoom in/out, search/menu/language toggles, drag handle, save/bookmark toggle.
- **`bare`** — reset-only (`fontFamily`, `background: none`, `border: none`, `cursor`, `color: inherit`), per the dispatch's own spec. The caller's own `style`/`className` still applies on top (Button's `style` prop already merges last, after `variantStyle()` — confirmed by reading `Button.tsx`'s own `merged` construction). Covers all 162 Class-D sites — every one keeps its exact current visual appearance, just gains the missing font-family/cursor reset and routes through the one shared component.

## Full per-site table

### `src/app/(auth)/login/page.tsx` (5)

| Line | Class | Note |
|---|---|---|
| 219 | C | password show/hide eye toggle, icon-only |
| 236 | B | amber alt-auth-method link, exact 4-site match -> new `link` variant |
| 254 | B | amber alt-auth-method link, exact 4-site match -> new `link` variant |
| 284 | B | amber alt-auth-method link, exact 4-site match -> new `link` variant |
| 307 | D | Google sign-in, branded icon+text composition, 2 sites only (below 3-site bar), no Button shape covers icon+label composition |

### `src/app/(auth)/register/RegisterForm.tsx` (7)

| Line | Class | Note |
|---|---|---|
| 366 | B | amber alt-auth-method link, exact 4-site match -> new `link` variant |
| 400 | D | Google sign-in, branded icon+text composition (see login L307) |
| 452 | D | username-suggestion chip - GEN-2609-066 precedent: translucent-tint utility chip, not Button-shaped, already documented as fixed via statusStyle.ts pattern |
| 470 | D | "try more suggestions" text action, opacity-state text link, one-off |
| 502 | D | error-colored underlined inline text link, one-off, no variant match |
| 570 | C | password show/hide eye toggle, icon-only |
| 614 | C | confirm-password show/hide eye toggle, icon-only |

### `src/app/(auth)/reset-password/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 116 | C | password show/hide eye toggle, icon-only |

### `src/app/(public)/artists/[id]/ArtistProfileClientPage.tsx` (6)

| Line | Class | Note |
|---|---|---|
| 383 | C | previous-artist arrow, icon-only |
| 406 | C | next-artist arrow, icon-only |
| 498 | D | follow CTA, near-miss to the Venue/Organiser follow-cta shape (fontWeight 700 vs 600, radius-sm vs none, different border alpha) - not exact, no rounding-of-variant-matching per standing precedent |
| 513 | C | notify-bell circle toggle, icon-only |
| 625 | D | profile tab selector, segmented/tab family |
| 836 | D | open-corporate-inquiry CTA, one-off (padding/border delta vs outline-neutral) |

### `src/app/(public)/artists/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 273 | D | genre filter pill, className-driven, filter/tag family |

### `src/app/(public)/events/[id]/EventDetailClientPage.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 467 | D | confirm +1 pill, radius 3px off-scale, one-off |
| 513 | D | star-rating widget button, structural rating control not a simple CTA |
| 522 | D | submit-review CTA, radius 3px off-scale, one-off |

### `src/app/(public)/events/[id]/rate/RatePromptClientPage.tsx` (5)

| Line | Class | Note |
|---|---|---|
| 20 | D | star-rating widget button (same family as EventDetailClientPage L513) |
| 159 | D | submit-overall CTA, near-miss to form-submit (color on-fill-solid vs cream, padding 14 vs 16, weight 700 vs 600) - not exact |
| 175 | D | see-performers CTA, near-miss to outline-neutral (radius md vs sm, different padding/font) - not exact |
| 199 | D | star-rating widget button (same family) |
| 209 | D | submit-performer-rating CTA, near-miss to solid/sm (padding 6px12px vs btn-padding-sm 4px10px) - not exact |

### `src/app/(public)/events/[id]/seats/SeatSelectionClientPage.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 64 | C | seat-quantity stepper glyph button, icon-only |

### `src/app/(public)/events/page.tsx` (9)

| Line | Class | Note |
|---|---|---|
| 415 | D | events/organisers mode tab, className-driven, tab family |
| 418 | D | events/organisers mode tab, className-driven, tab family |
| 492 | D | price filter chip, className-driven, filter family |
| 551 | D | type filter chip (all), className-driven, filter family |
| 561 | D | type filter chip, className-driven, filter family |
| 581 | D | price filter chip, className-driven, filter family |
| 604 | D | grid/list view-toggle pair (aria-pressed), 2-button segmented control, treated as tab family not standalone icon |
| 607 | D | grid/list view-toggle pair (aria-pressed), same segmented control |
| 645 | D | mobile browse-mode toggle, tab family |

### `src/app/checkout/[bookingId]/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 745 | D | add-companion list-row button, list-row family |

### `src/app/dashboard/admin/artists/page.tsx` (4)

| Line | Class | Note |
|---|---|---|
| 161 | D | table sort-column header button, structural |
| 213 | D | search submit, radius-10px off-scale, one-off |
| 267 | D | headliner-toggle CTA, one-off (no exact variant match) |
| 288 | D | expand-note text toggle, disclosure family |

### `src/app/dashboard/admin/bookings/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 288 | D | retry action CTA, one-off |

### `src/app/dashboard/admin/design-system/page.tsx` (4)

| Line | Class | Note |
|---|---|---|
| 366 | D | uses local secondaryBtnStyle constant (padding matches --afa-btn-padding-md but no radius set - square corners, not an exact variant match), reused 4x in this file |
| 372 | D | secondaryBtnStyle (same local constant) |
| 422 | D | secondaryBtnStyle + inline overrides (same local constant) |
| 678 | D | secondaryBtnStyle (same local constant), pairs with <Button variant="solid"> as dialog Cancel/Confirm |

### `src/app/dashboard/admin/diary/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 194 | D | status-change chip, data-driven per-status color, structural |

### `src/app/dashboard/admin/feedback/page.tsx` (7)

| Line | Class | Note |
|---|---|---|
| 125 | D | ApproveButton - local shared component, file's own comment: "Extracted rather than folded into Button.tsx - no existing variant matches this pair's color/border combination without a visible change" |
| 133 | D | RejectButton - same documented local-component precedent as ApproveButton |
| 602 | D | Pending Approvals disclosure toggle (▾/▸), disclosure family |
| 657 | D | Genre Requests disclosure toggle, disclosure family |
| 687 | D | Event Notes disclosure toggle, disclosure family |
| 724 | D | Trends disclosure toggle, disclosure family |
| 761 | D | clear-status-focus text action, one-off |

### `src/app/dashboard/admin/users/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 157 | D | search submit, radius-10px off-scale, one-off |
| 195 | D | unsuspend CTA, green-outline one-off, no variant match |

### `src/app/dashboard/artist/corporate-inquiries/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 134 | D | mark-contacted status CTA, one-off pair |
| 143 | D | mark-closed status CTA, one-off pair |

### `src/app/dashboard/artist/edit/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 319 | D | remove-tour-stop CTA, one-off |
| 328 | D | add-tour-stop, dashed-add family (near-miss to seat-map's AddDashedRowButton shape, different exact values) |

### `src/app/dashboard/artist/page.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 320 | D | accept tour invite, sage/error status-action pair, one-off |
| 327 | D | decline tour invite, same status-action pair |
| 544 | D | cancel performance CTA, one-off |

### `src/app/dashboard/messages/[id]/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 181 | D | send-message CTA, radius 20px off-scale (sage bg), one-off |

### `src/app/dashboard/organiser/events/[id]/checkin/page.tsx` (4)

| Line | Class | Note |
|---|---|---|
| 265 | D | stop-camera CTA, near-miss to outline-neutral (radius md vs sm, padding delta) |
| 297 | D | check-in submit CTA, near-miss to solid (fontSize body vs ui, padding delta) |
| 312 | D | Attendee List disclosure toggle, disclosure family |
| 332 | D | attendee filter tab, segmented/tab family |

### `src/app/dashboard/organiser/events/[id]/edit/page.tsx` (6)

| Line | Class | Note |
|---|---|---|
| 139 | C | remove (✕) icon button, icon-only |
| 896 | D | invite-celebrity list-row button, list-row family |
| 953 | D | invite-panelist list-row button, list-row family |
| 1020 | D | "Use platform default" - documented prior audit finding (docs/design.md GEN-2609-079): near-miss to outline-neutral on radius/padding/font/color, not exact |
| 1130 | D | compensation-type segmented toggle - documented prior audit finding: segmented-toggle family, GEN-2609-076 locked decision not to migrate to toggle-pill |
| 1203 | D | Save as Draft - documented prior audit finding: off-scale border alpha/padding, no variant match |

### `src/app/dashboard/organiser/events/[id]/lineup/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 90 | C | drag-to-reorder handle, icon-only (aria-label) |
| 120 | D | featured-vouch toggle, data-driven engagement control, structural |

### `src/app/dashboard/organiser/events/[id]/page.tsx` (4)

| Line | Class | Note |
|---|---|---|
| 372 | D | apply-wallet-credit CTA, gold one-off |
| 414 | D | convert-to-wallet-credit CTA, one-off |
| 460 | D | approve application CTA, sage one-off |
| 467 | D | reject application CTA, error one-off (same pair-family as feedback's Approve/Reject but different exact values - not shared) |

### `src/app/dashboard/organiser/events/create/page.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 901 | D | compensation-type segmented toggle - same family as edit/page.tsx L1130 |
| 928 | D | approval-mode segmented toggle - same segmented-toggle family |
| 970 | D | submit CTA, one-off |

### `src/app/dashboard/organiser/payouts/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 137 | D | retry-fetch CTA, one-off |

### `src/app/dashboard/organiser/tours/[id]/page.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 396 | D | remove-artist CTA, one-off |
| 439 | D | publish-stop CTA, sage one-off |
| 454 | D | cancel-tour CTA, one-off |

### `src/app/dashboard/venue/[id]/edit/page.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 371 | D | rate-type segmented toggle, tab family |
| 507 | D | save CTA, one-off |
| 516 | D | save-and-continue CTA, one-off |

### `src/app/dashboard/venue/[id]/seat-map/page.tsx` (23)

| Line | Class | Note |
|---|---|---|
| 495 | D | RemoveGuidedRowButton - documented prior audit (docs/design.md GEN-2609-079): shared local component, no bare-× variant exists |
| 505 | D | AddDashedRowButton - documented prior audit: shared local component, reused 3-4x |
| 1439 | D | seating-mode toggle - documented segmented-toggle family (9 sites total in this file) |
| 1450 | D | seating-mode toggle - segmented-toggle family |
| 1482 | D | freeze/unfreeze CTA - documented prior audit: 2-state colour+copy swap, no single-role variant fits |
| 1507 | D | Add level (dashed-add family, needs a disabled prop AddDashedRowButton doesn't expose - documented reason it wasn't extracted) |
| 1516 | D | level-tab - documented prior audit: joined half-radius compound shape |
| 1527 | C | remove-level (×), icon-only, joined to its sibling level-tab |
| 1542 | D | Add level (2nd instance) - same dashed-add family as L1507 |
| 1556 | D | start-wizard choice card - documented prior audit: icon+title+description content block, not a simple CTA |
| 1575 | D | draw-myself choice card - same choice-card family |
| 1601 | D | Back to setup options - documented prior audit: underlined text link, doesn't match secondary's fixed shape |
| 1624 | D | guided-setup-open toggle - segmented-toggle family |
| 1630 | C | "?" help-circle - documented prior audit: 32px transparent-border circle, doesn't match close's 36px filled-circle shape, icon-only |
| 1640 | D | manual-placement toggle - segmented-toggle family |
| 1684 | D | wizard-shape toggle - segmented-toggle family |
| 1687 | D | wizard-shape toggle - segmented-toggle family |
| 1708 | D | multi-zone toggle - segmented-toggle family |
| 1711 | D | multi-zone toggle - segmented-toggle family |
| 1749 | D | add-vertical-aisle - dashed-add family (same reasoning as L1507) |
| 1771 | D | row-alignment 3-way toggle - documented prior audit: related but distinct dynamic-color pattern |
| 1853 | D | safety-marker-type button - documented prior audit: dynamic per-marker-type colour, not --afa-fill-solid |
| 2255 | C | terminology-panel close (×) - documented prior audit: 20px, no circle, icon-only |

### `src/app/dashboard/venue/bookings/page.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 170 | C | calendar prev-month arrow, icon-only |
| 179 | C | calendar next-month arrow, icon-only |
| 199 | D | calendar day-cell button, structural grid control |

### `src/app/dashboard/venue/create/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 401 | D | rate-type segmented toggle, tab family (same as venue/[id]/edit L371) |
| 590 | D | path-card choice card, className-driven, choice-card family |

### `src/app/dashboard/venue/edit/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 154 | D | Save Profile - VenuePortalUI-family local style (primaryLinkStyle + className="avp-btn-primary"), this dashboard section's own local abstraction |

### `src/app/dashboard/venue/sales/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 257 | D | show-all-venues CTA, one-off |
| 292 | D | show-less text action, underline link, one-off |

### `src/app/dev/razorpay-test/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 287 | D | sign-in CTA, dev/test-only page, one-off |
| 352 | D | pay CTA, dev/test-only page, one-off |

### `src/app/my-feedback/page.tsx` (4)

| Line | Class | Note |
|---|---|---|
| 198 | C | close, icon-only |
| 247 | C | previous item, icon-only |
| 263 | C | next item, icon-only |
| 376 | D | thumbnail item-row selector, list-row family |

### `src/app/organisers/[id]/OrganiserFollowButton.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 73 | D | follow CTA - exact match to VenueFollowButton L97 (padding '10px 20px', no radius, fontSize-ui, weight 600) but only 2 sites total, below 3-site new-variant bar; no existing variant matches (no radius set at all) |
| 91 | C | notify-bell circle toggle, icon-only |

### `src/app/organisers/[id]/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 418 | D | view-all text+icon link, one-off |

### `src/app/profile/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 580 | D | switch-role CTA, amber outline one-off |
| 730 | D | settings list-row (icon+title+hint+chevron), list-row family |

### `src/app/tickets/page.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 419 | D | confirm-tag CTA, near-miss to pill-sm padding value but radius-sm not pill - shape mismatch, one-off pair |
| 426 | D | decline-tag CTA, same near-miss pair |

### `src/app/venues/VenuesGridClient.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 136 | D | city-filter trigger, className-driven, dropdown-trigger family |
| 150 | D | city-filter option row, className-driven, list-row family |
| 161 | D | city-filter option row, list-row family |

### `src/app/venues/VenuesViewToggle.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 55 | D | view tab, className-driven, tab family |

### `src/app/venues/[id]/VenueFollowButton.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 97 | D | follow CTA - exact match to OrganiserFollowButton L73 (see that entry) |
| 115 | C | notify-bell circle toggle, icon-only |
| 157 | D | follow CTA, sidebar variant - not verified byte-identical to L97, left raw pending closer diff, structural |

### `src/app/verify-phone/page.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 148 | D | resend-code link, near-miss to the new `link` variant (color fill-solid not amber, padding 10px not space-3, radius 8 not md-token) - not exact, no rounding |

### `src/components/AddressAutocomplete.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 151 | D | place-suggestion row, list-row family |

### `src/components/BrowseSearchDropdown.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 85 | D | search-result row, list-row family |

### `src/components/CityAutocomplete.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 140 | D | place-suggestion row, list-row family |

### `src/components/ContributionMoment.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 171 | D | backdrop dismiss catcher, className="afa-backdrop-mount" - invisible full-screen click-catcher, structural not a visible CTA |

### `src/components/DashboardShell.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 625 | D | "More" bottom-nav tab, structural nav-tab (icon+label) |
| 648 | C | close drawer, icon-only |

### `src/components/DisplayNameNudge.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 132 | C | dismiss, icon-only |

### `src/components/EventSaveButton.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 77 | C | save/bookmark toggle, icon-only |

### `src/components/FeeSheet.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 38 | D | backdrop dismiss catcher (inset:0 full-screen), same structural family as ContributionMoment L171 |

### `src/components/HelpIcon.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 16 | C | "?" help toggle, icon-only |

### `src/components/HomeHeader.tsx` (4)

| Line | Class | Note |
|---|---|---|
| 171 | C | search toggle, icon-only |
| 183 | C | account menu toggle, icon-only |
| 233 | D | language-option row, list-row family |
| 248 | D | sign-out text action, one-off |

### `src/components/LocationChip.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 100 | D | location-picker chip trigger, structural chip |
| 134 | D | city-option row, list-row family |

### `src/components/MessageButton.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 52 | D | Message CTA, sage-outline pill, branded icon+text one-off |

### `src/components/MobileEventFilterSheet.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 25 | D | filter option chip, structural |
| 78 | D | backdrop dismiss catcher, className="afa-backdrop-mount" - same structural family as ContributionMoment L171 |
| 175 | D | reset-filters CTA, one-off |

### `src/components/NearYouTabs.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 126 | D | events/artists tab, tab family |
| 132 | D | events/artists tab, tab family |

### `src/components/NotificationOptIn.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 113 | C | dismiss, icon-only |

### `src/components/PhotoRotationDots.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 26 | C | photo pagination dot, icon-only |

### `src/components/RangePicker.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 17 | D | range-option pill, segmented/tab family |

### `src/components/SearchBox.tsx` (3)

| Line | Class | Note |
|---|---|---|
| 88 | D | event search-result row, list-row family |
| 99 | D | artist search-result row, list-row family |
| 110 | D | venue search-result row, list-row family |

### `src/components/SeatLayoutPreview.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 72 | D | level tab, tab family (shared pattern with SeatPicker) |

### `src/components/SeatPicker.tsx` (4)

| Line | Class | Note |
|---|---|---|
| 276 | C | zoom out, icon-only |
| 285 | C | zoom in, icon-only |
| 295 | D | reset view, text CTA, one-off |
| 318 | D | level tab, tab family |

### `src/components/SeatSectionEditor.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 226 | C | remove section, icon-only (aria-label) |
| 266 | D | add section, className="ga-add-row", dashed-add family |

### `src/components/SiteNav.tsx` (7)

| Line | Class | Note |
|---|---|---|
| 437 | C | language picker toggle, icon-only |
| 449 | D | language option row, list-row family |
| 502 | D | sign-in CTA, fill-solid one-off |
| 532 | C | search toggle, icon-only |
| 545 | C | account menu toggle, icon-only |
| 609 | D | language option row (mobile panel), list-row family |
| 626 | D | sign-out text action (mobile panel), one-off |

### `src/components/SupportWidget.tsx` (7)

| Line | Class | Note |
|---|---|---|
| 452 | C | chat FAB toggle, icon-only |
| 504 | D | chat-panel tab, tab family |
| 519 | D | switch-to-feedback tab, tab family |
| 549 | D | switch-to-feedback CTA (amber, in empty-state), one-off |
| 594 | D | open-feedback-from-chat action, list-row-like, structural |
| 632 | D | switch-to-feedback text action, one-off |
| 812 | D | clear-attachment text action, one-off |

### `src/components/Toast.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 149 | C | dismiss, icon-only |

### `src/components/admin/FeedbackDetailPanel.tsx` (7)

| Line | Class | Note |
|---|---|---|
| 205 | C | close, icon-only |
| 216 | C | previous, icon-only |
| 237 | C | next, icon-only |
| 333 | D | confirm-note CTA, near-miss to pill-sm (fontSize small vs ui) - not exact |
| 344 | D | cancel-note CTA, one-off |
| 373 | D | deploy-stage selector chip, structural |
| 406 | D | severity selector chip, structural |

### `src/components/dashboard/VenuePortalUI.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 261 | D | this file's OWN local Button-like primitive definition (className+variants spread) - a parallel abstraction consumed by avp-btn-* classNames across the venue dashboard; not force-migrated into Button.tsx (would require refactoring every avp-btn-* call site, out of this phase's scope) |

### `src/components/mobile/MobileTabBar.tsx` (2)

| Line | Class | Note |
|---|---|---|
| 480 | D | "More" bottom-nav tab, structural nav-tab |
| 511 | C | close, icon-only |

### `src/components/mobile/MobileTopBar.tsx` (4)

| Line | Class | Note |
|---|---|---|
| 160 | C | filters toggle, icon-only |
| 187 | C | language picker toggle, icon-only |
| 212 | D | language option row, list-row family |
| 226 | D | sign-out text action, one-off |

### `src/components/pwa/InstallPrompt.tsx` (1)

| Line | Class | Note |
|---|---|---|
| 138 | C | dismiss install prompt, icon-only |

