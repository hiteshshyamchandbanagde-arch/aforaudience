'use client'

import { useEffect, useRef, useState } from 'react'
import { colorForZone } from '@/components/SeatLayoutPreview'

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
  level: string
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

// Pinch-to-zoom + pan (session 65, BUG-2608-030) - at high seat counts
// (600 in the reported case) seats squeeze down to a handful of px on
// mobile, too small to read the row/seat label or tap reliably. Rather
// than a library, this is a small self-contained gesture handler using
// Pointer Events (unifies touch/mouse/pen through one code path - two
// active pointers = pinch, one = pan/tap). Zoom range is deliberately
// modest (1x-4x): this is a seat picker, not a photo viewer, and 4x is
// already enough to make a single seat comfortably tappable.
const MIN_ZOOM = 1
const MAX_ZOOM = 4

export default function SeatPicker({ eventId, maxSeatsPerBooking, selected, onChange }: Props) {
  const [seats, setSeats] = useState<SeatInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Level-aware (28 Jul) - this previously rendered every level's seats on
  // one flat canvas, which overlapped/garbled for any real multi-level
  // venue since each level's x/y coordinates are independently generated
  // by the builder starting near the same origin. Filtering to one level
  // at a time, same pattern as the builder and the event-creation
  // pricing preview.
  const [activeLevel, setActiveLevel] = useState('')

  // Pinch/pan state - see MIN_ZOOM/MAX_ZOOM comment above.
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchRef = useRef<{ startDist: number; startZoom: number; startPan: { x: number; y: number } } | null>(null)
  const panStartRef = useRef<{ startX: number; startY: number; startPan: { x: number; y: number } } | null>(null)
  const movedRef = useRef(false)
  // Consumed by the seat's onClick - a pinch/pan gesture ending on top of
  // a seat would otherwise also fire that seat's click (pointerup ->
  // click is not automatically suppressed by the browser just because a
  // drag happened), silently selecting/deselecting a seat as a side
  // effect of panning. Set on pointerup if real movement was detected,
  // read-and-cleared once by the next click.
  const suppressClickRef = useRef(false)

  const distBetween = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

  const clampPan = (x: number, y: number, z: number) => {
    const el = containerRef.current
    if (!el) return { x, y }
    const rect = el.getBoundingClientRect()
    // At zoom 1 there's nothing to pan - content exactly fills the
    // container. Beyond that, the content is (rect * z) big and centered
    // via transform-origin: center, so it can drift at most half the
    // overshoot in either direction before empty space would show.
    const maxX = (rect.width * (z - 1)) / 2
    const maxY = (rect.height * (z - 1)) / 2
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const zoomBy = (factor: number) => {
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor))
      setPan((p) => clampPan(p.x, p.y, next))
      return next
    })
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    movedRef.current = false
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values())
      pinchRef.current = { startDist: distBetween(a, b), startZoom: zoom, startPan: pan }
      panStartRef.current = null
    } else if (pointersRef.current.size === 1) {
      panStartRef.current = { startX: e.clientX, startY: e.clientY, startPan: pan }
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values())
      const scale = distBetween(a, b) / pinchRef.current.startDist
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.startZoom * scale))
      setZoom(newZoom)
      setPan(clampPan(pinchRef.current.startPan.x, pinchRef.current.startPan.y, newZoom))
      movedRef.current = true
    } else if (pointersRef.current.size === 1 && panStartRef.current && zoom > 1) {
      const dx = e.clientX - panStartRef.current.startX
      const dy = e.clientY - panStartRef.current.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
      setPan(clampPan(panStartRef.current.startPan.x + dx, panStartRef.current.startPan.y + dy, zoom))
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size === 1) {
      // Dropped from two fingers to one (end of a pinch) - restart pan
      // tracking from the remaining pointer's current position so the
      // content doesn't jump when that finger starts moving again.
      const remaining = Array.from(pointersRef.current.values())[0]
      panStartRef.current = { startX: remaining.x, startY: remaining.y, startPan: pan }
      pinchRef.current = null
    } else if (pointersRef.current.size === 0) {
      pinchRef.current = null
      panStartRef.current = null
    }
    if (movedRef.current) suppressClickRef.current = true
  }

  useEffect(() => {
    // Switching levels swaps to a completely different coordinate set -
    // an old zoom/pan would be pointing at the wrong part of a different
    // map, so reset rather than carry it over.
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [activeLevel])

  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/seats`)
        if (!res.ok) throw new Error('Failed to load seat map')
        const data = await res.json()
        const loaded: SeatInfo[] = data.seats || []
        setSeats(loaded)
        setActiveLevel((prev) => prev || loaded[0]?.level || '')
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

  const levels = Array.from(new Set<string>(seats.map((s: SeatInfo) => s.level || '')))
  const levelSeats = seats.filter((s: SeatInfo) => (s.level || '') === activeLevel)

  // Zone order/price, scoped to the active level - same zone name can
  // have a different price on another level, so this must not be
  // computed across all seats at once. Used both for the legend and for
  // color-coding available seats by zone below.
  const zoneOrder: string[] = Array.from(new Set<string>(levelSeats.map((s: SeatInfo) => s.tierLabel)))
  const zonePrices = zoneOrder.map((zone: string) => ({
    zone,
    price: levelSeats.find((s: SeatInfo) => s.tierLabel === zone)?.price ?? null,
  }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
          Tap a seat to select it. Max {maxSeatsPerBooking} per booking. Pinch or use +/- to zoom in for easier tapping.
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.5)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)', fontSize: '16px', fontWeight: 700, cursor: zoom <= MIN_ZOOM ? 'default' : 'pointer', opacity: zoom <= MIN_ZOOM ? 0.4 : 1, lineHeight: 1 }}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.5)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)', fontSize: '16px', fontWeight: 700, cursor: zoom >= MAX_ZOOM ? 'default' : 'pointer', opacity: zoom >= MAX_ZOOM ? 0.4 : 1, lineHeight: 1 }}
          >
            +
          </button>
          {zoom > 1 && (
            <button
              type="button"
              onClick={resetView}
              style={{ padding: '0 10px', height: '28px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      {zonePrices.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          {zonePrices.map(({ zone, price }) => (
            <span key={zone} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '12px', color: 'var(--afa-text-primary)', background: 'var(--afa-cream-tint-1)', padding: '4px 10px', borderRadius: '999px' }}>
              <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', background: colorForZone(zone, zoneOrder), marginRight: '6px' }} />
              {zone} — {price ? `₹${price}` : 'not on sale'}
            </span>
          ))}
        </div>
      )}
      {levels.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          {levels.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setActiveLevel(lvl)}
              style={{
                fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
                border: activeLevel === lvl ? 'none' : '1px solid rgba(14,12,10,0.2)',
                background: activeLevel === lvl ? 'var(--afa-fill-solid)' : 'var(--afa-white)',
                color: activeLevel === lvl ? 'var(--afa-white)' : 'var(--afa-text-primary)',
              }}
            >
              {lvl || 'Main'}
            </button>
          ))}
        </div>
      )}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
          // Without this, the browser's own native touch scroll/zoom
          // fights the pointer handlers above - a one-finger drag on
          // mobile would scroll the page instead of panning the map, and
          // a pinch would zoom the whole viewport rather than just the
          // seat canvas.
          touchAction: 'none',
          cursor: zoom > 1 ? 'grab' : 'default',
        } as any}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
        <div
          style={{
            position: 'absolute', top: '2%', left: '50%', transform: 'translateX(-50%)',
            width: '60%', padding: '6px 0', textAlign: 'center', borderRadius: '6px',
            background: 'var(--afa-fill-solid)', color: 'var(--afa-white)', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none', zIndex: 1,
          }}
        >
          Stage
        </div>
        {levelSeats.map((s: SeatInfo) => {
          const isSelected = selected.includes(s.id)
          // Selected seats get a visual "pop" (scale + ring) so the seat
          // number reads clearly - but that pop is a CSS transform on top
          // of the canvas wrapper's own zoom transform, and transforms
          // compound multiplicatively, not additively. At zoom 1 this was
          // fine (a flat 1.5x). Once pinch-zoom shipped, a selected seat
          // at e.g. 3x zoom rendered at 1.5 * 3 = 4.5x - ballooning large
          // enough to swallow its neighbors (live report, session 65).
          // Dividing the boost by the current zoom keeps the seat's pop
          // roughly constant on screen regardless of zoom level, clamped
          // to never shrink below 1x (no boost needed once the zoom
          // itself already makes the seat comfortably large).
          const selectedBoost = Math.max(1, 1.5 / zoom)
          const bg =
            s.status === 'taken'
              ? 'var(--afa-ink-a13)'
              : isSelected
              ? 'var(--afa-terracotta)'
              : s.status === 'priceUnset'
              ? 'var(--afa-ink-a8)'
              : colorForZone(s.tierLabel, zoneOrder)
          return (
            <div
              key={s.id}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false
                  return
                }
                toggleSeat(s)
              }}
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
                // Selected seats get their own visual weight (scale + white
                // ring + larger, bold text) rather than relying on the same
                // tiny clamped font every other seat uses - reported live
                // (28 Jul) that the seat number wasn't legible once picked.
                // z-index lift keeps the ring from being clipped by a
                // neighboring seat drawn after it in DOM order.
                transform: isSelected ? `scale(${selectedBoost})` : undefined,
                zIndex: isSelected ? 2 : undefined,
                boxShadow: isSelected ? '0 0 0 2px var(--afa-white)' : undefined,
                color: s.status === 'taken' || s.status === 'priceUnset' ? 'var(--afa-ink-a40)' : 'var(--afa-white)',
                fontSize: isSelected ? '10px' : 'clamp(5px, 1.3cqw, 9px)',
                fontWeight: isSelected ? 700 : 400,
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
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.7 }}>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: 'var(--afa-terracotta)', marginRight: '4px' }} />Selected</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: 'var(--afa-ink-a13)', marginRight: '4px' }} />Taken</span>
      </div>
    </div>
  )
}
