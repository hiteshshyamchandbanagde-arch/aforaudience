'use client'

import { useEffect, useRef, useState } from 'react'

// Replaces the old free-text "comma separated" Facilities input, which
// directly produced garbage public-facing data (Feedback 3213952d, session
// 36 QA). Bounded preset list + an "Other" free-text fallback (capped
// length, lightly sanitized) - same shape Hitesh chose for this field,
// still outputs a plain string[] so no backend/schema change is needed;
// VenueCreate/Edit's existing `facilities: string[]` write path is untouched.
//
// Feedback cms7d0tjh (30 Jul) - the Other input used to be a fully
// controlled field bound straight to a value derived from the saved
// array (split on comma, filtered, re-joined). That meant every
// keystroke round-tripped through the array and back, so a trailing
// comma the user just typed - the only way to start a second item -
// was stripped immediately, before they could type anything after it.
// Fix: the input now owns its own local text state (otherText) so it
// shows exactly what was typed, including in-progress trailing commas
// and spaces; the parsed array is still computed and pushed up via
// onChange on every change, saving works identically. Only resynced
// from the `value` prop until the user's first edit (handles the async
// venue-edit-page-loads-later case) via hasUserEditedOther.

const PRESET_FACILITIES = [
  'Parking',
  'WiFi',
  'Air Conditioning',
  'Sound System',
  'Stage Lighting',
  'Green Room',
  'Bar / Refreshments',
  'Wheelchair Accessible',
  'Restrooms',
  'Power Backup',
  'Projector / Screen',
]

const MAX_OTHER_LENGTH = 200

interface Props {
  value: string[]
  onChange: (facilities: string[]) => void
}

const splitOther = (raw: string) =>
  raw.split(',').map((f) => f.trim()).filter(Boolean).slice(0, 10)

export default function FacilitiesPicker({ value, onChange }: Props) {
  const presetSelected = value.filter((v) => PRESET_FACILITIES.includes(v))
  // Anything in `value` that isn't one of the presets is "Other" content -
  // this correctly round-trips existing venues that already have free-text
  // facilities saved from before this component existed.
  const derivedOther = value.filter((v) => !PRESET_FACILITIES.includes(v)).join(', ')

  const [otherText, setOtherText] = useState(derivedOther)
  const hasUserEditedOther = useRef(false)

  // Keep following the prop until the user actually types in the field -
  // covers venue-edit pages where `value` starts empty and is populated
  // moments later once the fetch resolves. Once they've typed, this
  // component is the source of truth for what's displayed.
  useEffect(() => {
    if (!hasUserEditedOther.current) setOtherText(derivedOther)
  }, [derivedOther])

  const togglePreset = (facility: string) => {
    const next = presetSelected.includes(facility)
      ? presetSelected.filter((f) => f !== facility)
      : [...presetSelected, facility]
    onChange([...next, ...splitOther(otherText)])
  }

  const handleOtherChange = (raw: string) => {
    hasUserEditedOther.current = true
    const clamped = raw.slice(0, MAX_OTHER_LENGTH)
    setOtherText(clamped)
    onChange([...presetSelected, ...splitOther(clamped)])
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        {PRESET_FACILITIES.map((facility) => {
          const selected = presetSelected.includes(facility)
          return (
            <button
              key={facility}
              type="button"
              onClick={() => togglePreset(facility)}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: '999px',
                border: selected ? '1px solid var(--afa-text-primary)' : '1px solid rgba(245,245,240,0.15)',
                background: selected ? 'var(--afa-fill-solid)' : 'transparent',
                color: selected ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-primary)',
                cursor: 'pointer',
              }}
            >
              {facility}
            </button>
          )
        })}
      </div>
      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
        Other <span style={{ fontWeight: 400, opacity: 0.7 }}>(comma separated, optional)</span>
      </label>
      <input
        type="text"
        value={otherText}
        onChange={(e) => handleOtherChange(e.target.value)}
        maxLength={MAX_OTHER_LENGTH}
        placeholder="e.g., Rooftop seating, Valet"
        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(245,245,240,0.15)', background: '#171717', color: 'var(--afa-text-primary)', fontSize: '14px', boxSizing: 'border-box' }}
      />
    </div>
  )
}
