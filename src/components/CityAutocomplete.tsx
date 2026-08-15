'use client'

import { useEffect, useRef, useState } from 'react'

interface PlacePrediction {
  placeId: string
  mainText: string
  secondaryText: string
}

interface ResolvedLocation {
  city: string
  state: string | null
  country: string | null
  lat: number | null
  lng: number | null
}

interface CityAutocompleteProps {
  value: string
  onChange: (city: string) => void
  onResolved: (location: ResolvedLocation) => void
  inputStyle: React.CSSProperties
  placeholder?: string
}

// Replaces the plain free-text City input on venue create/edit with a
// real Places (New) autocomplete - typing shows city suggestions,
// picking one resolves State/Country automatically via a Place Details
// call. Debounced the same way SearchBox.tsx already does (250ms) for
// consistency with the rest of the app.
//
// Session token: generated once per "search episode" (first keystroke
// after the field was empty/just resolved), reused across every
// keystroke and the final Details call, then regenerated - this is
// what makes Google bill the whole search-and-pick as one cheap
// session instead of per-keystroke (see src/lib/places.ts).
export default function CityAutocomplete({ value, onChange, onResolved, inputStyle, placeholder }: CityAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionTokenRef = useRef<string | null>(null)

  const getSessionToken = () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = crypto.randomUUID()
    }
    return sessionTokenRef.current
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (value.trim().length < 2) {
      setPredictions([])
      return
    }
    setLoading(true)
    const timeout = setTimeout(() => {
      fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value.trim(), sessionToken: getSessionToken(), mode: 'city' }),
      })
        .then((res) => res.json())
        .then((data) => setPredictions(Array.isArray(data.predictions) ? data.predictions : []))
        .catch(() => setPredictions([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleSelect = async (prediction: PlacePrediction) => {
    setOpen(false)
    onChange(prediction.mainText)
    setResolving(true)
    try {
      const res = await fetch('/api/places/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: prediction.placeId, sessionToken: getSessionToken() }),
      })
      if (res.ok) {
        const location = await res.json()
        onResolved(location)
      }
    } finally {
      // Session is over (terminated by the Details call above) -
      // next search episode gets a fresh token.
      sessionTokenRef.current = null
      setResolving(false)
      setPredictions([])
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'Start typing a city...'}
        style={inputStyle}
        autoComplete="off"
      />
      {resolving && (
        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', opacity: 0.5 }}>
          ...
        </span>
      )}
      {open && predictions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--afa-surface-raised)',
            border: '1px solid rgba(14,12,10,0.15)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(14,12,10,0.12)',
            zIndex: 20,
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {predictions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              onClick={() => handleSelect(p)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--afa-text-primary)',
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span style={{ fontWeight: 600 }}>{p.mainText}</span>
              {p.secondaryText && (
                <span style={{ opacity: 0.55 }}> · {p.secondaryText}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {loading && open && predictions.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            fontSize: '12px',
            opacity: 0.5,
            padding: '4px 2px',
          }}
        >
          Searching...
        </div>
      )}
    </div>
  )
}
