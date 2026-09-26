// GEN-2609-075 - Admin-controlled design tokens, runtime layer (MVP).
//
// Deliberately no `prisma`/`next/cache` imports in this file - it's
// imported by the admin page, a Client Component, and `next build`
// (Turbopack) bundles whatever a Client Component imports for the
// browser too. Pulling in `@/lib/prisma` here drags the `pg` driver
// (Node-only: `net`/`tls`/`fs`/`dns`) into the client bundle and fails
// the build outright - caught by an actual `next build` run, not
// assumed. The DB-touching half (reads, unstable_cache, revalidateTag)
// lives in design-tokens.server.ts instead, imported only from Server
// Components and Route Handlers.
//
// One CSS custom property per DesignToken row. The root layout reads
// every row (cached, tag "design-tokens") and injects them as a single
// <style> block in <head> that overrides globals.css's :root defaults -
// so a change made in /dashboard/admin/design-system takes effect on
// the next page load everywhere, no deploy. If the DB is empty or the
// read throws, the layout renders no override at all and the page
// falls back to globals.css's own hardcoded defaults untouched.
//
// Font tokens (--font-display/--font-ui/--font-sans/--font-mono) are a
// special case: those names are ALSO set directly on <body> by
// next/font's generated classes (see layout.tsx), so overriding them
// only at :root wouldn't win - a property declared directly on body
// (even without !important) beats one inherited from an ancestor like
// html. The runtime <style> below targets `body` (not just `:root`)
// and uses !important so it wins regardless. Their curated allowlist
// values are `var(--font-phys-*)` references to 4 always-loaded,
// role-independent physical font aliases (also added in layout.tsx) -
// NOT the role names themselves - specifically so reassigning one
// role's font can't silently drift if another role gets reassigned in
// the same save (see layout.tsx's own comment on --font-phys-*).
//
// Token values are user-controlled (admin-authored, DB-stored) and get
// concatenated directly into a server-rendered <style> tag on every
// public page load - a real CSS/markup-injection surface, not just a
// data-integrity one. isValidTokenValue() is the one gate everything
// must pass through before it's ever written, and it's deliberately an
// allowlist (exact shape per `type`), not a denylist.

export const DESIGN_TOKEN_CACHE_TAG = "design-tokens"

export type TokenGroup = "color" | "font" | "size" | "spacing" | "radius" | "button"
export type TokenType = "color" | "dimension" | "dimension-shorthand" | "font-family"

export type DesignTokenDTO = {
  key: string
  value: string
  group: TokenGroup
  type: TokenType
  locked: boolean
  updatedBy: string | null
  updatedAt: string
}

// The 5 core brand tokens - surfaces + accent + the CTA fill/text pair.
// Editable here, but only behind a confirm dialog (client) and this
// same check (server) - see docs/design.md's GEN-2609-075 entry for why
// these 5 specifically. Unrelated to check-design-tokens.js's own
// locked-palette rule, which keeps blocking raw literals in application
// code regardless of what this table holds.
export const LOCKED_TOKEN_KEYS = new Set<string>([
  "--afa-surface-page",
  "--afa-surface-raised",
  "--afa-amber",
  "--afa-fill-solid",
  "--afa-on-fill-solid",
])

// The only allowed values for the 4 font-role tokens - each a reference
// to one of layout.tsx's 4 stable --font-phys-* aliases. Kept as a
// closed enum (not free text) since a bad font-family value here is one
// of the lowest-visible-harm ways an admin typo could degrade the whole
// site (silent fallback to a generic font, not a broken page) - but
// still worth just not allowing outside this curated set at all.
export const FONT_ALLOWLIST = [
  { label: "Young Serif", value: "var(--font-phys-young-serif)" },
  { label: "Schibsted Grotesk", value: "var(--font-phys-schibsted-grotesk)" },
  { label: "Instrument Sans", value: "var(--font-phys-instrument-sans)" },
  { label: "JetBrains Mono", value: "var(--font-phys-jetbrains-mono)" },
] as const

