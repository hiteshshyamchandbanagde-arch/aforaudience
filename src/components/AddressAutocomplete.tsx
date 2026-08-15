'use client'

import { useEffect, useRef, useState } from 'react'

interface PlacePrediction {
  placeId: string
  mainText: string
  secondaryText: string
}

interface ResolvedAddress {
  formattedAddress: string | null
  city: string
  state: string | null
  country: string | null
  lat: number | null
  lng: number | null
  placeId: string | null
}

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string) => void
  onResolved: (location: ResolvedAddress) => void
  // Fired only when the person types into the field directly - NOT when
  // this component sets the text itself after a selection. Lets the
  // parent form know "the address is no longer what autocomplete last
  // resolved" so it can clear lat/lng/placeId and revert the Google Maps
  // Link field from its read-only auto-derived state back to a plain
  // editable input (see venue create/edit pages, PR #212).
  onManualEdit?: () => void
  inputStyle: React.CSSProperties
  placeholder?: string
}

// Address-level search (street addresses, premises, and named
// establishments - so typing a venue's actual name can surface its
// real indexed address). Deliberately built as ONE merged lookup that
// also derives City/State/Country/lat-lng from the same Place Details
// response, instead of running a second independent search - this is
// what keeps API call volume/cost the same as the City-only feature
// that shipped in PR #210, per the cost note in docs/design.md §9.4.
//
// Same graceful-degradation pattern as CityAutocomplete: typing an
// address with no clean match still works and just saves as free
// text, since many real venues here (homes, informal spaces) won't
// have a clean Google-indexed listing.
export default function AddressAutocomplete({ value, onChange, onResolved, onManualEdit, inputStyle, placeholder }: AddressAutocompleteProps) {
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
    if (value.trim().length < 3) {
      setPredictions([])
      return
    }
    setLoading(true)
    const timeout = setTimeout(() => {
      fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value.trim(), sessionToken: getSessionToken(), mode: 'address' }),
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
        body: JSON.stringify({ placeId: prediction.placeId, sessionToken: getSessionToken(), includeAddress: true }),
      })
      if (res.ok) {
        const location = await res.json()
        onChange(location.formattedAddress || prediction.mainText)
        onResolved({ ...location, placeId: prediction.placeId })
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
        onChange={(e) => { onManualEdit?.(); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'Start typing an address or venue name...'}
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
            background: 'var(--afa-white, #fff)',
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
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, fontSize: '12px', opacity: 0.5, padding: '4px 2px' }}>
          Searching...
        </div>
      )}
    </div>
  )
}
