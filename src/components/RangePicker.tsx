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
    <div style={{ display: 'inline-flex', gap: 'var(--afa-space-1)', background: 'var(--afa-tint-04)', padding: 'var(--afa-space-1)', borderRadius: 'var(--afa-radius-md)' }}>
      {RANGES.map((r) => (
        <Button
          // bare-reason: segmented control: borderless segments inside one shared tinted track; toggle-box and toggle-pill are free-standing bordered options
          variant="bare"
          key={r.value}
          onClick={() => onChange(r.value)}
          style={{
            fontSize: 'var(--afa-text-ui)',
            fontWeight: 600,
            padding: 'var(--afa-space-6px) var(--afa-space-14px)',
            borderRadius: 'var(--afa-radius-sm)',
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