const HEX_COLOR = /^#[0-9a-fA-F]{3,4}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/
// GEN-2609-108 - channels 0-255 with no leading zeros (the old `\d{1,3}`
// took 999), alpha 0-1. The regex fixes the shape; parseRgb checks the
// numeric bounds.
const RGB_COLOR = /^rgba?\(\s*(0|[1-9]\d{0,2})\s*,\s*(0|[1-9]\d{0,2})\s*,\s*(0|[1-9]\d{0,2})\s*(?:,\s*(0|1|1\.0+|0?\.\d+)\s*)?\)$/
const COLOR_VAR_REF = /^var\(--afa-[a-z0-9-]+\)$/
// No leading zeros (`0100000px` was saved once on QA), no bare `.5px`,
// no sign. A token that genuinely needs a negative value goes in
// NEGATIVE_ALLOWED_KEYS below.
const DIMENSION = /^0$|^(0|[1-9]\d*)(\.\d+)?(px|rem|em|%)$/
const DIMENSION_SHORTHAND = /^(0|[1-9]\d*)(\.\d+)?px(\s+(0|[1-9]\d*)(\.\d+)?px){0,3}$/

// GEN-2609-108 - no token takes a negative value today. An explicit set
// so allowing one later is a deliberate, reviewed edit.
export const NEGATIVE_ALLOWED_KEYS = new Set<string>()

// GEN-2609-108 - value ranges, px only. Every QA DB value sat inside
// these on 26 Sep, so none of them rejects a value that is live today.
// Lookup: exact key first (KEY_RANGES), then the key's group.
export type TokenRange = { min: number; max: number }

export const GROUP_RANGES = {
  radius: { min: 0, max: 40 },
  size: { min: 10, max: 72 },
  spacing: { min: 0, max: 64 },
  button: { min: 0, max: 64 },
} satisfies Record<string, TokenRange>

export const KEY_RANGES: Record<string, TokenRange> = {
  // Below ~100px a tall pill starts showing flat sides.
  "--afa-radius-pill": { min: 100, max: 9999 },
  // Running-text roles (micro is the label size). Caption (10px badge
  // micro-labels) stays on the group range: its default is under 11.
  "--afa-text-micro": { min: 11, max: 24 },
  "--afa-text-small": { min: 11, max: 24 },
  "--afa-text-ui": { min: 11, max: 24 },
  "--afa-text-body": { min: 11, max: 24 },
  "--afa-text-body-lg": { min: 11, max: 24 },
}

// The radius scale must stay ordered. The pill is not part of it.
export const RADIUS_ORDER = [
  "--afa-radius-sharp",
  "--afa-radius-xs",
  "--afa-radius-sm",
  "--afa-radius-md",
  "--afa-radius-lg",
  "--afa-radius-xl",
  "--afa-radius-2xl",
] as const

// Group from the key's prefix, so validation needs only the key.
// `--afa-text-*` colour tokens never reach the range check (type gate).
export function rangeGroupForKey(key: string): keyof typeof GROUP_RANGES | null {
  if (key.startsWith("--afa-radius-")) return "radius"
  if (key.startsWith("--afa-space-")) return "spacing"
  if (key.startsWith("--afa-btn-padding-")) return "button"
  if (key.startsWith("--afa-text-")) return "size"
  return null
}

export function rangeFor(key: string): TokenRange | null {
  if (KEY_RANGES[key]) return KEY_RANGES[key]
  const g = rangeGroupForKey(key)
  return g ? GROUP_RANGES[g] : null
}

export function parsePx(part: string): number | null {
  if (part === "0") return 0
  const m = part.match(/^(-?\d+(?:\.\d+)?)px$/)
  return m ? Number(m[1]) : null
}

// Shape only - what every stored value must satisfy before it goes near
// the <style> tag. No key-specific rules.
function isValidShape(type: TokenType, value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 120) return false
  // Belt-and-braces: none of these characters are ever legitimate inside
  // a single CSS custom property value in this app, and every one of
  // them is exactly what a style/markup-injection payload would need.
  if (/[<>{};]|\/\*|\*\//.test(value)) return false

  switch (type) {
    case "color":
      return HEX_COLOR.test(value) || parseRgb(value) !== null || COLOR_VAR_REF.test(value)
    case "dimension":
      return DIMENSION.test(value)
    case "dimension-shorthand":
      return DIMENSION_SHORTHAND.test(value)
    case "font-family":
      return FONT_ALLOWLIST.some((f) => f.value === value)
    default:
      return false
  }
}

