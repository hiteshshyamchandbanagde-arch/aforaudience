'use client'

// Replaces the old free-text "comma separated" Facilities input, which
// directly produced garbage public-facing data (Feedback 3213952d, session
// 36 QA). Bounded preset list + an "Other" free-text fallback (capped
// length, lightly sanitized) - same shape Hitesh chose for this field,
// still outputs a plain string[] so no backend/schema change is needed;
// VenueCreate/Edit's existing `facilities: string[]` write path is untouched.

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

export default function FacilitiesPicker({ value, onChange }: Props) {
  const presetSelected = value.filter((v) => PRESET_FACILITIES.includes(v))
  // Anything in `value` that isn't one of the presets is "Other" content -
  // this correctly round-trips existing venues that already have free-text
  // facilities saved from before this component existed.
  const otherValue = value.filter((v) => !PRESET_FACILITIES.includes(v)).join(', ')

  const togglePreset = (facility: string) => {
    const next = presetSelected.includes(facility)
      ? presetSelected.filter((f) => f !== facility)
      : [...presetSelected, facility]
    onChange([...next, ...splitOther(otherValue)])
  }

  const splitOther = (raw: string) =>
    raw.split(',').map((f) => f.trim()).filter(Boolean).slice(0, 10)

  const handleOtherChange = (raw: string) => {
    const clamped = raw.slice(0, MAX_OTHER_LENGTH)
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
                border: selected ? '1px solid var(--afa-ink)' : '1px solid rgba(14,12,10,0.15)',
                background: selected ? 'var(--afa-ink)' : 'transparent',
                color: selected ? 'var(--afa-cream)' : 'var(--afa-ink)',
                cursor: 'pointer',
              }}
            >
              {facility}
            </button>
          )
        })}
      </div>
      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-ink)', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
        Other <span style={{ fontWeight: 400, opacity: 0.7 }}>(comma separated, optional)</span>
      </label>
      <input
        type="text"
        value={otherValue}
        onChange={(e) => handleOtherChange(e.target.value)}
        maxLength={MAX_OTHER_LENGTH}
        placeholder="e.g., Rooftop seating, Valet"
        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px', boxSizing: 'border-box' }}
      />
    </div>
  )
}
