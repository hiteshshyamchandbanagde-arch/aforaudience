'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'

// §9.4 twenty-fourth amendment - Venue Owner seat-map builder.
//
// Real x/y canvas (confirmed with Hitesh over the grid-only alternative)
// so venues with irregular shapes (curved rows, aisles, balconies) can be
// laid out faithfully rather than forced into a rows x columns grid.
//
// Local-only edit model: every click/drag mutates React state, nothing
// hits the network until Save - same reasoning as the full-replace PUT
// on the API side (see route.ts comment). Keeps the canvas fast and the
// save operation simple and atomic.

type SeatDraft = {
  // clientId is a local-only key for React/drag tracking. Real seats
  // (loaded from the server) also get one assigned on load; it is never
  // sent to the API - only tierLabel/row/number/x/y are.
  clientId: string
  tierLabel: string
  row: string
  number: string
  x: number
  y: number
}

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 560
const SEAT_SIZE = 22

function makeClientId() {
  return Math.random().toString(36).slice(2, 10)
}

const inputStyle = {
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid rgba(14,12,10,0.15)',
  background: '#fff',
  fontSize: '13px',
  color: '#0E0C0A',
}

const TIER_COLORS = ['#C8441A', '#4A6741', '#2E5C8A', '#8a6a1f', '#7A4A8A', '#0E0C0A']

function colorForTier(tierLabel: string, tierOrder: string[]) {
  const idx = tierOrder.indexOf(tierLabel)
  return TIER_COLORS[idx % TIER_COLORS.length] || '#0E0C0A'
}

