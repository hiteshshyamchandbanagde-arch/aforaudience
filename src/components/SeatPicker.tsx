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
const SEAT_SIZE = 22

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
  if (error) return <p style={{ fontSize: '13px', color: '#B3261E' }}>{error}</p>
  if (seats.length === 0) return <p style={{ fontSize: '13px', opacity: 0.6 }}>No seat map has been set up for this venue yet.</p>

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '8px' }}>
        Tap a seat to select it. Max {maxSeatsPerBooking} per booking.
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: `${CANVAS_WIDTH}px`,
          aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
          background: '#FBF8F3',
          border: '1px solid rgba(14,12,10,0.15)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute', top: '2%', left: '50%', transform: 'translateX(-50%)',
            width: '60%', padding: '6px 0', textAlign: 'center', borderRadius: '6px',
            background: '#0E0C0A', color: '#fff', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none', zIndex: 1,
          }}
        >
          Stage
        </div>
        {seats.map((s) => {
          const isSelected = selected.includes(s.id)
          const bg =
            s.status === 'taken' ? '#0E0C0A22' : isSelected ? '#C8441A' : s.status === 'priceUnset' ? '#0E0C0A15' : '#4A6741'
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
                width: `${SEAT_SIZE}px`,
                height: `${SEAT_SIZE}px`,
                marginLeft: `-${SEAT_SIZE / 2}px`,
                marginTop: `-${SEAT_SIZE / 2}px`,
                borderRadius: '5px',
                background: bg,
                color: s.status === 'taken' || s.status === 'priceUnset' ? '#0E0C0A66' : '#fff',
                fontSize: '9px',
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
      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: '#0E0C0A', opacity: 0.7 }}>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#4A6741', marginRight: '4px' }} />Available</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#C8441A', marginRight: '4px' }} />Selected</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#0E0C0A22', marginRight: '4px' }} />Taken</span>
      </div>
    </div>
  )
}
