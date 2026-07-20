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
// Stage bar sits at top:8px with ~8px padding top/bottom around an 11px
// label - roughly 37px tall in total. 40px of clearance let the first
// row's seat squares (11px half-height) draw underneath/behind it.
// 70px gives clear breathing room between the stage and row A.
const STAGE_CLEARANCE_Y = 70

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

// A zone is a named group of rows sharing the same seat count and price
// identity (e.g. "Front", "Mid", "Recliner") - a real venue's actual
// pricing structure. Vertical aisles are pure seat separators WITHIN a
// zone (a walking gap, no pricing of their own); horizontal aisles are
// usually where one zone ends and the next begins, though that's a
// convention, not enforced.
type HorizontalAisle = { id: string; afterRow: number; gapPx: number }
// A vertical aisle is the mirror of a horizontal aisle - a gap after
// column N instead of after row N. It is purely structural: it splits a
// zone's seats for walking room, but does NOT create a separate pricing
// identity - that comes from the zone (row-group) alone. "Blocks" fall
// out of this for free: 0 vertical aisles = seats packed solid, 1 aisle
// = a center walkway, N aisles = N+1 walking segments, all in the same
// zone - no hardcoded cap, no separate blockCount concept.
// Position is a FRACTION of each row's width (0-1), not an absolute
// column - with tapering rows (different column counts per row-group),
// a fixed column position pins one side to a constant width while the
// other side absorbs the entire taper, producing a lopsided layout
// instead of both sides growing together like a real fan-shaped hall.
//
// Lives on the RowGroup (zone), not globally - confirmed with Hitesh
// that different zones can have entirely different aisle layouts (e.g.
// a 16-column zone split into 4 blocks, a 20-column zone split into 2).
type VerticalAisle = { id: string; afterFraction: number; gapPx: number }
type RowGroup = { id: string; rows: number; columns: number; zoneName: string; verticalAisles: VerticalAisle[] }

type GridConfig = {
  sideMarginPx: number
  seatSpacingX: number
  seatSpacingY: number
  rowGroups: RowGroup[]
  aisles: HorizontalAisle[]
  // How rows of DIFFERENT widths (tapering row-groups) line up against
  // each other. 'left' packs every row flush against the same left
  // edge, so wider rows only grow rightward - a staircase, not a fan.
  // 'center' (the realistic default for a real hall) shares one central
  // axis across every row, so narrower rows are inset equally on both
  // sides. 'right' is the mirror of 'left'. Rows of equal width look
  // identical under all three - this only matters once rows taper.
  rowAlignment: 'left' | 'center' | 'right'
}

