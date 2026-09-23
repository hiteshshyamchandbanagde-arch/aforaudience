// GEN-2609-068 - the /tickets/ page v6 redesign's "ticket stub" row
// (Tier / Qty / Ref, mono micro-label over value, inset on
// --afa-surface-inverse). Generalized to N labeled cells rather than a
// hardcoded Tier/Qty/Ref shape - per the dispatch's own instruction to
// check reusability before making this single-purpose. Real reuse
// candidates spotted but NOT migrated in this pass (out of scope for a
// tickets-page redesign, flagged in docs/design.md instead): the seat-
// tier legend in SeatLayoutPreview.tsx/SeatPicker.tsx, and the booking-
// summary line in checkout/[bookingId]/page.tsx - both are their own
// existing, already-shipped patterns that would need their own audit
// before forcing onto this shape.
export interface StubCell {
  label: string
  value: React.ReactNode
  align?: 'left' | 'center' | 'right'
}

export default function StubRow({ cells, style }: { cells: StubCell[]; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderRadius: 8,
        background: 'var(--afa-surface-inverse)',
        padding: '8px 12px',
        ...style,
      }}
    >
      {cells.map((cell, i) => (
        <div
          key={i}
          style={{
            minWidth: 0,
            textAlign: cell.align ?? (i === 0 ? 'left' : i === cells.length - 1 ? 'right' : 'center'),
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--afa-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {cell.label}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--afa-text-micro)',
              color: 'var(--afa-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  )
}
