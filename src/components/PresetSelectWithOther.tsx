'use client'

import { useState, useEffect } from 'react'

const MAX_OTHER_LENGTH = 60

interface Props {
  value: string
  onChange: (value: string) => void
  presets: string[]
  placeholder?: string
  inputStyle: React.CSSProperties
}

// Single-select preset dropdown + "Other - specify" free-text fallback.
// Distinct from FacilitiesPicker (multi-select chips) since Dress Code and
// Vibe are each a single value, not a list. Optional field either way -
// "None / not specified" is always available as the first option.
export default function PresetSelectWithOther({ value, onChange, presets, placeholder, inputStyle }: Props) {
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
        <option value="">None / not specified</option>
        {presets.map((preset) => (
          <option key={preset} value={preset}>{preset}</option>
        ))}
        <option value="__other__">Other — specify</option>
      </select>
      {showOther && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_OTHER_LENGTH))}
          maxLength={MAX_OTHER_LENGTH}
          placeholder={placeholder}
          style={{ ...inputStyle, marginTop: '8px' }}
        />
      )}
    </div>
  )
}