// Pure function - given a config, returns the seats it describes. Kept
// separate from React state so it's easy to reason about (and test by
// hand against Hitesh's two reference scenarios) independent of the UI.
// STAGE-FACING CONVENTION: canvas x increases left-to-right as if you
// are standing on stage looking out at the audience - "Left" and
// "Right" (as segment order) match the performer's perspective, not
// the audience's.
function computeGridSeats(config: GridConfig, originX: number, originY: number): Omit<SeatDraft, 'clientId'>[] {
  const totalRows = config.rowGroups.reduce((sum, g) => sum + g.rows, 0)
  const seats: Omit<SeatDraft, 'clientId'>[] = []

  // Expand row-groups into flat per-row lookups, including each row's
  // OWN vertical-aisle set - zones can have entirely different aisle
  // layouts (different column counts, different split counts/positions).
  const columnsForRow: number[] = []
  const zoneForRow: string[] = []
  const vAislesForRow: VerticalAisle[][] = []
  for (const g of config.rowGroups) {
    const sortedVAisles = [...g.verticalAisles].sort((a, b) => a.afterFraction - b.afterFraction)
    for (let i = 0; i < g.rows; i++) {
      columnsForRow.push(g.columns)
      zoneForRow.push(g.zoneName || 'General')
      vAislesForRow.push(sortedVAisles)
    }
  }

  // Pixel width of a row with `cols` seats and its own aisle set - each
  // zone can have a different aisle count/width now, so this is computed
  // per-row rather than once globally.
  const rowWidthPx = (cols: number, vAisles: VerticalAisle[]) =>
    cols * config.seatSpacingX + vAisles.reduce((sum, a) => sum + a.gapPx, 0)
  const maxRowWidthPx = Math.max(0, ...columnsForRow.map((cols, i) => rowWidthPx(cols, vAislesForRow[i])))

  let y = originY
  for (let r = 0; r < totalRows; r++) {
    // Horizontal aisle gaps accumulate extra vertical space BEFORE this
    // row if one was configured to land here (e.g. "gap after row 10"
    // adds space before row 11 - a 1-based, human-facing row count).
    const aisleHere = config.aisles.find((a) => a.afterRow === r)
    if (aisleHere) y += aisleHere.gapPx

    const cols = columnsForRow[r] || 0
    const zoneName = zoneForRow[r] || 'General'
    const rowLetter = rowLetterAt(r)
    const vAisles = vAislesForRow[r] || []

    // Convert each aisle's fraction into THIS row's actual cut point -
    // e.g. a 0.5 aisle lands after column 5 on a 10-wide row and after
    // column 8 on a 16-wide row, so both sides taper together instead
    // of one side staying a fixed width. Range is [0, cols] inclusive -
    // 0 means a walkway BEFORE the first seat (against the wall), cols
    // means a walkway AFTER the last seat - not just strictly between
    // two seats. Clamped strictly increasing so narrow rows with
    // multiple aisles can't collapse two cuts onto the same column.
    let prevCut = -1
    const cutPointsForRow = vAisles.map((a) => {
      const cut = Math.max(prevCut + 1, Math.min(cols, Math.round(cols * a.afterFraction)))
      prevCut = cut
      return cut
    })

    // Slack is how much narrower this row is than the widest row in the
    // layout - 'left' puts all of it on the right (unchanged rows start
    // at the same spot), 'right' puts all of it on the left, 'center'
    // splits it evenly so every row shares the same central axis.
    const slack = maxRowWidthPx - rowWidthPx(cols, vAisles)
    const leftInset = config.rowAlignment === 'center' ? slack / 2 : config.rowAlignment === 'right' ? slack : 0

    let x = originX + config.sideMarginPx + leftInset
    let segment = 0
    // Numbering is continuous 1..cols across every section in the row -
    // this was special-cased for exactly two blocks before (and had to
    // avoid a (venueId, row, number) collision); with a single loop over
    // total columns it falls out naturally, no special-casing needed,
    // and still matches real theater signage.
    for (let c = 1; c <= cols; c++) {
      while (segment < cutPointsForRow.length && cutPointsForRow[segment] === c - 1) {
        x += vAisles[segment].gapPx
        segment++
      }
      seats.push({ tierLabel: zoneName, row: rowLetter, number: String(c), x, y })
      x += config.seatSpacingX
    }
    // A trailing edge aisle (cut === cols) sits after the last seat, so
    // it never triggers inside the loop above (which only checks up to
    // c === cols, i.e. cut === cols - 1). It's still correctly counted
    // in rowWidthPx/maxRowWidthPx for alignment purposes even though
    // nothing renders after it - this just consumes the segment pointer
    // for correctness rather than leaving it dangling.
    while (segment < cutPointsForRow.length && cutPointsForRow[segment] === cols) {
      segment++
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

// A generated (or manually placed) layout can be wider/taller than the
// default canvas - large grids used to draw silently past CANVAS_WIDTH/
// HEIGHT and get clipped by overflow:hidden with no scrollbar and no
// warning, so seats existed but were invisible and impossible to verify.
// Canvas containers now size to whichever is bigger: the default, or the
// actual content bounds plus padding.
function contentBounds(points: { x: number; y: number }[]) {
  const maxX = points.reduce((m, p) => Math.max(m, p.x), 0)
  const maxY = points.reduce((m, p) => Math.max(m, p.y), 0)
  return {
    width: Math.max(CANVAS_WIDTH, maxX + 60),
    height: Math.max(CANVAS_HEIGHT, maxY + 60),
    overflowsDefault: maxX + 60 > CANVAS_WIDTH || maxY + 60 > CANVAS_HEIGHT,
  }
}

// Preview-only sizing (wizard step 4) - deliberately WITHOUT the
// CANVAS_WIDTH/HEIGHT floor that contentBounds uses for the editable
// canvas. A small layout (e.g. 5 rows) doesn't need a 900x560 box with
// mostly-empty space and a needless scrollbar; it should size tightly to
// its own content and center in the available width. Only genuinely
// large layouts scroll, and only horizontally/vertically as needed.
function previewBounds(points: { x: number; y: number }[]) {
  const maxX = points.reduce((m, p) => Math.max(m, p.x), 0)
  const maxY = points.reduce((m, p) => Math.max(m, p.y), 0)
  return {
    width: Math.max(280, maxX + 60),
    height: Math.max(180, maxY + 60),
  }
}

// Fresh default config for a level that doesn't have one yet - a plain
// factory (not React state) since each level in gridConfigByLevel needs
// its own independent starting point.
function defaultGridConfig(): GridConfig {
  return {
    sideMarginPx: 30,
    seatSpacingX: 26,
    seatSpacingY: 30,
    rowGroups: [{ id: makeClientId(), rows: 5, columns: 10, zoneName: 'General', verticalAisles: [] }],
    aisles: [],
    // 'center' is the realistic default for a real hall (rows widen
    // symmetrically around a shared axis) and is a no-op whenever every
    // row is the same width, so it's safe as a default either way.
    rowAlignment: 'center',
  }
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

  // §9.4 - venue Levels (Ground Floor, Balcony, 1st, 2nd...). Starts as a
  // single implicit level ('') that stays invisible in the UI unless the
  // owner adds a real one - confirmed with Hitesh this needs to live in
  // the wizard/canvas entry point, not an advanced-only panel, for
  // international multi-level venues. Everything below (seats,
  // gridConfig, builderPath, per-zone suggested prices) is scoped PER
  // LEVEL so each level gets its own independent layout.
  const [levels, setLevels] = useState<string[]>([''])
  const [activeLevel, setActiveLevel] = useState<string>('')
  const levelLabel = (lvl: string) => lvl || 'Main'

  const [seatsByLevel, setSeatsByLevel] = useState<Record<string, SeatDraft[]>>({})
  const seats = seatsByLevel[activeLevel] || []
  const setSeats = (updater: (prev: SeatDraft[]) => SeatDraft[]) =>
    setSeatsByLevel((prev) => ({ ...prev, [activeLevel]: updater(prev[activeLevel] || []) }))

  const [gridConfigByLevel, setGridConfigByLevel] = useState<Record<string, GridConfig>>({})
  const gridConfig = gridConfigByLevel[activeLevel] || defaultGridConfig()
  const setGridConfig = (updater: (prev: GridConfig) => GridConfig) =>
    setGridConfigByLevel((prev) => ({ ...prev, [activeLevel]: updater(prev[activeLevel] || defaultGridConfig()) }))

  // Per-zone SUGGESTED price (decision: organiser-facing prefill only,
  // never a lock - organiser can still override at event creation, same
  // as today's TicketTier.price model). Kept as its own small map rather
  // than on RowGroup, since RowGroup state isn't reconstructed from saved
  // seats on reload (only the seats themselves are) - this map
  // round-trips independently via VenueZonePrice.
  const [zonePricesByLevel, setZonePricesByLevel] = useState<Record<string, Record<string, string>>>({})
  const zonePrices = zonePricesByLevel[activeLevel] || {}
  const setZonePrice = (zoneName: string, price: string) =>
    setZonePricesByLevel((prev) => ({ ...prev, [activeLevel]: { ...(prev[activeLevel] || {}), [zoneName]: price } }))

  const [builderPathByLevel, setBuilderPathByLevel] = useState<Record<string, 'choose' | 'wizard' | 'canvas' | null>>({})
  const builderPath = builderPathByLevel[activeLevel] ?? null
  const setBuilderPath = (path: 'choose' | 'wizard' | 'canvas' | null) =>
    setBuilderPathByLevel((prev) => ({ ...prev, [activeLevel]: path }))

  const addLevel = () => {
    const name = window.prompt('Name this level (e.g. "Ground Floor", "Balcony", "1st Floor")')
    if (name === null) return
    const trimmed = name.trim().slice(0, 60)
    if (!trimmed) { showToast('Level name cannot be empty.', 'error'); return }
    if (levels.includes(trimmed)) { showToast('A level with that name already exists.', 'error'); return }
    setLevels((prev) => [...prev, trimmed])
    setActiveLevel(trimmed)
  }
  const removeLevel = (name: string) => {
    if (levels.length <= 1) return
    if (!window.confirm(`Remove level "${levelLabel(name)}"? This clears its local layout - nothing is deleted server-side until you Save.`)) return
    setLevels((prev) => prev.filter((l) => l !== name))
    setSeatsByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
    setGridConfigByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
    setBuilderPathByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
    setZonePricesByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
    if (activeLevel === name) {
      const remaining = levels.filter((l) => l !== name)
      setActiveLevel(remaining[0] || '')
    }
  }

  const [activeTier, setActiveTier] = useState('General')
  const [nextRow, setNextRow] = useState('A')
  const [nextNumber, setNextNumber] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  // A click on the canvas used to always place a new seat - which meant
  // simply reviewing/scrolling a Guided-Setup-generated layout could
  // silently scatter stray seats wherever the owner clicked (live bug,
  // 20 Jul session). Defaults OFF after Guided Setup (safe to click
  // around and inspect), ON for Draw It Myself (where click-to-place is
  // the entire point) - toggleable either way at any time.
  const [manualPlacement, setManualPlacement] = useState(false)

  // §9.4 - Grid Generator state. Kept separate from the freeform seats
  // array - Generate computes seats and appends them, manual placement
  // still works on top of a generated layout.
  const [showGenerator, setShowGenerator] = useState(false)

  // Guided Setup (wizard) - a plain-language front door onto the SAME
  // gridConfig/computeGridSeats engine the advanced Generate Grid panel
  // uses. Not a separate feature: it edits the same state via the same
  // helper functions below, just one question at a time instead of a
  // dense all-at-once form. "Draw It Myself" (existing canvas) stays a
  // fully first-class second path, not a fallback - some venue owners
  // want hands-on creative control and shouldn't be funneled away from it.
  // Step order: shape -> zones (rows + zone names + suggested price per
  // zone) -> vertical walkway -> row alignment -> horizontal aisle(s) ->
  // preview.
  const effectivePath = builderPath ?? (seats.length > 0 ? 'canvas' : 'choose')
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardShape, setWizardShape] = useState<'rows' | 'other' | null>(null)
  const [wizardMultiZone, setWizardMultiZone] = useState<boolean | null>(null)
  const [wizardHasVerticalAisle, setWizardHasVerticalAisle] = useState<boolean | null>(null)
  const [wizardHasAisle, setWizardHasAisle] = useState<boolean | null>(null)

  const startWizard = () => { setBuilderPath('wizard'); setWizardStep(0); setWizardShape(null); setWizardMultiZone(null); setWizardHasVerticalAisle(null); setWizardHasAisle(null) }
  const startDrawMyself = () => { setBuilderPath('canvas'); setManualPlacement(true) }
  const backToChoice = () => { setBuilderPath('choose'); setWizardStep(0) }
  const wizardNext = () => setWizardStep((s) => s + 1)
  const wizardBack = () => setWizardStep((s) => Math.max(0, s - 1))

  // "Multiple zones" just means "more than one row-group" - each
  // row-group already IS a zone (rows + seat count + a name). Single
  // zone collapses to exactly one row-group spanning every row.
  const setMultiZone = (multi: boolean) => {
    setWizardMultiZone(multi)
    if (!multi) {
      const totalRows = gridConfig.rowGroups.reduce((s, r) => s + r.rows, 0) || 5
      const columns = gridConfig.rowGroups[0]?.columns || 10
      const zoneName = gridConfig.rowGroups[0]?.zoneName || 'General'
      const verticalAisles = gridConfig.rowGroups[0]?.verticalAisles || []
      setGridConfig((g) => ({ ...g, rowGroups: [{ id: makeClientId(), rows: totalRows, columns, zoneName, verticalAisles }] }))
    } else if (gridConfig.rowGroups.length < 2) {
      setGridConfig((g) => ({
        ...g,
        rowGroups: [
          g.rowGroups[0] || { id: makeClientId(), rows: 5, columns: 10, zoneName: 'Front', verticalAisles: [] },
          { id: makeClientId(), rows: 5, columns: 10, zoneName: 'Back', verticalAisles: [] },
        ],
      }))
    }
  }

  // Wizard offers a single yes/no walkway (per-zone divergence stays in
  // the advanced panel, which has full per-zone vertical-aisle control) -
  // applies the SAME starting aisle to every current zone at the row's
  // midpoint (50%), which scales with tapering rows instead of pinning
  // one side to a fixed width. Purely a walking gap - it does not create
  // a separate pricing section.
  const setWizardVerticalAisle = (has: boolean) => {
    setWizardHasVerticalAisle(has)
    setGridConfig((g) => ({
      ...g,
      rowGroups: g.rowGroups.map((rg) => ({
        ...rg,
        verticalAisles: has ? [{ id: makeClientId(), afterFraction: 0.5, gapPx: 60 }] : [],
      })),
    }))
  }

  const setWizardAisle = (has: boolean) => {
    setWizardHasAisle(has)
    if (!has) setGridConfig((g) => ({ ...g, aisles: [] }))
    else if (gridConfig.aisles.length === 0) addAisle()
  }

  const wizardPreviewSeats = computeGridSeats(gridConfig, 40, STAGE_CLEARANCE_Y)

  const finishWizard = () => {
    generateGrid()
    setManualPlacement(false)
    setBuilderPath('canvas')
  }

  const addRowGroup = () =>
    setGridConfig((g) => ({ ...g, rowGroups: [...g.rowGroups, { id: makeClientId(), rows: 5, columns: 10, zoneName: `Zone ${g.rowGroups.length + 1}`, verticalAisles: [] }] }))
  const removeRowGroup = (id: string) => setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.filter((r) => r.id !== id) }))
  const updateRowGroup = (id: string, field: 'rows' | 'columns', value: number) =>
    setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.map((r) => (r.id === id ? { ...r, [field]: Math.max(1, value) } : r)) }))
  const updateRowGroupZone = (id: string, zoneName: string) =>
    setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.map((r) => (r.id === id ? { ...r, zoneName: zoneName.slice(0, 60) } : r)) }))

  const addAisle = () => setGridConfig((g) => ({ ...g, aisles: [...g.aisles, { id: makeClientId(), afterRow: g.rowGroups.reduce((s, r) => s + r.rows, 0), gapPx: 30 }] }))
  const removeAisle = (id: string) => setGridConfig((g) => ({ ...g, aisles: g.aisles.filter((a) => a.id !== id) }))
  const updateAisle = (id: string, field: 'afterRow' | 'gapPx', value: number) =>
    setGridConfig((g) => ({ ...g, aisles: g.aisles.map((a) => (a.id === id ? { ...a, [field]: Math.max(0, value) } : a)) }))

  // Vertical aisles now live per-zone (per-RowGroup) - different zones
  // can have entirely different split counts/positions (confirmed with
  // Hitesh: a 16-column zone might need 4 splits, a 20-column zone only
  // 2). New aisles default to an even spread within that zone rather
  // than a fixed column - stays sensible regardless of that zone's width.
  const addVerticalAisleToGroup = (groupId: string) =>
    setGridConfig((g) => ({
      ...g,
      rowGroups: g.rowGroups.map((rg) => {
        if (rg.id !== groupId) return rg
        const defaultFraction = (rg.verticalAisles.length + 1) / (rg.verticalAisles.length + 2)
        return { ...rg, verticalAisles: [...rg.verticalAisles, { id: makeClientId(), afterFraction: defaultFraction, gapPx: 60 }] }
      }),
    }))
  const removeVerticalAisleFromGroup = (groupId: string, aisleId: string) =>
    setGridConfig((g) => ({
      ...g,
      rowGroups: g.rowGroups.map((rg) => (rg.id === groupId ? { ...rg, verticalAisles: rg.verticalAisles.filter((a) => a.id !== aisleId) } : rg)),
    }))
  const updateVerticalAisleInGroup = (groupId: string, aisleId: string, field: 'afterFraction' | 'gapPx', value: number) =>
    setGridConfig((g) => ({
      ...g,
      rowGroups: g.rowGroups.map((rg) =>
        rg.id !== groupId
          ? rg
          : {
              ...rg,
              verticalAisles: rg.verticalAisles.map((a) =>
                a.id === aisleId ? { ...a, [field]: field === 'afterFraction' ? Math.min(1, Math.max(0, value)) : Math.max(0, value) } : a
              ),
            }
      ),
    }))

  const generateGrid = () => {
    const totalRows = gridConfig.rowGroups.reduce((s, r) => s + r.rows, 0)
    if (totalRows === 0) {
      showToast('Add at least one row group first.', 'error')
      return
    }
    const generated = computeGridSeats(gridConfig, 40, STAGE_CLEARANCE_Y)
    setSeats((prev) => [...prev, ...generated.map((s) => ({ ...s, clientId: makeClientId() }))])
    showToast(`Generated ${generated.length} seats.`, 'success')
    setShowGenerator(false)
  }

  const resetLayout = () => {
    if (seats.length === 0) return
    if (!window.confirm(`Clear the layout for ${levelLabel(activeLevel)}? This only affects your local edits - nothing is deleted until you Save.`)) return
    setSeats(() => [])
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

        // Group loaded seats by level - each distinct level value found
        // becomes a tab. Existing single-level venues have every seat at
        // level '' and end up with exactly one (invisible-by-default) tab.
        const byLevel: Record<string, SeatDraft[]> = {}
        for (const s of data.seats || []) {
          const lvl = s.level || ''
          if (!byLevel[lvl]) byLevel[lvl] = []
          byLevel[lvl].push({ clientId: makeClientId(), tierLabel: s.tierLabel, row: s.row, number: s.number, x: s.x, y: s.y })
        }
        const foundLevels = Object.keys(byLevel)
        setSeatsByLevel(byLevel)
        setLevels(foundLevels.length > 0 ? foundLevels : [''])
        setActiveLevel(foundLevels[0] ?? '')

        const priceByLevel: Record<string, Record<string, string>> = {}
        for (const z of data.zonePrices || []) {
          const lvl = z.level || ''
          if (!priceByLevel[lvl]) priceByLevel[lvl] = {}
          priceByLevel[lvl][z.zoneName] = z.suggestedPrice != null ? String(z.suggestedPrice) : ''
        }
        setZonePricesByLevel(priceByLevel)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) fetchSeatMap()
  }, [session, id])

  const tierOrder = Array.from(new Set(seats.map((s) => s.tierLabel).concat(activeTier ? [activeTier] : [])))
  const canvasBounds = contentBounds(seats)

  const placeSeat = (e: React.MouseEvent<HTMLDivElement>) => {
    if (seatingMode !== 'NUMBERED') return
    if (!manualPlacement) return
    if (dragId) return // don't place while finishing a drag
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)
    if (x < 0 || y < 0 || x > canvasBounds.width || y > canvasBounds.height) return
    if (y < STAGE_CLEARANCE_Y) {
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
      const x = Math.max(0, Math.min(canvasBounds.width, Math.round(e.clientX - rect.left)))
      const y = Math.max(0, Math.min(canvasBounds.height, Math.round(e.clientY - rect.top)))
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
    // Mid-wizard with nothing generated yet used to silently save 0
    // seats and show a false green "Saved 0 seats" success toast - the
    // button was reachable at every wizard step. Now it warns instead of
    // proceeding silently, but doesn't block Save outright, since other
    // levels may already have a real, finished layout worth saving.
    if (effectivePath === 'wizard' && seats.length === 0) {
      if (!window.confirm(`You haven't finished Guided Setup for ${levelLabel(activeLevel)} yet - it will save with 0 seats. Continue?`)) {
        return
      }
    }

    // Full-venue replace - flatten every level's seats/zone-prices into
    // one payload (the API always replaces the WHOLE venue's layout, not
    // just the active level), so saving while level B is mid-setup must
    // not lose level A's already-built seats.
    const allSeats = Object.entries(seatsByLevel).flatMap(([level, lvlSeats]) =>
      lvlSeats.map((s) => ({ tierLabel: s.tierLabel, row: s.row, number: s.number, x: s.x, y: s.y, level }))
    )
    const allZonePrices = Object.entries(zonePricesByLevel).flatMap(([level, prices]) =>
      Object.entries(prices)
        .filter(([, price]) => price.trim() !== '')
        .map(([zoneName, price]) => ({ level, zoneName, suggestedPrice: parseFloat(price) }))
    )

    // Duplicate row/number check client-side first (level-scoped, since
    // the same row/number legitimately repeats across different levels)
    // - mirrors the server validation in PUT so the error surfaces
    // before a wasted round trip.
    const seen = new Set<string>()
    for (const s of allSeats) {
      const key = `${s.level}::${s.row}::${s.number}`
      if (seen.has(key)) {
        showToast(`Duplicate seat label: Row ${s.row}, Seat ${s.number}${s.level ? ` (${s.level})` : ''}. Fix before saving.`, 'error')
        return
      }
      seen.add(key)
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/venues/${id}/seats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatingMode, seats: allSeats, zonePrices: allZonePrices }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      showToast(`Saved ${data.seatCount} seat${data.seatCount === 1 ? '' : 's'} across ${levels.length} level${levels.length === 1 ? '' : 's'}.`, 'success')
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
          <div style={{ marginBottom: '20px' }}>
            {levels.length === 1 ? (
              <button onClick={addLevel} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', opacity: 0.6, background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                + This venue has more than one level (e.g. Balcony, 1st Floor)
              </button>
            ) : (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0E0C0A', opacity: 0.6, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {levels.map((lvl) => (
                    <div key={lvl} style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={() => setActiveLevel(lvl)}
                        style={{
                          padding: '7px 14px', borderRadius: '8px 0 0 8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                          border: activeLevel === lvl ? 'none' : '1px solid rgba(14,12,10,0.15)',
                          background: activeLevel === lvl ? '#0E0C0A' : '#fff',
                          color: activeLevel === lvl ? '#fff' : '#0E0C0A',
                        }}
                      >
                        {levelLabel(lvl)}
                      </button>
                      <button
                        onClick={() => removeLevel(lvl)}
                        title={`Remove ${levelLabel(lvl)}`}
                        style={{
                          padding: '7px 8px', borderRadius: '0 8px 8px 0', fontSize: '13px', cursor: 'pointer',
                          border: activeLevel === lvl ? 'none' : '1px solid rgba(14,12,10,0.15)', borderLeft: 'none',
                          background: activeLevel === lvl ? '#0E0C0A' : '#fff',
                          color: activeLevel === lvl ? '#fff' : '#B3261E',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button onClick={addLevel} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', opacity: 0.6, background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>
                    + Add level
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginTop: '6px' }}>
                  Each level has its own independent seat layout - build them one at a time using Guided Setup or Draw It Myself below.
                </p>
              </div>
            )}
          </div>
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
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Do you want different pricing zones by row depth?</h3>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6, marginBottom: '12px' }}>
                  e.g. "Front" costs more than "Back". Each zone is a range of rows with its own name and seat count - that name is what an organiser will price when they build an event here.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setMultiZone(false)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardMultiZone === false ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardMultiZone === false ? '#0E0C0A' : '#fff', color: wizardMultiZone === false ? '#fff' : '#0E0C0A' }}>
                    No, one zone for everything
                  </button>
                  <button onClick={() => setMultiZone(true)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardMultiZone === true ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardMultiZone === true ? '#0E0C0A' : '#fff', color: wizardMultiZone === true ? '#fff' : '#0E0C0A' }}>
                    Yes, multiple zones
                  </button>
                </div>

                {wizardMultiZone === false && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Total rows</label>
                      <input type="number" style={{ ...inputStyle, width: '90px' }} value={gridConfig.rowGroups[0]?.rows || 1} onChange={(e) => gridConfig.rowGroups[0] && updateRowGroup(gridConfig.rowGroups[0].id, 'rows', Number(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Seats per row</label>
                      <input type="number" style={{ ...inputStyle, width: '90px' }} value={gridConfig.rowGroups[0]?.columns || 1} onChange={(e) => gridConfig.rowGroups[0] && updateRowGroup(gridConfig.rowGroups[0].id, 'columns', Number(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Zone name</label>
                      <input style={{ ...inputStyle, width: '160px' }} value={gridConfig.rowGroups[0]?.zoneName || ''} placeholder="e.g. General" onChange={(e) => gridConfig.rowGroups[0] && updateRowGroupZone(gridConfig.rowGroups[0].id, e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Suggested price (optional)</label>
                      <input
                        type="number"
                        style={{ ...inputStyle, width: '120px' }}
                        placeholder="₹"
                        value={zonePrices[gridConfig.rowGroups[0]?.zoneName || ''] || ''}
                        onChange={(e) => gridConfig.rowGroups[0] && setZonePrice(gridConfig.rowGroups[0].zoneName, e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {wizardMultiZone === true && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6, marginBottom: '8px' }}>Add a zone for each range of rows, front to back (e.g. rows 1-5 "Front" at 10 seats/row, rows 6-15 "Mid" at 14 seats/row).</div>
                    {gridConfig.rowGroups.map((rg, i) => (
                      <div key={rg.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', opacity: 0.6, minWidth: '50px' }}>Zone {i + 1}:</span>
                        <label style={{ fontSize: '12px' }}>Rows:</label>
                        <input type="number" style={{ ...inputStyle, width: '55px' }} value={rg.rows} onChange={(e) => updateRowGroup(rg.id, 'rows', Number(e.target.value) || 1)} />
                        <label style={{ fontSize: '12px' }}>Seats:</label>
                        <input type="number" style={{ ...inputStyle, width: '55px' }} value={rg.columns} onChange={(e) => updateRowGroup(rg.id, 'columns', Number(e.target.value) || 1)} />
                        <label style={{ fontSize: '12px' }}>Name:</label>
                        <input style={{ ...inputStyle, width: '120px' }} value={rg.zoneName} placeholder={`Zone ${i + 1}`} onChange={(e) => updateRowGroupZone(rg.id, e.target.value)} />
                        <label style={{ fontSize: '12px' }}>Price:</label>
                        <input type="number" style={{ ...inputStyle, width: '80px' }} placeholder="₹ optional" value={zonePrices[rg.zoneName] || ''} onChange={(e) => setZonePrice(rg.zoneName, e.target.value)} />
                        {gridConfig.rowGroups.length > 1 && <button onClick={() => removeRowGroup(rg.id)} style={{ border: 'none', background: 'none', color: '#B3261E', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                      </div>
                    ))}
                    <button onClick={addRowGroup} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                      + Add another zone
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button
                    onClick={wizardNext}
                    disabled={wizardMultiZone === null || gridConfig.rowGroups.some((rg) => !rg.zoneName.trim())}
                    style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (wizardMultiZone === null || gridConfig.rowGroups.some((rg) => !rg.zoneName.trim())) ? 0.5 : 1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Any walkway splitting the rows, like left/right?</h3>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6, marginBottom: '12px' }}>
                  This is just a walking gap — it doesn't change pricing. Pricing already comes from the zone(s) you set up on the previous step. This sets the same walkway for every zone to start; if different zones need different splits, fine-tune each one separately afterward in the advanced Generate Grid panel.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setWizardVerticalAisle(false)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasVerticalAisle === false ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasVerticalAisle === false ? '#0E0C0A' : '#fff', color: wizardHasVerticalAisle === false ? '#fff' : '#0E0C0A' }}>
                    No, one solid block
                  </button>
                  <button onClick={() => setWizardVerticalAisle(true)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasVerticalAisle === true ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasVerticalAisle === true ? '#0E0C0A' : '#fff', color: wizardHasVerticalAisle === true ? '#fff' : '#0E0C0A' }}>
                    Yes, a center walkway
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.55, marginBottom: '16px' }}>
                  Need more than one walkway, or a different split per zone? Finish here, then use the advanced Generate Grid panel afterward — it supports any number, independently per zone.
                </p>

                {wizardHasVerticalAisle === true && (
                  <>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>How wide should the walkway be?</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      {[{ label: 'Narrow', px: 40 }, { label: 'Standard', px: 60 }, { label: 'Wide', px: 90 }].map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.map((rg) => ({ ...rg, verticalAisles: rg.verticalAisles.map((a, i) => (i === 0 ? { ...a, gapPx: opt.px } : a)) })) }))}
                          style={{ padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: gridConfig.rowGroups[0]?.verticalAisles[0]?.gapPx === opt.px ? 'none' : '1px solid rgba(14,12,10,0.2)', background: gridConfig.rowGroups[0]?.verticalAisles[0]?.gapPx === opt.px ? '#0E0C0A' : '#fff', color: gridConfig.rowGroups[0]?.verticalAisles[0]?.gapPx === opt.px ? '#fff' : '#0E0C0A' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} disabled={wizardHasVerticalAisle === null} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: wizardHasVerticalAisle === null ? 0.5 : 1 }}>Next</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>How should rows of different widths line up?</h3>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6, marginBottom: '12px' }}>
                  Only matters if your zones have different seats-per-row (tapering rows). Referenced to the stage, not the audience.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  {(['left', 'center', 'right'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setGridConfig((g) => ({ ...g, rowAlignment: opt }))}
                      style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', border: gridConfig.rowAlignment === opt ? 'none' : '1px solid rgba(14,12,10,0.2)', background: gridConfig.rowAlignment === opt ? '#0E0C0A' : '#fff', color: gridConfig.rowAlignment === opt ? '#fff' : '#0E0C0A' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.55, marginBottom: '16px' }}>
                  {gridConfig.rowAlignment === 'center' && 'Narrower rows are inset equally on both sides — every zone shares one central aisle, like a real fan-style hall.'}
                  {gridConfig.rowAlignment === 'left' && 'Every row starts at the stage-left edge — wider rows only grow toward stage-right. Use this if stage-left is against a wall.'}
                  {gridConfig.rowAlignment === 'right' && 'Every row ends at the stage-right edge — wider rows only grow toward stage-left.'}
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Next</button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Any gangways between rows (front-to-back walkways)?</h3>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6, marginBottom: '12px' }}>
                  e.g. a walking gap after row 10, so rows 11+ have extra space in front of them. You can add more than one - answering Yes adds a row-number field below for each gangway.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setWizardAisle(true)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasAisle === true ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasAisle === true ? '#0E0C0A' : '#fff', color: wizardHasAisle === true ? '#fff' : '#0E0C0A' }}>Yes</button>
                  <button onClick={() => setWizardAisle(false)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasAisle === false ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasAisle === false ? '#0E0C0A' : '#fff', color: wizardHasAisle === false ? '#fff' : '#0E0C0A' }}>No</button>
                </div>

                {wizardHasAisle === true && (
                  <div style={{ marginBottom: '16px' }}>
                    {gridConfig.aisles.map((a, i) => (
                      <div key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.6, minWidth: '70px' }}>Gangway {i + 1}:</span>
                        <label style={{ fontSize: '13px', fontWeight: 600 }}>After row #</label>
                        <input type="number" style={{ ...inputStyle, width: '70px' }} value={a.afterRow} onChange={(e) => updateAisle(a.id, 'afterRow', Number(e.target.value) || 0)} />
                        {gridConfig.aisles.length > 1 && <button onClick={() => removeAisle(a.id)} style={{ border: 'none', background: 'none', color: '#B3261E', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                      </div>
                    ))}
                    <button onClick={addAisle} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                      + Add another gangway
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} disabled={wizardHasAisle === null} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: wizardHasAisle === null ? 0.5 : 1 }}>Next: Preview</button>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Preview</h3>
                <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.7, marginBottom: '12px' }}>
                  This is exactly what your audience will see. {wizardPreviewSeats.length} seats across {gridConfig.rowGroups.reduce((s, r) => s + r.rows, 0)} rows.
                </p>
                <div
                  style={{
                    maxWidth: '100%', maxHeight: '420px', overflow: 'auto', display: 'flex', justifyContent: 'center',
                    background: '#FBF8F3', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '10px', marginBottom: '16px', padding: '10px 0',
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0, width: `${previewBounds(wizardPreviewSeats).width}px`, height: `${previewBounds(wizardPreviewSeats).height}px` }}>
                    <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '60%', padding: '8px 0', textAlign: 'center', borderRadius: '6px', background: '#0E0C0A', color: '#fff', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Stage
                    </div>
                    {wizardPreviewSeats.map((s, i) => (
                      <div key={i} style={{ position: 'absolute', left: s.x - SEAT_SIZE / 2, top: s.y - SEAT_SIZE / 2, width: `${SEAT_SIZE}px`, height: `${SEAT_SIZE}px`, borderRadius: '5px', background: colorForTier(s.tierLabel, Array.from(new Set(wizardPreviewSeats.map((p) => p.tierLabel)))), opacity: 0.85, color: '#fff', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s.row}{s.number}
                      </div>
                    ))}
                  </div>
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

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                <button
                  onClick={() => setManualPlacement((v) => !v)}
                  title={manualPlacement ? 'Clicking the canvas places a new seat - click to turn off' : 'Canvas clicks are safe (no new seats) - click to enable manual placement'}
                  style={{
                    padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    border: manualPlacement ? 'none' : '1px solid rgba(14,12,10,0.2)',
                    background: manualPlacement ? '#0E0C0A' : '#fff',
                    color: manualPlacement ? '#fff' : '#0E0C0A',
                  }}
                >
                  {manualPlacement ? '✓ Manual placement ON' : 'Manual placement OFF'}
                </button>
              </div>
              <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginTop: '-6px', marginBottom: '12px' }}>
                {manualPlacement
                  ? 'Clicking the canvas adds a new seat. Turn this off to safely scroll/inspect without accidentally placing seats.'
                  : 'Canvas clicks are safe right now - nothing gets added. Turn manual placement on to hand-place extra seats.'}
              </p>

              {showGenerator && (
                <div style={{ marginBottom: '16px', padding: '18px', borderRadius: '10px', background: '#FBF8F3', border: '1px solid rgba(14,12,10,0.1)' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Side margin (px):</label>
                    <input type="number" style={{ ...inputStyle, width: '70px' }} value={gridConfig.sideMarginPx} onChange={(e) => setGridConfig((g) => ({ ...g, sideMarginPx: Math.max(0, Number(e.target.value) || 0) }))} />
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Seat spacing X/Y (px):</label>
                    <input type="number" style={{ ...inputStyle, width: '60px' }} value={gridConfig.seatSpacingX} onChange={(e) => setGridConfig((g) => ({ ...g, seatSpacingX: Math.max(10, Number(e.target.value) || 10) }))} />
                    <input type="number" style={{ ...inputStyle, width: '60px' }} value={gridConfig.seatSpacingY} onChange={(e) => setGridConfig((g) => ({ ...g, seatSpacingY: Math.max(10, Number(e.target.value) || 10) }))} />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>
                      Row alignment (only matters when rows taper to different widths):
                    </label>
                    {(['left', 'center', 'right'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setGridConfig((g) => ({ ...g, rowAlignment: opt }))}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                          border: gridConfig.rowAlignment === opt ? 'none' : '1px solid rgba(14,12,10,0.15)',
                          background: gridConfig.rowAlignment === opt ? '#0E0C0A' : '#fff',
                          color: gridConfig.rowAlignment === opt ? '#fff' : '#0E0C0A',
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.55, marginTop: '-10px', marginBottom: '14px' }}>
                    {gridConfig.rowAlignment === 'center' && 'Narrower rows are inset equally on both sides, so every row shares one central aisle — the shape of a real fan-style hall.'}
                    {gridConfig.rowAlignment === 'left' && 'Every row starts at the same left edge — wider rows only grow to the right. Use this if one side of your venue is against a wall.'}
                    {gridConfig.rowAlignment === 'right' && 'Every row ends at the same right edge — wider rows only grow to the left.'}
                  </p>

                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Zones / row groups (rows can taper — different column counts per range, counted across the whole row)</div>
                  {gridConfig.rowGroups.map((rg, i) => (
                    <div key={rg.id} style={{ border: '1px solid rgba(14,12,10,0.12)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', opacity: 0.6, minWidth: '55px' }}>Zone {i + 1}:</span>
                        <label style={{ fontSize: '12px' }}>Rows:</label>
                        <input type="number" style={{ ...inputStyle, width: '55px' }} value={rg.rows} onChange={(e) => updateRowGroup(rg.id, 'rows', Number(e.target.value) || 1)} />
                        <label style={{ fontSize: '12px' }}>Columns:</label>
                        <input type="number" style={{ ...inputStyle, width: '55px' }} value={rg.columns} onChange={(e) => updateRowGroup(rg.id, 'columns', Number(e.target.value) || 1)} />
                        <label style={{ fontSize: '12px' }}>Name:</label>
                        <input style={{ ...inputStyle, width: '120px' }} value={rg.zoneName} onChange={(e) => updateRowGroupZone(rg.id, e.target.value)} />
                        <label style={{ fontSize: '12px' }}>Price:</label>
                        <input type="number" style={{ ...inputStyle, width: '80px' }} placeholder="₹ optional" value={zonePrices[rg.zoneName] || ''} onChange={(e) => setZonePrice(rg.zoneName, e.target.value)} />
                        {gridConfig.rowGroups.length > 1 && <button onClick={() => removeRowGroup(rg.id)} style={{ border: 'none', background: 'none', color: '#B3261E', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#0E0C0A', opacity: 0.55, marginBottom: '4px' }}>
                        Vertical aisles for this zone only (different zones can have different splits) - add as many as you need; 0% = walkway before seat 1 (against the wall), 100% = walkway after the last seat
                      </div>
                      {rg.verticalAisles.map((a) => (
                        <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '12px' }}>Position (% from left):</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            style={{ ...inputStyle, width: '55px' }}
                            value={Math.round(a.afterFraction * 100)}
                            onChange={(e) => updateVerticalAisleInGroup(rg.id, a.id, 'afterFraction', (Number(e.target.value) || 0) / 100)}
                          />
                          <label style={{ fontSize: '12px' }}>Gap (px):</label>
                          <input type="number" style={{ ...inputStyle, width: '55px' }} value={a.gapPx} onChange={(e) => updateVerticalAisleInGroup(rg.id, a.id, 'gapPx', Number(e.target.value) || 0)} />
                          <button onClick={() => removeVerticalAisleFromGroup(rg.id, a.id)} style={{ border: 'none', background: 'none', color: '#B3261E', cursor: 'pointer', fontSize: '16px' }}>×</button>
                        </div>
                      ))}
                      <button onClick={() => addVerticalAisleToGroup(rg.id)} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', marginTop: '2px' }}>
                        + Add vertical aisle to this zone
                      </button>
                    </div>
                  ))}
                  <button onClick={addRowGroup} style={{ fontSize: '12px', fontWeight: 600, color: '#0E0C0A', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px' }}>
                    + Add row group / zone
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

              {canvasBounds.overflowsDefault && (
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6, marginBottom: '8px' }}>
                  This layout is larger than the default view — scroll inside the box below to see and place seats across the whole thing.
                </p>
              )}

              <div style={{ maxWidth: '100%', maxHeight: '70vh', overflow: 'auto', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '10px' }}>
                <div
                  ref={canvasRef}
                  onClick={placeSeat}
                  style={{
                    position: 'relative',
                    width: `${canvasBounds.width}px`,
                    height: `${canvasBounds.height}px`,
                    background: '#FBF8F3',
                    cursor: manualPlacement ? 'crosshair' : 'default',
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
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E0C0A', opacity: 0.35, fontSize: '14px', textAlign: 'center', padding: '0 20px' }}>
                      {manualPlacement ? 'Click anywhere to place your first seat' : 'Turn on Manual placement above to click and place seats'}
                    </div>
                  )}
                </div>
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

        {!(seatingMode === 'NUMBERED' && effectivePath === 'wizard') && (
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
        )}
      </div>
    </>
  )
}
