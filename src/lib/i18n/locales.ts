// Multi-language Phase 1 (GEN-2608-012 follow-up). Scope is deliberately
// narrow for this pilot: SiteNav chrome only (nav links, account menu,
// language picker itself) - NOT static pages, NOT user-generated content
// (event/artist bios etc., which have no clean translation story and
// aren't attempted here). Hindi ships first; Telugu/Tamil/Kannada/
// Malayalam are added as LOCALES entries + dictionary files once Hindi is
// confirmed clean on a real device - no further picker/infra rework
// needed, same "array now, content later" pattern as the Theme Phase 2
// picker rebuild.
//
// Persistence is localStorage-only for this pilot (mirrors afa-theme),
// not a User.locale DB field yet - deliberately not adding a migration
// for an unproven pilot. Promote to a profile-persisted field (same
// pattern as User.defaultCity / displayCurrency) once Hindi is confirmed
// and the other 4 languages are queued.

export const LOCALES = [
  { id: "en", label: "English", nativeLabel: "English" },
  { id: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
] as const

export type LocaleId = typeof LOCALES[number]["id"]

export const DEFAULT_LOCALE: LocaleId = "en"

// Allow-list mirrors the theme pre-paint script's `valid` array pattern -
// kept as a literal array (not derived from LOCALES) anywhere it needs to
// run before the module graph is guaranteed loaded.
export const VALID_LOCALE_IDS: string[] = LOCALES.map((l) => l.id)
