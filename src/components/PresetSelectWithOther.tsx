'use client'

import { useState, useEffect } from 'react'

const MAX_OTHER_LENGTH = 60

interface Props {
  value: string
  onChange: (value: string) => void
  presets: string[]
  placeholder?: string
  inputStyle: React.CSSProperties
  // GEN-2610-007 - labels in the UI language; the stored value stays the
  // English preset. Pages that aren't translated leave these out.
  presetLabels?: Record<string, string>
  noneLabel?: string
  otherLabel?: string
}

// Single-select preset dropdown + "Other - specify" free-text fallback.
// Distinct from FacilitiesPicker (multi-select chips) since Dress Code and
// Vibe are each a single value, not a list. Optional field either way -
// "None / not specified" is always available as the first option.
export default function PresetSelectWithOther({ value, onChange, presets, placeholder, inputStyle, presetLabels, noneLabel = 'None / not specified', otherLabel = 'Other — specify' }: Props) {
  const isPreset = value === '' || presets.includes(value)
  const [showOther, setShowOther] = useState(!isPreset)

  // If a preset gets auto-filled in from outside (EventType default) after
  // mount, make sure we're not stuck showing the Other text box for it.
  useEffect(() => {
    if (presets.includes(value)) setShowOther(false)
  }, [value, presets])

  const handleSelectChange = (selected: string) => {
    if (selected === '__other__') {
      setShowOther(true)
      onChange('')
    } else {
      setShowOther(false)
      onChange(selected)
    }
  }

  return (
    <div>
      <select
        value={showOther ? '__other__' : value}
        onChange={(e) => handleSelectChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">{noneLabel}</option>
        {presets.map((preset) => (
          <option key={preset} value={preset}>{presetLabels?.[preset] ?? preset}</option>
        ))}
        <option value="__other__">{otherLabel}</option>
      </select>
      {showOther && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_OTHER_LENGTH))}
          maxLength={MAX_OTHER_LENGTH}
          placeholder={placeholder}
          style={{ ...inputStyle, marginTop: 'var(--afa-space-2)' }}
        />
      )}
    </div>
  )
}
