'use client'

import { PRESET_GENRES } from '@/lib/genres'
import { useLocale } from '@/lib/i18n/translate'

// Same fix pattern as FacilitiesPicker (Feedback 3213952d, session 36) and
// Dress Code/Vibe (session 36) - replaces free-text "comma separated"
// Genre input, which directly produced garbage public-facing filter chips
// (Feedback 3b8cb30d, confirmed live: "Standup comedy"/"Stand-up"/"standup
// comic" as three separate chips instead of one, "Aman" - an artist's own
// name - used as a genre, role-words like "Singer"/"Dancer"/"Poet" instead
// of an actual genre). Bounded preset list + an "Other" free-text fallback
// (capped length) - still outputs a plain string[] so no backend/schema
// change is needed; Artist.genre's existing write path is untouched.
//
// Session 39 addition (PR #224): an "Other" value entered here shows on
// the submitting artist's own profile immediately (this component doesn't
// block or gate anything client-side) - but the API layer (see
// /api/artists/me and /api/artists/apply) separately logs it as a
// GenreRequest, so it won't appear as a public filter-chip option on
// /artists until an admin approves it there.

const MAX_OTHER_LENGTH = 200

interface Props {
  value: string[]
  onChange: (genres: string[]) => void
}

export default function GenrePicker({ value, onChange }: Props) {
  const { t: tr } = useLocale()
  const presetSelected = value.filter((v) => PRESET_GENRES.includes(v))
  // Anything in `value` that isn't one of the presets is "Other" content -
  // this correctly round-trips existing artists who already have free-text
  // genre saved from before this component existed (e.g. "Aman", "Singer").
  const otherValue = value.filter((v) => !PRESET_GENRES.includes(v)).join(', ')

  const splitOther = (raw: string) =>
    raw.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 10)

  const togglePreset = (genre: string) => {
    const next = presetSelected.includes(genre)
      ? presetSelected.filter((g) => g !== genre)
      : [...presetSelected, genre]
    onChange([...next, ...splitOther(otherValue)])
  }

  const handleOtherChange = (raw: string) => {
    const clamped = raw.slice(0, MAX_OTHER_LENGTH)
    onChange([...presetSelected, ...splitOther(clamped)])
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        {PRESET_GENRES.map((genre) => {
          const selected = presetSelected.includes(genre)
          return (
            <button
              key={genre}
              type="button"
              onClick={() => togglePreset(genre)}
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
              {genre}
            </button>
          )
        })}
      </div>
      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
        {tr.genrePicker.otherLabel} <span style={{ fontWeight: 400, opacity: 0.7 }}>{tr.genrePicker.otherHint}</span>
      </label>
      <input
        type="text"
        value={otherValue}
        onChange={(e) => handleOtherChange(e.target.value)}
        maxLength={MAX_OTHER_LENGTH}
        placeholder={tr.genrePicker.otherPlaceholder}
        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '14px', boxSizing: 'border-box' }}
      />
    </div>
  )
}