// Why a value can't be saved for this key, or null if it can. Shared by
// the API (authoritative) and the editor (inline errors) so the two
// can't disagree.
export function tokenValueError(key: string, type: TokenType, value: string): string | null {
  const isDim = type === "dimension" || type === "dimension-shorthand"
  const negativeAllowed = isDim && NEGATIVE_ALLOWED_KEYS.has(key)
  const shapeValue = negativeAllowed ? value.replace(/(^|\s)-/g, "$1") : value
  if (!isValidShape(type, shapeValue)) {
    if (isDim && /(^|\s)-/.test(value)) return "Negative values are not allowed."
    if (isDim && /(^|\s)0\d/.test(value)) return "Remove the leading zero."
    if (isDim) return "Use a px value, e.g. 12px."
    if (type === "color") return "Use #hex, or rgba(r, g, b, a) with channels 0–255 and alpha 0–1."
    return "Not an allowed value."
  }
  if (!isDim) return null
  const range = rangeFor(key)
  if (!range) return null
  for (const part of value.trim().split(/\s+/)) {
    const px = parsePx(part)
    if (px === null) return "Use px for this token."
    if (px < range.min || px > range.max) return `Must be between ${range.min}px and ${range.max}px.`
  }
  return null
}

// Pass `key` wherever it's known (every write path does). Without it
// only the shape is checked: that's buildDesignTokenCss's defence-in-
// depth pass, which must not drop a stored value just because a range
// was tightened after it was saved.
export function isValidTokenValue(type: TokenType, value: string, key?: string): boolean {
  if (key === undefined) return isValidShape(type, value)
  return tokenValueError(key, type, value) === null
}

// GEN-2609-108 - checks the full resulting value set (saved values with
// edits applied) and names the neighbour each out-of-order radius
// crosses. Only pairs touching `changed` are reported, so a scale that's
// already out of order in the DB doesn't block an unrelated save.
export function radiusOrderErrors(values: Record<string, string>, changed?: Iterable<string>): { key: string; message: string }[] {
  const changedSet = changed ? new Set(changed) : null
  const errors: { key: string; message: string }[] = []
  for (let i = 0; i < RADIUS_ORDER.length - 1; i++) {
    const lo = RADIUS_ORDER[i]
    const hi = RADIUS_ORDER[i + 1]
    const a = values[lo] !== undefined ? parsePx(values[lo]) : null
    const b = values[hi] !== undefined ? parsePx(values[hi]) : null
    if (a === null || b === null || a <= b) continue
    if (changedSet && !changedSet.has(lo) && !changedSet.has(hi)) continue
    // Blame whichever side moved; if both did, the lower one.
    if (!changedSet || changedSet.has(lo)) {
      errors.push({ key: lo, message: `Can't be larger than ${hi} (${values[hi]}).` })
    } else {
      errors.push({ key: hi, message: `Can't be smaller than ${lo} (${values[lo]}).` })
    }
  }
  return errors
}

export function isTokenGroup(v: string): v is TokenGroup {
  return v === "color" || v === "font" || v === "size" || v === "spacing" || v === "radius" || v === "button"
}
export function isTokenType(v: string): v is TokenType {
  return v === "color" || v === "dimension" || v === "dimension-shorthand" || v === "font-family"
}

export function toDTO(row: { key: string; value: string; group: string; type: string; locked: boolean; updatedBy: string | null; updatedAt: Date }): DesignTokenDTO | null {
  if (!isTokenGroup(row.group) || !isTokenType(row.type)) return null
  return {
    key: row.key,
    value: row.value,
    group: row.group,
    type: row.type,
    locked: row.locked,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  }
}

// Builds the <style> body injected in <head>. Font-role tokens target
// `body` (see the file header comment above for why); everything else
// targets `:root`. Both use !important for one consistent reason to
// reason about: next/font's own generated stylesheet order relative to
// this inline tag isn't a documented contract, so relying on plain
// source-order cascade for the non-font tokens would be fragile too.
export function buildDesignTokenCss(tokens: DesignTokenDTO[]): string {
  if (tokens.length === 0) return ""
  const rootDecls: string[] = []
  const bodyDecls: string[] = []
  for (const t of tokens) {
    if (!isValidTokenValue(t.type, t.value)) continue // defense in depth - should never trip if writes are validated
    const decl = `${t.key}: ${t.value} !important;`
    if (t.group === "font") bodyDecls.push(decl)
    else rootDecls.push(decl)
  }
  const parts: string[] = []
  if (rootDecls.length) parts.push(`:root{${rootDecls.join("")}}`)
  if (bodyDecls.length) parts.push(`body{${bodyDecls.join("")}}`)
  return parts.join("")
}

