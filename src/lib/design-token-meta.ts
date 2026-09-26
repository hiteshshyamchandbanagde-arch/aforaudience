// GEN-2609-108 - plain-language labels for the design-system editor.
//
// Every key in DEFAULT_TOKEN_VALUES has an entry (scripts/design-tokens.
// test.ts fails otherwise). For colours, `usedFor` comes from where the
// token is actually read (git grep "var(KEY)" over src, the same pass
// design-token-coverage.ts records), not from the token's name. For the
// type, radius, padding and spacing scales it describes the step's role
// in the scale; each step has too many consumers to list.
//
// Pure data, no imports beyond types: safe for the admin page (a Client
// Component).

export type ColorSection = "surfaces" | "text" | "brand" | "status" | "tints" | "overlays"

export const COLOR_SECTIONS: { id: ColorSection; label: string }[] = [
  { id: "surfaces", label: "Surfaces" },
  { id: "text", label: "Text" },
  { id: "brand", label: "Brand & actions" },
  { id: "status", label: "Status tones" },
  { id: "tints", label: "Tints & borders" },
  { id: "overlays", label: "Overlays & shadows" },
]

export type TokenMeta = { label: string; usedFor: string; section?: ColorSection }

export const TOKEN_META: Record<string, TokenMeta> = {
  // --- Surfaces
  "--afa-surface-page": { section: "surfaces", label: "Page background", usedFor: "the base background behind every page" },
  "--afa-surface-raised": { section: "surfaces", label: "Raised surface", usedFor: "cards, panels, dialogs, inputs" },
  "--afa-surface-inverse": { section: "surfaces", label: "Deepest background", usedFor: "avatar circles, hero and image backdrops" },
  "--afa-ink": { section: "surfaces", label: "Backdrop glow", usedFor: "the radial-gradient centre on the Four Rooms and photo backdrops" },
  "--afa-brown-black": { section: "surfaces", label: "Placeholder: brown", usedFor: "event-card placeholder background; also the primary-button text colour" },
  "--afa-green-black": { section: "surfaces", label: "Placeholder: green", usedFor: "event-card placeholder background (Open Mic)" },
  "--afa-maroon-black": { section: "surfaces", label: "Placeholder: maroon", usedFor: "event-card placeholder background" },
  "--afa-plum-black": { section: "surfaces", label: "Placeholder: plum", usedFor: "event-card placeholder background" },
  "--afa-indigo-black": { section: "surfaces", label: "Placeholder: indigo", usedFor: "event-card placeholder background" },

  // --- Text
  "--afa-text-primary": { section: "text", label: "Primary text", usedFor: "headings, body copy, most text" },
  "--afa-text-soft": { section: "text", label: "Soft text", usedFor: "quotes, stat values, slightly quieter body copy" },
  "--afa-text-secondary": { section: "text", label: "Secondary text", usedFor: "descriptions, supporting lines, inactive tabs" },
  "--afa-text-muted": { section: "text", label: "Muted text", usedFor: "timestamps, helper text, empty states" },
  "--afa-text-inverse": { section: "text", label: "Text on dark hero", usedFor: "headings on the home, For Artists and Four Rooms dark panels" },
  "--afa-text-on-image": { section: "text", label: "Text on photo", usedFor: "subtitles over hero photos (Organisers, Venue Owners, Wall of Fame)" },
  "--afa-cream": { section: "text", label: "Cream text", usedFor: "text on coloured fills (success and form-submit buttons, seat-map markers)" },
  "--afa-white": { section: "text", label: "White", usedFor: "text in your own message bubbles" },

  // --- Brand & actions
  "--afa-amber": { section: "brand", label: "Amber accent", usedFor: "links, highlights, active nav, focus accents" },
  "--afa-fill-solid": { section: "brand", label: "Primary button fill", usedFor: "main call-to-action buttons, selected states" },
  "--afa-on-fill-solid": { section: "brand", label: "Primary button text", usedFor: "text and icons on the primary button fill" },
  "--afa-brand-mark": { section: "brand", label: "Logo \"A\"", usedFor: "the coloured A in the AforAudience wordmark" },
  "--afa-terracotta": { section: "brand", label: "Terracotta (legacy)", usedFor: "no live style reads it; only a code comment in SiteNav mentions it" },
  "--afa-peach": { section: "brand", label: "Peach", usedFor: "the eyebrow label on the home hero rotator" },
  "--afa-social-blue": { section: "brand", label: "Verified-badge blue", usedFor: "the verified tick on artist profiles" },

  // --- Status tones
  "--afa-sage": { section: "status", label: "Success green", usedFor: "success button fill, confirmed borders" },
  "--afa-sage-bright": { section: "status", label: "Success text", usedFor: "success badge and status text on dark" },
  "--afa-error": { section: "status", label: "Error red", usedFor: "error fills and borders, offline banner" },
  "--afa-error-bright": { section: "status", label: "Error text", usedFor: "error messages and error badge text on dark" },
  "--afa-red-alt": { section: "status", label: "Alert red", usedFor: "load-error messages, critical-priority badges" },
  "--afa-gold": { section: "status", label: "Featured gold", usedFor: "featured-card and top-rank borders" },
  "--afa-green-deep": { section: "status", label: "Delivered green", usedFor: "delivered / rising / retry-ok labels" },
  "--afa-green-dark": { section: "status", label: "Auth success green", usedFor: "success notices on login, register and verify email" },
  "--afa-green-bright": { section: "status", label: "Positive figure green", usedFor: "net-positive earnings, back-online banner" },
  "--afa-green-mid": { section: "status", label: "Toast success", usedFor: "the success toast accent" },
  "--afa-forest": { section: "status", label: "Check-in success", usedFor: "the successful-scan banner on event check-in" },
  "--afa-blue": { section: "status", label: "In-progress blue", usedFor: "In Progress status on the admin diary" },
  "--afa-orange-dark": { section: "status", label: "High-priority orange", usedFor: "High priority on admin feedback" },
  "--afa-gray-taupe": { section: "status", label: "Refunded grey", usedFor: "Refunded status on venue bookings" },
  "--afa-taupe": { section: "status", label: "Quiet label taupe", usedFor: "small meta labels on admin feedback (\"via chatbot\")" },
  "--afa-brown-gold": { section: "status", label: "Warning note", usedFor: "a warning note on the organiser event edit page" },
  "--afa-blue-dark": { section: "status", label: "Seat map: blue", usedFor: "seat-map tier colour and Gate marker" },
  "--afa-plum": { section: "status", label: "Seat map: plum", usedFor: "seat-map tier colour and stage-distance marker" },
  "--afa-brown-dark": { section: "status", label: "Seat map: brown", usedFor: "seat-map tier colour" },

  // --- Tints & borders
  "--afa-border-resting": { section: "tints", label: "Default border", usedFor: "card, input and divider borders" },
  "--afa-tint-04": { section: "tints", label: "Faint tint (4%)", usedFor: "muted rows, faint dividers" },
  "--afa-tint-06": { section: "tints", label: "Light tint (6%)", usedFor: "list dividers, neutral badges" },
  "--afa-tint-08": { section: "tints", label: "Tint (8%)", usedFor: "hover fills, neutral chips, soft borders" },
  "--afa-tint-10": { section: "tints", label: "Tint (10%)", usedFor: "hover fills, borders" },
  "--afa-tint-12": { section: "tints", label: "Tint (12%)", usedFor: "form-input borders" },
  "--afa-tint-20": { section: "tints", label: "Tint (20%)", usedFor: "inactive dots and stars, stronger borders" },
  "--afa-tint-30": { section: "tints", label: "Tint (30%)", usedFor: "disabled fills, image overlays" },
  "--afa-amber-wash": { section: "tints", label: "Amber wash", usedFor: "unread rows, highlighted notes" },
  "--afa-amber-tint": { section: "tints", label: "Amber tint", usedFor: "amber badges, selected chips" },
  "--afa-amber-border": { section: "tints", label: "Amber border", usedFor: "highlighted card and chip borders" },
  "--afa-amber-strong": { section: "tints", label: "Amber (strong)", usedFor: "hover borders on organiser cards, theatre mark" },
  "--afa-error-tint": { section: "tints", label: "Error tint", usedFor: "error notice and badge backgrounds" },
  "--afa-error-edge": { section: "tints", label: "Error border", usedFor: "error notice borders" },
  "--afa-sage-tint": { section: "tints", label: "Success tint", usedFor: "success badge and banner backgrounds" },
  "--afa-success-tint": { section: "tints", label: "Success notice tint", usedFor: "success notice backgrounds on auth pages" },
  "--afa-fill-tint": { section: "tints", label: "Primary tint", usedFor: "selected toggles and borders in the primary colour" },
  "--afa-blue-tint": { section: "tints", label: "Blue tint", usedFor: "In Progress badge background (admin diary)" },
  "--afa-mint-tint": { section: "tints", label: "Checked-in row", usedFor: "checked-in attendee rows on event check-in" },

  // --- Overlays & shadows
  "--afa-shadow": { section: "overlays", label: "Shadow", usedFor: "drop shadows on menus, sheets and cards" },
  "--afa-scrim": { section: "overlays", label: "Dialog backdrop", usedFor: "the dim layer behind dialogs and sheets" },
  "--afa-scrim-strong": { section: "overlays", label: "Strong backdrop", usedFor: "photo fades and full-screen overlays" },

  // --- Font roles
  "--font-display": { label: "Display font", usedFor: "page titles and headlines" },
  "--font-ui": { label: "UI font", usedFor: "buttons, tabs, navigation" },
  "--font-sans": { label: "Body font", usedFor: "body copy and forms" },
  "--font-mono": { label: "Mono font", usedFor: "eyebrows, prices, small labels" },

  // --- Type scale
  "--afa-text-caption": { label: "Caption", usedFor: "badge micro-labels" },
  "--afa-text-micro": { label: "Micro", usedFor: "labels, eyebrows, tags" },
  "--afa-text-small": { label: "Small", usedFor: "meta lines, helper text" },
  "--afa-text-ui": { label: "UI", usedFor: "buttons, inputs, compact lists" },
  "--afa-text-body": { label: "Body", usedFor: "running text" },
  "--afa-text-body-lg": { label: "Body large", usedFor: "lead paragraphs in cards" },
  "--afa-text-title": { label: "Title", usedFor: "card titles, hero subtitles" },
  "--afa-text-lead": { label: "Lead", usedFor: "section titles in panels" },
  "--afa-text-subtitle": { label: "Subtitle", usedFor: "dialog titles, sub-sections" },
  "--afa-text-subheading": { label: "Subheading", usedFor: "big stat figures, section headings" },
  "--afa-text-heading": { label: "Heading", usedFor: "section headings" },
  "--afa-text-page-title": { label: "Page title", usedFor: "dashboard page titles" },
  "--afa-text-page-title-lg": { label: "Page title (large)", usedFor: "public page titles" },

  // --- Radius
  "--afa-radius-sharp": { label: "Sharp", usedFor: "square corners" },
  "--afa-radius-xs": { label: "Extra small", usedFor: "tiny chips, progress bars" },
  "--afa-radius-sm": { label: "Small", usedFor: "buttons, small inputs" },
  "--afa-radius-md": { label: "Medium", usedFor: "inputs, form buttons, small cards" },
  "--afa-radius-lg": { label: "Large", usedFor: "cards and panels" },
  "--afa-radius-xl": { label: "Extra large", usedFor: "large cards, sheets" },
  "--afa-radius-2xl": { label: "2× large", usedFor: "hero cards, modals" },
  "--afa-radius-pill": { label: "Pill", usedFor: "pills, chips, round buttons, avatars" },

  // --- Button padding
  "--afa-btn-padding-sm": { label: "Button small", usedFor: "padding on small buttons" },
  "--afa-btn-padding-md": { label: "Button medium", usedFor: "padding on standard buttons" },
  "--afa-btn-padding-lg": { label: "Button large", usedFor: "padding on large buttons" },
  "--afa-btn-padding-pill-sm": { label: "Pill small", usedFor: "padding on small pill toggles" },
  "--afa-btn-padding-pill-md": { label: "Pill medium", usedFor: "padding on standard pill toggles" },

  // --- Spacing (hidden from the editor - GEN-2609-107 keeps spacing out
  // of admin control - but still labelled so the table stays complete)
  "--afa-space-2px": { label: "Space 2", usedFor: "hairline gaps" },
  "--afa-space-1": { label: "Space 4", usedFor: "tight gaps" },
  "--afa-space-6px": { label: "Space 6", usedFor: "small gaps" },
  "--afa-space-2": { label: "Space 8", usedFor: "small gaps and padding" },
  "--afa-space-10px": { label: "Space 10", usedFor: "compact padding" },
  "--afa-space-3": { label: "Space 12", usedFor: "padding and gaps" },
  "--afa-space-14px": { label: "Space 14", usedFor: "padding and gaps" },
  "--afa-space-4": { label: "Space 16", usedFor: "standard padding" },
  "--afa-space-18px": { label: "Space 18", usedFor: "padding" },
  "--afa-space-5": { label: "Space 20", usedFor: "card padding" },
  "--afa-space-6": { label: "Space 24", usedFor: "section padding" },
  "--afa-space-28px": { label: "Space 28", usedFor: "section spacing" },
  "--afa-space-32px": { label: "Space 32", usedFor: "section spacing" },
  "--afa-space-48px": { label: "Space 48", usedFor: "page-level spacing" },
}

export function tokenMeta(key: string): TokenMeta {
  return TOKEN_META[key] ?? { label: key, usedFor: "" }
}

// Case-insensitive match on label, raw key or usedFor.
export function tokenMatches(key: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const m = tokenMeta(key)
  return key.toLowerCase().includes(q) || m.label.toLowerCase().includes(q) || m.usedFor.toLowerCase().includes(q)
}

// Position in TOKEN_META, which lists each colour subsection in reading
// order (page before raised, primary text before muted, ...).
const ORDER = new Map(Object.keys(TOKEN_META).map((k, i) => [k, i]))
export function tokenOrder(key: string): number {
  return ORDER.get(key) ?? Number.MAX_SAFE_INTEGER
}
