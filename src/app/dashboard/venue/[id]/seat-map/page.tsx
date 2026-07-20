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

// §9.4 - spreadsheet-style row lettering (A..Z, AA, AB...) since real
// venues (Hitesh's 30-row reference scenario) exceed 26 rows.
function rowLetterAt(index: number): string {
  let i = index + 1
  let s = ''
  while (i > 0) {
    const rem = (i - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

type RowGroup = { id: string; rows: number; columns: number }
type HorizontalAisle = { id: string; afterRow: number; gapPx: number }

type GridConfig = {
  blockCount: 1 | 2
  leftTier: string
  rightTier: string
  centerAislePx: number
  sideMarginPx: number
  seatSpacingX: number
  seatSpacingY: number
  rowGroups: RowGroup[]
  aisles: HorizontalAisle[]
}

// Pure function - given a config, returns the seats it describes. Kept
// separate from React state so it's easy to reason about (and test by
// hand against Hitesh's two reference scenarios) independent of the UI.
// STAGE-FACING CONVENTION: canvas x increases left-to-right as if you
// are standing on stage looking out at the audience - "Left" block/seat
// numbering matches the performer's left, not the audience's.
function computeGridSeats(config: GridConfig, originX: number, originY: number): Omit<SeatDraft, 'clientId'>[] {
  const totalRows = config.rowGroups.reduce((sum, g) => sum + g.rows, 0)
  const seats: Omit<SeatDraft, 'clientId'>[] = []

  // Expand row-groups into a flat per-row column-count lookup.
  const columnsForRow: number[] = []
  for (const g of config.rowGroups) {
    for (let i = 0; i < g.rows; i++) columnsForRow.push(g.columns)
  }

  let y = originY
  for (let r = 0; r < totalRows; r++) {
    // Horizontal aisle gaps accumulate extra vertical space BEFORE this
    // row if one was configured to land here (e.g. "gap after row 10"
    // adds space before row 11 - a 1-based, human-facing row count).
    const aisleHere = config.aisles.find((a) => a.afterRow === r)
    if (aisleHere) y += aisleHere.gapPx

    const cols = columnsForRow[r] || 0
    const rowLetter = rowLetterAt(r)

    // Block 1 (or the only block) starts at originX + side margin.
    let blockX = originX + config.sideMarginPx
    for (let c = 0; c < cols; c++) {
      seats.push({ tierLabel: config.leftTier, row: rowLetter, number: String(c + 1), x: blockX + c * config.seatSpacingX, y })
    }

    if (config.blockCount === 2) {
      const block1Width = cols * config.seatSpacingX
      const block2X = blockX + block1Width + config.centerAislePx
      // Numbering continues across the aisle (row B: 1-20 left, 21-40
      // right) rather than restarting at 1 - matches real theater
      // signage, and avoids a (venueId, row, number) collision that a
      // restart would cause since both blocks share the same row letter.
      for (let c = 0; c < cols; c++) {
        seats.push({ tierLabel: config.rightTier, row: rowLetter, number: String(cols + c + 1), x: block2X + c * config.seatSpacingX, y })
      }
    }

    y += config.seatSpacingY
  }

  return seats
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

  // §9.4 - Grid Generator state. Kept separate from the freeform seats
  // array - Generate computes seats and appends them, manual placement
  // still works on top of a generated layout.
  const [showGenerator, setShowGenerator] = useState(false)
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    blockCount: 1,
    leftTier: 'General',
    rightTier: 'General',
    centerAislePx: 60,
    sideMarginPx: 30,
    seatSpacingX: 26,
    seatSpacingY: 30,
    rowGroups: [{ id: makeClientId(), rows: 5, columns: 10 }],
    aisles: [],
  })

  // Guided Setup (wizard) - a plain-language front door onto the SAME
  // gridConfig/computeGridSeats engine the advanced Generate Grid panel
  // uses. Not a separate feature: it edits the same state via the same
  // helper functions below, just one question at a time instead of a
  // dense all-at-once form. "Draw It Myself" (existing canvas) stays a
  // fully first-class second path, not a fallback - some venue owners
  // want hands-on creative control and shouldn't be funneled away from it.
  const [builderPath, setBuilderPath] = useState<'choose' | 'wizard' | 'canvas' | null>(null)
  const effectivePath = builderPath ?? (seats.length > 0 ? 'canvas' : 'choose')
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardShape, setWizardShape] = useState<'rows' | 'other' | null>(null)
  const [wizardUniform, setWizardUniform] = useState<boolean | null>(null)
  const [wizardHasAisle, setWizardHasAisle] = useState<boolean | null>(null)

  const startWizard = () => { setBuilderPath('wizard'); setWizardStep(0); setWizardShape(null); setWizardUniform(null); setWizardHasAisle(null) }
  const startDrawMyself = () => setBuilderPath('canvas')
  const backToChoice = () => { setBuilderPath('choose'); setWizardStep(0) }
  const wizardNext = () => setWizardStep((s) => s + 1)
  const wizardBack = () => setWizardStep((s) => Math.max(0, s - 1))

  const setUniformRows = (uniform: boolean) => {
    setWizardUniform(uniform)
    if (uniform) {
      // Collapse to a single row-group so "rows" and "seats per row" map
      // to one clean pair of numbers instead of the tapering-groups list.
      const totalRows = gridConfig.rowGroups.reduce((s, r) => s + r.rows, 0) || 5
      const columns = gridConfig.rowGroups[0]?.columns || 10
      setGridConfig((g) => ({ ...g, rowGroups: [{ id: makeClientId(), rows: totalRows, columns }] }))
    } else if (gridConfig.rowGroups.length === 0) {
      setGridConfig((g) => ({ ...g, rowGroups: [{ id: makeClientId(), rows: 5, columns: 10 }] }))
    }
  }

  const setWizardAisle = (has: boolean) => {
    setWizardHasAisle(has)
    if (!has) setGridConfig((g) => ({ ...g, aisles: [] }))
    else if (gridConfig.aisles.length === 0) addAisle()
  }

  const wizardPreviewSeats = computeGridSeats(gridConfig, 40, 40)

  const finishWizard = () => {
    generateGrid()
    setBuilderPath('canvas')
  }

  const addRowGroup = () => setGridConfig((g) => ({ ...g, rowGroups: [...g.rowGroups, { id: makeClientId(), rows: 5, columns: 10 }] }))
  const removeRowGroup = (id: string) => setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.filter((r) => r.id !== id) }))
  const updateRowGroup = (id: string, field: 'rows' | 'columns', value: number) =>
    setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.map((r) => (r.id === id ? { ...r, [field]: Math.max(1, value) } : r)) }))

  const addAisle = () => setGridConfig((g) => ({ ...g, aisles: [...g.aisles, { id: makeClientId(), afterRow: g.rowGroups.reduce((s, r) => s + r.rows, 0), gapPx: 30 }] }))
  const removeAisle = (id: string) => setGridConfig((g) => ({ ...g, aisles: g.aisles.filter((a) => a.id !== id) }))
  const updateAisle = (id: string, field: 'afterRow' | 'gapPx', value: number) =>
    setGridConfig((g) => ({ ...g, aisles: g.aisles.map((a) => (a.id === id ? { ...a, [field]: Math.max(0, value) } : a)) }))

  const generateGrid = () => {
    const totalRows = gridConfig.rowGroups.reduce((s, r) => s + r.rows, 0)
    if (totalRows === 0) {
      showToast('Add at least one row group first.', 'error')
      return
    }
    const generated = computeGridSeats(gridConfig, 40, 40)
    setSeats((prev) => [...prev, ...generated.map((s) => ({ ...s, clientId: makeClientId() }))])
    showToast(`Generated ${generated.length} seats.`, 'success')
    setShowGenerator(false)
  }

  const resetLayout = () => {
    if (seats.length === 0) return
    if (!window.confirm('Clear the entire layout? This only affects your local edits - nothing is deleted until you Save.')) return
    setSeats([])
    setSelectedId(null)
  }

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
    if (y < 40) {
      showToast("That's the stage — seats go below it.", 'error')
      return
    }
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

        {seatingMode === 'NUMBERED' && effectivePath === 'choose' && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', maxWidth: '760px' }}>
            <button
              onClick={startWizard}
              style={{
                flex: '1 1 300px', textAlign: 'left', cursor: 'pointer', padding: '22px',
                borderRadius: '12px', border: '2px solid #0E0C0A', background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C8441A', marginBottom: '6px' }}>Recommended</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>Guided Setup</div>
              <div style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.7, lineHeight: 1.5 }}>
                Answer a few simple questions — rows, seats per row, walkways — and we'll lay out the seats for you. Best if your seating is straight rows facing the stage.
              </div>
            </button>
            <button
              onClick={startDrawMyself}
              style={{
                flex: '1 1 300px', textAlign: 'left', cursor: 'pointer', padding: '22px',
                borderRadius: '12px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0E0C0A', opacity: 0.5, marginBottom: '6px' }}>For hands-on control</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>Draw It Myself</div>
              <div style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.7, lineHeight: 1.5 }}>
                Place and drag every seat by hand on a canvas shaped like your real venue. Good for curved rows, round tables, or any layout that isn't straight rows.
              </div>
            </button>
          </div>
        )}

        {seatingMode === 'NUMBERED' && effectivePath === 'wizard' && (
          <div style={{ maxWidth: '560px' }}>
            <button onClick={backToChoice} style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.55, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
              ← Change approach
            </button>

            {wizardStep === 0 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>What's your seating shape?</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => { setWizardShape('rows'); wizardNext() }} style={{ textAlign: 'left', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                    Straight rows facing the stage
                  </button>
                  <button onClick={() => setWizardShape('other')} style={{ textAlign: 'left', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                    Curved rows, round tables, or a U-shape
                  </button>
                </div>
                {wizardShape === 'other' && (
                  <div style={{ marginTop: '14px', padding: '14px', borderRadius: '8px', background: '#FBF8F3', fontSize: '13px', color: '#0E0C0A' }}>
                    Guided Setup only builds straight rows for now — curved and round layouts aren't supported yet. You can either draw that shape by hand, or start from straight rows here and adjust later.
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button onClick={startDrawMyself} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#0E0C0A', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Draw It Myself instead</button>
                      <button onClick={() => { setWizardShape('rows'); wizardNext() }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Continue with straight rows anyway</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {wizardStep === 1 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Is it one block of seats, or two with a walkway down the middle?</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setGridConfig((g) => ({ ...g, blockCount: 1 }))} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: gridConfig.blockCount === 1 ? 'none' : '1px solid rgba(14,12,10,0.2)', background: gridConfig.blockCount === 1 ? '#0E0C0A' : '#fff', color: gridConfig.blockCount === 1 ? '#fff' : '#0E0C0A' }}>
                    One block
                  </button>
                  <button onClick={() => setGridConfig((g) => ({ ...g, blockCount: 2 }))} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: gridConfig.blockCount === 2 ? 'none' : '1px solid rgba(14,12,10,0.2)', background: gridConfig.blockCount === 2 ? '#0E0C0A' : '#fff', color: gridConfig.blockCount === 2 ? '#fff' : '#0E0C0A' }}>
                    Two blocks, walkway in the middle
                  </button>
                </div>

                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{gridConfig.blockCount === 2 ? 'What do you call the left section?' : 'What do you call this section?'}</label>
                <input style={{ ...inputStyle, width: '220px', marginBottom: '12px' }} value={gridConfig.leftTier} placeholder="e.g. General" onChange={(e) => setGridConfig((g) => ({ ...g, leftTier: e.target.value.slice(0, 60) }))} />

                {gridConfig.blockCount === 2 && (
                  <>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>What do you call the right section?</label>
                    <input style={{ ...inputStyle, width: '220px', marginBottom: '12px' }} value={gridConfig.rightTier} placeholder="e.g. General" onChange={(e) => setGridConfig((g) => ({ ...g, rightTier: e.target.value.slice(0, 60) }))} />

                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>How wide should the middle walkway be?</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      {[{ label: 'Narrow', px: 40 }, { label: 'Standard', px: 60 }, { label: 'Wide', px: 90 }].map((opt) => (
                        <button key={opt.label} onClick={() => setGridConfig((g) => ({ ...g, centerAislePx: opt.px }))} style={{ padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: gridConfig.centerAislePx === opt.px ? 'none' : '1px solid rgba(14,12,10,0.2)', background: gridConfig.centerAislePx === opt.px ? '#0E0C0A' : '#fff', color: gridConfig.centerAislePx === opt.px ? '#fff' : '#0E0C0A' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} disabled={!gridConfig.leftTier.trim() || (gridConfig.blockCount === 2 && !gridConfig.rightTier.trim())} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (!gridConfig.leftTier.trim() || (gridConfig.blockCount === 2 && !gridConfig.rightTier.trim())) ? 0.5 : 1 }}>Next</button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Do all rows have the same number of seats?</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setUniformRows(true)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardUniform === true ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardUniform === true ? '#0E0C0A' : '#fff', color: wizardUniform === true ? '#fff' : '#0E0C0A' }}>
                    Yes, same for every row
                  </button>
                  <button onClick={() => setUniformRows(false)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardUniform === false ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardUniform === false ? '#0E0C0A' : '#fff', color: wizardUniform === false ? '#fff' : '#0E0C0A' }}>
                    No, it tapers (e.g. fewer seats near the stage)
                  </button>
                </div>

                {wizardUniform === true && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Total rows</label>
                      <input type="number" style={{ ...inputStyle, width: '90px' }} value={gridConfig.rowGroups[0]?.rows || 1} onChange={(e) => gridConfig.rowGroups[0] && updateRowGroup(gridConfig.rowGroups[0].id, 'rows', Number(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Seats per row{gridConfig.blockCount === 2 ? ' (per block)' : ''}</label>
                      <input type="number" style={{ ...inputStyle, width: '90px' }} value={gridConfig.rowGroups[0]?.columns || 1} onChange={(e) => gridConfig.rowGroups[0] && updateRowGroup(gridConfig.rowGroups[0].id, 'columns', Number(e.target.value) || 1)} />
                    </div>
                  </div>
                )}

                {wizardUniform === false && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6, marginBottom: '8px' }}>Add a group for each range of rows that shares the same seat count (e.g. rows 1-3 with 8 seats, rows 4-10 with 14 seats).</div>
                    {gridConfig.rowGroups.map((rg, i) => (
                      <div key={rg.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.6, minWidth: '60px' }}>Group {i + 1}:</span>
                        <label style={{ fontSize: '12px' }}>Rows:</label>
                        <input type="number" style={{ ...inputStyle, width: '60px' }} value={rg.rows} onChange={(e) => updateRowGroup(rg.id, 'rows', Number(e.target.value) || 1)} />
                        <label style={{ fontSize: '12px' }}>Seats:</label>
                        <input type="number" style={{ ...inputStyle, width: '60px' }} value={rg.columns} onChange={(e) => updateRowGroup(rg.id, 'columns', Number(e.target.value) || 1)} />
                        {gridConfig.rowGroups.length > 1 && <button onClick={() => removeRowGroup(rg.id)} style={{ border: 'none', background: 'none', color: '#B3261E', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                      </div>
                    ))}
                    <button onClick={addRowGroup} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                      + Add another range
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} disabled={wizardUniform === null} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: wizardUniform === null ? 0.5 : 1 }}>Next</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Any walkway partway through the rows, like a gangway after a certain row?</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setWizardAisle(true)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasAisle === true ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasAisle === true ? '#0E0C0A' : '#fff', color: wizardHasAisle === true ? '#fff' : '#0E0C0A' }}>Yes</button>
                  <button onClick={() => setWizardAisle(false)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasAisle === false ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasAisle === false ? '#0E0C0A' : '#fff', color: wizardHasAisle === false ? '#fff' : '#0E0C0A' }}>No</button>
                </div>

                {wizardHasAisle === true && gridConfig.aisles.map((a) => (
                  <div key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>After row #</label>
                    <input type="number" style={{ ...inputStyle, width: '70px' }} value={a.afterRow} onChange={(e) => updateAisle(a.id, 'afterRow', Number(e.target.value) || 0)} />
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} disabled={wizardHasAisle === null} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: wizardHasAisle === null ? 0.5 : 1 }}>Next: Preview</button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Preview</h3>
                <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.7, marginBottom: '12px' }}>
                  This is exactly what your audience will see. {wizardPreviewSeats.length} seats across {gridConfig.rowGroups.reduce((s, r) => s + r.rows, 0)} rows.
                </p>
                <div
                  style={{
                    position: 'relative', width: `${CANVAS_WIDTH}px`, maxWidth: '100%', height: `${CANVAS_HEIGHT}px`,
                    background: '#FBF8F3', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px',
                  }}
                >
                  <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '60%', padding: '8px 0', textAlign: 'center', borderRadius: '6px', background: '#0E0C0A', color: '#fff', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Stage
                  </div>
                  {wizardPreviewSeats.map((s, i) => (
                    <div key={i} style={{ position: 'absolute', left: s.x - SEAT_SIZE / 2, top: s.y - SEAT_SIZE / 2, width: `${SEAT_SIZE}px`, height: `${SEAT_SIZE}px`, borderRadius: '5px', background: colorForTier(s.tierLabel, [gridConfig.leftTier, gridConfig.rightTier]), opacity: 0.85, color: '#fff', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.row}{s.number}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={finishWizard} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#0E0C0A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Looks good — continue to fine-tune</button>
                </div>
              </div>
            )}
          </div>
        )}

        {seatingMode === 'NUMBERED' && effectivePath === 'canvas' && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.55, marginBottom: '10px', fontStyle: 'italic' }}>
                {seats.length === 0 && (
                  <button onClick={backToChoice} style={{ display: 'block', fontSize: '12px', color: '#0E0C0A', opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '8px', textDecoration: 'underline' }}>
                    ← Back to setup options
                  </button>
                )}
                Orientation: this canvas is drawn as if you're standing on stage facing the audience — "Left" and "Right" match the performer's perspective, not the audience's.
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <button
                  onClick={() => setShowGenerator((v) => !v)}
                  style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#C8441A', color: '#fff' }}
                >
                  {showGenerator ? 'Close Grid Generator' : '+ Generate Grid'}
                </button>
                <button
                  onClick={resetLayout}
                  style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: '1px solid #B3261E', background: '#fff', color: '#B3261E' }}
                >
                  Reset Layout
                </button>
              </div>

              {showGenerator && (
                <div style={{ marginBottom: '16px', padding: '18px', borderRadius: '10px', background: '#FBF8F3', border: '1px solid rgba(14,12,10,0.1)' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Layout:</label>
                    <button
                      onClick={() => setGridConfig((g) => ({ ...g, blockCount: 1 }))}
                      style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: gridConfig.blockCount === 1 ? 'none' : '1px solid rgba(14,12,10,0.15)', background: gridConfig.blockCount === 1 ? '#0E0C0A' : '#fff', color: gridConfig.blockCount === 1 ? '#fff' : '#0E0C0A' }}
                    >
                      Single Block
                    </button>
                    <button
                      onClick={() => setGridConfig((g) => ({ ...g, blockCount: 2 }))}
                      style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: gridConfig.blockCount === 2 ? 'none' : '1px solid rgba(14,12,10,0.15)', background: gridConfig.blockCount === 2 ? '#0E0C0A' : '#fff', color: gridConfig.blockCount === 2 ? '#fff' : '#0E0C0A' }}
                    >
                      Two Blocks (Left / Right)
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>{gridConfig.blockCount === 2 ? 'Left tier name:' : 'Tier name:'}</label>
                    <input style={{ ...inputStyle, width: '130px' }} value={gridConfig.leftTier} onChange={(e) => setGridConfig((g) => ({ ...g, leftTier: e.target.value.slice(0, 60) }))} />
                    {gridConfig.blockCount === 2 && (
                      <>
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Right tier name:</label>
                        <input style={{ ...inputStyle, width: '130px' }} value={gridConfig.rightTier} onChange={(e) => setGridConfig((g) => ({ ...g, rightTier: e.target.value.slice(0, 60) }))} />
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Center aisle (px):</label>
                        <input type="number" style={{ ...inputStyle, width: '70px' }} value={gridConfig.centerAislePx} onChange={(e) => setGridConfig((g) => ({ ...g, centerAislePx: Math.max(0, Number(e.target.value) || 0) }))} />
                      </>
                    )}
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Side margin (px):</label>
                    <input type="number" style={{ ...inputStyle, width: '70px' }} value={gridConfig.sideMarginPx} onChange={(e) => setGridConfig((g) => ({ ...g, sideMarginPx: Math.max(0, Number(e.target.value) || 0) }))} />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Seat spacing X/Y (px):</label>
                    <input type="number" style={{ ...inputStyle, width: '60px' }} value={gridConfig.seatSpacingX} onChange={(e) => setGridConfig((g) => ({ ...g, seatSpacingX: Math.max(10, Number(e.target.value) || 10) }))} />
                    <input type="number" style={{ ...inputStyle, width: '60px' }} value={gridConfig.seatSpacingY} onChange={(e) => setGridConfig((g) => ({ ...g, seatSpacingY: Math.max(10, Number(e.target.value) || 10) }))} />
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Row groups (rows can taper — different column counts per range)</div>
                  {gridConfig.rowGroups.map((rg, i) => (
                    <div key={rg.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', opacity: 0.6, minWidth: '70px' }}>Group {i + 1}:</span>
                      <label style={{ fontSize: '12px' }}>Rows:</label>
                      <input type="number" style={{ ...inputStyle, width: '60px' }} value={rg.rows} onChange={(e) => updateRowGroup(rg.id, 'rows', Number(e.target.value) || 1)} />
                      <label style={{ fontSize: '12px' }}>Columns:</label>
                      <input type="number" style={{ ...inputStyle, width: '60px' }} value={rg.columns} onChange={(e) => updateRowGroup(rg.id, 'columns', Number(e.target.value) || 1)} />
                      <button onClick={() => removeRowGroup(rg.id)} style={{ border: 'none', background: 'none', color: '#B3261E', cursor: 'pointer', fontSize: '16px' }}>×</button>
                    </div>
                  ))}
                  <button onClick={addRowGroup} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px' }}>
                    + Add row group
                  </button>

                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Horizontal aisles (a walking gap between two rows, e.g. a gangway)</div>
                  {gridConfig.aisles.map((a) => (
                    <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px' }}>After row #:</label>
                      <input type="number" style={{ ...inputStyle, width: '60px' }} value={a.afterRow} onChange={(e) => updateAisle(a.id, 'afterRow', Number(e.target.value) || 0)} />
                      <label style={{ fontSize: '12px' }}>Gap (px):</label>
                      <input type="number" style={{ ...inputStyle, width: '60px' }} value={a.gapPx} onChange={(e) => updateAisle(a.id, 'gapPx', Number(e.target.value) || 0)} />
                      <button onClick={() => removeAisle(a.id)} style={{ border: 'none', background: 'none', color: '#B3261E', cursor: 'pointer', fontSize: '16px' }}>×</button>
                    </div>
                  ))}
                  <button onClick={addAisle} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px', display: 'block' }}>
                    + Add horizontal aisle
                  </button>

                  <button onClick={generateGrid} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#0E0C0A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    Generate Seats
                  </button>
                </div>
              )}

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
                <span style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5 }}>Click the canvas to place a seat manually</span>
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
                <div
                  style={{
                    position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
                    width: '60%', padding: '8px 0', textAlign: 'center', borderRadius: '6px',
                    background: '#0E0C0A', color: '#fff', fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none', zIndex: 1,
                  }}
                >
                  Stage
                </div>
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
