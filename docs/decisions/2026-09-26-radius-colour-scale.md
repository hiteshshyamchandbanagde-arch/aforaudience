# Decision record — radius scale + colour closeout (26 Sep 2026)

**Decided by:** chat, delegated by Hitesh ("just decide for me"). Hitesh can veto any line; everything here is admin-editable afterwards, so a wrong call costs one token edit, not a redeploy.
**Measured on:** `qa@f4202a8`, with the checker's own `RULES` (counts match CI exactly).
**Guiding rules:** fewest tokens that keep the current look; round to the nearest scale step (same precedent as the font-size closeout, GEN-2609-106); where rounding direction is a toss-up, round toward better contrast.

## 1. Radius (GEN-2609-112) — 310 literals

| Token | Value | Absorbs | Visible change |
|---|---|---|---|
| sharp | 0px | 0 | none |
| **xs (new)** | 3px | 2, 3, 4 | ≤1px |
| sm | 6px | 5, 6, 7 | ≤1px |
| md | 8px | 8 | none |
| **lg** (was `radius-12px`) | 12px | 10, 12, 14 | ≤2px |
| **xl (new)** | 16px | 16 | none |
| **2xl (new)** | 20px | 20, 24 | 4px on 2 sites |
| pill | 999px | 99, 999 | none (both render fully round) |

`--afa-radius-10px` retired into `lg`. Pixel names (`-10px`, `-12px`) go, for the same reason as the font-size rename: once an admin can edit the value, a pixel name lies.

## 2. Colour (GEN-2609-113) — 543 rgba + 51 hex

### 2a. Cream overlays `rgba(245,245,240,a)` — also absorbs the near-identical `rgba(247,243,238,a)`
Two ladders, chosen by what the colour is doing.

**Surfaces and borders (`--afa-tint-*`, existing naming):**

| Token | Alpha | Absorbs |
|---|---|---|
| tint-04 (new) | 0.04 | 0.03, 0.04, 0.05 |
| tint-06 (new) | 0.06 | 0.06, 0.07 |
| tint-08 | 0.08 | 0.08 |
| tint-10 | 0.10 | 0.10 |
| tint-12 (new) | 0.12 | 0.12, 0.13 |
| border-resting | 0.15 | 0.15, 0.16 |
| tint-20 (new) | 0.20 | 0.20, 0.25 |
| tint-30 (new) | 0.30 | 0.30, 0.35 when not text |

**Text (`--afa-text-*`):**

| Token | Alpha | Absorbs | Contrast on page surface |
|---|---|---|---|
| text-muted | **0.40 → 0.50** | 0.35, 0.40, 0.45, 0.50 | 3.6:1 → **4.95:1** |
| text-secondary | 0.65 | 0.55, 0.60, 0.65, 0.70 | 7.6:1 |
| text-soft (new) | 0.80 | 0.75, 0.80, 0.85 | 11.0:1 |

`--afa-text-muted` is raised from 0.40 to 0.50 because at 0.40 it measures 3.6:1 on `--afa-surface-page` and fails WCAG AA for body text; every existing muted-text site gets that fix for free. The 0.35/0.45 sites round into it (4.95:1 is a pass; 0.45 alone was 4.2:1, a fail).

### 2b. Tone tints

| Token | Value | Absorbs |
|---|---|---|
| amber-wash (new) | amber @ 0.08 | 0.08 |
| amber-tint (new) | amber @ 0.15 | 0.10–0.20 |
| amber-border (new) | amber @ 0.40 | 0.25–0.50 |
| amber-strong (new) | amber @ 0.60 | 0.60 |
| (existing `--afa-amber`) | solid | 0.80 |
| error-tint (new) | error @ 0.10 | 0.08–0.15 |
| error-edge (new) | error @ 0.30 | 0.30, 0.40 |
| sage-tint (new) | sage @ 0.12 | sage 0.12 |
| success-tint (new) | `--afa-green-dark` @ 0.15 | `39,103,73` and `22,101,52` @ 0.12–0.15 |
| fill-tint (new) | `--afa-fill-solid` @ 0.20 | orange 0.20, 0.30 |
| blue-tint (new) | blue @ 0.15 | 0.15 |

Tints are written as literal `rgba()` in the token definitions (not `color-mix`), so an admin editing a tint edits exactly what they see.

### 2c. Dark overlays and shadows

| Token | Value | Absorbs |
|---|---|---|
| shadow (new) | `rgba(0,0,0,0.3)` | black 0.2–0.4, `14,12,10` @ 0.15, in shadows |
| scrim (new) | `rgba(10,10,10,0.7)` | black/ink 0.5–0.7 overlays |
| scrim-strong (new) | `rgba(10,10,10,0.9)` | 0.85–0.95 |

`rgba(10,10,10,0)` (the transparent end of image fades) is structural, not a colour choice: `token-ok`.

### 2d. Hex (51)
- `#F7F3EE` → `--afa-cream`; `#C9973A` (any case) → `--afa-amber`; `#0E0C0A` → `--afa-ink`; `#1F1F1F` → `--afa-surface-raised`; `#0a0a0a` → `--afa-surface-inverse`; `#4a6741` → `--afa-sage`.
- `#a89880` (15, home "near you" rails): → `--afa-text-secondary`. It's the only warm-grey text on the site; aligning it removes a one-off.
- `#171717` (8, input backgrounds): → `--afa-surface-inverse`, per the settled 3-level surface rule (inputs = inverse).
- `#FFEBEE`/`#C62828` (`my-feedback` alert): → `error-tint` / `--afa-error-bright` (a light-theme leftover on a dark page).
- `#241a10` (EventCard image placeholder): → `--afa-surface-raised`.
- `var(--afa-error, #b3261e)`: drop the fallback.
- **`BrandLoader.tsx` exempt**: it's a pixel copy of the app icon (`icon.svg`); logo colours must not move when an admin edits the palette.
- SVG presentation attributes (`fill=`, `stopColor=`) don't reliably resolve `var()`: move those to `style={{ ... }}`.

### 2e. Cleanup
Remove `--afa-error-border` (#F5C2C0, 0 consumers, light-theme leftover).

## 3. Sequencing (decided)
Radius (112) → small user-facing bug batch (053, 054, 050) → colour (113) → **editor guardrails (108)** → button phase 3 (110) → spacing (107, hidden from the editor).
Guardrails move ahead of buttons: every token wired makes the editor more powerful, and today it accepts `0100000px` and `200px` without complaint.
