'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, use } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import { normalizeWhitespace, normalizeForCompare } from '@/lib/text'

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

// §9.4 seat-map cluster item #6 (session 48/49) - safety/reference markers.
// Same local-draft/clientId pattern as SeatDraft - nothing hits the network
// until Save. STAGE_DISTANCE_REF's distanceMeters is manually entered, not
// measured - no real-world scale calibration exists for this canvas.
type MarkerType = 'GATE' | 'FIRE_EXTINGUISHER' | 'STAGE_DISTANCE_REF'
type MarkerDraft = {
  clientId: string
  type: MarkerType
  x: number
  y: number
  label: string
  distanceMeters: number | null
}
const MARKER_META: Record<MarkerType, { glyph: string; color: string; name: string }> = {
  GATE: { glyph: 'G', color: 'var(--afa-blue-dark)', name: 'Gate' },
  FIRE_EXTINGUISHER: { glyph: 'F', color: 'var(--afa-error, #b3261e)', name: 'Fire Extinguisher' },
  STAGE_DISTANCE_REF: { glyph: 'S', color: 'var(--afa-text-primary)', name: 'Stage-Distance Reference' },
}

// Local-draft persistence (autosave) - a manual-canvas layout previously
// lived only in React state, so an accidental scroll-triggered refresh
// (or an away-tab losing state) wiped every placed seat with no way
// back. Mirrors it into localStorage on every change; offered back on
// next load rather than silently overwriting the server-loaded layout,
// since the two could legitimately differ (e.g. someone else edited the
// venue meanwhile, or the local draft is just stale).
type SeatMapDraft = {
  savedAt: number
  seatingMode: 'GENERAL_ADMISSION' | 'NUMBERED'
  levels: string[]
  activeLevel: string
  seatsByLevel: Record<string, SeatDraft[]>
  gridConfigByLevel: Record<string, GridConfig>
  zonePricesByLevel: Record<string, Record<string, string>>
  builderPathByLevel: Record<string, 'choose' | 'wizard' | 'canvas' | null>
  markersByLevel: Record<string, MarkerDraft[]>
}
const draftKey = (venueId: string) => `afa-seatmap-draft:${venueId}`

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

// design.md \u00a79.5 "Zone naming defaults" - settled 25 Jul session 30 but
// only the first 2 slots (Front/Back) were ever actually wired in; a 3rd+
// zone always fell straight to generic "Zone N". Real cycle per the
// decision: Front -> Middle -> Back -> Recliner, then "Zone 5", "Zone 6"...
const ZONE_NAME_CYCLE = ['Front', 'Middle', 'Back', 'Recliner']
function defaultZoneName(zeroBasedIndex: number): string {
  return ZONE_NAME_CYCLE[zeroBasedIndex] ?? `Section ${zeroBasedIndex + 1}`
}

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
      // Collapse internal whitespace here - this is the single point
      // where a row-group's zoneName becomes a seat's persisted
      // tierLabel, so it's the last chance to stop "General    2"
      // (extra internal spaces) from being saved as a real, distinct
      // zone identity.
      zoneForRow.push(normalizeWhitespace(g.zoneName) || 'General')
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
  background: 'var(--afa-surface-raised)',
  fontSize: '13px',
  color: 'var(--afa-text-primary)',
}

// Terracotta deliberately excluded - reserved app-wide for "selected /
// primary action" (see SeatLayoutPreview.tsx TIER_COLORS for why).
const TIER_COLORS = ['var(--afa-sage)', 'var(--afa-blue-dark)', 'var(--afa-gold)', 'var(--afa-plum)', 'var(--afa-brown-dark)', 'var(--afa-ink)']

function colorForTier(tierLabel: string, tierOrder: string[]) {
  const idx = tierOrder.indexOf(tierLabel)
  return TIER_COLORS[idx % TIER_COLORS.length] || 'var(--afa-ink)'
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
// Reconstructs a display-only RowGroup summary from already-saved seats
// (added 27 Jul, fixes the "whole zone data gone" bug: reopening Edit
// Venue -> Seat Map Builder previously left gridConfigByLevel empty for
// every level, so the Zone/price fields silently fell back to
// defaultGridConfig()'s single hardcoded "General" zone - completely
// disconnected from the real saved zones and prices, even though the
// actual seats and zonePrices themselves loaded correctly underneath).
// Rows/columns here are a best-effort approximation (distinct row
// letters, max seats seen in any one row for that zone) since the
// original generator "recipe" - aisle positions, alignment, tapering -
// is never stored on individual seats, only the resulting seat rows
// are. Good enough to show the true zone names and let their real
// prices resolve correctly via the existing zonePrices[zoneName]
// lookup - NOT a promise that clicking Generate again reproduces the
// exact original layout down to the pixel.
function deriveRowGroupsFromSeats(seats: SeatDraft[]): RowGroup[] {
  const byZone = new Map<string, SeatDraft[]>()
  for (const s of seats) {
    if (!byZone.has(s.tierLabel)) byZone.set(s.tierLabel, [])
    byZone.get(s.tierLabel)!.push(s)
  }
  return Array.from(byZone.entries()).map(([zoneName, zoneSeats]) => {
    const rowLetters = new Set(zoneSeats.map((s) => s.row))
    const perRowCounts = new Map<string, number>()
    for (const s of zoneSeats) perRowCounts.set(s.row, (perRowCounts.get(s.row) || 0) + 1)
    const columns = Math.max(1, ...Array.from(perRowCounts.values()))
    return {
      id: makeClientId(),
      rows: Math.max(1, rowLetters.size),
      columns,
      zoneName,
      verticalAisles: [],
    }
  })
}

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

// Zone-name uniqueness (added 27 Jul, Hitesh's rule): a zone name may
// never repeat within the same level - two same-named zones on one
// level would be genuinely indistinguishable to an audience member
// booking a seat, and since Generate flattens row-groups into plain
// Seat.tierLabel strings, a same-level collision becomes invisible
// (silently merged) the moment seats are generated - so this must be
// caught HERE, before generation, not after. The same name CAN repeat
// across different levels (e.g. "General" on both Ground and Balcony),
// but only with explicit consent at Save time (see save()) - it's easy
// to type the same word out of habit without meaning to link two
// unrelated levels' pricing together.
function findDuplicateZoneNames(rowGroups: RowGroup[]): string[] {
  const seen = new Map<string, number>()
  for (const rg of rowGroups) {
    // normalizeForCompare (not bare trim+lowercase) - "General 2" vs
    // "General    2" trim to two different strings otherwise, and both
    // pass as "unique." Same class of bug found live on the GA path
    // (SeatSectionEditor) and fixed here for consistency.
    const key = normalizeForCompare(rg.zoneName)
    if (!key) continue
    seen.set(key, (seen.get(key) || 0) + 1)
  }
  return Array.from(seen.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
}

// §9.2 (26 Jul) - every numeric input in this builder (side margin, seat
// spacing, rows, columns, gangway position, vertical-aisle gap) bound its
// value directly to a number in gridConfig - clearing the field to type a
// new value immediately re-rendered the old number (React has no concept
// of "temporarily empty" for a controlled numeric value), forcing the
// reported overtype-then-delete workaround (typing 3050 then deleting
// the 3 to get from 30 to 50). Fix: buffer the field's own display text
// locally so it can genuinely go blank while typing; only the last valid
// number is ever committed up to gridConfig, and the real min/max bound
// is enforced on blur, not on every keystroke (which would otherwise
// re-introduce the same snapping the moment a value dips below the
// minimum mid-type, e.g. typing "5" before "50" on a min-10 field).
function ClampedNumberInput({
  value, onCommit, min, max, style, placeholder,
}: {
  value: number
  onCommit: (n: number) => void
  min?: number
  max?: number
  style?: React.CSSProperties
  placeholder?: string
}) {
  const [raw, setRaw] = useState(String(value))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setRaw(String(value))
  }, [value])

  const clamp = (n: number) => {
    let c = n
    if (min !== undefined) c = Math.max(min, c)
    if (max !== undefined) c = Math.min(max, c)
    return c
  }

  return (
    <input
      type="number"
      style={style}
      placeholder={placeholder}
      value={raw}
      onFocus={() => { focusedRef.current = true }}
      onChange={(e) => {
        const v = e.target.value
        setRaw(v)
        if (v === '' || v === '-') return
        const n = Number(v)
        if (!Number.isFinite(n)) return
        onCommit(n)
      }}
      onBlur={() => {
        focusedRef.current = false
        const n = Number(raw)
        const finalValue = raw === '' || !Number.isFinite(n) ? value : clamp(n)
        onCommit(finalValue)
        setRaw(String(finalValue))
      }}
    />
  )
}

// Free toggle (Hitesh, 28 Jul): the inline FREE badge floating inside
// the price textbox looked cluttered on live click-test. Replaced with
// an explicit checkbox that sits beside the field rather than inside
// it - matches SeatSectionEditor.tsx's GA-side fix, same rationale.
// Kept as a small standalone component here since this file has 3
// separate zone-price input sites (wizard single-zone, wizard
// multi-zone, manual canvas) that all need it.
function FreeToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--afa-text-primary)', opacity: 0.75, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ margin: 0 }} />
      Free
    </label>
  )
}

