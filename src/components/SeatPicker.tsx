'use client'

import { useEffect, useRef, useState } from 'react'
import { colorForZone } from '@/components/SeatLayoutPreview'
import Button from '@/components/ui/Button'
import { SELECTED, SELECTED_BG } from '@/lib/statusStyle'

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

// Outer container's max-width cap only (desktop) - no longer doubles as
// the coordinate-normalization base. See GEN-2609-015: a fixed 900x560
// virtual canvas assumed every venue's seat data filled that space: a
// small/tight layout (like Jaipur Mic Gala 100's) only occupied its
// top-left ~20%, leaving the rest dead and shrinking real tap targets
// down to a sliver. Seat positions are now normalized against each
// level's own real coordinate bounding box (see contentBox below),
// same technique already used by SeatLayoutPreview.tsx's minX/maxX/
// minY/maxY (Organiser pricing screen) and the builder's own
// contentBounds()/previewBounds() (src/app/dashboard/venue/[id]/seat-map)
// - reused/adapted here rather than invented fresh.
const MAX_CONTAINER_WIDTH = 900
// Seat size in the same coordinate units the builder saves x/y in (its
// default seatSpacingX/Y is 26/30 - see seat-map/page.tsx), not a fixed
// pixel value - x/y positions are percentage-based (scale with the
// container), so a fixed-px seat size stayed constant while spacing
// shrank at narrower render widths (e.g. inside this sidebar panel),
// causing seats to visually overlap. Expressing width/height as their
// own axis's percentage of SEAT_SIZE/contentBox keeps the seat square
// and in sync with the container at any width - see SeatPicker overlap
// bug, 22 Jul.
const SEAT_SIZE = 22
// Padding (same coordinate units as seat x/y) around the real bounding
// box of a level's seats, so seats/labels aren't flush against the
// container edge. Extra clearance at the top specifically for the
// "Stage" badge, which overlays the canvas rather than reserving its
// own layout space - without it, a level whose seats start near y=0
// (e.g. the Jaipur fixture) puts row 1 directly under the badge.
const PAD_X = 50
const PAD_TOP = 90
const PAD_BOTTOM = 50
// Safety clamp on the fitted container's aspect ratio - real
// builder-generated grids land well inside this range (seatSpacingX/Y
// defaults keep rows/columns roughly proportionate), but an extreme
// single-row-of-many-seats or single-column layout could otherwise
// stretch the container into an unusable sliver.
const MIN_ASPECT = 0.35
const MAX_ASPECT = 3

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

  if (loading) return <p style={{ fontSize: 'var(--afa-text-ui)', opacity: 0.6 }}>Loading seat map...</p>
  if (error) return <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-error-bright)' }}>{error}</p>
  if (seats.length === 0) return <p style={{ fontSize: 'var(--afa-text-ui)', opacity: 0.6 }}>No seat map has been set up for this venue yet.</p>

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

  // Real bounding box of this level's actual seat coordinates (GEN-2609-015)
  // - same technique as SeatLayoutPreview's minX/maxX/minY/maxY, extended
  // with fixed padding (see PAD_X/PAD_TOP/PAD_BOTTOM above) since this is
  // the interactive canvas rather than a small fixed-size thumbnail.
  // Recomputed per level, same reasoning as zoneOrder above - each
  // level's coordinates are independently generated near their own origin.
  const xs = levelSeats.map((s: SeatInfo) => s.x)
  const ys = levelSeats.map((s: SeatInfo) => s.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const contentWidth = maxX - minX + PAD_X * 2
  const contentHeight = maxY - minY + PAD_TOP + PAD_BOTTOM
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, contentWidth / contentHeight))
  const seatWidthPct = (SEAT_SIZE / contentWidth) * 100
  const seatHeightPct = (SEAT_SIZE / contentHeight) * 100

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--afa-space-2)', marginBottom: 'var(--afa-space-2)', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
          Tap a seat to select it. Max {maxSeatsPerBooking} per booking. Pinch or use +/- to zoom in for easier tapping.
        </div>
        <div style={{ display: 'flex', gap: 'var(--afa-space-1)', flexShrink: 0 }}>
          <Button
            variant="icon"
            type="button"
            onClick={() => zoomBy(1 / 1.5)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            style={{ width: '28px', height: '28px', borderRadius: 'var(--afa-radius-sm)', border: '1px solid var(--afa-tint-20)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)', fontSize: 'var(--afa-text-title)', fontWeight: 700, cursor: zoom <= MIN_ZOOM ? 'default' : 'pointer', opacity: zoom <= MIN_ZOOM ? 0.4 : 1, lineHeight: 1 }}
          >
            −
          </Button>
          <Button
            variant="icon"
            type="button"
            onClick={() => zoomBy(1.5)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            style={{ width: '28px', height: '28px', borderRadius: 'var(--afa-radius-sm)', border: '1px solid var(--afa-tint-20)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)', fontSize: 'var(--afa-text-title)', fontWeight: 700, cursor: zoom >= MAX_ZOOM ? 'default' : 'pointer', opacity: zoom >= MAX_ZOOM ? 0.4 : 1, lineHeight: 1 }}
          >
            +
          </Button>
          {zoom > 1 && (
            <Button
              variant="outline-neutral"
              size="sm"
              fullWidth={false}
              type="button"
              onClick={resetView}
              style={{ height: '28px', border: '1px solid var(--afa-tint-20)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)' }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>
      {zonePrices.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--afa-space-10px)', marginBottom: 'var(--afa-space-10px)' }}>
          {zonePrices.map(({ zone, price }) => (
            <span key={zone} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', background: 'var(--afa-surface-raised)', padding: 'var(--afa-space-1) var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)' }}>
              <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', background: colorForZone(zone, zoneOrder), marginRight: 'var(--afa-space-6px)' }} />
              {zone} — {price ? `₹${price}` : 'not on sale'}
            </span>
          ))}
        </div>
      )}
      {levels.length > 1 && (
        <div style={{ display: 'flex', gap: 'var(--afa-space-6px)', marginBottom: 'var(--afa-space-10px)' }}>
          {levels.map((lvl) => (
            <Button
              variant="toggle-box"
              size="sm"
              fullWidth={false}
              selected={activeLevel === lvl}
              key={lvl}
              type="button"
              onClick={() => setActiveLevel(lvl)}
            >
              {lvl || 'Main'}
            </Button>
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
          maxWidth: `${MAX_CONTAINER_WIDTH}px`,
          aspectRatio: `${aspect}`,
          background: 'var(--afa-surface-raised)',
          border: '1px solid var(--afa-border-resting)',
          borderRadius: 'var(--afa-radius-lg)',
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
            width: '60%', padding: 'var(--afa-space-6px) 0', textAlign: 'center', borderRadius: 'var(--afa-radius-sm)',
            background: 'var(--afa-tint-20)', color: 'var(--afa-text-primary)', fontSize: 'var(--afa-text-caption)', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none', zIndex: 1,
          }}
        >
          Stage
        </div>
        {levelSeats.map((s: SeatInfo) => {
          const isSelected = selected.includes(s.id)
          // GEN-2609-118 - selected is a state, not an action: amber tint
          // with an amber ring and number, never the solid orange fill.
          const bg =
            s.status === 'taken'
              ? 'var(--afa-tint-12)'
              : isSelected
              ? SELECTED_BG
              : s.status === 'priceUnset'
              ? 'var(--afa-tint-08)'
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
                left: `${((s.x - minX + PAD_X) / contentWidth) * 100}%`,
                top: `${((s.y - minY + PAD_TOP) / contentHeight) * 100}%`,
                width: `${seatWidthPct}%`,
                height: `${seatHeightPct}%`,
                marginLeft: `-${seatWidthPct / 2}%`,
                // CSS quirk: percentage margin-top/-bottom resolve against the
                // containing block's WIDTH, not its height, even though this is
                // a vertical offset. The seat is square in real (px) terms
                // when the container's aspectRatio equals contentWidth /
                // contentHeight exactly, which is true unless MIN_ASPECT/
                // MAX_ASPECT clamped it - in that rare case this is a
                // deliberate near-enough approximation, not a bug.
                marginTop: `-${seatWidthPct / 2}%`,
                borderRadius: 'var(--afa-radius-sm)',
                background: bg,
                // BUG-2609-075 - selected changes colour, ring and weight
                // only, never size. The old "pop" (scale(max(1, 1.5 / zoom))
                // plus a fixed 10px label and an outside ring) drew a
                // selected seat about 2x at zoom 1; seats sit edge to edge,
                // so J3 covered J2 and J4, and 4 adjacent selected seats
                // stacked into one where only the last was readable. The
                // ring is inset, so it stays inside the seat at any zoom.
                // A selected label is sized from the seat's own width (the
                // seat is seatWidthPct cqw wide; "J10" in bold fits at 0.42
                // of it), capped at 11px and never below every other
                // seat's size - as readable as the seat allows, never wider.
                boxShadow: isSelected ? `inset 0 0 0 2px ${SELECTED}` : undefined,
                color: s.status === 'taken' || s.status === 'priceUnset' ? 'var(--afa-text-muted)' : isSelected ? SELECTED : 'var(--afa-text-primary)',
                fontSize: isSelected ? `max(clamp(5px, 1.3cqw, 9px), min(11px, ${(seatWidthPct * 0.42).toFixed(3)}cqw))` : 'clamp(5px, 1.3cqw, 9px)',
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
      <div style={{ display: 'flex', gap: 'var(--afa-space-4)', marginTop: 'var(--afa-space-10px)', fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.7 }}>
        {/* BUG-2609-075 (legend part) - each swatch is drawn the way that
            seat state renders on the canvas above. Available seats take
            their zone's colour, so its swatch shows the zones in play. */}
        {zoneOrder.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {zoneOrder.slice(0, 3).map((zone) => (
              <span key={zone} style={{ display: 'inline-block', width: 'var(--afa-space-10px)', height: 'var(--afa-space-10px)', borderRadius: 'var(--afa-radius-xs)', background: colorForZone(zone, zoneOrder), marginRight: 'var(--afa-space-2px)' }} />
            ))}
            <span style={{ marginLeft: 'var(--afa-space-2px)' }}>Available</span>
          </span>
        )}
        <span><span style={{ display: 'inline-block', width: 'var(--afa-space-10px)', height: 'var(--afa-space-10px)', borderRadius: 'var(--afa-radius-xs)', background: SELECTED_BG, boxShadow: `inset 0 0 0 2px ${SELECTED}`, marginRight: 'var(--afa-space-1)' }} />Selected</span>
        <span><span style={{ display: 'inline-block', width: 'var(--afa-space-10px)', height: 'var(--afa-space-10px)', borderRadius: 'var(--afa-radius-xs)', background: 'var(--afa-tint-12)', marginRight: 'var(--afa-space-1)' }} />Held / booked</span>
        {levelSeats.some((s: SeatInfo) => s.status === 'priceUnset') && (
          <span><span style={{ display: 'inline-block', width: 'var(--afa-space-10px)', height: 'var(--afa-space-10px)', borderRadius: 'var(--afa-radius-xs)', background: 'var(--afa-tint-08)', marginRight: 'var(--afa-space-1)' }} />Not on sale</span>
        )}
      </div>
    </div>
  )
}
