'use client'

import { FILL_SOLID_TINT } from '@/lib/statusStyle'
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
    <div style={{ display: 'inline-flex', gap: '4px', background: 'rgba(245,245,240,0.05)', padding: '4px', borderRadius: 'var(--afa-radius-md)' }}>
      {RANGES.map((r) => (
        <Button
          variant="bare"
          key={r.value}
          onClick={() => onChange(r.value)}
          style={{
            fontSize: 'var(--afa-text-ui)',
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 'var(--afa-radius-sm)',
            color: value === r.value ? 'var(--afa-fill-solid)' : 'var(--afa-text-primary)',
            background: value === r.value ? FILL_SOLID_TINT : undefined,
          }}
        >
          {r.label}
        </Button>
      ))}
    </div>
  )
}
