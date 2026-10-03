'use client'

import { SELECTED, SELECTED_BG } from '@/lib/statusStyle'
import Button from '@/components/ui/Button'

const RANGES: { value: string; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
]

export default function RangePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    // BUG-2609-087 - five segments on one line at phone width: labels never
    // wrap ("All Time" did at 412), the side padding narrows with the
    // viewport, and the track scrolls rather than widening the page if it
    // still doesn't fit.
    <div style={{ display: 'inline-flex', maxWidth: '100%', overflowX: 'auto', gap: 'var(--afa-space-1)', background: 'var(--afa-tint-04)', padding: 'var(--afa-space-1)', borderRadius: 'var(--afa-radius-md)' }}>
      {RANGES.map((r) => (
        <Button
          // bare-reason: segmented control: borderless segments inside one shared tinted track; toggle-box and toggle-pill are free-standing bordered options
          variant="bare"
          key={r.value}
          onClick={() => onChange(r.value)}
          style={{
            fontSize: 'var(--afa-text-ui)',
            fontWeight: 600,
            padding: 'var(--afa-space-6px) clamp(var(--afa-space-2), 2.6vw, var(--afa-space-14px))',
            flexShrink: 0,
            borderRadius: 'var(--afa-radius-sm)',
            whiteSpace: 'nowrap',
            // GEN-2609-118 - the chosen period is a selected state: amber.
            color: value === r.value ? SELECTED : 'var(--afa-text-primary)',
            background: value === r.value ? SELECTED_BG : undefined,
          }}
        >
          {r.label}
        </Button>
      ))}
    </div>
  )
}
