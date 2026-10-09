"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import en from "./dictionaries/en"
import hi from "./dictionaries/hi"
import mr from "./dictionaries/mr"
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
  mr,
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

function saveToAccount(id: LocaleId) {
  fetch("/api/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferredLocale: id }),
  }).catch(() => {
    // Not saved to the account this time; the device keeps it.
  })
}

// Client-only rendering, like the Theme picker's pattern (SiteNav.tsx
// applyTheme/useEffect). No pre-paint script: unlike the theme's CSS
// attribute, there's no flash-free way to swap rendered text before
// hydration without SSR-aware routing (next-intl style [locale]
// segments). Worst case on a saved Hindi preference: the page briefly
// shows English then flips after mount.
//
// GEN-2610-006 - where the choice lives:
// - The device: localStorage (afa-locale), for guests and signed-in alike.
// - The account: User.preferredLocale. A signed-in pick is saved there too
//   (PATCH /api/users/me), and whenever a signed-in user appears (sign-in,
//   session load) the account's value wins over the device and is mirrored
//   to localStorage. A null account value keeps the device's choice.
// The default stays English and is never picked from the city (5 Oct rule).
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(DEFAULT_LOCALE)
  const { data: session, status } = useSession()
  const userId = (session?.user as { id?: string } | undefined)?.id
  // Bumped on every pick, so an account read that started before the pick
  // can't overwrite it when it lands.
  const pickSeq = useRef(0)
  // A pick made while the session is still loading: saved to the account
  // once it turns out someone is signed in, instead of being read over.
  const pendingSave = useRef<LocaleId | null>(null)

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
    if (!userId) return
    if (pendingSave.current) {
      saveToAccount(pendingSave.current)
      pendingSave.current = null
      return
    }
    const seq = pickSeq.current
    let cancelled = false
    fetch("/api/users/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const saved = data?.user?.preferredLocale
        if (cancelled || seq !== pickSeq.current) return
        if (typeof saved !== "string" || VALID_LOCALE_IDS.indexOf(saved) === -1) return
        setLocaleState(saved as LocaleId)
        try {
          localStorage.setItem(STORAGE_KEY, saved)
        } catch (e) {}
      })
      .catch(() => {
        // Offline or a cold function: the device's choice stands.
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale)
    }
  }, [locale])

  const setLocale = (id: LocaleId) => {
    pickSeq.current += 1
    setLocaleState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch (e) {}
    if (userId) saveToAccount(id)
    else if (status === "loading") pendingSave.current = id
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
