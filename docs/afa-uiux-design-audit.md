# AforAudience — UI/UX Design System Audit

**Internal audit · 12 Sep 2026 · Target audience: 15–35**

What's locked and consistent today, what's still legacy debt, and what
has never been formally specified — plus how to mature each gap,
whether Figma Make should be part of that, whether the palette is
centrally configurable in code, and where animation/infographics/
interaction could differentiate the product. Built to support a
go/no-go call on scoping a dedicated design-system pass.

This is the plain-text companion to `docs/afa-uiux-design-audit.html`
(same content, no styling) — read this one if you're CC or otherwise
working from the repo directly.

---

## 01. Color Palette — Locked, mostly clean

Four core tokens govern every screen. Well-adopted, but legacy
pre-redesign tokens still surface in older components whenever
they're touched.

| Token | Hex | Use |
|---|---|---|
| `--afa-surface-inverse` | `#0E0C0A` | Page background |
| `--afa-text-primary` | `#F5F5F0` | Body & heading text on dark |
| `--afa-amber` | `#C9973A` | Quiet accents only — never CTA |
| `--afa-fill-solid` | `#C8441A` | Booking / payment / commit actions only |
| `--afa-error` | `#B3261E` | Error banners / validation |

**Example — nav active-color bleed (`BUG-2609-022`):**
- As-is: `color: active ? 'var(--afa-fill-solid)' : 'var(--afa-text-primary)'` — CTA orange leaking into nav.
- To-be (PR #595): `color: active ? 'var(--afa-amber)' : 'var(--afa-text-primary)'` — quiet accent, CTA reserved.

**Example — legacy token cleanup (`BUG-2609-024`):**
- As-is: `background: var(--afa-terracotta-tint)`, `color: var(--afa-terracotta)`, button `background: var(--afa-terracotta)` + hardcoded `"white"` text.
- To-be: `background: rgba(179,38,30,0.1)`, `color: var(--afa-error)`, button `background: var(--afa-fill-solid)` + `color: var(--afa-on-fill-solid)`.

---

## 02. Font & Font Size — Family locked, scale undefined

| Element | Value | Status |
|---|---|---|
| Wordmark / Headings | `var(--font-display)` → Archivo | Locked, consistent mobile + desktop |
| Mobile nav labels | 10px, uppercase, 0.08em tracking | Mobile-only, undocumented outside this one component |
| Body text | Not specified | **Gap** |
| Heading scale (H1–H4) | Not specified | **Gap** |
| Line-height rules | Not specified | **Gap** |

---

## 03. Styling — Photo treatment locked

Every image gets the same duotone treatment via one shared component
(`Photo.tsx`) — zero known drift.

- As-is (raw): `<img src={photo} />`
- To-be (applied): `filter: grayscale(1) contrast(1.25) brightness(0.9); overlay: #C9973A @ 48% opacity, mix-blend-mode: multiply;`

---

## 04. Alignment & Layout — No formal grid

Mobile and desktop use structurally different navigation shells
(intentional, not a bug) — but neither is built from a documented
spacing/grid system.

| Surface | Mobile | Desktop |
|---|---|---|
| Navigation shell | Bottom `MobileTabBar` + `MobileTopBar`, breakpoint <1023px | `DashboardShell` sidebar + `SiteNav`/`HomeHeader` |
| Floating widget offset | `calc(64px + safe-area-inset-bottom)` | Flat `bottom: 20/88`, no tab bar to clear |
| Spacing/grid unit | Not documented on either platform | — |
| Admin page content | 0/8 pages have mobile-responsive treatment beyond the nav shell | Fully responsive |

---

## 05. Improvement Scope — Decision Inputs

| Gap | Priority | Note |
|---|---|---|
| No written type scale | HIGH | Touches every new screen |
| No formal spacing/grid system | HIGH | Compounds with the above |
| Component library / single source of truth | HIGH | Root cause behind the token-residue backlog |
| Icon system | MEDIUM | Cosmetic today, compounds as more pages ship |
| Accessibility spec | MEDIUM | Currently unverified, not necessarily broken |
| Admin mobile content responsiveness | MEDIUM | Depends on actual Admin usage pattern |
| Motion / animation guidelines | LOW | Nothing broken, just undocumented |
| Breakpoint definitions | LOW | Works today by convention, risks drift |
| Legacy token residue | LOW | Handled opportunistically, working as intended |

---

## 06. How to Mature Each Gap

| Gap | Maturing approach |
|---|---|
| Type scale | Pick 5–6 sizes (e.g. 12/14/16/20/28/34px) with weight + line-height per level; document in `docs/afa-design-tokens-reference.md`; retrofit opportunistically. |
| Grid / spacing | Adopt an 8px (or 4px) base unit; define page-margin/gutter rules per breakpoint; same doc. |
| Component library | Extract `Button`/`Input`/`Modal` from the worst legacy-token offenders first; require new UI to use them going forward. |
| Icon system | Audit current icon usage across nav + dashboards; pick one size scale and stroke weight; consolidate into one icon component. |
| Accessibility | Run one contrast/focus-state pass against the 4 locked tokens; document pass/fail combinations. |
| Motion guidelines | Catalogue existing motion (splash, spinners, transitions); write one rule for when motion is used vs. not. |
| Breakpoints | Name the existing `1023px` split (and any others) as tokens/constants in one place. |

---

## 07. Should Figma Make Help? — Useful, with a caveat

**Yes for exploration, no for trust.** Already used well to generate
options fast for real decisions (nav placement, wordmark variants).

**The caveat:** this project's own working notes flag that Figma Make
"repeatedly produces confident change descriptions that don't match
rendered/grepped reality." Every past exploration that shipped
required a manual code-vs-Figma diff before being trusted.

**Net:** use it to widen the option set, not to validate what's
already built or to skip verification.

---

## 08. Is It Centrally Configurable? — Mostly, adoption is the gap

The 4 locked tokens live as CSS variables in `globals.css`. Changing
one there cascades everywhere it's referenced by variable — but only
where a file used the variable instead of a hardcoded literal.

- **Works:** `background: var(--afa-fill-solid)` — change once in `globals.css`, updates everywhere.
- **Breaks:** `background: var(--afa-terracotta)` (legacy token) or `color: "white"` (hardcoded literal, not a token) — changing `globals.css` does nothing here.

Every legacy-token find (`BUG-2609-024`, `BUG-2609-025`) is this same
failure: not a broken system, a file that opted out of it.

---

## 09. Creative Opportunity — Animation, Infographics, Interaction, Transitions

| Category | Idea | Why it fits AFA |
|---|---|---|
| Animation | Staggered event-card reveal on scroll (stage curtain / spotlight cue) | Reinforces "live event" feel over generic SaaS list |
| Animation | Booking-confirmation "ticket stamp" / seat "lighting up" moment | The one true celebration moment, currently under-designed |
| Infographic | Artist journey timeline on profile | More scannable than a text list, reinforces discovery |
| Infographic | Navarasa mood map (visual wheel/cluster) | Navarasa is already AFA's core philosophy, currently text-only |
| Interaction | Seat-map hover previews (sightline/price) | Reduces back-and-forth taps during booking |
| Interaction | Extend Feedback-panel swipe gesture to Discover browsing | Reuses a pattern already built and verified |
| Transition | Shared-element transition, card → detail page | Visual continuity between browse and detail |
| Transition | Role-switch transition (Audience ↔ Organiser ↔ Artist) | Reinforces stepping into a different role |

**Sequencing note:** all eight should wait on the Motion Guidelines
gap (Section 06) being defined first — building any of them ad hoc
now adds to the same inconsistency problem already flagged for tokens
and components.

---

## 10. Additional Gaps — Specific to a 15–35 Audience

| Area | Gap | Why it matters for 15–35 |
|---|---|---|
| Personalization | No personalized/algorithmic Discover feed; no "For You" vs "Trending Near You" split | This age group expects adaptive feeds, not a static list |
| Social proof / FOMO | No "X people viewing," "3 tickets left," friend-attendance cues | High-impact on booking decisions for this demographic |
| Shareability | Event cards have no screenshot/story-shareable treatment | This audience discovers events via peer shares |
| Empty / loading / error states | No visual spec beyond tone guidance | Shapes first-time-user impression, disproportionately important for retention |
| Onboarding | Role selection, permission asks, intro splash exist but aren't one designed sequence | First 60 seconds decides stay-or-churn |
| Dark-mode-only | Decision point, not a gap | Dark-mode-native audience, but name the outdoor-readability/accessibility tradeoffs explicitly |
| Notifications | `web-push` exists in stack, no visual/content design system | Major retention lever for this age group |
| Search & filters | Functionally flagged (`BUG-2609-023`); no visual design for chips/applied-state/empty-result | Functional fix alone won't feel complete without the visual layer |
| Micro-copy / tone | Writing principles exist, not audited for consistency | Voice consistency matters more to this audience |

---

## 11. Strategic Call — Before Any More Spec Work

Everything above is infrastructure. Infrastructure doesn't make
someone love a product — one moment, done perfectly, does.

1. **Own one moment, not ten.** Section 09 lists eight ideas weighted
   equally — wrong. Pick the single moment someone would screenshot
   and send a friend (strongest candidate: the decision to go, not
   the payment) and make everything else quieter.
2. **Say no to a second accent color.** Restraint, not addition,
   creates drama. Keep CTA orange sacred and single-purpose. Earn
   drama from motion, not from a new brand color.
3. **Ship the type scale and grid before Figma Make, not after.** A
   one-page spec, boring and finished, beats a beautiful screen that
   can't be repeated.

---

## 12. How to Proceed

Sequence, not a simultaneous push. Each step should be finished and
boring before the next one starts.

| Step | Action | Done when |
|---|---|---|
| 1 | Write the one-page type scale + 8px grid spec (Section 06) | Fits on one page, nobody needs to ask "what size is this?" again |
| 2 | Decide the one signature moment (Strategic Call #1) — one sentence, no committee | You can say it in one sentence without hedging |
| 3 | Design and build that one moment only — ignore the rest of Section 09/10 for now | You'd show it to someone outside the team and they'd react |
| 4 | Extract the component library from the worst legacy-token offenders (Section 06) | Zero legacy-token hits remain in files touching that moment |
| 5 | Only now bring in Figma Make — for remaining Section 09/10 ideas, against the finished spec | Every Figma Make output checked against real code before being trusted (Section 07) |
| 6 | Revisit accessibility, motion guidelines, icons, notifications, onboarding — opportunistically, not as a blocking project | Each gets its own one-page spec, same discipline as step 1 |

**The one-line version:** finish the boring spec, decide the one
moment, build only that, then let Figma Make loose on everything
else — never the other order.

---

*Source: `docs/design.md`, `docs/afa-design-tokens-reference.md`, and
this session's audit of `qa` HEAD. Hex values for locked tokens are
taken from shipped component code and verified `getComputedStyle`
reads where available. All gaps reflect the absence of a written
spec, not a guess at what one might contain. Sections 06–12 are
suggestions only — no action has been taken on any of them.*