export default function SeatMapBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [seatingMode, setSeatingMode] = useState<'GENERAL_ADMISSION' | 'NUMBERED'>('GENERAL_ADMISSION')
  const [seats, setSeats] = useState<SeatDraft[]>([])
  const [activeTier, setActiveTier] = useState('General')
  const [nextRow, setNextRow] = useState('A')
  const [nextNumber, setNextNumber] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const fetchSeatMap = async () => {
      try {
        const res = await fetch(`/api/venues/${id}/seats`)
        if (!res.ok) throw new Error('Venue not found')
        const data = await res.json()
        setSeatingMode(data.seatingMode || 'GENERAL_ADMISSION')
        setSeats(
          (data.seats || []).map((s: any) => ({
            clientId: makeClientId(),
            tierLabel: s.tierLabel,
            row: s.row,
            number: s.number,
            x: s.x,
            y: s.y,
          }))
        )
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) fetchSeatMap()
  }, [session, id])

  const tierOrder = Array.from(new Set(seats.map((s) => s.tierLabel).concat(activeTier ? [activeTier] : [])))

  const placeSeat = (e: React.MouseEvent<HTMLDivElement>) => {
    if (seatingMode !== 'NUMBERED') return
    if (dragId) return // don't place while finishing a drag
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)
    if (x < 0 || y < 0 || x > CANVAS_WIDTH || y > CANVAS_HEIGHT) return
    if (!activeTier.trim()) {
      showToast('Set a section/tier name first.', 'error')
      return
    }

    const newSeat: SeatDraft = {
      clientId: makeClientId(),
      tierLabel: activeTier.trim(),
      row: nextRow,
      number: String(nextNumber),
      x,
      y,
    }
    setSeats((prev) => [...prev, newSeat])
    setNextNumber((n) => n + 1)
  }

  const startDrag = (e: React.MouseEvent, clientId: string) => {
    e.stopPropagation()
    setSelectedId(clientId)
    setDragId(clientId)
  }

  useEffect(() => {
    if (!dragId) return
    const onMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(0, Math.min(CANVAS_WIDTH, Math.round(e.clientX - rect.left)))
      const y = Math.max(0, Math.min(CANVAS_HEIGHT, Math.round(e.clientY - rect.top)))
      setSeats((prev) => prev.map((s) => (s.clientId === dragId ? { ...s, x, y } : s)))
    }
    const onUp = () => setDragId(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragId])

  const deleteSelected = () => {
    if (!selectedId) return
    setSeats((prev) => prev.filter((s) => s.clientId !== selectedId))
    setSelectedId(null)
  }

  const updateSelected = (field: 'tierLabel' | 'row' | 'number', value: string) => {
    if (!selectedId) return
    setSeats((prev) => prev.map((s) => (s.clientId === selectedId ? { ...s, [field]: value } : s)))
  }

  const selected = seats.find((s) => s.clientId === selectedId) || null

  const save = async () => {
    // Duplicate row/number check client-side first, mirrors the server
    // validation in PUT so the error surfaces before a wasted round trip.
    const seen = new Set<string>()
    for (const s of seats) {
      const key = `${s.row}::${s.number}`
      if (seen.has(key)) {
        showToast(`Duplicate seat label: Row ${s.row}, Seat ${s.number}. Fix before saving.`, 'error')
        return
      }
      seen.add(key)
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/venues/${id}/seats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatingMode,
          seats: seats.map((s) => ({ tierLabel: s.tierLabel, row: s.row, number: s.number, x: s.x, y: s.y })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      showToast(`Saved ${data.seatCount} seat${data.seatCount === 1 ? '' : 's'}.`, 'success')
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{error}</div></>)

  return (
    <>
      <SiteNav />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
        <Link href={`/dashboard/venue/${id}/edit`} style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, textDecoration: 'none' }}>
          ← Back to venue
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '10px 0 4px', color: '#0E0C0A' }}>Seat Map Builder</h1>
        <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.65, marginBottom: '20px' }}>
          General Admission is section/quantity based, same as today. Numbered Seating lets you place real seats on a canvas matching your venue's actual shape.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setSeatingMode('GENERAL_ADMISSION')}
            style={{
              padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: seatingMode === 'GENERAL_ADMISSION' ? 'none' : '1px solid rgba(14,12,10,0.15)',
              background: seatingMode === 'GENERAL_ADMISSION' ? '#0E0C0A' : '#fff',
              color: seatingMode === 'GENERAL_ADMISSION' ? '#F7F3EE' : '#0E0C0A',
            }}
          >
            General Admission
          </button>
          <button
            onClick={() => setSeatingMode('NUMBERED')}
            style={{
              padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: seatingMode === 'NUMBERED' ? 'none' : '1px solid rgba(14,12,10,0.15)',
              background: seatingMode === 'NUMBERED' ? '#0E0C0A' : '#fff',
              color: seatingMode === 'NUMBERED' ? '#F7F3EE' : '#0E0C0A',
            }}
          >
            Numbered Seating
          </button>
        </div>

        {seatingMode === 'GENERAL_ADMISSION' && (
          <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, fontStyle: 'italic' }}>
            This venue uses General Admission (section + quantity). Section names, seat counts, and pricing are managed from the venue's Edit page, not here. Switch to Numbered Seating above to build a real seat layout.
          </p>
        )}

        {seatingMode === 'NUMBERED' && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Section/Tier:</label>
                <input
                  style={{ ...inputStyle, width: '160px' }}
                  value={activeTier}
                  onChange={(e) => setActiveTier(e.target.value.slice(0, 60))}
                  placeholder="e.g. VIP Front"
                />
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Row:</label>
                <input style={{ ...inputStyle, width: '60px' }} value={nextRow} onChange={(e) => setNextRow(e.target.value.slice(0, 10))} />
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Next #:</label>
                <input
                  type="number"
                  style={{ ...inputStyle, width: '70px' }}
                  value={nextNumber}
                  onChange={(e) => setNextNumber(Math.max(1, Number(e.target.value) || 1))}
                />
                <span style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5 }}>Click the canvas to place a seat</span>
              </div>

              <div
                ref={canvasRef}
                onClick={placeSeat}
                style={{
                  position: 'relative',
                  width: `${CANVAS_WIDTH}px`,
                  height: `${CANVAS_HEIGHT}px`,
                  background: '#FBF8F3',
                  border: '1px solid rgba(14,12,10,0.15)',
                  borderRadius: '10px',
                  cursor: 'crosshair',
                  overflow: 'hidden',
                }}
              >
                {seats.map((s) => (
                  <div
                    key={s.clientId}
                    onMouseDown={(e) => startDrag(e, s.clientId)}
                    title={`${s.tierLabel} — Row ${s.row}, Seat ${s.number}`}
                    style={{
                      position: 'absolute',
                      left: s.x - SEAT_SIZE / 2,
                      top: s.y - SEAT_SIZE / 2,
                      width: `${SEAT_SIZE}px`,
                      height: `${SEAT_SIZE}px`,
                      borderRadius: '5px',
                      background: colorForTier(s.tierLabel, tierOrder),
                      opacity: selectedId === s.clientId ? 1 : 0.85,
                      outline: selectedId === s.clientId ? '2px solid #0E0C0A' : 'none',
                      outlineOffset: '2px',
                      color: '#fff',
                      fontSize: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      userSelect: 'none',
                    }}
                  >
                    {s.row}{s.number}
                  </div>
                ))}
                {seats.length === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E0C0A', opacity: 0.35, fontSize: '14px' }}>
                    Click anywhere to place your first seat
                  </div>
                )}
              </div>
            </div>

            <div style={{ minWidth: '220px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Selected seat</h3>
              {!selected && <p style={{ fontSize: '13px', opacity: 0.6 }}>Click a seat on the canvas to edit or delete it.</p>}
              {selected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Section/Tier</label>
                  <input style={inputStyle} value={selected.tierLabel} onChange={(e) => updateSelected('tierLabel', e.target.value.slice(0, 60))} />
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Row</label>
                  <input style={inputStyle} value={selected.row} onChange={(e) => updateSelected('row', e.target.value.slice(0, 10))} />
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Seat Number</label>
                  <input style={inputStyle} value={selected.number} onChange={(e) => updateSelected('number', e.target.value.slice(0, 10))} />
                  <button
                    onClick={deleteSelected}
                    style={{ marginTop: '6px', padding: '8px 0', borderRadius: '6px', border: '1px solid #B3261E', color: '#B3261E', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete seat
                  </button>
                </div>
              )}

              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '20px 0 10px' }}>Summary</h3>
              <p style={{ fontSize: '13px' }}>Total seats: <strong>{seats.length}</strong></p>
              {tierOrder.filter((t) => seats.some((s) => s.tierLabel === t)).map((t) => (
                <p key={t} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: colorForTier(t, tierOrder), display: 'inline-block' }} />
                  {t}: {seats.filter((s) => s.tierLabel === t).length}
                </p>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          style={{
            marginTop: '24px', padding: '11px 28px', borderRadius: '8px', border: 'none',
            background: '#C8441A', color: '#fff', fontSize: '14px', fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Seat Map'}
        </button>
      </div>
    </>
  )
}
