'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { chipCityLabel } from '@/lib/country-codes'
import { nearestCity, locateOutcome, roundKm, type CityPoint } from '@/lib/nearest-city'
import { useLocale } from '@/lib/i18n/translate'
import Button from '@/components/ui/Button'
import { LOCATION_CHANGED_EVENT, type LocationChangedDetail } from '@/lib/app-events'

interface LocationState {
  city: string | null
  lat: number | null
  lng: number | null
  country: string | null
  // A deliberate choice (account city or a picked city), not an IP guess:
  // see ResolvedLocation.saved in src/lib/location.ts.
  saved: boolean
}

interface CityOption {
  city: string
  country: string | null
  label: string
  lat: number | null
  lng: number | null
}

// GEN-2610-005 - what "Use my location" has to say, shown at the top of
// the open picker.
type GeoState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'unavailable' }
  | { kind: 'far'; option: CityOption; km: number }
  | { kind: 'prompt'; option: CityOption }

// Cities "Not now" was said to, on this device. The travel prompt does
// not come back for them.
const DISMISSED_KEY = 'afa-loc-dismissed'

function readDismissed(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : []
  } catch {
    // localStorage disabled (private mode) or a bad value - nothing dismissed.
    return []
  }
}

function rememberDismissed(city: string) {
  try {
    const list = readDismissed()
    if (!list.includes(city)) localStorage.setItem(DISMISSED_KEY, JSON.stringify([...list, city]))
  } catch {
    // localStorage disabled - the prompt may come back next tap. Not fatal.
  }
}

// BUG-2610-019 - the search box takes focus when the picker opens on a
// desktop only. On a touch screen or a narrow one (< 768 px) focus would
// pop the keyboard over half the screen, hiding "Use my location" and the
// short city list. Read when the picker opens (it only renders after a tap).
function focusSearchOnOpen(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(pointer: coarse), (max-width: 767px)').matches
}

// Throws on a failed response, so the picker keeps "loading" and asks
// again on the next open instead of treating it as a city list (BUG-2610-032).
async function fetchCities(): Promise<CityOption[]> {
  const res = await fetch('/api/venues/cities')
  if (!res.ok) throw new Error(`/api/venues/cities: HTTP ${res.status}`)
  const data = await res.json()
  return data?.cities ?? []
}

