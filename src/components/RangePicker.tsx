'use client'

const RANGES: { value: string; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
]

export default function RangePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: '4px', background: 'rgba(245,245,240,0.05)', padding: '4px', borderRadius: '8px' }}>
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            color: value === r.value ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-primary)',
            background: value === r.value ? 'var(--afa-fill-solid)' : 'transparent',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
