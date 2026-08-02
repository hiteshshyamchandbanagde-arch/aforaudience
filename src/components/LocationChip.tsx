'use client'

import { useEffect, useRef, useState } from 'react'

interface LocationState {
  city: string | null
  lat: number | null
  lng: number | null
}

// FEAT-2608-036. Small header control: shows the resolved location
// (profile choice > cookie > this-visit IP-geo guess, resolved server-
// side by /api/user/location - see src/lib/location.ts) and lets the
// user override it from a free list of cities we actually have venues
// in. Deliberately no browser Geolocation prompt and no Google Places
// call - see route/component comments for why.
export default function LocationChip({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const [location, setLocation] = useState<LocationState | null>(null)
  const [open, setOpen] = useState(false)
  const [cities, setCities] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/user/location')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setLocation({ city: data.city, lat: data.lat, lng: data.lng }) })
      .catch(() => {})
    return () => { cancelled = true }
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

  const handleSelect = async (city: string) => {
    setOpen(false)
    setQuery('')
    setSaving(true)
    const previous = location
    setLocation({ city, lat: null, lng: null })
    try {
      const res = await fetch('/api/user/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, lat: null, lng: null }),
      })
      if (!res.ok) setLocation(previous)
    } catch {
      setLocation(previous)
    } finally {
      setSaving(false)
    }
  }

  const filteredCities = cities.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
  const label = location?.city ?? (location === null ? '…' : 'Set location')

  const chipStyle: React.CSSProperties =
    variant === 'mobile'
      ? { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: 500, color: 'var(--afa-ink)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 0', borderBottom: '1px solid rgba(14,12,10,0.06)', width: '100%', textAlign: 'left' }
      : { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--afa-ink)', background: 'rgba(14,12,10,0.05)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', opacity: saving ? 0.6 : 1 }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={chipStyle}>
        <span aria-hidden>📍</span>
        <span>{label}</span>
        <span style={{ opacity: 0.5, fontSize: '10px' }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: variant === 'mobile' ? 0 : 'auto',
            right: variant === 'mobile' ? 0 : 0,
            background: 'var(--afa-white, #fff)',
            border: '1px solid rgba(14,12,10,0.15)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(14,12,10,0.15)',
            zIndex: 40,
            width: '240px',
            padding: '10px',
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city..."
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '13px', marginBottom: '8px', outline: 'none' }}
          />
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filteredCities.length === 0 ? (
              <div style={{ fontSize: '12px', opacity: 0.5, padding: '6px 4px' }}>No matching cities</div>
            ) : (
              filteredCities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelect(c)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 8px', border: 'none', background: c === location?.city ? 'rgba(200,68,26,0.08)' : 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--afa-ink)', borderRadius: '6px' }}
                >
                  {c}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
