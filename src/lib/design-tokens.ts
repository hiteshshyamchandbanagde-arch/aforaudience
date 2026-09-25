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
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/
const COLOR_VAR_REF = /^var\(--afa-[a-z0-9-]+\)$/
const DIMENSION = /^0$|^-?\d+(\.\d+)?(px|rem|em|%)$/
const DIMENSION_SHORTHAND = /^\d+(\.\d+)?px(\s+\d+(\.\d+)?px){0,3}$/

export function isValidTokenValue(type: TokenType, value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 120) return false
  // Belt-and-braces: none of these characters are ever legitimate inside
  // a single CSS custom property value in this app, and every one of
  // them is exactly what a style/markup-injection payload would need.
  if (/[<>{};]|\/\*|\*\//.test(value)) return false

  switch (type) {
    case "color":
      return HEX_COLOR.test(value) || RGB_COLOR.test(value) || COLOR_VAR_REF.test(value)
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
  "--afa-error-border": "#F5C2C0",
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
  "--afa-text-muted": "rgba(245, 245, 240, 0.4)",
  "--afa-text-inverse": "#F5F5F0",
  "--afa-text-on-image": "rgba(255, 255, 255, 0.5)",
  "--afa-fill-solid": "#FF5A36",
  "--afa-border-resting": "rgba(245, 245, 240, 0.15)",
  "--afa-tint-08": "rgba(245, 245, 240, 0.08)",
  "--afa-tint-10": "rgba(245, 245, 240, 0.1)",
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
  "--afa-btn-padding-sm": "4px 10px",
  "--afa-btn-padding-md": "9px 17px",
  "--afa-btn-padding-lg": "12px 24px",
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
  "--afa-radius-10px": "10px",
  "--afa-radius-12px": "12px",
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
  const rgb = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/)
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] !== undefined ? Number(rgb[4]) : 1]
  }
  return null
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
