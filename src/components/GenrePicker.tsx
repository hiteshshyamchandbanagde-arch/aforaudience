'use client'

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
// Preset list grounded in real DB values at time of writing, not guessed -
// covers the actual acts on this platform (open mic: comedy, poetry,
// storytelling, music, spoken word) rather than a generic genre taxonomy.
const PRESET_GENRES = [
  'Stand-up Comedy',
  'Poetry',
  'Storytelling',
  'Spoken Word',
  'Music - Acoustic',
  'Singing',
  'Rap / Hip-Hop',
  'Dance',
  'Theatre / Drama',
  'Improv',
  'Magic',
]

const MAX_OTHER_LENGTH = 200

interface Props {
  value: string[]
  onChange: (genres: string[]) => void
}

export default function GenrePicker({ value, onChange }: Props) {
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
                border: selected ? '1px solid var(--afa-ink)' : '1px solid rgba(14,12,10,0.15)',
                background: selected ? 'var(--afa-ink)' : 'transparent',
                color: selected ? 'var(--afa-cream)' : 'var(--afa-ink)',
                cursor: 'pointer',
              }}
            >
              {genre}
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
        placeholder="e.g., Beatboxing, Mimicry"
        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px', boxSizing: 'border-box' }}
      />
    </div>
  )
}
