'use client'

import { useEffect, useState } from 'react'

// §9.4 twenty-fourth amendment - audience seat-picker. Renders the same
// x/y layout the Venue Owner builder saved, read-only except for click-
// to-toggle selection. Deliberately a separate component from the
// builder (SeatMapBuilder page) rather than a shared one with an
// editable/read-only prop - the two have very different interaction
// models (drag-to-place vs click-to-select) and sharing would mean more
// conditional branches than actual shared code.

type SeatInfo = {
  id: string
  tierLabel: string
  row: string
  number: string
  x: number
  y: number
  price: number | null
  status: 'available' | 'taken' | 'priceUnset'
}

type Props = {
  eventId: string
  maxSeatsPerBooking: number
  selected: string[]
  onChange: (seatIds: string[], amount: number) => void
}

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 560
// Seat size as a fraction of the canvas, not a fixed pixel value - x/y
// positions are already percentage-based (scale with the container), so
// a fixed-px seat size stayed constant while spacing shrank at narrower
// render widths (e.g. inside this sidebar panel), causing seats to
// visually overlap. Expressing width/height as their own axis's
// percentage of SEAT_SIZE/CANVAS_* keeps the seat square and in sync
// with the container at any width - see SeatPicker overlap bug, 22 Jul.
const SEAT_SIZE = 22
const SEAT_WIDTH_PCT = (SEAT_SIZE / CANVAS_WIDTH) * 100
const SEAT_HEIGHT_PCT = (SEAT_SIZE / CANVAS_HEIGHT) * 100

export default function SeatPicker({ eventId, maxSeatsPerBooking, selected, onChange }: Props) {
  const [seats, setSeats] = useState<SeatInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/seats`)
        if (!res.ok) throw new Error('Failed to load seat map')
        const data = await res.json()
        setSeats(data.seats || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchSeats()
  }, [eventId])

  const toggleSeat = (seat: SeatInfo) => {
    if (seat.status !== 'available') return
    const isSelected = selected.includes(seat.id)
    let next: string[]
    if (isSelected) {
      next = selected.filter((id) => id !== seat.id)
    } else {
      if (selected.length >= maxSeatsPerBooking) return
      next = [...selected, seat.id]
    }
    const amount = next.reduce((sum, id) => {
      const s = seats.find((x) => x.id === id)
      return sum + (s?.price || 0)
    }, 0)
    onChange(next, amount)
  }

  if (loading) return <p style={{ fontSize: '13px', opacity: 0.6 }}>Loading seat map...</p>
  if (error) return <p style={{ fontSize: '13px', color: 'var(--afa-error)' }}>{error}</p>
  if (seats.length === 0) return <p style={{ fontSize: '13px', opacity: 0.6 }}>No seat map has been set up for this venue yet.</p>

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '8px' }}>
        Tap a seat to select it. Max {maxSeatsPerBooking} per booking.
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: `${CANVAS_WIDTH}px`,
          aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
          background: 'var(--afa-cream-tint-1)',
          border: '1px solid rgba(14,12,10,0.15)',
          borderRadius: '10px',
          overflow: 'hidden',
          containerType: 'inline-size',
        } as any}
      >
        <div
          style={{
            position: 'absolute', top: '2%', left: '50%', transform: 'translateX(-50%)',
            width: '60%', padding: '6px 0', textAlign: 'center', borderRadius: '6px',
            background: 'var(--afa-ink)', color: 'var(--afa-white)', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none', zIndex: 1,
          }}
        >
          Stage
        </div>
        {seats.map((s) => {
          const isSelected = selected.includes(s.id)
          const bg =
            s.status === 'taken' ? 'var(--afa-ink-a13)' : isSelected ? 'var(--afa-terracotta)' : s.status === 'priceUnset' ? 'var(--afa-ink-a8)' : 'var(--afa-sage)'
          return (
            <div
              key={s.id}
              onClick={() => toggleSeat(s)}
              title={
                s.status === 'taken'
                  ? `Row ${s.row}, Seat ${s.number} — taken`
                  : s.status === 'priceUnset'
                  ? `Row ${s.row}, Seat ${s.number} — not on sale`
                  : `Row ${s.row}, Seat ${s.number} — ₹${s.price}`
              }
              style={{
                position: 'absolute',
                left: `${(s.x / CANVAS_WIDTH) * 100}%`,
                top: `${(s.y / CANVAS_HEIGHT) * 100}%`,
                width: `${SEAT_WIDTH_PCT}%`,
                height: `${SEAT_HEIGHT_PCT}%`,
                marginLeft: `-${SEAT_WIDTH_PCT / 2}%`,
                // CSS quirk: percentage margin-top/-bottom resolve against the
                // containing block's WIDTH, not its height, even though this is
                // a vertical offset. Since the seat is square (width_px ===
                // height_px by construction above), the width-based percentage
                // here is the correct value - using SEAT_HEIGHT_PCT would be
                // computed against the wrong axis and mis-center vertically.
                marginTop: `-${SEAT_WIDTH_PCT / 2}%`,
                borderRadius: '5px',
                background: bg,
                color: s.status === 'taken' || s.status === 'priceUnset' ? 'var(--afa-ink-a40)' : 'var(--afa-white)',
                fontSize: 'clamp(5px, 1.3cqw, 9px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: s.status === 'available' ? 'pointer' : 'not-allowed',
                userSelect: 'none',
              }}
            >
              {s.row}{s.number}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.7 }}>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: 'var(--afa-sage)', marginRight: '4px' }} />Available</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: 'var(--afa-terracotta)', marginRight: '4px' }} />Selected</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: 'var(--afa-ink-a13)', marginRight: '4px' }} />Taken</span>
      </div>
    </div>
  )
}