// FEAT-2608-036. Small header control: shows the resolved location
// (profile choice > cookie > this-visit IP-geo guess, resolved server-
// side by /api/user/location - see src/lib/location.ts) and lets the
// user override it from a free list of cities we actually have venues
// in. No Google Places call - see route/component comments for why.
//
// GEN-2610-005 - "Use my location", the first row of the picker. The
// browser's geolocation is asked only on that tap, never on page load.
// The fix goes to the nearest city that has approved venues (haversine
// on src/lib/city-centroids.ts / venue lat/lng, src/lib/nearest-city.ts):
// within NEAR_CITY_KM it is picked like a manual pick (POST, manual
// cookie), further away the picker names the nearest city and its
// distance. A saved city (account or picked) is never replaced without
// asking: the picker says "You seem to be in {city}. Switch?", and "Not
// now" keeps that city from being offered again on this device. IP
// detection alone never asks - it is wrong too often on Indian mobile
// networks (carriers resolve to their gateway city).
// `inPanel` - the chip sits inside another clipping panel (the account
// menus in SiteNav and HomeHeader): the picker opens in the flow below
// the chip instead of floating, so the menu grows to show it rather than
// clipping it (GEN-2610-005: the "Use my location" messages were cut off
// at 1440).
export default function LocationChip({ variant = 'desktop', inPanel = false }: { variant?: 'desktop' | 'mobile' | 'topbar'; inPanel?: boolean }) {
  const { t } = useLocale()
  const [location, setLocation] = useState<LocationState | null>(null)
  const [open, setOpen] = useState(false)
  const [cities, setCities] = useState<CityOption[]>([])
  // BUG-2610-032 - false until /api/venues/cities has answered. Before that
  // an empty list means "still loading", not "no city matches".
  const [citiesLoaded, setCitiesLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [geo, setGeo] = useState<GeoState>({ kind: 'idle' })
  const containerRef = useRef<HTMLDivElement>(null)

  // BUG-2610-021 - re-read whenever the signed-in user changes (sign-in,
  // sign-out, another account), not only on mount: the top bar stays
  // mounted through a client-side sign-in, and kept the previous
  // account's city. The mount read already matches the session cookie,
  // so the first resolved session only records who it was for.
  const { data: session, status } = useSession()
  const sessionUser = status === 'loading' ? undefined : ((session?.user as { id?: string } | undefined)?.id ?? null)
  const readFor = useRef<string | null | undefined>(undefined)
  const [readCount, setReadCount] = useState(0)

  useEffect(() => {
    if (sessionUser === undefined) return
    if (readFor.current !== undefined && readFor.current !== sessionUser) setReadCount((n) => n + 1)
    readFor.current = sessionUser
  }, [sessionUser])

  useEffect(() => {
    let cancelled = false
    fetch('/api/user/location')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setLocation({ city: data.city, lat: data.lat, lng: data.lng, country: data.country ?? null, saved: data.saved === true }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [readCount])

  // A page can show two chips (SiteNav's and the mobile top bar's, one
  // hidden by CSS); a change made in one shows in the other.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<LocationChangedDetail>).detail
      if (detail?.city) setLocation({ city: detail.city, lat: null, lng: null, country: detail.country, saved: true })
    }
    window.addEventListener(LOCATION_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(LOCATION_CHANGED_EVENT, onChanged)
  }, [])

  useEffect(() => {
    if (!open || citiesLoaded) return
    let cancelled = false
    fetchCities()
      .then((list) => {
        if (cancelled) return
        setCities(list)
        setCitiesLoaded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, citiesLoaded])

  // A closed picker starts clean next time it opens.
  useEffect(() => {
    if (!open) setGeo({ kind: 'idle' })
  }, [open])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = async (option: CityOption) => {
    setOpen(false)
    setQuery('')
    setSaving(true)
    const previous = location
    setLocation({ city: option.city, lat: null, lng: null, country: option.country, saved: true })
    try {
      const res = await fetch('/api/user/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: option.city, lat: null, lng: null, country: option.country }),
      })
      if (!res.ok) {
        setLocation(previous)
        return
      }
      // BUG-2609-078 - tell the page (and any other chip) once the choice
      // is saved, so /venues and /events switch city without a reload.
      window.dispatchEvent(new CustomEvent<LocationChangedDetail>(LOCATION_CHANGED_EVENT, { detail: { city: option.city, country: option.country } }))
    } catch {
      setLocation(previous)
    } finally {
      setSaving(false)
    }
  }

  const handleUseMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo({ kind: 'unavailable' })
      return
    }
    setGeo({ kind: 'locating' })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const list = citiesLoaded ? cities : await fetchCities()
          if (!citiesLoaded) {
            setCities(list)
            setCitiesLoaded(true)
          }
          const byPoint = new Map<CityPoint, CityOption>()
          for (const c of list) {
            if (typeof c.lat === 'number' && typeof c.lng === 'number') byPoint.set({ city: c.city, country: c.country, lat: c.lat, lng: c.lng }, c)
          }
          const nearest = nearestCity(pos.coords.latitude, pos.coords.longitude, [...byPoint.keys()])
          const option = nearest ? list.find((c) => c.city === nearest.city && c.country === nearest.country) ?? null : null
          const outcome = locateOutcome({ nearest, currentCity: location?.city ?? null, saved: location?.saved === true, dismissedCities: readDismissed() })
          if (outcome === 'none' || !nearest || !option) setGeo({ kind: 'unavailable' })
          else if (outcome === 'far') setGeo({ kind: 'far', option, km: roundKm(nearest.km) })
          else if (outcome === 'prompt') setGeo({ kind: 'prompt', option })
          else if (outcome === 'select') handleSelect(option)
          else setOpen(false) // 'same' or 'dismissed': the city stays as it is
        } catch {
          setGeo({ kind: 'unavailable' })
        }
      },
      () => setGeo({ kind: 'unavailable' }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    )
  }

  const handleNotNow = (city: string) => {
    rememberDismissed(city)
    setOpen(false)
  }

  const filteredCities = cities.filter((c) => c.city.toLowerCase().includes(query.toLowerCase()))
  const label = location?.city ? chipCityLabel(location.city, location.country) : (location === null ? '…' : 'Set location')

  // 'topbar' (GEN-2609-019, Phase A) - MobileTopBar.tsx's compact slot
  // next to the logo: no pin emoji/background/padding (those read fine as
  // a standalone chip but too heavy stacked next to a logo + search bar
  // in a 60px-tall header), just the label + chevron at the small mono
  // size TopBar.tsx's own Figma reference uses for this exact spot.
  const chipStyle: React.CSSProperties =
    variant === 'mobile'
      ? { display: 'flex', alignItems: 'center', gap: 'var(--afa-space-6px)', fontSize: 'var(--afa-text-body-lg)', fontWeight: 500, color: 'var(--afa-text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 'var(--afa-space-3) 0', borderBottom: '1px solid var(--afa-tint-06)', width: '100%', textAlign: 'left' }
      : variant === 'topbar'
      ? { display: 'flex', alignItems: 'center', gap: 'var(--afa-space-2px)', fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-caption)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--afa-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, opacity: saving ? 0.6 : 1 }
      : { display: 'inline-flex', alignItems: 'center', gap: 'var(--afa-space-1)', fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'var(--afa-tint-04)', border: 'none', cursor: 'pointer', padding: 'var(--afa-space-6px) var(--afa-space-3)', borderRadius: 'var(--afa-radius-pill)', opacity: saving ? 0.6 : 1 }

  return (
    <div ref={containerRef} style={{ position: 'relative', marginTop: variant === 'topbar' ? '3px' : 0 }}>
      <Button
        // bare-reason: renders one of three context looks (mobile menu row, top-bar label, pill chip) to match the header hosting it; no one variant covers all three
        variant="bare"
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={chipStyle}
      >
        {variant !== 'topbar' && <span aria-hidden>📍</span>}
        {/* GEN-2610-005 - capped with an ellipsis in the top bar: a long
            city ("Thiruthuraipoondi") squeezed the 390 search box down to
            "Sea". The full name stays in the text, so it is still read out. */}
        <span style={variant === 'topbar' ? { maxWidth: '96px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}>{label}</span>
        <span style={{ opacity: 0.5, fontSize: variant === 'topbar' ? '8px' : '10px' }}>▾</span>
      </Button>
      {open && (
        <div
          style={{
            ...(inPanel ? { position: 'static', marginTop: 'var(--afa-space-6px)', boxSizing: 'border-box', width: '100%' } : { position: 'absolute', top: 'calc(100% + 6px)', width: '240px' }),
            left: variant === 'mobile' || variant === 'topbar' ? 0 : 'auto',
            right: variant === 'mobile' || variant === 'topbar' ? 0 : 0,
            background: 'var(--afa-surface-raised)',
            border: '1px solid var(--afa-border-resting)',
            borderRadius: 'var(--afa-radius-lg)',
            boxShadow: '0 8px 24px var(--afa-border-resting)',
            zIndex: 40,
            fontFamily: 'var(--font-sans)',
            padding: 'var(--afa-space-10px)',
          }}
        >
          <Button
            variant="menu-row"
            type="button"
            onClick={handleUseMyLocation}
            disabled={geo.kind === 'locating'}
          >
            <span aria-hidden>📍</span> {t.location.useMyLocation}
          </Button>
          {geo.kind !== 'idle' && (
            <div role="status" style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)', padding: 'var(--afa-space-6px) var(--afa-space-1)', display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-6px)' }}>
              {geo.kind === 'locating' && <span>{t.location.locating}</span>}
              {geo.kind === 'unavailable' && <span>{t.location.locationUnavailable}</span>}
              {geo.kind === 'far' && (
                <>
                  <span>{t.location.noShowsNearby.replace('{city}', geo.option.city).replace('{km}', String(geo.km))}</span>
                  <Button variant="outline-neutral" size="sm" type="button" onClick={() => handleSelect(geo.option)}>
                    {t.location.switchToCity.replace('{city}', geo.option.city)}
                  </Button>
                </>
              )}
              {geo.kind === 'prompt' && (
                <>
                  <span>{t.location.travelPrompt.replace('{city}', geo.option.city)}</span>
                  <div style={{ display: 'flex', gap: 'var(--afa-space-2)' }}>
                    <Button variant="primary" size="sm" type="button" onClick={() => handleSelect(geo.option)}>
                      {t.location.switchButton}
                    </Button>
                    <Button variant="outline-neutral" size="sm" type="button" onClick={() => handleNotNow(geo.option.city)}>
                      {t.location.notNow}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.location.searchCityPlaceholder}
            autoFocus={focusSearchOnOpen()}
            style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--afa-space-2) var(--afa-space-10px)', borderRadius: 'var(--afa-radius-sm)', border: '1px solid var(--afa-border-resting)', fontSize: 'var(--afa-text-ui)', marginBottom: 'var(--afa-space-2)', outline: 'none', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)' }}
          />
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {/* BUG-2610-032 - "no match" only once the list is here and a search found nothing. */}
            {!citiesLoaded ? (
              // aria-live, not role="status": the picker's one status region is the "Use my location" message.
              <div aria-live="polite" data-testid="city-list-loading" style={{ fontSize: 'var(--afa-text-small)', opacity: 0.5, padding: 'var(--afa-space-6px) var(--afa-space-1)' }}>{t.location.loadingCities}</div>
            ) : filteredCities.length === 0 ? (
              query.trim() !== '' && (
                <div style={{ fontSize: 'var(--afa-text-small)', opacity: 0.5, padding: 'var(--afa-space-6px) var(--afa-space-1)' }}>{t.location.noMatchingCities}</div>
              )
            ) : (
              filteredCities.map((c) => (
                <Button
                  variant="menu-row"
                  key={c.city}
                  type="button"
                  selected={c.city === location?.city}
                  onClick={() => handleSelect(c)}
                >
                  {chipCityLabel(c.city, c.country)}
                </Button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
