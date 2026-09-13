'use client'

import { useState } from 'react'

// Read-only visual preview of a NUMBERED venue's saved seat layout, shown
// on the event-creation/edit pricing screen. Confirmed still missing
// (live-observed, 21 Jul session 13 and reconfirmed since): that screen
// showed zone names/counts/price inputs - enough to price correctly - but
// no way to actually see the zone shape or which level a zone belongs to.
// This is deliberately read-only and scaled-down - it's a confirmation
// view for the Organiser pricing an event, not the Venue Owner's builder
// (that stays at /dashboard/venue/[id]/seat-map).

export type PreviewSeat = {
  tierLabel: string
  level: string
  row: string
  number: string
  x: number
  y: number
}

// Same palette as the seat-map builder's colorForTier, duplicated here on
// purpose - this is a small, self-contained read-only view and doesn't
// justify a shared-module dependency between the Venue Owner builder and
// the Organiser pricing screen for a 2-line lookup table.
//
// Terracotta is deliberately excluded - it's the app-wide "selected /
// primary action" color (SeatPicker's selected-seat highlight, buttons
// throughout). Reported live (28 Jul): whichever zone landed first in
// rotation got terracotta, which then looked visually identical to a
// selected seat in that same zone on the audience-facing picker. Kept
// out of the zone rotation everywhere these two duplicate palettes are
// used, not just patched in the picker, so this can't recur in the
// builder's own canvas either.
// GEN-2609-067 - the 6th tier color was --afa-ink (near-black), a
// legacy leftover from when this preview's own canvas (line ~81) was
// still a light cream background - black-on-cream was high-contrast
// and clearly visible. Now that the canvas is properly dark-themed
// (matching the seat-map editor it's a preview of), a near-black tier
// would barely be visible against it - swapped to --afa-cream, which
// stays clearly distinct from the other 5 (mid-tone/saturated) colors.
export const TIER_COLORS = ['var(--afa-sage)', 'var(--afa-blue-dark)', 'var(--afa-gold)', 'var(--afa-plum)', 'var(--afa-brown-dark)', 'var(--afa-cream)']

export function colorForZone(zoneName: string, zoneOrder: string[]) {
  const idx = zoneOrder.indexOf(zoneName)
  return TIER_COLORS[idx % TIER_COLORS.length] || 'var(--afa-cream)'
}

export default function SeatLayoutPreview({ seats, zoneOrder }: { seats: PreviewSeat[]; zoneOrder: string[] }) {
  const levels = Array.from(new Set(seats.map((s) => s.level || '')))
  const [activeLevel, setActiveLevel] = useState(levels[0] ?? '')
  const levelSeats = seats.filter((s) => (s.level || '') === activeLevel)

  if (seats.length === 0) return null

  const xs = levelSeats.map((s) => s.x)
  const ys = levelSeats.map((s) => s.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  return (
    <div style={{ marginTop: '8px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-text-primary)' }}>Layout preview</span>
        {levels.length > 1 && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setActiveLevel(lvl)}
                style={{
                  fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                  border: activeLevel === lvl ? 'none' : '1px solid rgba(245,245,240,0.15)',
                  background: activeLevel === lvl ? 'var(--afa-fill-solid)' : 'var(--afa-surface-raised)',
                  color: activeLevel === lvl ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-primary)',
                }}
              >
                {lvl || 'Main'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ border: '1px solid rgba(245,245,240,0.1)', borderRadius: '10px', background: 'var(--afa-surface-page)', padding: '16px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--afa-fill-solid)', color: 'var(--afa-on-fill-solid)', textAlign: 'center', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', borderRadius: '6px', padding: '4px 0', marginBottom: '14px' }}>
          STAGE
        </div>
        <div style={{ position: 'relative', width: '100%', height: '160px' }}>
          {levelSeats.map((s, i) => (
            <div
              key={i}
              title={`${s.tierLabel} - Row ${s.row}${s.number}`}
              style={{
                position: 'absolute',
                left: `${((s.x - minX) / rangeX) * 92 + 4}%`,
                top: `${((s.y - minY) / rangeY) * 84 + 8}%`,
                width: '6px',
                height: '6px',
                borderRadius: '2px',
                background: colorForZone(s.tierLabel, zoneOrder),
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: '6px' }}>
        Read-only preview of the venue's saved layout - colors match the sections priced below.{levels.length > 1 ? ' Switch levels above to see each one.' : ''}
      </p>
    </div>
  )
}