// Defaults, mirrored 1:1 from src/app/globals.css (the 82 pre-existing
// --afa-* tokens) plus the 11 new ones this ticket adds (4 --afa-radius-*,
// 3 --afa-btn-padding-*, 4 --font-* role tokens). This is the single
// source of truth "reset to defaults" restores to - kept as a plain
// object (not re-read from globals.css at runtime) so a reset works
// even if globals.css itself has since drifted, and so there's one
// place, not two, to keep in sync with the seed migration.
export const DEFAULT_TOKEN_VALUES: Record<string, string> = {
  "--afa-amber": "#C9973A",
  "--afa-blue": "#4A6FA5",
  "--afa-blue-dark": "#2E5C8A",
  "--afa-brown-black": "#1A1000",
  "--afa-brown-dark": "#4A2E1A",
  "--afa-brown-gold": "#8A5A1E",
  "--afa-cream": "#F7F3EE",
  "--afa-error": "#B3261E",
  "--afa-forest": "#2F4A28",
  "--afa-gold": "#8A6A1F",
  "--afa-gray-taupe": "#8A877E",
  "--afa-green-black": "#001A10",
  "--afa-green-bright": "#2F7D4A",
  "--afa-green-dark": "#276749",
  "--afa-green-deep": "#166534",
  "--afa-green-mid": "#2D6A4F",
  "--afa-indigo-black": "#0A001A",
  "--afa-ink": "#0E0C0A",
  "--afa-maroon-black": "#1A0500",
  "--afa-mint-tint": "#EAF3E7",
  "--afa-orange-dark": "#C2410C",
  "--afa-peach": "#F5A26E",
  "--afa-plum": "#7A4A8A",
  "--afa-plum-black": "#1A0A1A",
  "--afa-red-alt": "#EF4444",
  "--afa-sage": "#4A6741",
  "--afa-social-blue": "#1D9BF0",
  "--afa-taupe": "#8A827A",
  "--afa-terracotta": "#C8441A",
  "--afa-white": "#FFF",
  "--afa-brand-mark": "#C8441A",
  "--afa-surface-page": "#141414",
  "--afa-surface-raised": "#1F1F1F",
  "--afa-surface-inverse": "#0A0A0A",
  "--afa-text-primary": "#F5F5F0",
  "--afa-text-secondary": "rgba(245, 245, 240, 0.65)",
  "--afa-text-muted": "rgba(245, 245, 240, 0.5)",
  "--afa-text-soft": "rgba(245, 245, 240, 0.8)",
  "--afa-text-inverse": "#F5F5F0",
  "--afa-text-on-image": "rgba(255, 255, 255, 0.5)",
  "--afa-fill-solid": "#FF5A36",
  "--afa-border-resting": "rgba(245, 245, 240, 0.15)",
  "--afa-tint-08": "rgba(245, 245, 240, 0.08)",
  "--afa-tint-10": "rgba(245, 245, 240, 0.1)",
  "--afa-tint-04": "rgba(245, 245, 240, 0.04)",
  "--afa-tint-06": "rgba(245, 245, 240, 0.06)",
  "--afa-tint-12": "rgba(245, 245, 240, 0.12)",
  "--afa-tint-20": "rgba(245, 245, 240, 0.2)",
  "--afa-tint-30": "rgba(245, 245, 240, 0.3)",
  "--afa-amber-wash": "rgba(201, 151, 58, 0.08)",
  "--afa-amber-tint": "rgba(201, 151, 58, 0.15)",
  "--afa-amber-border": "rgba(201, 151, 58, 0.4)",
  "--afa-amber-strong": "rgba(201, 151, 58, 0.6)",
  "--afa-error-tint": "rgba(179, 38, 30, 0.1)",
  "--afa-error-edge": "rgba(179, 38, 30, 0.3)",
  "--afa-sage-tint": "rgba(74, 103, 65, 0.12)",
  "--afa-success-tint": "rgba(39, 103, 73, 0.15)",
  "--afa-fill-tint": "rgba(255, 90, 54, 0.2)",
  "--afa-blue-tint": "rgba(74, 111, 165, 0.15)",
  "--afa-shadow": "rgba(0, 0, 0, 0.3)",
  "--afa-scrim": "rgba(10, 10, 10, 0.7)",
  "--afa-scrim-strong": "rgba(10, 10, 10, 0.9)",
  "--afa-on-fill-solid": "var(--afa-brown-black)",
  "--afa-sage-bright": "#7AA86E",
  "--afa-error-bright": "#E67870",
  "--afa-text-micro": "11px",
  "--afa-text-small": "12px",
  "--afa-text-ui": "13px",
  "--afa-text-body": "14px",
  "--afa-text-title": "16px",
  "--afa-text-subheading": "22px",
  "--afa-text-heading": "24px",
  "--afa-text-page-title": "28px",
  "--afa-text-page-title-lg": "32px",
  "--afa-space-1": "4px",
  "--afa-space-2": "8px",
  "--afa-space-3": "12px",
  "--afa-space-4": "16px",
  "--afa-space-5": "20px",
  "--afa-space-6": "24px",
  "--afa-radius-sharp": "0px",
  "--afa-radius-sm": "6px",
  "--afa-radius-md": "8px",
  "--afa-radius-pill": "999px",
  "--afa-radius-xs": "3px",
  "--afa-radius-lg": "12px",
  "--afa-radius-xl": "16px",
  "--afa-radius-2xl": "20px",
  "--afa-btn-padding-sm": "4px 10px",
  "--afa-btn-padding-md": "9px 17px",
  "--afa-btn-padding-lg": "12px 24px",
  "--afa-btn-padding-pill-sm": "6px 14px",
  "--afa-btn-padding-pill-md": "10px 18px",
  "--afa-space-2px": "2px",
  "--afa-space-6px": "6px",
  "--afa-space-10px": "10px",
  "--afa-space-14px": "14px",
  "--afa-space-18px": "18px",
  "--afa-space-28px": "28px",
  "--afa-space-32px": "32px",
  "--afa-space-48px": "48px",
  "--afa-text-caption": "10px",
  "--afa-text-body-lg": "15px",
  "--afa-text-lead": "18px",
  "--afa-text-subtitle": "20px",
  "--font-display": "var(--font-phys-young-serif)",
  "--font-ui": "var(--font-phys-schibsted-grotesk)",
  "--font-sans": "var(--font-phys-instrument-sans)",
  "--font-mono": "var(--font-phys-jetbrains-mono)",
}

