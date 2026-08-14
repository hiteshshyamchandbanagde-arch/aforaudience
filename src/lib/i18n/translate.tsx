"use client"

import { createContext, useContext, useEffect, useState } from "react"
import en from "./dictionaries/en"
import hi from "./dictionaries/hi"
import te from "./dictionaries/te"
import ta from "./dictionaries/ta"
import kn from "./dictionaries/kn"
import ml from "./dictionaries/ml"
import gu from "./dictionaries/gu"
import bn from "./dictionaries/bn"
import de from "./dictionaries/de"
import fr from "./dictionaries/fr"
import es from "./dictionaries/es"
import { DEFAULT_LOCALE, VALID_LOCALE_IDS, type LocaleId } from "./locales"

export type Dictionary = typeof en

const DICTIONARIES: Record<LocaleId, Dictionary> = {
  en,
  hi,
  te,
  ta,
  kn,
  ml,
  gu,
  bn,
  de,
  fr,
  es,
}

const STORAGE_KEY = "afa-locale"

type LocaleContextValue = {
  locale: LocaleId
  setLocale: (id: LocaleId) => void
  t: Dictionary
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: en,
})

// Client-only, localStorage-backed - deliberately mirrors the Theme
// picker's pattern (SiteNav.tsx applyTheme/useEffect), not a DB field yet.
// No pre-paint script for this pilot: unlike the theme's CSS attribute,
// there's no flash-free way to swap rendered text before hydration
// without SSR-aware routing (next-intl style [locale] segments), which is
// a much bigger structural change than this pilot's nav-only scope
// justifies. Worst case on a saved Hindi preference: nav briefly shows
// English then flips after mount - acceptable for a chrome-only pilot,
// revisit if/when this expands past nav labels.
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(DEFAULT_LOCALE)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && VALID_LOCALE_IDS.indexOf(saved) !== -1) {
        setLocaleState(saved as LocaleId)
      }
    } catch (e) {
      // localStorage can throw in private-browsing/embedded contexts -
      // silently keep the default, same handling as the theme script.
    }
  }, [])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale)
    }
  }, [locale])

  const setLocale = (id: LocaleId) => {
    setLocaleState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch (e) {}
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: DICTIONARIES[locale] }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