export default function SeatMapBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Seat-map cluster #3 (design.md §9.4, decided 31 Jul session 48) -
  // Manual Canvas is a precision drag/place tool that doesn't translate
  // to touch at this granularity (dragging in particular only ever had
  // mouse listeners - touchmove/touchend were never wired up, so it was
  // already silently broken on phones, not just cramped). Rather than
  // chase full touch parity, the canvas becomes view-only + scrollable/
  // pinch-zoomable below the breakpoint; actual placement stays desktop/
  // tablet. 768px matches the existing mobile-nav breakpoint elsewhere
  // in the app for consistency.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const [seatingMode, setSeatingMode] = useState<'GENERAL_ADMISSION' | 'NUMBERED'>('GENERAL_ADMISSION')

  // §9.4 Freeze + method persistence (session 48) - explicit "this map
  // is finalized" state, venue-wide. While frozen: Save, Add/Remove
  // level, Quick Layout/Generate, the wizard, and canvas placement/drag
  // are all disabled - same read-only treatment as the mobile view-only
  // mode (#3) for visual consistency, distinct banner copy.
  const [seatMapFrozen, setSeatMapFrozen] = useState(false)
  const [freezing, setFreezing] = useState(false)
  const toggleFreeze = async (next: boolean) => {
    if (next && !window.confirm(
      'Freeze this seat map? It becomes read-only everywhere in this builder until you Unfreeze it.\n\nThis does not affect any live event or booking - it just locks further edits here.'
    )) return
    if (!next && !window.confirm('Unfreeze this seat map so it can be edited again?')) return
    setFreezing(true)
    try {
      const res = await fetch(`/api/venues/${id}/seats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frozen: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update freeze state')
      setSeatMapFrozen(next)
      showToast(next ? 'Seat map frozen.' : 'Seat map unfrozen - you can edit it again.', 'success')
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setFreezing(false)
    }
  }

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

  // §9.4 seat-map cluster item #6 - safety/reference markers, same
  // per-level scoping as seats above.
  const [markersByLevel, setMarkersByLevel] = useState<Record<string, MarkerDraft[]>>({})
  const markers = markersByLevel[activeLevel] || []
  const setMarkers = (updater: (prev: MarkerDraft[]) => MarkerDraft[]) =>
    setMarkersByLevel((prev) => ({ ...prev, [activeLevel]: updater(prev[activeLevel] || []) }))

  // §9.4 seat-map cluster item #5 - PDF/image reference underlay, one per
  // level. Server-authoritative (not part of the local-draft/Save-button
  // model above) - upload/opacity-change/delete each hit the network
  // directly via /api/venues/[id]/underlay, since it's a real file, not
  // small JSON state worth batching into the seats PUT payload.
  type UnderlayState = { imageUrl: string; opacity: number } | null
  const [underlaysByLevel, setUnderlaysByLevel] = useState<Record<string, UnderlayState>>({})
  const underlay = underlaysByLevel[activeLevel] || null
  const [underlayUploading, setUnderlayUploading] = useState(false)

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
  // Rule (Hitesh, 27 Jul): Numbered zones now allow ₹0 as a valid,
  // explicit "Free" price (previously any zone <= 0 hard-blocked Save -
  // see the missingPricing check below). Distinct from a genuinely
  // blank/never-entered price, which still blocks Save - only an
  // explicit "0" counts as Free, so the FREE tag can't appear on a zone
  // the owner simply hasn't priced yet.
  const zoneIsFree = (zoneName: string) => {
    const raw = zonePrices[zoneName]
    return raw !== undefined && raw.trim() !== '' && Number(raw) === 0
  }
  // Sets/clears Free the same way SeatSectionEditor's setSectionFree
  // does: checking writes an explicit '0' (the only thing zoneIsFree
  // treats as Free), unchecking clears back to '' so a stale 0 can't
  // linger unnoticed - owner must explicitly re-enter a real price.
  const setZoneFree = (zoneName: string, free: boolean) => setZonePrice(zoneName, free ? '0' : '')

  const [builderPathByLevel, setBuilderPathByLevel] = useState<Record<string, 'choose' | 'wizard' | 'canvas' | null>>({})
  const builderPath = builderPathByLevel[activeLevel] ?? null
  const setBuilderPath = (path: 'choose' | 'wizard' | 'canvas' | null) =>
    setBuilderPathByLevel((prev) => ({ ...prev, [activeLevel]: path }))

  const addLevel = () => {
    if (seatMapFrozen) return
    const name = window.prompt('Name this level (e.g. "Ground Floor", "Balcony", "1st Floor")')
    if (name === null) return
    const trimmed = normalizeWhitespace(name).slice(0, 60)
    if (!trimmed) { showToast('Level name cannot be empty.', 'error'); return }
    if (levels.includes(trimmed)) { showToast('A level with that name already exists.', 'error'); return }
    setLevels((prev) => [...prev, trimmed])
    setActiveLevel(trimmed)
  }
  const removeLevel = (name: string) => {
    if (levels.length <= 1 || seatMapFrozen) return
    if (!window.confirm(`Remove level "${levelLabel(name)}"? This clears its local layout - nothing is deleted server-side until you Save.`)) return
    setLevels((prev) => prev.filter((l) => l !== name))
    setSeatsByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
    setGridConfigByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
    setBuilderPathByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
    setZonePricesByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
    setMarkersByLevel((prev) => { const next = { ...prev }; delete next[name]; return next })
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
  // §9.4 cluster item #6 - which marker type is "armed" for the next
  // canvas click (null = off, canvas click places a seat as before).
  // Separate from manualPlacement/activeTier - placing a marker doesn't
  // need a section name and shouldn't consume the seat auto-increment.
  const [markerMode, setMarkerMode] = useState<MarkerType | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
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

  const startWizard = () => { if (seatMapFrozen) return; setBuilderPath('wizard'); setWizardStep(0); setWizardShape(null); setWizardMultiZone(null); setWizardHasVerticalAisle(null); setWizardHasAisle(null) }
  const startDrawMyself = () => { if (seatMapFrozen) return; setBuilderPath('canvas'); setManualPlacement(true) }
  // §9.4 (session 48) - "Back to setup options" used to be reachable
  // with zero warning even when this level already had real seats.
  // Guided Setup's Generate APPENDS seats on top of whatever exists
  // (see generateGrid below) rather than replacing - so re-running it
  // after Back doesn't delete anything, but it can silently create
  // overlapping duplicate seats. A confirm-gated switch is the
  // "separate deliberate action" Hitesh asked for. Empty levels have
  // nothing to lose, so no prompt needed there.
  const backToChoice = () => {
    if (seats.length > 0 && !window.confirm(
      `Go back and change the setup approach for ${levelLabel(activeLevel)}?\n\n` +
      `This level already has ${seats.length} seat${seats.length === 1 ? '' : 's'}. Existing seats won't be deleted, but generating a new layout adds seats on top of them and can create overlapping duplicates - review the canvas afterward if you continue.`
    )) return
    setBuilderPath('choose')
    setWizardStep(0)
  }
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
          g.rowGroups[0] || { id: makeClientId(), rows: 5, columns: 10, zoneName: defaultZoneName(0), verticalAisles: [] },
          { id: makeClientId(), rows: 5, columns: 10, zoneName: defaultZoneName(1), verticalAisles: [] },
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
    setGridConfig((g) => ({ ...g, rowGroups: [...g.rowGroups, { id: makeClientId(), rows: 5, columns: 10, zoneName: defaultZoneName(g.rowGroups.length), verticalAisles: [] }] }))
  const removeRowGroup = (id: string) => setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.filter((r) => r.id !== id) }))
  const updateRowGroup = (id: string, field: 'rows' | 'columns', value: number) =>
    setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.map((r) => (r.id === id ? { ...r, [field]: Math.max(1, value) } : r)) }))
  const updateRowGroupZone = (id: string, zoneName: string) => {
    const trimmed = zoneName.slice(0, 60)
    const rg = gridConfig.rowGroups.find((r) => r.id === id)
    const oldName = rg?.zoneName ?? ''
    // Live-caught 28 Jul (Hitesh): renamed a zone's Name field to match
    // another zone's name AFTER Generate Seats had already run, and
    // Save went through with no warning - "Section name same still
    // saving." Root cause: this field only ever updated gridConfig (a
    // "next generation" setting) - already-placed seats keep whatever
    // tierLabel they were generated with forever, and Save's duplicate
    // check only covered row/number collisions, never zone names. So
    // the form could show two zones with the identical name while the
    // real per-seat data quietly stayed different (or, going forward,
    // genuinely collide) with nothing catching either case.
    // Fix: block the rename outright if it would collide with a
    // DIFFERENT zone's name already in use by seats already placed on
    // this level (same rule every other duplicate-name check in this
    // app already enforces) - and otherwise propagate a valid rename
    // onto those placed seats and their saved suggested price, so the
    // form and the real data can no longer drift apart.
    const otherZoneNames = new Set(seats.filter((s) => s.tierLabel !== oldName).map((s) => s.tierLabel))
    if (trimmed && otherZoneNames.has(trimmed)) {
      showToast(`"${trimmed}" is already used by another section on ${levelLabel(activeLevel)} - each section needs a unique name.`, 'error')
      return
    }
    setGridConfig((g) => ({ ...g, rowGroups: g.rowGroups.map((r) => (r.id === id ? { ...r, zoneName: trimmed } : r)) }))
    if (oldName && oldName !== trimmed) {
      setSeats((prev) => prev.map((s) => (s.tierLabel === oldName ? { ...s, tierLabel: trimmed } : s)))
      setZonePricesByLevel((prev) => {
        const levelPrices = { ...(prev[activeLevel] || {}) }
        if (oldName in levelPrices) {
          levelPrices[trimmed] = levelPrices[oldName]
          delete levelPrices[oldName]
        }
        return { ...prev, [activeLevel]: levelPrices }
      })
    }
  }

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
    if (seatMapFrozen) return
    const totalRows = gridConfig.rowGroups.reduce((s, r) => s + r.rows, 0)
    if (totalRows === 0) {
      showToast('Add at least one row group first.', 'error')
      return
    }
    const dupes = findDuplicateZoneNames(gridConfig.rowGroups)
    if (dupes.length > 0) {
      showToast(
        `Section name${dupes.length === 1 ? '' : 's'} "${dupes.join('", "')}" ${dupes.length === 1 ? 'is' : 'are'} used more than once on ${levelLabel(activeLevel)}. Each section on the same level needs a unique name - rename one before generating.`,
        'error'
      )
      return
    }
    const generated = computeGridSeats(gridConfig, 40, STAGE_CLEARANCE_Y)
    // Live-caught (28 Jul, Hitesh screenshot): re-running Generate Grid
    // used to blindly APPEND onto whatever was already on the canvas.
    // Row letters always restart from 'A' based on the row-group config
    // alone, not on how many seats already exist - so re-generating
    // (e.g. after tweaking a setting, without hitting Reset Layout
    // first) silently produced an exact duplicate of every seat, only
    // caught much later at Save with an unhelpful "Duplicate seat
    // label: Row A, Seat 1" toast and no clue what caused it. Catch the
    // real collision here instead, at the point it's actually created,
    // with a message that points at the fix (Reset Layout).
    const existingKeys = new Set(seats.map((s) => `${s.row}::${s.number}`))
    const collides = generated.some((s) => existingKeys.has(`${s.row}::${s.number}`))
    if (collides) {
      showToast(
        `This would duplicate seats already on ${levelLabel(activeLevel)}'s canvas (Generate Grid always starts at Row A - it doesn't know what's already placed). Click "Reset Layout" first, then Generate Grid again.`,
        'error'
      )
      return
    }
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
  // Gates the autosave effect below until the initial load (and any
  // restore-a-draft decision) has fully settled - otherwise autosave's
  // first run would fire against default/empty state and clobber a real
  // unrestored draft before the load effect even gets a chance to offer it.
  const hydratedRef = useRef(false)

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
        setSeatMapFrozen(Boolean(data.seatMapFrozen))

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

        const markersLoaded: Record<string, MarkerDraft[]> = {}
        for (const m of data.markers || []) {
          const lvl = m.level || ''
          if (!markersLoaded[lvl]) markersLoaded[lvl] = []
          markersLoaded[lvl].push({
            clientId: makeClientId(),
            type: m.type,
            x: m.x,
            y: m.y,
            label: m.label || '',
            distanceMeters: m.distanceMeters ?? null,
          })
        }
        setMarkersByLevel(markersLoaded)

        const underlaysLoaded: Record<string, { imageUrl: string; opacity: number }> = {}
        for (const u of data.underlays || []) {
          underlaysLoaded[u.level || ''] = { imageUrl: u.imageUrl, opacity: u.opacity }
        }
        setUnderlaysByLevel(underlaysLoaded)

        const priceByLevel: Record<string, Record<string, string>> = {}
        for (const z of data.zonePrices || []) {
          const lvl = z.level || ''
          if (!priceByLevel[lvl]) priceByLevel[lvl] = {}
          priceByLevel[lvl][z.zoneName] = z.suggestedPrice != null ? String(z.suggestedPrice) : ''
        }
        setZonePricesByLevel(priceByLevel)

        // Fixes "whole zone data gone" on reopening the builder - without
        // this, gridConfigByLevel stayed {} for every level, so the Zone
        // name/price fields fell back to defaultGridConfig()'s single
        // fake "General" row-group instead of reflecting what's really
        // saved. See deriveRowGroupsFromSeats() for what this can and
        // can't reconstruct.
        const gridByLevel: Record<string, GridConfig> = {}
        for (const lvl of foundLevels) {
          gridByLevel[lvl] = { ...defaultGridConfig(), rowGroups: deriveRowGroupsFromSeats(byLevel[lvl]) }
        }
        setGridConfigByLevel(gridByLevel)

        // Offer back a local draft rather than silently applying or
        // silently discarding it - the two could legitimately differ
        // (someone else edited the venue meanwhile, or the draft is
        // just stale from an earlier abandoned session).
        //
        // Deferred via setTimeout(0) - Feedback 78cb970a ("seat-map view
        // sometimes fails to render fully... resolves after... dismissing
        // the confirmation dialog"). window.confirm() is synchronous and
        // blocks the whole tab; firing it immediately after the several
        // setState calls above gave React no chance to commit/paint the
        // just-loaded seat data before the dialog froze everything, so
        // the canvas could still be showing its pre-load state underneath
        // when the dialog appeared. Deferring one tick lets the browser
        // paint the loaded seats first; the dialog then appears on top of
        // a fully-rendered canvas instead of a half-rendered one.
        setTimeout(() => {
          try {
            const raw = localStorage.getItem(draftKey(id))
            if (raw) {
              const draft: SeatMapDraft = JSON.parse(raw)
              const draftSeatCount = Object.values(draft.seatsByLevel || {}).reduce((n, arr) => n + arr.length, 0)
              if (draftSeatCount > 0) {
                const minsAgo = Math.max(0, Math.round((Date.now() - draft.savedAt) / 60000))
                const levelCount = Object.keys(draft.seatsByLevel).length
                const restore = window.confirm(
                  `Found an unsaved local draft from ${minsAgo < 1 ? 'less than a minute' : `${minsAgo} minute${minsAgo === 1 ? '' : 's'}`} ago ` +
                  `(${draftSeatCount} seat${draftSeatCount === 1 ? '' : 's'} across ${levelCount} level${levelCount === 1 ? '' : 's'}) - ` +
                  `likely from an accidental refresh. Restore it?\n\nCancel discards the draft and keeps what's saved on the server.`
                )
                if (restore) {
                  setSeatingMode(draft.seatingMode)
                  setLevels(draft.levels)
                  setActiveLevel(draft.activeLevel)
                  setSeatsByLevel(draft.seatsByLevel)
                  setGridConfigByLevel(draft.gridConfigByLevel)
                  setZonePricesByLevel(draft.zonePricesByLevel)
                  setBuilderPathByLevel(draft.builderPathByLevel)
                  setMarkersByLevel(draft.markersByLevel || {})
                } else {
                  localStorage.removeItem(draftKey(id))
                }
              } else {
                localStorage.removeItem(draftKey(id))
              }
            }
          } catch {
            // Corrupt/unparseable draft - drop it rather than throw.
            localStorage.removeItem(draftKey(id))
          }
        }, 0)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
        hydratedRef.current = true
      }
    }
    if (session?.user) fetchSeatMap()
    // Deliberately NOT depending on the `session` object itself: next-auth
    // hands back a new session reference on its own schedule (window-focus
    // revalidation, internal polling) unrelated to anything real changing.
    // Depending on `session` re-ran this fetch mid-edit and silently
    // overwrote unsaved local seats/zone prices - the P0 data-loss bug.
    // session.user.id only changes on an actual login/logout. (Cast to any:
    // this codebase's Session type has no next-auth.d.ts augmentation, so
    // `id` isn't in the default typed shape - same pattern as the existing
    // `(session?.user as any)?.role` cast elsewhere.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(session?.user as any)?.id, id])

  // Autosave - mirrors the in-progress layout into localStorage on every
  // change, so an accidental refresh/tab-close has something to offer
  // back on next load instead of wiping the canvas outright. Convenience
  // only, never the source of truth: Save (below) still requires an
  // explicit click, and a successful Save clears this draft since the
  // server is now the up-to-date copy.
  useEffect(() => {
    if (!hydratedRef.current) return
    try {
      const draft: SeatMapDraft = {
        savedAt: Date.now(),
        seatingMode,
        levels,
        activeLevel,
        seatsByLevel,
        gridConfigByLevel,
        zonePricesByLevel,
        builderPathByLevel,
        markersByLevel,
      }
      localStorage.setItem(draftKey(id), JSON.stringify(draft))
    } catch {
      // Storage full or unavailable (e.g. private browsing) - autosave
      // is a convenience, fail silently rather than interrupt editing.
    }
  }, [id, seatingMode, levels, activeLevel, seatsByLevel, gridConfigByLevel, zonePricesByLevel, builderPathByLevel, markersByLevel])

  const tierOrder = Array.from(new Set(seats.map((s) => s.tierLabel).concat(activeTier ? [activeTier] : [])))
  const canvasBounds = contentBounds([...seats, ...markers])

  const placeSeat = (e: React.MouseEvent<HTMLDivElement>) => {
    if (seatingMode !== 'NUMBERED') return
    if (isMobile) return // view-only on mobile - see isMobile note above
    if (seatMapFrozen) return // view-only while frozen - see toggleFreeze above
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
    // §9.2 (26 Jul) - manually resetting Row/Next# (e.g. back to B/1 to
    // patch in a missed seat) previously had no collision check against
    // seats already placed on this level, silently creating a duplicate
    // label - normal auto-incrementing during placement never hit this
    // since it always counts up past what exists. Row+number is the
    // physical seat label regardless of tier, so this checks across the
    // whole level's seats, same scope as the duplicate check at Save.
    if (seats.some((s) => s.row === nextRow && s.number === String(nextNumber))) {
      showToast(`Row ${nextRow}, Seat ${nextNumber} already exists on this level - change Row/Next# first.`, 'error')
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

  // §9.4 cluster item #6 - places a marker at the click point instead of
  // a seat when markerMode is armed. Deliberately no stage-clearance or
  // activeTier gate here (unlike placeSeat) - a gate/extinguisher marker
  // legitimately needs to sit right at the stage edge or anywhere else on
  // the floor, and doesn't carry a section/tier identity at all.
  const placeMarker = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!markerMode) return
    if (seatingMode !== 'NUMBERED') return
    if (isMobile || seatMapFrozen) return
    if (dragId) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)
    if (x < 0 || y < 0 || x > canvasBounds.width || y > canvasBounds.height) return
    const newMarker: MarkerDraft = {
      clientId: makeClientId(),
      type: markerMode,
      x,
      y,
      label: '',
      distanceMeters: null,
    }
    setMarkers((prev) => [...prev, newMarker])
    setSelectedId(null)
    setSelectedMarkerId(newMarker.clientId)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (markerMode) placeMarker(e)
    else placeSeat(e)
  }

  const startDrag = (e: React.MouseEvent, clientId: string) => {
    e.stopPropagation()
    setSelectedMarkerId(null)
    if (isMobile || seatMapFrozen) { setSelectedId(clientId); return } // view-only: allow selecting to inspect, but not dragging
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
    if (!selectedId || seatMapFrozen) return
    setSeats((prev) => prev.filter((s) => s.clientId !== selectedId))
    setSelectedId(null)
  }

  const updateSelected = (field: 'tierLabel' | 'row' | 'number', value: string) => {
    if (!selectedId || seatMapFrozen) return
    setSeats((prev) => prev.map((s) => (s.clientId === selectedId ? { ...s, [field]: value } : s)))
  }

  const selected = seats.find((s) => s.clientId === selectedId) || null

  const selectMarker = (clientId: string) => {
    setSelectedId(null)
    setSelectedMarkerId(clientId)
  }

  const deleteSelectedMarker = () => {
    if (!selectedMarkerId || seatMapFrozen) return
    setMarkers((prev) => prev.filter((m) => m.clientId !== selectedMarkerId))
    setSelectedMarkerId(null)
  }

  const updateSelectedMarker = (field: 'label' | 'distanceMeters', value: string) => {
    if (!selectedMarkerId || seatMapFrozen) return
    setMarkers((prev) =>
      prev.map((m) => {
        if (m.clientId !== selectedMarkerId) return m
        if (field === 'label') return { ...m, label: value.slice(0, 120) }
        // distanceMeters: allow clearing to null (empty field), clamp
        // non-negative otherwise. Free-typing (not committing on every
        // keystroke) matches the ClampedNumberInput lesson elsewhere in
        // this builder, but this single field doesn't justify pulling in
        // that shared component - clamp only rejects negative, doesn't
        // force a floor mid-type.
        const trimmed = value.trim()
        if (trimmed === '') return { ...m, distanceMeters: null }
        const n = parseFloat(trimmed)
        return { ...m, distanceMeters: Number.isFinite(n) && n >= 0 ? n : m.distanceMeters }
      })
    )
  }

  const selectedMarker = markers.find((m) => m.clientId === selectedMarkerId) || null

  // §9.4 cluster item #5 - underlay is server-authoritative (see the
  // UnderlayState comment above), so these hit the network immediately
  // rather than waiting for the main Save button.
  const uploadUnderlay = async (file: File) => {
    if (seatMapFrozen) { showToast('This seat map is frozen. Unfreeze it first to make changes.', 'error'); return }
    setUnderlayUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('level', activeLevel)
      const res = await fetch(`/api/venues/${id}/underlay`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setUnderlaysByLevel((prev) => ({ ...prev, [activeLevel]: { imageUrl: data.imageUrl, opacity: data.opacity } }))
      showToast('Reference image uploaded.', 'success')
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setUnderlayUploading(false)
    }
  }

  const updateUnderlayOpacity = async (opacity: number) => {
    if (seatMapFrozen || !underlay) return
    // Optimistic - a slider that visibly lags every drag tick would feel
    // broken; a failed PATCH is rare and non-destructive to revert from.
    setUnderlaysByLevel((prev) => ({ ...prev, [activeLevel]: { ...prev[activeLevel]!, opacity } }))
    try {
      const res = await fetch(`/api/venues/${id}/underlay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: activeLevel, opacity }),
      })
      if (!res.ok) throw new Error('Failed to update opacity')
    } catch {
      // Silent - a stale opacity value isn't worth interrupting the
      // owner's flow over; it'll resync correctly on next page load.
    }
  }

  const removeUnderlay = async () => {
    if (seatMapFrozen || !underlay) return
    if (!window.confirm(`Remove the reference image for ${levelLabel(activeLevel)}?`)) return
    try {
      const res = await fetch(`/api/venues/${id}/underlay?level=${encodeURIComponent(activeLevel)}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to remove') }
      setUnderlaysByLevel((prev) => { const next = { ...prev }; delete next[activeLevel]; return next })
    } catch (err: any) {
      showToast(err.message, 'error')
    }
  }

  const save = async () => {
    if (seatMapFrozen) { showToast('This seat map is frozen. Unfreeze it first to save changes.', 'error'); return }
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
    const allMarkers = Object.entries(markersByLevel).flatMap(([level, lvlMarkers]) =>
      lvlMarkers.map((m) => ({ type: m.type, x: m.x, y: m.y, label: m.label, distanceMeters: m.distanceMeters, level }))
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

    // Zone pricing validation (moved here, added 27 Jul, Hitesh's rule):
    // previously this only ran at Venue Publish, meaning an owner could
    // Save an unpriced layout and only find out much later. Every real
    // zone (distinct level+tierLabel actually present in the saved
    // seats) needs a real price before Save succeeds, same check the
    // publish-gate already runs server-side - just surfaced at the
    // point where it's actually actionable.
    //
    // ₹0 is now a valid price (Hitesh, 27 Jul, follow-up rule): a
    // Numbered venue can have a genuinely free/RSVP zone, same as GA
    // sections already allow - only a MISSING price (owner never typed
    // anything) blocks Save now, not an explicit "0".
    const zoneKeysInUse = new Set<string>()
    for (const s of allSeats) zoneKeysInUse.add(`${s.level}::${s.tierLabel}`)
    const priceMap = new Map(allZonePrices.map((z) => [`${z.level}::${z.zoneName}`, z.suggestedPrice]))
    const missingPricing: string[] = []
    for (const key of zoneKeysInUse) {
      const price = priceMap.get(key)
      if (price == null || !Number.isFinite(price) || price < 0) {
        const [level, zoneName] = key.split('::')
        missingPricing.push(`${levelLabel(level)}: ${zoneName}`)
      }
    }
    if (missingPricing.length > 0) {
      showToast(`Every section needs a price before saving (check "Free" for a free section). Missing: ${missingPricing.join(', ')}. Set prices, then save again.`, 'error')
      return
    }

    // Cross-level zone-name consent (added 27 Jul, Hitesh's rule): the
    // same zone name is allowed to repeat across DIFFERENT levels (e.g.
    // "General" on both Ground and Balcony), but only with explicit
    // confirmation - it's easy to type the same word out of habit
    // without meaning to signal "these are the same pricing identity."
    // Same-level duplicates are already blocked earlier (generateGrid/
    // wizardNext), before generation ever merges them into one
    // indistinguishable tierLabel.
    const levelsByZoneName = new Map<string, Set<string>>()
    for (const key of zoneKeysInUse) {
      const [level, zoneName] = key.split('::')
      const nameKey = normalizeForCompare(zoneName)
      if (!levelsByZoneName.has(nameKey)) levelsByZoneName.set(nameKey, new Set())
      levelsByZoneName.get(nameKey)!.add(level)
    }
    const crossLevelDupes = Array.from(levelsByZoneName.entries()).filter(([, lvls]) => lvls.size > 1)
    if (crossLevelDupes.length > 0) {
      const names = crossLevelDupes.map(([name]) => name).join(', ')
      if (!window.confirm(
        `Section name "${names}" is used on more than one level. This is allowed, but audiences won't be able to tell the levels apart by section name alone - only proceed if that's intentional.\n\nContinue saving?`
      )) {
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/venues/${id}/seats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatingMode, seats: allSeats, zonePrices: allZonePrices, markers: allMarkers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      // Server is now the up-to-date copy - the local draft would only
      // cause confusion (or a stale-restore prompt) on a future reload.
      try { localStorage.removeItem(draftKey(id)) } catch {}
      showToast(
        `Saved ${data.seatCount} seat${data.seatCount === 1 ? '' : 's'} across ${levels.length} level${levels.length === 1 ? '' : 's'}` +
        (data.markerCount ? ` and ${data.markerCount} safety marker${data.markerCount === 1 ? '' : 's'}` : '') + '.',
        'success'
      )
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)

  return (
    <>
      <SiteNav />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
        <BackLink href={`/dashboard/venue/${id}/edit`} label="Back to Venue" />
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '10px 0 4px', color: 'var(--afa-text-primary)' }}>Seat Map Builder</h1>
        <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.65, marginBottom: '20px' }}>
          General Admission is section/quantity based, same as today. Numbered Seating lets you place real seats on a canvas matching your venue's actual shape.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setSeatingMode('GENERAL_ADMISSION')}
            style={{
              padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: seatingMode === 'GENERAL_ADMISSION' ? 'none' : '1px solid rgba(14,12,10,0.15)',
              background: seatingMode === 'GENERAL_ADMISSION' ? 'var(--afa-fill-solid)' : 'var(--afa-white)',
              color: seatingMode === 'GENERAL_ADMISSION' ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-primary)',
            }}
          >
            General Admission
          </button>
          <button
            onClick={() => setSeatingMode('NUMBERED')}
            style={{
              padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: seatingMode === 'NUMBERED' ? 'none' : '1px solid rgba(14,12,10,0.15)',
              background: seatingMode === 'NUMBERED' ? 'var(--afa-fill-solid)' : 'var(--afa-white)',
              color: seatingMode === 'NUMBERED' ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-primary)',
            }}
          >
            Numbered Seating
          </button>
        </div>

        {seatingMode === 'NUMBERED' && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
              padding: '12px 16px', borderRadius: '10px', marginBottom: '18px',
              background: seatMapFrozen ? 'var(--afa-cream-tint-1)' : 'var(--afa-white)',
              border: seatMapFrozen ? '1px solid var(--afa-terracotta)' : '1px dashed rgba(14,12,10,0.2)',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--afa-text-primary)' }}>
              {seatMapFrozen ? (
                <><strong>🔒 Seat map frozen</strong> — finalized and read-only. Unfreeze to make changes.</>
              ) : (
                'Once this layout is finished, freeze it to lock it against accidental edits.'
              )}
            </div>
            <button
              onClick={() => toggleFreeze(!seatMapFrozen)}
              disabled={freezing}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: freezing ? 'default' : 'pointer',
                border: 'none', opacity: freezing ? 0.6 : 1,
                background: seatMapFrozen ? 'var(--afa-white)' : 'var(--afa-terracotta)',
                color: seatMapFrozen ? 'var(--afa-text-primary)' : 'var(--afa-white)',
                ...(seatMapFrozen ? { border: '1px solid rgba(14,12,10,0.2)' } : {}),
              }}
            >
              {freezing ? 'Working…' : seatMapFrozen ? 'Unfreeze' : 'Freeze this seat map'}
            </button>
          </div>
        )}

        {seatingMode === 'GENERAL_ADMISSION' && (
          <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.6, fontStyle: 'italic' }}>
            This venue uses General Admission (section + quantity). Section names, seat counts, and pricing are managed from the venue's Edit page, not here. Switch to Numbered Seating above to build a real seat layout.
          </p>
        )}

        {seatingMode === 'NUMBERED' && (
          <div style={{ marginBottom: '20px' }}>
            {levels.length === 1 ? (
              <button onClick={addLevel} disabled={seatMapFrozen} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: seatMapFrozen ? 0.3 : 0.6, background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: seatMapFrozen ? 'default' : 'pointer' }}>
                + This venue has more than one level (e.g. Balcony, 1st Floor)
              </button>
            ) : (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {levels.map((lvl) => (
                    <div key={lvl} style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={() => setActiveLevel(lvl)}
                        style={{
                          padding: '7px 14px', borderRadius: '8px 0 0 8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                          border: activeLevel === lvl ? 'none' : '1px solid rgba(14,12,10,0.15)',
                          background: activeLevel === lvl ? 'var(--afa-fill-solid)' : 'var(--afa-white)',
                          color: activeLevel === lvl ? 'var(--afa-white)' : 'var(--afa-text-primary)',
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
                          background: activeLevel === lvl ? 'var(--afa-fill-solid)' : 'var(--afa-white)',
                          color: activeLevel === lvl ? 'var(--afa-white)' : 'var(--afa-error)',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button onClick={addLevel} disabled={seatMapFrozen} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: seatMapFrozen ? 0.3 : 0.6, background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '7px 12px', cursor: seatMapFrozen ? 'default' : 'pointer' }}>
                    + Add level
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: '6px' }}>
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
                borderRadius: '12px', border: '2px solid var(--afa-ink)', background: 'var(--afa-surface-raised)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--afa-terracotta)', marginBottom: '6px' }}>Recommended</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>Guided Setup</div>
              <div style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.7, lineHeight: 1.5 }}>
                Answer a few simple questions — rows, seats per row, walkways — and we'll lay out the seats for you. Best if your seating is straight rows facing the stage.
              </div>
            </button>
            <button
              onClick={startDrawMyself}
              style={{
                flex: '1 1 300px', textAlign: 'left', cursor: 'pointer', padding: '22px',
                borderRadius: '12px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '6px' }}>For hands-on control</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>Draw It Myself</div>
              <div style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.7, lineHeight: 1.5 }}>
                Place and drag every seat by hand on a canvas shaped like your real venue. Good for curved rows, round tables, or any layout that isn't straight rows.
              </div>
            </button>
          </div>
        )}

        {seatingMode === 'NUMBERED' && effectivePath === 'wizard' && (
          <div style={{ maxWidth: '560px' }}>
            <button onClick={backToChoice} style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.55, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
              ← Change approach
            </button>

            {wizardStep === 0 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>What's your seating shape?</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => { setWizardShape('rows'); wizardNext() }} style={{ textAlign: 'left', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                    Straight rows facing the stage
                  </button>
                  <button onClick={() => setWizardShape('other')} style={{ textAlign: 'left', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                    Curved rows, round tables, or a U-shape
                  </button>
                </div>
                {wizardShape === 'other' && (
                  <div style={{ marginTop: '14px', padding: '14px', borderRadius: '8px', background: 'var(--afa-cream-tint-1)', fontSize: '13px', color: 'var(--afa-text-primary)' }}>
                    Guided Setup only builds straight rows for now — curved and round layouts aren't supported yet. You can either draw that shape by hand, or start from straight rows here and adjust later.
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button onClick={startDrawMyself} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--afa-fill-solid)', color: 'var(--afa-white)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Draw It Myself instead</button>
                      <button onClick={() => { setWizardShape('rows'); wizardNext() }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Continue with straight rows anyway</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {wizardStep === 1 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Do you want different pricing sections by row depth?</h3>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '12px' }}>
                  e.g. "Front" costs more than "Back". Each section is a range of rows with its own name and seat count - that name is what an organiser will price when they build an event here.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setMultiZone(false)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardMultiZone === false ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardMultiZone === false ? 'var(--afa-fill-solid)' : 'var(--afa-white)', color: wizardMultiZone === false ? 'var(--afa-white)' : 'var(--afa-text-primary)' }}>
                    No, one section for everything
                  </button>
                  <button onClick={() => setMultiZone(true)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardMultiZone === true ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardMultiZone === true ? 'var(--afa-fill-solid)' : 'var(--afa-white)', color: wizardMultiZone === true ? 'var(--afa-white)' : 'var(--afa-text-primary)' }}>
                    Yes, multiple sections
                  </button>
                </div>

                {wizardMultiZone === false && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Total rows</label>
                      <ClampedNumberInput style={{ ...inputStyle, width: '90px' }} value={gridConfig.rowGroups[0]?.rows || 1} min={1} max={200} onCommit={(n) => gridConfig.rowGroups[0] && updateRowGroup(gridConfig.rowGroups[0].id, 'rows', n)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Seats per row</label>
                      <ClampedNumberInput style={{ ...inputStyle, width: '90px' }} value={gridConfig.rowGroups[0]?.columns || 1} min={1} max={200} onCommit={(n) => gridConfig.rowGroups[0] && updateRowGroup(gridConfig.rowGroups[0].id, 'columns', n)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Section name</label>
                      <input style={{ ...inputStyle, width: '160px' }} value={gridConfig.rowGroups[0]?.zoneName || ''} placeholder="e.g. General" onChange={(e) => gridConfig.rowGroups[0] && updateRowGroupZone(gridConfig.rowGroups[0].id, e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Price</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input
                          type="number"
                          style={{ ...inputStyle, width: '120px', ...(gridConfig.rowGroups[0] && zoneIsFree(gridConfig.rowGroups[0].zoneName) ? { opacity: 0.5, background: 'rgba(14,12,10,0.04)' } : {}) }}
                          placeholder="₹"
                          disabled={!!gridConfig.rowGroups[0] && zoneIsFree(gridConfig.rowGroups[0].zoneName)}
                          value={zonePrices[gridConfig.rowGroups[0]?.zoneName || ''] || ''}
                          onChange={(e) => gridConfig.rowGroups[0] && setZonePrice(gridConfig.rowGroups[0].zoneName, e.target.value)}
                        />
                        {gridConfig.rowGroups[0] && (
                          <FreeToggle checked={zoneIsFree(gridConfig.rowGroups[0].zoneName)} onChange={(free) => gridConfig.rowGroups[0] && setZoneFree(gridConfig.rowGroups[0].zoneName, free)} />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {wizardMultiZone === true && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '8px' }}>Add a section for each range of rows, front to back (e.g. rows 1-5 "Front" at 10 seats/row, rows 6-15 "Mid" at 14 seats/row).</div>
                    {gridConfig.rowGroups.map((rg, i) => (
                      <div key={rg.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', opacity: 0.6, minWidth: '50px' }}>Section {i + 1}:</span>
                        <label style={{ fontSize: '12px' }}>Rows:</label>
                        <ClampedNumberInput style={{ ...inputStyle, width: '55px' }} value={rg.rows} min={1} max={200} onCommit={(n) => updateRowGroup(rg.id, 'rows', n)} />
                        <label style={{ fontSize: '12px' }}>Seats:</label>
                        <ClampedNumberInput style={{ ...inputStyle, width: '55px' }} value={rg.columns} min={1} max={200} onCommit={(n) => updateRowGroup(rg.id, 'columns', n)} />
                        <label style={{ fontSize: '12px' }}>Name:</label>
                        <input style={{ ...inputStyle, width: '120px' }} value={rg.zoneName} placeholder={`Section ${i + 1}`} onChange={(e) => updateRowGroupZone(rg.id, e.target.value)} />
                        <label style={{ fontSize: '12px' }}>Price:</label>
                        <input
                          type="number"
                          style={{ ...inputStyle, width: '80px', ...(zoneIsFree(rg.zoneName) ? { opacity: 0.5, background: 'rgba(14,12,10,0.04)' } : {}) }}
                          placeholder="₹"
                          disabled={zoneIsFree(rg.zoneName)}
                          value={zonePrices[rg.zoneName] || ''}
                          onChange={(e) => setZonePrice(rg.zoneName, e.target.value)}
                        />
                        <FreeToggle checked={zoneIsFree(rg.zoneName)} onChange={(free) => setZoneFree(rg.zoneName, free)} />
                        {gridConfig.rowGroups.length > 1 && <button onClick={() => removeRowGroup(rg.id)} style={{ border: 'none', background: 'none', color: 'var(--afa-error)', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                      </div>
                    ))}
                    <button onClick={addRowGroup} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                      + Add another zone
                    </button>
                    {findDuplicateZoneNames(gridConfig.rowGroups).length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--afa-error)', fontWeight: 600 }}>
                        Section name{findDuplicateZoneNames(gridConfig.rowGroups).length === 1 ? '' : 's'} "{findDuplicateZoneNames(gridConfig.rowGroups).join('", "')}" {findDuplicateZoneNames(gridConfig.rowGroups).length === 1 ? 'is' : 'are'} used more than once - each section on this level needs a unique name.
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button
                    onClick={wizardNext}
                    disabled={wizardMultiZone === null || gridConfig.rowGroups.some((rg) => !rg.zoneName.trim()) || findDuplicateZoneNames(gridConfig.rowGroups).length > 0}
                    style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--afa-terracotta)', color: 'var(--afa-white)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (wizardMultiZone === null || gridConfig.rowGroups.some((rg) => !rg.zoneName.trim()) || findDuplicateZoneNames(gridConfig.rowGroups).length > 0) ? 0.5 : 1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Any walkway splitting the rows, like left/right?</h3>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '12px' }}>
                  This is just a walking gap — it doesn't change pricing. Pricing already comes from the zone(s) you set up on the previous step. This sets the same walkway for every zone to start; if different zones need different splits, fine-tune each one separately afterward in the advanced Generate Grid panel.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setWizardVerticalAisle(false)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasVerticalAisle === false ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasVerticalAisle === false ? 'var(--afa-fill-solid)' : 'var(--afa-white)', color: wizardHasVerticalAisle === false ? 'var(--afa-white)' : 'var(--afa-text-primary)' }}>
                    No, one solid block
                  </button>
                  <button onClick={() => setWizardVerticalAisle(true)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasVerticalAisle === true ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasVerticalAisle === true ? 'var(--afa-fill-solid)' : 'var(--afa-white)', color: wizardHasVerticalAisle === true ? 'var(--afa-white)' : 'var(--afa-text-primary)' }}>
                    Yes, a center walkway
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.55, marginBottom: '16px' }}>
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
                          style={{ padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: gridConfig.rowGroups[0]?.verticalAisles[0]?.gapPx === opt.px ? 'none' : '1px solid rgba(14,12,10,0.2)', background: gridConfig.rowGroups[0]?.verticalAisles[0]?.gapPx === opt.px ? 'var(--afa-fill-solid)' : 'var(--afa-white)', color: gridConfig.rowGroups[0]?.verticalAisles[0]?.gapPx === opt.px ? 'var(--afa-white)' : 'var(--afa-text-primary)' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} disabled={wizardHasVerticalAisle === null} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--afa-terracotta)', color: 'var(--afa-white)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: wizardHasVerticalAisle === null ? 0.5 : 1 }}>Next</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>How should rows of different widths line up?</h3>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '12px' }}>
                  Only matters if your zones have different seats-per-row (tapering rows). Referenced to the stage, not the audience.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  {(['left', 'center', 'right'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setGridConfig((g) => ({ ...g, rowAlignment: opt }))}
                      style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', border: gridConfig.rowAlignment === opt ? 'none' : '1px solid rgba(14,12,10,0.2)', background: gridConfig.rowAlignment === opt ? 'var(--afa-fill-solid)' : 'var(--afa-white)', color: gridConfig.rowAlignment === opt ? 'var(--afa-white)' : 'var(--afa-text-primary)' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.55, marginBottom: '16px' }}>
                  {gridConfig.rowAlignment === 'center' && 'Narrower rows are inset equally on both sides — every zone shares one central aisle, like a real fan-style hall.'}
                  {gridConfig.rowAlignment === 'left' && 'Every row starts at the stage-left edge — wider rows only grow toward stage-right. Use this if stage-left is against a wall.'}
                  {gridConfig.rowAlignment === 'right' && 'Every row ends at the stage-right edge — wider rows only grow toward stage-left.'}
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--afa-terracotta)', color: 'var(--afa-white)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Next</button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Any gangways between rows (front-to-back walkways)?</h3>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '12px' }}>
                  e.g. a walking gap after row 10, so rows 11+ have extra space in front of them. You can add more than one - answering Yes adds a row-number field below for each gangway.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setWizardAisle(true)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasAisle === true ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasAisle === true ? 'var(--afa-fill-solid)' : 'var(--afa-white)', color: wizardHasAisle === true ? 'var(--afa-white)' : 'var(--afa-text-primary)' }}>Yes</button>
                  <button onClick={() => setWizardAisle(false)} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: wizardHasAisle === false ? 'none' : '1px solid rgba(14,12,10,0.2)', background: wizardHasAisle === false ? 'var(--afa-fill-solid)' : 'var(--afa-white)', color: wizardHasAisle === false ? 'var(--afa-white)' : 'var(--afa-text-primary)' }}>No</button>
                </div>

                {wizardHasAisle === true && (
                  <div style={{ marginBottom: '16px' }}>
                    {gridConfig.aisles.map((a, i) => (
                      <div key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.6, minWidth: '70px' }}>Gangway {i + 1}:</span>
                        <label style={{ fontSize: '13px', fontWeight: 600 }}>After row #</label>
                        <ClampedNumberInput style={{ ...inputStyle, width: '70px' }} value={a.afterRow} min={0} onCommit={(n) => updateAisle(a.id, 'afterRow', n)} />
                        {gridConfig.aisles.length > 1 && <button onClick={() => removeAisle(a.id)} style={{ border: 'none', background: 'none', color: 'var(--afa-error)', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                      </div>
                    ))}
                    <button onClick={addAisle} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                      + Add another gangway
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={wizardNext} disabled={wizardHasAisle === null} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--afa-terracotta)', color: 'var(--afa-white)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: wizardHasAisle === null ? 0.5 : 1 }}>Next: Preview</button>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>Preview</h3>
                <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: '12px' }}>
                  This is exactly what your audience will see. {wizardPreviewSeats.length} seats across {gridConfig.rowGroups.reduce((s, r) => s + r.rows, 0)} rows.
                </p>
                <div
                  style={{
                    maxWidth: '100%', maxHeight: '420px', overflow: 'auto', display: 'flex',
                    background: 'var(--afa-cream-tint-1)', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '10px', marginBottom: '16px', padding: '10px 0',
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0, margin: '0 auto', width: `${previewBounds(wizardPreviewSeats).width}px`, height: `${previewBounds(wizardPreviewSeats).height}px` }}>
                    <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '60%', padding: '8px 0', textAlign: 'center', borderRadius: '6px', background: 'var(--afa-fill-solid)', color: 'var(--afa-white)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Stage
                    </div>
                    {wizardPreviewSeats.map((s, i) => (
                      <div key={i} style={{ position: 'absolute', left: s.x - SEAT_SIZE / 2, top: s.y - SEAT_SIZE / 2, width: `${SEAT_SIZE}px`, height: `${SEAT_SIZE}px`, borderRadius: '5px', background: colorForTier(s.tierLabel, Array.from(new Set(wizardPreviewSeats.map((p) => p.tierLabel)))), opacity: 0.85, color: 'var(--afa-white)', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s.row}{s.number}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={wizardBack} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Back</button>
                  <button onClick={finishWizard} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--afa-fill-solid)', color: 'var(--afa-white)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Looks good — continue to fine-tune</button>
                </div>
              </div>
            )}
          </div>
        )}

        {seatingMode === 'NUMBERED' && effectivePath === 'canvas' && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.55, marginBottom: '10px', fontStyle: 'italic' }}>
                <button onClick={backToChoice} style={{ display: 'block', fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '8px', textDecoration: 'underline' }}>
                  ← Back to setup options
                </button>
                Orientation: this canvas is drawn as if you're standing on stage facing the audience — "Left" and "Right" match the performer's perspective, not the audience's.
              </div>

              {isMobile ? (
                <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--afa-cream-tint-1)', border: '1px solid rgba(14,12,10,0.15)', marginBottom: '14px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-text-primary)', margin: '0 0 4px' }}>
                    Viewing only on this screen
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.7, margin: 0 }}>
                    Placing, moving, and generating seats needs more room than a phone gives you. Pinch or scroll below to check the current layout, and switch to a tablet or desktop to make changes.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={() => setShowGenerator((v) => !v)}
                      title="Drops a starting grid of seats onto the canvas - you can then freely move, add, or delete any of them by hand."
                      style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--afa-terracotta)', color: 'var(--afa-white)' }}
                    >
                      {showGenerator ? 'Close Quick Layout' : '+ Quick Layout (start from a grid)'}
                    </button>
                    <button
                      onClick={resetLayout}
                      style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--afa-error)', background: 'var(--afa-surface-raised)', color: 'var(--afa-error)' }}
                    >
                      Reset Layout
                    </button>
                    <button
                      onClick={() => setManualPlacement((v) => !v)}
                      title={manualPlacement ? 'Clicking the canvas places a new seat - click to turn off' : 'Canvas clicks are safe (no new seats) - click to enable manual placement'}
                      style={{
                        padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        border: manualPlacement ? 'none' : '1px solid rgba(14,12,10,0.2)',
                        background: manualPlacement ? 'var(--afa-fill-solid)' : 'var(--afa-white)',
                        color: manualPlacement ? 'var(--afa-white)' : 'var(--afa-text-primary)',
                      }}
                    >
                      {manualPlacement ? '✓ Manual placement ON' : 'Manual placement OFF'}
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: '-6px', marginBottom: '12px' }}>
                    {manualPlacement
                      ? 'Clicking the canvas adds a new seat. Turn this off to safely scroll/inspect without accidentally placing seats.'
                      : 'Canvas clicks are safe right now - nothing gets added. Turn manual placement on to hand-place extra seats.'}
                  </p>

                  {/* §9.4 cluster item #6 (session 48/49) - safety/reference
                      markers, scoped as potentially Fire-NOC-relevant.
                      Arming a type here takes over the next canvas click
                      (placeMarker), same one-click-away pattern as manual
                      seat placement above. */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Safety markers:</span>
                    {(Object.keys(MARKER_META) as MarkerType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setMarkerMode((v) => (v === t ? null : t))}
                        title={`Click, then click the canvas to place a ${MARKER_META[t].name} marker.`}
                        style={{
                          padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                          border: markerMode === t ? 'none' : `1px solid ${MARKER_META[t].color}`,
                          background: markerMode === t ? MARKER_META[t].color : 'var(--afa-white)',
                          color: markerMode === t ? 'var(--afa-white)' : MARKER_META[t].color,
                        }}
                      >
                        {markerMode === t ? `✓ Placing ${MARKER_META[t].name}` : `+ ${MARKER_META[t].name}`}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: '4px', marginBottom: '12px' }}>
                    For Fire-NOC documentation, not shown to audience members booking seats. Click a marker on the canvas to label it or (for a stage-distance point) record the measured distance.
                  </p>
                </>
              )}

              {/* §9.4 cluster item #5 (session 49) - PDF/image reference
                  underlay. Deliberately NOT inside the !isMobile branch
                  above (unlike Safety Markers/seat placement) - a file
                  picker and an opacity slider are plain touch-friendly
                  controls with no drag-precision problem, so a phone-only
                  Venue Owner with no laptop/tablet access can still use
                  this even though seat/marker placement stays desktop-
                  only. Scoped as a fixed-fit background image per level
                  (stretched to fit, opacity-adjustable) - no independent
                  pan/zoom/rotation alignment in v1. */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Reference image ({levelLabel(activeLevel)}):</span>
                <label
                  style={{
                    padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: underlayUploading ? 'default' : 'pointer',
                    border: '1px solid rgba(14,12,10,0.2)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)',
                    opacity: underlayUploading ? 0.6 : 1,
                  }}
                >
                  {underlayUploading ? 'Uploading…' : underlay ? 'Replace image' : '+ Upload floor plan / photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={underlayUploading}
                    style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadUnderlay(f); e.target.value = '' }}
                  />
                </label>
                {underlay && (
                  <>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Opacity</label>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={underlay.opacity}
                      onChange={(e) => updateUnderlayOpacity(parseFloat(e.target.value))}
                      style={{ width: '100px' }}
                    />
                    <button
                      onClick={removeUnderlay}
                      style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--afa-error)', background: 'var(--afa-surface-raised)', color: 'var(--afa-error)' }}
                    >
                      Remove image
                    </button>
                  </>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: '4px', marginBottom: '12px' }}>
                Upload a floor plan or venue photo to trace over - it stretches to fit behind the canvas and doesn't affect saved seats/markers. If you have a PDF floor plan, export or screenshot the page as an image first.
              </p>

              {showGenerator && !isMobile && (
                <div style={{ marginBottom: '16px', padding: '18px', borderRadius: '10px', background: 'var(--afa-cream-tint-1)', border: '1px solid rgba(14,12,10,0.1)' }}>
                  <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 0, marginBottom: '14px' }}>
                    This is a starting point, not a final layout. Set the shape below and it drops seats onto the canvas above - then hand-edit anything (move, add, delete) just like a manually placed seat.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Side margin:</label>
                    <ClampedNumberInput style={{ ...inputStyle, width: '70px' }} value={gridConfig.sideMarginPx} min={0} max={500} onCommit={(n) => setGridConfig((g) => ({ ...g, sideMarginPx: n }))} />
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Seat spacing, side-to-side / front-to-back:</label>
                    <ClampedNumberInput style={{ ...inputStyle, width: '60px' }} value={gridConfig.seatSpacingX} min={10} max={200} onCommit={(n) => setGridConfig((g) => ({ ...g, seatSpacingX: n }))} />
                    <ClampedNumberInput style={{ ...inputStyle, width: '60px' }} value={gridConfig.seatSpacingY} min={10} max={200} onCommit={(n) => setGridConfig((g) => ({ ...g, seatSpacingY: n }))} />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 0, marginBottom: '12px' }}>
                    These are canvas units, not a real-world measurement - bigger number means more empty space. Adjust and watch the preview above; there's no need to know exactly what "px" means.
                  </p>

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
                          background: gridConfig.rowAlignment === opt ? 'var(--afa-fill-solid)' : 'var(--afa-white)',
                          color: gridConfig.rowAlignment === opt ? 'var(--afa-white)' : 'var(--afa-text-primary)',
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.55, marginTop: '-10px', marginBottom: '14px' }}>
                    {gridConfig.rowAlignment === 'center' && 'Narrower rows are inset equally on both sides, so every row shares one central aisle — the shape of a real fan-style hall.'}
                    {gridConfig.rowAlignment === 'left' && 'Every row starts at the same left edge — wider rows only grow to the right. Use this if one side of your venue is against a wall.'}
                    {gridConfig.rowAlignment === 'right' && 'Every row ends at the same right edge — wider rows only grow to the left.'}
                  </p>

                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Sections / row groups (rows can taper — different column counts per range, counted across the whole row)</div>
                  {gridConfig.rowGroups.map((rg, i) => (
                    <div key={rg.id} style={{ border: '1px solid rgba(14,12,10,0.12)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', opacity: 0.6, minWidth: '55px' }}>Section {i + 1}:</span>
                        <label style={{ fontSize: '12px' }}>Rows:</label>
                        <ClampedNumberInput style={{ ...inputStyle, width: '55px' }} value={rg.rows} min={1} max={200} onCommit={(n) => updateRowGroup(rg.id, 'rows', n)} />
                        <label style={{ fontSize: '12px' }}>Columns:</label>
                        <ClampedNumberInput style={{ ...inputStyle, width: '55px' }} value={rg.columns} min={1} max={200} onCommit={(n) => updateRowGroup(rg.id, 'columns', n)} />
                        <label style={{ fontSize: '12px' }}>Name:</label>
                        <input style={{ ...inputStyle, width: '120px' }} value={rg.zoneName} onChange={(e) => updateRowGroupZone(rg.id, e.target.value)} />
                        <label style={{ fontSize: '12px' }}>Price:</label>
                        <input
                          type="number"
                          style={{ ...inputStyle, width: '80px', ...(zoneIsFree(rg.zoneName) ? { opacity: 0.5, background: 'rgba(14,12,10,0.04)' } : {}) }}
                          placeholder="₹"
                          disabled={zoneIsFree(rg.zoneName)}
                          value={zonePrices[rg.zoneName] || ''}
                          onChange={(e) => setZonePrice(rg.zoneName, e.target.value)}
                        />
                        <FreeToggle checked={zoneIsFree(rg.zoneName)} onChange={(free) => setZoneFree(rg.zoneName, free)} />
                        {gridConfig.rowGroups.length > 1 && <button onClick={() => removeRowGroup(rg.id)} style={{ border: 'none', background: 'none', color: 'var(--afa-error)', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: 0.55, marginBottom: '4px' }}>
                        Vertical aisles for this zone only (different zones can have different splits) - add as many as you need; 0% = walkway before seat 1 (against the wall), 100% = walkway after the last seat. The scale already runs the full width, so a position near the right edge just means a number close to 100 - there's no separate "from the right" field needed.
                      </div>
                      {rg.verticalAisles.map((a) => (
                        <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '12px' }}>Position (%):</label>
                          <ClampedNumberInput
                            min={0}
                            max={100}
                            style={{ ...inputStyle, width: '55px' }}
                            value={Math.round(a.afterFraction * 100)}
                            onCommit={(n) => updateVerticalAisleInGroup(rg.id, a.id, 'afterFraction', n / 100)}
                          />
                          <label style={{ fontSize: '12px' }}>Aisle width:</label>
                          <ClampedNumberInput style={{ ...inputStyle, width: '55px' }} value={a.gapPx} min={0} onCommit={(n) => updateVerticalAisleInGroup(rg.id, a.id, 'gapPx', n)} />
                          <button onClick={() => removeVerticalAisleFromGroup(rg.id, a.id)} style={{ border: 'none', background: 'none', color: 'var(--afa-error)', cursor: 'pointer', fontSize: '16px' }}>×</button>
                        </div>
                      ))}
                      <button onClick={() => addVerticalAisleToGroup(rg.id)} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', marginTop: '2px' }}>
                        + Add vertical aisle to this zone
                      </button>
                    </div>
                  ))}
                  <button onClick={addRowGroup} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px' }}>
                    + Add row group / zone
                  </button>

                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Horizontal aisles (a walking gap between two rows, e.g. a gangway)</div>
                  {gridConfig.aisles.map((a) => (
                    <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px' }}>After row #:</label>
                      <ClampedNumberInput style={{ ...inputStyle, width: '60px' }} value={a.afterRow} min={0} onCommit={(n) => updateAisle(a.id, 'afterRow', n)} />
                      <label style={{ fontSize: '12px' }}>Aisle width:</label>
                      <ClampedNumberInput style={{ ...inputStyle, width: '60px' }} value={a.gapPx} min={0} onCommit={(n) => updateAisle(a.id, 'gapPx', n)} />
                      <button onClick={() => removeAisle(a.id)} style={{ border: 'none', background: 'none', color: 'var(--afa-error)', cursor: 'pointer', fontSize: '16px' }}>×</button>
                    </div>
                  ))}
                  <button onClick={addAisle} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'none', border: '1px dashed rgba(14,12,10,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px', display: 'block' }}>
                    + Add horizontal aisle
                  </button>

                  <button onClick={generateGrid} disabled={seatMapFrozen} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'var(--afa-fill-solid)', color: 'var(--afa-white)', fontSize: '13px', fontWeight: 700, cursor: seatMapFrozen ? 'default' : 'pointer', opacity: seatMapFrozen ? 0.5 : 1 }}>
                    Generate Seats
                  </button>
                </div>
              )}

              {!isMobile && (
                <>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Section name:</label>
                    <input
                      style={{ ...inputStyle, width: '160px' }}
                      value={activeTier}
                      onChange={(e) => setActiveTier(e.target.value.slice(0, 60))}
                      placeholder="e.g. VIP Front"
                    />
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Row letter:</label>
                    <input style={{ ...inputStyle, width: '60px' }} value={nextRow} onChange={(e) => setNextRow(e.target.value.slice(0, 10))} />
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Next seat #:</label>
                    <ClampedNumberInput
                      style={{ ...inputStyle, width: '70px' }}
                      value={nextNumber}
                      min={1}
                      onCommit={setNextNumber}
                    />
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Price:</label>
                    <input
                      type="number"
                      style={{ ...inputStyle, width: '90px', ...(zoneIsFree(activeTier) ? { opacity: 0.5, background: 'rgba(14,12,10,0.04)' } : {}) }}
                      placeholder="₹"
                      disabled={zoneIsFree(activeTier)}
                      value={zonePrices[activeTier] || ''}
                      onChange={(e) => setZonePrice(activeTier, e.target.value)}
                    />
                    <FreeToggle checked={zoneIsFree(activeTier)} onChange={(free) => setZoneFree(activeTier, free)} />
                    <span style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>Click the canvas to place a seat manually</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '12px' }}>
                    Every seat you place next gets this section name and row letter, then auto-increments the seat number. Section name is what an organiser will price later, so keep it short and clear (e.g. "VIP", "General") — the price here is shared with any other section box using the same name.
                  </p>
                </>
              )}

              {canvasBounds.overflowsDefault && (
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '8px' }}>
                  {isMobile
                    ? 'This layout is larger than your screen — pinch to zoom or scroll inside the box below to see the whole thing.'
                    : 'This layout is larger than the default view — scroll inside the box below to see and place seats across the whole thing.'}
                </p>
              )}

              <div style={{ maxWidth: '100%', maxHeight: '70vh', overflow: 'auto', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '10px', touchAction: isMobile ? 'pinch-zoom pan-x pan-y' : 'auto' }}>
                <div
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  data-testid="seatmap-canvas"
                  style={{
                    position: 'relative',
                    width: `${canvasBounds.width}px`,
                    height: `${canvasBounds.height}px`,
                    background: 'var(--afa-cream-tint-1)',
                    cursor: isMobile ? 'default' : (manualPlacement || markerMode ? 'crosshair' : 'default'),
                  }}
                >
                  {underlay && (
                    <img
                      src={underlay.imageUrl}
                      alt=""
                      data-testid="seatmap-underlay"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        opacity: underlay.opacity,
                        pointerEvents: 'none',
                        zIndex: 0,
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
                      width: '60%', padding: '8px 0', textAlign: 'center', borderRadius: '6px',
                      background: 'var(--afa-fill-solid)', color: 'var(--afa-white)', fontSize: '11px', fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none', zIndex: 1,
                    }}
                  >
                    Stage
                  </div>
                  {seats.map((s) => (
                    <div
                      key={s.clientId}
                      data-testid="seat"
                      onMouseDown={(e) => startDrag(e, s.clientId)}
                      // stopPropagation() in startDrag only stops the
                      // mousedown event itself - the browser still fires a
                      // separate click event afterward (mousedown+mouseup
                      // on the same element with no movement), which then
                      // bubbles up to the canvas's onClick={placeSeat} and
                      // was creating a duplicate overlapping seat instead
                      // of just selecting the existing one (§9.2, 26 Jul).
                      // Stopping the click here, on the seat itself,
                      // closes that gap regardless of drag state.
                      onClick={(e) => e.stopPropagation()}
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
                        outline: selectedId === s.clientId ? '2px solid var(--afa-ink)' : 'none',
                        outlineOffset: '2px',
                        color: 'var(--afa-white)',
                        fontSize: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isMobile ? 'default' : 'grab',
                        userSelect: 'none',
                      }}
                    >
                      {s.row}{s.number}
                    </div>
                  ))}
                  {seats.length === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--afa-text-primary)', opacity: 0.35, fontSize: '14px', textAlign: 'center', padding: '0 20px' }}>
                      {isMobile ? 'No seats placed yet - switch to a tablet or desktop to build this layout' : (manualPlacement ? 'Click anywhere to place your first seat' : 'Turn on Manual placement above to click and place seats')}
                    </div>
                  )}
                  {markers.map((m) => {
                    const meta = MARKER_META[m.type]
                    return (
                      <div
                        key={m.clientId}
                        data-testid="safety-marker"
                        onClick={(e) => { e.stopPropagation(); selectMarker(m.clientId) }}
                        title={`${meta.name}${m.label ? ` — ${m.label}` : ''}${m.distanceMeters != null ? ` (${m.distanceMeters}m)` : ''}`}
                        style={{
                          position: 'absolute',
                          left: m.x - 11,
                          top: m.y - 11,
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: meta.color,
                          opacity: selectedMarkerId === m.clientId ? 1 : 0.9,
                          outline: selectedMarkerId === m.clientId ? '2px solid var(--afa-ink)' : '2px solid var(--afa-white)',
                          outlineOffset: '1px',
                          color: 'var(--afa-white)',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          userSelect: 'none',
                          zIndex: 2,
                        }}
                      >
                        {meta.glyph}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ minWidth: '220px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Selected seat</h3>
              {!selected && <p style={{ fontSize: '13px', opacity: 0.6 }}>{isMobile ? 'Tap a seat on the canvas to view it.' : 'Click a seat on the canvas to edit or delete it.'}</p>}
              {selected && isMobile && (
                <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)' }}>
                  {selected.tierLabel} — Row {selected.row}, Seat {selected.number}
                  <br /><span style={{ fontSize: '12px', opacity: 0.6 }}>Switch to a tablet or desktop to edit or delete this seat.</span>
                </p>
              )}
              {selected && !isMobile && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Section name</label>
                  <input style={inputStyle} value={selected.tierLabel} onChange={(e) => updateSelected('tierLabel', e.target.value.slice(0, 60))} />
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Row letter</label>
                  <input style={inputStyle} value={selected.row} onChange={(e) => updateSelected('row', e.target.value.slice(0, 10))} />
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Seat Number</label>
                  <input style={inputStyle} value={selected.number} onChange={(e) => updateSelected('number', e.target.value.slice(0, 10))} />
                  <button
                    onClick={deleteSelected}
                    style={{ marginTop: '6px', padding: '8px 0', borderRadius: '6px', border: '1px solid var(--afa-error)', color: 'var(--afa-error)', background: 'var(--afa-surface-raised)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete seat
                  </button>
                </div>
              )}

              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '20px 0 10px' }}>Selected marker</h3>
              {!selectedMarker && markers.length === 0 && (
                <p style={{ fontSize: '13px', opacity: 0.6 }}>No safety markers placed yet.</p>
              )}
              {!selectedMarker && markers.length > 0 && (
                <p style={{ fontSize: '13px', opacity: 0.6 }}>{isMobile ? 'Tap a marker on the canvas to view it.' : 'Click a marker on the canvas to label or delete it.'}</p>
              )}
              {selectedMarker && isMobile && (
                <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)' }}>
                  {MARKER_META[selectedMarker.type].name}{selectedMarker.label ? ` — ${selectedMarker.label}` : ''}
                  <br /><span style={{ fontSize: '12px', opacity: 0.6 }}>Switch to a tablet or desktop to edit or delete this marker.</span>
                </p>
              )}
              {selectedMarker && !isMobile && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: MARKER_META[selectedMarker.type].color }}>{MARKER_META[selectedMarker.type].name}</span>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Label (optional)</label>
                  <input
                    style={inputStyle}
                    placeholder={selectedMarker.type === 'GATE' ? 'e.g. Gate 2' : selectedMarker.type === 'FIRE_EXTINGUISHER' ? 'e.g. Extinguisher A' : 'e.g. Rear exit reference'}
                    value={selectedMarker.label}
                    onChange={(e) => updateSelectedMarker('label', e.target.value)}
                  />
                  {selectedMarker.type === 'STAGE_DISTANCE_REF' && (
                    <>
                      <label style={{ fontSize: '12px', fontWeight: 600 }}>Distance from stage (meters)</label>
                      <input
                        type="number"
                        min={0}
                        style={inputStyle}
                        placeholder="e.g. 12"
                        value={selectedMarker.distanceMeters ?? ''}
                        onChange={(e) => updateSelectedMarker('distanceMeters', e.target.value)}
                      />
                      <p style={{ fontSize: '11px', opacity: 0.5, margin: 0 }}>Manually measured/known distance - this canvas has no real-world scale to calculate it automatically.</p>
                    </>
                  )}
                  <button
                    onClick={deleteSelectedMarker}
                    style={{ marginTop: '6px', padding: '8px 0', borderRadius: '6px', border: '1px solid var(--afa-error)', color: 'var(--afa-error)', background: 'var(--afa-surface-raised)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete marker
                  </button>
                </div>
              )}

              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '20px 0 10px' }}>Summary</h3>
              <p style={{ fontSize: '13px', marginBottom: '10px' }}>Total seats: <strong>{seats.length}</strong></p>
              {/* Price/Free editable directly here, per already-placed zone - avoids
                  having to retype a zone's exact name back into the placement
                  toolbar just to price it (live-found 28 Jul: retyping is
                  case/spacing-sensitive and a mistype silently creates an
                  orphaned zonePrices entry with no effect on real seats). The
                  toolbar's Section name field is now only ever "what new seats
                  get named next" - this list is "price what's already placed". */}
              {tierOrder.filter((t) => seats.some((s) => s.tierLabel === t)).map((t) => {
                const raw = zonePrices[t]
                const noPriceSet = !zoneIsFree(t) && (!raw || raw.trim() === '')
                return (
                  <div key={t} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: colorForTier(t, tierOrder), display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px' }}>{t}: {seats.filter((s) => s.tierLabel === t).length}</span>
                    <input
                      type="number"
                      style={{ ...inputStyle, width: '80px', ...(zoneIsFree(t) ? { opacity: 0.5, background: 'rgba(14,12,10,0.04)' } : {}) }}
                      placeholder="₹"
                      disabled={zoneIsFree(t)}
                      value={raw || ''}
                      onChange={(e) => setZonePrice(t, e.target.value)}
                    />
                    <FreeToggle checked={zoneIsFree(t)} onChange={(free) => setZoneFree(t, free)} />
                    {noPriceSet && <span style={{ fontSize: '12px', color: 'var(--afa-error)', fontWeight: 600 }}>No price set</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!(seatingMode === 'NUMBERED' && effectivePath === 'wizard') && (
          <button
            onClick={save}
            disabled={saving || seatMapFrozen}
            style={{
              marginTop: '24px', padding: '11px 28px', borderRadius: '8px', border: 'none',
              background: 'var(--afa-terracotta)', color: 'var(--afa-white)', fontSize: '14px', fontWeight: 700,
              cursor: (saving || seatMapFrozen) ? 'not-allowed' : 'pointer', opacity: (saving || seatMapFrozen) ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Seat Map'}
          </button>
        )}
      </div>
    </>
  )
}