// WCAG 2.x relative luminance / contrast ratio - no shared helper
// existed anywhere in the repo (every prior contrast check documented
// in HANDOFF.md was done by hand, ad hoc, per session). Only handles
// #hex and rgb()/rgba() - the two shapes every color token in this
// table actually uses (see isValidTokenValue above) - a `var()`
// reference (only --afa-on-fill-solid) is resolved by the caller before
// this runs.
function srgbToLinear(c: number): number {
  const cs = c / 255
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

export function parseCssColor(value: string): [number, number, number, number] | null {
  const hex = value.match(/^#([0-9a-fA-F]{3,8})$/)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("")
    if (h.length !== 6 && h.length !== 8) return null
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return [r, g, b, a]
  }
  return parseRgb(value)
}

function parseRgb(value: string): [number, number, number, number] | null {
  const m = value.match(RGB_COLOR)
  if (!m) return null
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (r > 255 || g > 255 || b > 255) return null
  const a = m[4] !== undefined ? Number(m[4]) : 1
  if (a > 1) return null
  return [r, g, b, a]
}

function relativeLuminance([r, g, b]: [number, number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

// Alpha-aware: a translucent text color is flattened onto its
// background before computing luminance, since that's what's actually
// visible - several real tokens here are rgba() with alpha < 1
// (--afa-text-secondary, --afa-text-muted, --afa-text-on-image).
function flattenOnBackground(fg: [number, number, number, number], bg: [number, number, number, number]): [number, number, number, number] {
  const a = fg[3]
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]
}

export function contrastRatio(fgValue: string, bgValue: string): number | null {
  const fgRaw = parseCssColor(fgValue)
  const bgRaw = parseCssColor(bgValue)
  if (!fgRaw || !bgRaw) return null
  const fg = flattenOnBackground(fgRaw, bgRaw)
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bgRaw)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}
