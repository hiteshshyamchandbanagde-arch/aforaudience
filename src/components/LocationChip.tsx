'use client'

import { useEffect, useRef, useState } from 'react'
import { cityLabel } from '@/lib/country-codes'
import { useLocale } from '@/lib/i18n/translate'
import Button from '@/components/ui/Button'
import { LOCATION_CHANGED_EVENT, type LocationChangedDetail } from '@/lib/app-events'

interface LocationState {
  city: string | null
  lat: number | null
  lng: number | null
  country: string | null
}

interface CityOption {
  city: string
  country: string | null
  label: string
}

// FEAT-2608-036. Small header control: shows the resolved location
// (profile choice > cookie > this-visit IP-geo guess, resolved server-
// side by /api/user/location - see src/lib/location.ts) and lets the
// user override it from a free list of cities we actually have venues
// in. Deliberately no browser Geolocation prompt and no Google Places
// call - see route/component comments for why.
export default function LocationChip({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' | 'topbar' }) {
  const { t } = useLocale()
  const [location, setLocation] = useState<LocationState | null>(null)
  const [open, setOpen] = useState(false)
  const [cities, setCities] = useState<CityOption[]>([])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/user/location')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setLocation({ city: data.city, lat: data.lat, lng: data.lng, country: data.country ?? null }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // A page can show two chips (SiteNav's and the mobile top bar's, one
  // hidden by CSS); a change made in one shows in the other.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<LocationChangedDetail>).detail
      if (detail?.city) setLocation({ city: detail.city, lat: null, lng: null, country: detail.country })
    }
    window.addEventListener(LOCATION_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(LOCATION_CHANGED_EVENT, onChanged)
  }, [])

  useEffect(() => {
    if (!open || cities.length > 0) return
    fetch('/api/venues/cities')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.cities) setCities(data.cities) })
      .catch(() => {})
  }, [open, cities.length])

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
    setLocation({ city: option.city, lat: null, lng: null, country: option.country })
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

  const filteredCities = cities.filter((c) => c.city.toLowerCase().includes(query.toLowerCase()))
  const label = location?.city ? cityLabel(location.city, location.country) : (location === null ? '…' : 'Set location')

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
        <span>{label}</span>
        <span style={{ opacity: 0.5, fontSize: variant === 'topbar' ? '8px' : '10px' }}>▾</span>
      </Button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: variant === 'mobile' || variant === 'topbar' ? 0 : 'auto',
            right: variant === 'mobile' || variant === 'topbar' ? 0 : 0,
            background: 'var(--afa-surface-raised)',
            border: '1px solid var(--afa-border-resting)',
            borderRadius: 'var(--afa-radius-lg)',
            boxShadow: '0 8px 24px var(--afa-border-resting)',
            zIndex: 40,
            width: '240px',
            padding: 'var(--afa-space-10px)',
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.location.searchCityPlaceholder}
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--afa-space-2) var(--afa-space-10px)', borderRadius: 'var(--afa-radius-sm)', border: '1px solid var(--afa-border-resting)', fontSize: 'var(--afa-text-ui)', marginBottom: 'var(--afa-space-2)', outline: 'none', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)' }}
          />
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filteredCities.length === 0 ? (
              <div style={{ fontSize: 'var(--afa-text-small)', opacity: 0.5, padding: 'var(--afa-space-6px) var(--afa-space-1)' }}>{t.location.noMatchingCities}</div>
            ) : (
              filteredCities.map((c) => (
                <Button
                  variant="menu-row"
                  key={c.city}
                  type="button"
                  selected={c.city === location?.city}
                  onClick={() => handleSelect(c)}
                >
                  {c.label}
                </Button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
