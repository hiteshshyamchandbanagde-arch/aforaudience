'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useLocale } from '@/lib/i18n/translate'
import { LOCALES } from '@/lib/i18n/locales'
import LocationChip from '@/components/LocationChip'
import { FilterSlidersIcon } from '@/components/icons/EventIcons'
import { TopBarSearchIcon, TopBarGlobeIcon } from '@/components/icons/MobileTopBarIcons'

// Mobile Nav v3, Phase A (GEN-2609-019) - global mobile top bar, ported
// from the Figma Make "AFA Mobile App v3" export's TopBar.tsx (structure,
// not literal code - that mock has no real auth/i18n/location system to
// wire against). Mounted once in the root layout (see layout.tsx),
// self-gated to mobile via `lg:hidden` same as MobileTabBar.tsx, and
// replaces SiteNav.tsx's entire header on mobile (not just its hamburger
// drawer) - see SiteNav.tsx's own comment on why its whole <nav> is now
// hidden below the same breakpoint rather than just the drawer panel.
//
// Two judgment calls made here, flagged per the dispatch brief rather
// than guessed silently:
//
// 1. Language placement (Phase A's own open flag - the Figma mock has no
//    language control anywhere). Put here, not on Profile: the removed
//    hamburger drawer's language picker was reachable by EVERYONE,
//    signed in or not (profile/page.tsx redirects guests to /login, so a
//    Profile-only home would have regressed guest access to changing
//    language). A small globe icon next to the auth buttons keeps that
//    same "no login required" reach.
// 2. "Search bar replaces the filter icon" on /events (confirmed 8 Sep,
//    "one unified entry point, not two separate ones"): implemented as a
//    filter-sliders icon *attached to* this same search input (not a
//    separate button/row below it, which is what actually existed
//    before) - tapping it opens the exact same MobileEventFilterSheet via
//    a custom window event, since that sheet is owned by events/page.tsx
//    (a different component tree) and this bar is global. Typing in the
//    input forwards live via the same event bridge to that page's real
//    `search` state - events/page.tsx's own hero search box is now
//    hidden on mobile (see that file's own comment) so there's exactly
//    one search entry point at this width, not two. One accepted
//    scope-trim: the hero search's BrowseSearchDropdown autocomplete
//    doesn't follow into this bar - out of scope for Phase A, worth a
//    fast-follow if it's missed.
export const MOBILE_SEARCH_EVENT = 'afa:mobile-search'
export const MOBILE_SEARCH_OPEN_FILTERS_EVENT = 'afa:mobile-search-open-filters'

export default function MobileTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { locale, setLocale, t } = useLocale()

  const normalizedPathname = pathname && pathname !== '/' ? pathname.replace(/\/$/, '') : pathname
  const onEventsRoute = normalizedPathname === '/events'

  const [query, setQuery] = useState('')
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!langOpen) return
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [langOpen])

  // Query resets per-route rather than persisting globally - matches
  // events/page.tsx's own `search` state, which is that page's local
  // state and never survives a navigation away either.
  useEffect(() => {
    setQuery('')
  }, [normalizedPathname])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (onEventsRoute) {
      window.dispatchEvent(new CustomEvent(MOBILE_SEARCH_EVENT, { detail: { query: value } }))
    }
  }

  const handleOpenFilters = () => {
    if (!onEventsRoute) return
    window.dispatchEvent(new CustomEvent(MOBILE_SEARCH_OPEN_FILTERS_EVENT))
  }

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    if (onEventsRoute) return
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/events?search=${encodeURIComponent(trimmed)}`)
  }

  const user = session?.user as { name?: string | null } | undefined

  return (
    <header
      // `flex` lives in the className (Tailwind), not the inline style -
      // an inline `display` would out-specificity `lg:hidden`'s own
      // `display: none` media rule and defeat it at desktop widths (real
      // bug, caught via a live computed-style check: this bar was still
      // `display: flex` at 1440px until this fix). Same reason
      // MobileTabBar.tsx keeps ALL layout-affecting props (flex,
      // items-stretch, justify-around, fixed, bottom-0) in its className
      // and only non-conflicting properties (background, zIndex, padding)
      // in its style object - matched here.
      className="lg:hidden flex items-center"
      style={{
        position: 'sticky',
        // Same CSS var SiteNav.tsx uses for its own sticky `top` offset -
        // NudgeStack.tsx (rendered just before this in layout.tsx) is
        // itself sticky top:0, and sets this var to its own live height so
        // whatever sticky element comes after it stacks below instead of
        // overlapping. Same zIndex as SiteNav/NudgeStack (100) since this
        // bar now plays SiteNav's header role on mobile.
        top: 'var(--nudge-stack-height, 0px)',
        zIndex: 100,
        gap: '10px',
        padding: '10px 14px',
        background: 'rgba(20,20,20,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(245,245,240,0.08)',
      }}
    >
      <Link href="/" style={{ flexShrink: 0, lineHeight: 1, textDecoration: 'none' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--afa-text-primary)', display: 'block', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--afa-brand-mark)' }}>A</span>forAudience
        </span>
        <LocationChip variant="topbar" />
      </Link>

      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <TopBarSearchIcon
          style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--afa-text-muted)', pointerEvents: 'none' }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={handleOpenFilters}
          onKeyDown={handleSearchSubmit}
          placeholder={t.search.mobileTopBarPlaceholder}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: onEventsRoute ? '8px 30px 8px 26px' : '8px 8px 8px 26px',
            borderRadius: '999px',
            border: '1px solid rgba(245,245,240,0.12)',
            background: 'var(--afa-surface-raised)',
            color: 'var(--afa-text-primary)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        {onEventsRoute && (
          <button
            type="button"
            onClick={handleOpenFilters}
            aria-label={t.eventsPage.filtersButtonLabel}
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: 'var(--afa-amber)',
              cursor: 'pointer',
            }}
          >
            <FilterSlidersIcon style={{ width: '15px', height: '15px' }} />
          </button>
        )}
      </div>

      <div ref={langRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setLangOpen((v) => !v)}
          aria-label={t.languagePicker.label}
          aria-expanded={langOpen}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--afa-text-secondary)', cursor: 'pointer' }}
        >
          <TopBarGlobeIcon style={{ width: '17px', height: '17px' }} />
        </button>
        {langOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              background: 'var(--afa-surface-raised)',
              border: '1px solid rgba(245,245,240,0.1)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              padding: '6px',
              minWidth: '150px',
              zIndex: 20,
            }}
          >
            {LOCALES.map((l) => (
              <button
                key={l.id}
                onClick={() => { setLocale(l.id); setLangOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: '6px', border: 'none', background: locale === l.id ? 'rgba(201,151,58,0.08)' : 'transparent', color: 'var(--afa-text-primary)', fontSize: '13px', fontWeight: locale === l.id ? 700 : 500, cursor: 'pointer' }}
              >
                {l.nativeLabel}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: user ? '8px' : '5px' }}>
        {status === 'loading' ? null : user ? (
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--afa-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {t.nav.signOut}
          </button>
        ) : (
          <>
            {/* Narrower letter-spacing/padding than the signed-in Sign
                Out button on purpose - two elements here (vs one) eat
                into the search input's width at 360-375px, this is the
                sizing-only fold-in for that. */}
            <Link href="/login" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--afa-text-secondary)', textDecoration: 'none' }}>
              {t.nav.signIn}
            </Link>
            <Link
              href="/register"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--afa-on-fill-solid)', background: 'var(--afa-fill-solid)', textDecoration: 'none', padding: '5px 7px', borderRadius: '999px' }}
            >
              {t.nav.signUp}
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
