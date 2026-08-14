// Multi-language Phase 1 (GEN-2608-012 follow-up). Scope is deliberately
// narrow for this pilot: SiteNav chrome only (nav links, account menu,
// language picker itself) - NOT static pages, NOT user-generated content
// (event/artist bios etc., which have no clean translation story and
// aren't attempted here). Hindi shipped first; Telugu/Tamil/Kannada/
// Malayalam added 13 Aug (same nav-chrome scope, same array-driven
// picker). Gujarati/Bengali added same day, continuing sequentially
// (Hitesh: "go one by one, gujrati, bengali, german, french,
// spainish... don't wait for my reply") - German/French/Spanish are
// next, noting they sit outside AFA's India-only functional scope
// (phone verification, payment settlement) even though this UI-text
// addition itself doesn't change that.
//
// Persistence is localStorage-only for this pilot (mirrors afa-theme),
// not a User.locale DB field yet - deliberately not adding a migration
// for an unproven pilot. Promote to a profile-persisted field (same
// pattern as User.defaultCity / displayCurrency) once Hindi is confirmed
// and the other 4 languages are queued.

export const LOCALES = [
  { id: "en", label: "English", nativeLabel: "English" },
  { id: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { id: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { id: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { id: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { id: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
  { id: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી" },
  { id: "bn", label: "Bengali", nativeLabel: "বাংলা" },
] as const

export type LocaleId = typeof LOCALES[number]["id"]

export const DEFAULT_LOCALE: LocaleId = "en"

// Allow-list mirrors the theme pre-paint script's `valid` array pattern -
// kept as a literal array (not derived from LOCALES) anywhere it needs to
// run before the module graph is guaranteed loaded.
export const VALID_LOCALE_IDS: string[] = LOCALES.map((l) => l.id)
