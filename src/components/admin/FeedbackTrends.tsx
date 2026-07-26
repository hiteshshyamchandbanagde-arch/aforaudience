'use client'

// Admin Dashboard v1 trend charts (design.md §9.1).
//
// Deliberately hand-rolled inline SVG rather than pulling in a chart
// library - at MVP feedback volume (dozens to low hundreds of rows) a
// dependency-free approach is simpler to maintain and keeps this page's
// bundle small. Revisit if the dataset grows enough to need real
// interactivity (zoom/tooltip-on-hover across many points).
//
// Takes the FULL feedback set (open + resolved) regardless of what the
// board/list currently has loaded via the "Show Resolved" toggle -
// trends need the whole picture to be meaningful.

interface TrendFeedbackItem {
  category: string
  status: string
  severity: string | null
  createdAt: string
  resolvedAt: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  BUG: 'Bug',
  FEATURE_IDEA: 'Feature idea',
  QUESTION: 'Question',
  GENERAL: 'General',
  OTHER: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  BUG: 'var(--afa-error)',
  FEATURE_IDEA: 'var(--afa-sage)',
  QUESTION: 'var(--afa-terracotta)',
  GENERAL: 'var(--afa-taupe)',
  OTHER: 'var(--afa-taupe)',
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay() // 0 = Sunday
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function buildWeeklySeries(items: TrendFeedbackItem[], weeks = 8) {
  const now = new Date()
  const thisWeekStart = startOfWeek(now)
  const buckets: { weekStart: Date; opened: number; resolved: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(thisWeekStart)
    ws.setDate(ws.getDate() - i * 7)
    buckets.push({ weekStart: ws, opened: 0, resolved: 0 })
  }
  const weekIndex = (date: Date) => {
    const ws = startOfWeek(date)
    return buckets.findIndex((b) => b.weekStart.getTime() === ws.getTime())
  }
  for (const item of items) {
    const openedIdx = weekIndex(new Date(item.createdAt))
    if (openedIdx >= 0) buckets[openedIdx].opened += 1
    if (item.resolvedAt) {
      const resolvedIdx = weekIndex(new Date(item.resolvedAt))
      if (resolvedIdx >= 0) buckets[resolvedIdx].resolved += 1
    }
  }
  return buckets
}

function buildCategoryBreakdown(items: TrendFeedbackItem[]) {
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1
  }
  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

const AGE_BUCKETS = [
  { label: '0–1d', maxDays: 1 },
  { label: '1–3d', maxDays: 3 },
  { label: '3–7d', maxDays: 7 },
  { label: '7–14d', maxDays: 14 },
  { label: '14d+', maxDays: Infinity },
]

function buildAgeDistribution(openItems: TrendFeedbackItem[]) {
  const now = Date.now()
  const buckets = AGE_BUCKETS.map((b) => ({ ...b, count: 0 }))
  for (const item of openItems) {
    const ageDays = (now - new Date(item.createdAt).getTime()) / 86_400_000
    const bucket = buckets.find((b) => ageDays <= b.maxDays)
    if (bucket) bucket.count += 1
  }
  return buckets
}

const chartCard: React.CSSProperties = {
  background: 'var(--afa-white)',
  borderRadius: '12px',
  border: '1px solid rgba(14,12,10,0.08)',
  padding: '18px',
}

const chartTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--afa-ink)',
  marginBottom: '14px',
}

export default function FeedbackTrends({ items }: { items: TrendFeedbackItem[] }) {
  const weekly = buildWeeklySeries(items)
  const categories = buildCategoryBreakdown(items)
  const openItems = items.filter((i) => i.status !== 'RESOLVED')
  const ageBuckets = buildAgeDistribution(openItems)

  // --- Weekly line chart geometry ---
  const W = 560
  const H = 160
  const padL = 28
  const padB = 20
  const padT = 10
  const plotW = W - padL - 12
  const plotH = H - padB - padT
  const maxVal = Math.max(1, ...weekly.map((w) => Math.max(w.opened, w.resolved)))
  const xFor = (i: number) => padL + (i / Math.max(1, weekly.length - 1)) * plotW
  const yFor = (v: number) => padT + plotH - (v / maxVal) * plotH
  const openedPath = weekly.map((w, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(w.opened)}`).join(' ')
  const resolvedPath = weekly.map((w, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(w.resolved)}`).join(' ')

  // --- Category bar chart geometry ---
  const maxCatCount = Math.max(1, ...categories.map((c) => c.count))

  // --- Age distribution geometry ---
  const maxAgeCount = Math.max(1, ...ageBuckets.map((b) => b.count))

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '14px',
        marginBottom: '24px',
      }}
    >
      <div style={chartCard}>
        <div style={chartTitle}>
          Opened vs. resolved <span style={{ opacity: 0.5, fontWeight: 400 }}>· last 8 weeks</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* baseline */}
          <line x1={padL} y1={padT + plotH} x2={W - 12} y2={padT + plotH} stroke="rgba(14,12,10,0.15)" strokeWidth={1} />
          <path d={openedPath} fill="none" stroke="var(--afa-terracotta)" strokeWidth={2} />
          <path d={resolvedPath} fill="none" stroke="var(--afa-sage)" strokeWidth={2} />
          {weekly.map((w, i) => (
            <g key={i}>
              <circle cx={xFor(i)} cy={yFor(w.opened)} r={2.5} fill="var(--afa-terracotta)" />
              <circle cx={xFor(i)} cy={yFor(w.resolved)} r={2.5} fill="var(--afa-sage)" />
              {(i === 0 || i === weekly.length - 1 || i === Math.floor(weekly.length / 2)) && (
                <text x={xFor(i)} y={H - 4} fontSize={9} fill="var(--afa-taupe)" textAnchor="middle">
                  {weekLabel(w.weekStart)}
                </text>
              )}
            </g>
          ))}
        </svg>
        <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '11px' }}>
          <span style={{ color: 'var(--afa-terracotta)' }}>● Opened</span>
          <span style={{ color: 'var(--afa-sage)' }}>● Resolved</span>
        </div>
      </div>

      <div style={chartCard}>
        <div style={chartTitle}>Category breakdown</div>
        {categories.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--afa-taupe)' }}>No data yet.</p>
        )}
        {categories.map((c) => (
          <div key={c.category} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
              <span style={{ color: 'var(--afa-ink)', opacity: 0.75 }}>{CATEGORY_LABELS[c.category] || c.category}</span>
              <span style={{ color: 'var(--afa-taupe)' }}>{c.count}</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(14,12,10,0.06)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(c.count / maxCatCount) * 100}%`,
                  background: CATEGORY_COLORS[c.category] || 'var(--afa-taupe)',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={chartCard}>
        <div style={chartTitle}>
          Open-item age <span style={{ opacity: 0.5, fontWeight: 400 }}>· {openItems.length} open</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '110px' }}>
          {ageBuckets.map((b) => (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '11px', color: 'var(--afa-taupe)', marginBottom: '4px' }}>{b.count}</span>
              <div
                style={{
                  width: '100%',
                  maxWidth: '32px',
                  height: `${Math.max(4, (b.count / maxAgeCount) * 80)}px`,
                  background: b.label === '14d+' ? 'var(--afa-error)' : 'var(--afa-terracotta)',
                  opacity: b.label === '14d+' ? 1 : 0.6 + 0.1 * AGE_BUCKETS.findIndex((ab) => ab.label === b.label),
                  borderRadius: '4px 4px 0 0',
                }}
              />
              <span style={{ fontSize: '10px', color: 'var(--afa-taupe)', marginTop: '5px' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
