'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import DashboardShell from '@/components/DashboardShell'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { CONTRAST_PAIRS, composeRgba, planRestore, type RestorePlan, contrastFailures, contrastMinimum, formatAlpha, pairRatio, parseCssColor, parsePx, rangeFor, rgbToHex, tokenValueError, radiusOrderErrors, FONT_ALLOWLIST, type ContrastFailure, type TokenGroup, type TokenType } from '@/lib/design-tokens'
import { TOKEN_COVERAGE, appliesTo, type CoverageStatus } from '@/lib/design-token-coverage'
import { STATUS_TONE } from '@/lib/statusStyle'
import { COLOR_SECTIONS, tokenMeta, tokenMatches } from '@/lib/design-token-meta'

// /dashboard/admin/design-system — GEN-2609-075
//
// Admin-only. Routed under dashboard/admin/* (this codebase's existing
// admin-page family - see settings/users/revenue/etc. siblings) rather
// than a literal top-level /admin/design-system the dispatch's own
// wording suggested - no top-level /admin route exists anywhere in this
// app, every admin surface lives here. Flagged as a discovery-stage
// call, not a silent deviation - see the PR description.
//
// A curated allowlist of pre-loaded fonts (FONT_ALLOWLIST in
// src/lib/design-tokens.ts) backs the 4 font-role selects - "pre-
// loaded" because next/font self-hosts at build time, so there is no
// way to add a brand-new webfont at runtime without a deploy; what IS
// safely runtime-swappable is which of the fonts ALREADY on the page
// plays which typographic role, which is exactly what this offers.

type DesignToken = {
  key: string
  value: string
  group: TokenGroup
  type: TokenType
  locked: boolean
  updatedBy: string | null
  updatedAt: string
}

type DesignTokenVersion = {
  id: string
  snapshot: Record<string, string>
  createdBy: string | null
  creatorLabel: string | null
  createdAt: string
  note: string | null
}

// GEN-2609-076 - versions come back newest-first; diffing each one
// against the NEXT one in that same order (i.e. the version immediately
// before it in time) shows what THAT SAVE actually changed, without a
// second API round trip - the snapshots are already in hand.
function diffSnapshots(newer: Record<string, string>, older: Record<string, string> | undefined): { key: string; from: string; to: string }[] {
  if (!older) return []
  const changes: { key: string; from: string; to: string }[] = []
  for (const key of Object.keys(newer)) {
    if (older[key] !== undefined && older[key] !== newer[key]) {
      changes.push({ key, from: older[key], to: newer[key] })
    }
  }
  return changes
}

const GROUP_META: Record<TokenGroup, { label: string; blurb: string }> = {
  color: { label: 'Color', blurb: 'Every --afa-* color token in globals.css.' },
  font: { label: 'Font', blurb: 'Which pre-loaded font plays each typographic role.' },
  size: { label: 'Size', blurb: 'Type scale.' },
  radius: { label: 'Radius', blurb: 'Corner radius scale, consumed by the Button component.' },
  spacing: { label: 'Spacing', blurb: '8px-based spacing grid.' },
  button: { label: 'Button', blurb: 'Button padding scale (sm/md/lg), consumed by the Button component.' },
}
// GEN-2609-108 - 'spacing' is deliberately absent: GEN-2609-107 keeps
// spacing out of admin control. Its tokens stay in code and in the DB
// (and Reset still restores them); the editor just doesn't show them.
const GROUP_ORDER: TokenGroup[] = ['color', 'font', 'size', 'radius', 'button']

// GEN-2609-076 - "coverage" here means real, grepped consumer files
// (TOKEN_COVERAGE, src/lib/design-token-coverage.ts), not a guess. A
// group's own badge is the honest headline (does editing ANYTHING in
// this group ever do anything, and where), but real groups are mixed -
// "color" is mostly site-wide with 24 orphaned tokens mixed in, so
// individual fields get their own disabled/noted treatment too (see
// TokenField below) rather than the group badge alone standing in for
// per-token truth.
// Reuses statusStyle.ts's own governed STATUS_TONE palette instead of
// inventing new rgba tints - it's exempt from check-design-tokens.js's
// literal-check for exactly this reason (see that file's own header
// comment: "this is where new tone literals are supposed to live").
const COVERAGE_META: Record<CoverageStatus, { label: string; color: string; bg: string }> = {
  'site-wide': { label: 'Site-wide', ...STATUS_TONE.sage },
  'button-only': { label: 'Button only', ...STATUS_TONE.gold },
  unused: { label: 'Not yet applied', ...STATUS_TONE.error },
}

function tokenCoverage(key: string): CoverageStatus {
  return TOKEN_COVERAGE[key]?.status ?? 'unused'
}

// A group's headline status: "site-wide" if ANY token in it reaches
// beyond Button.tsx (even if others in the same group are dead),
// "button-only" if every live token in it tops out at Button.tsx,
// "unused" only when EVERY token in the group has zero consumers -
// exactly the case the ticket says to hide or disable-with-note.
function groupCoverage(tokens: DesignToken[]): CoverageStatus {
  const statuses = tokens.map((t) => tokenCoverage(t.key))
  if (statuses.every((s) => s === 'unused')) return 'unused'
  if (statuses.some((s) => s === 'site-wide')) return 'site-wide'
  return 'button-only'
}

function CoverageBadge({ status }: { status: CoverageStatus }) {
  const meta = COVERAGE_META[status]
  return (
    <span style={{ fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', borderRadius: 'var(--afa-radius-pill)', color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  )
}

export default function AdminDesignSystemPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()

  const [tokens, setTokens] = useState<DesignToken[] | null>(null)
  const [versions, setVersions] = useState<DesignTokenVersion[]>([])
  const [pending, setPending] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmingLocked, setConfirmingLocked] = useState(false)
  // GEN-2609-108 - pairs this save would take below AA, waiting on the
  // contrast confirm; `contrastConfirmed` carries that answer through
  // the locked-token confirm when a save needs both.
  const [confirmingContrast, setConfirmingContrast] = useState<ContrastFailure[] | null>(null)
  const [contrastConfirmed, setContrastConfirmed] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  // BUG-2609-059 - the version a Restore click is waiting to confirm.
  // A single accidental click used to apply site-wide immediately.
  const [confirmingRevert, setConfirmingRevert] = useState<DesignTokenVersion | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/design-tokens')
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      if (!res.ok) throw new Error('Failed to load design tokens')
      const data = await res.json()
      setTokens(data.tokens)
      setVersions(data.versions)
      setPending(new Map(data.tokens.map((t: DesignToken) => [t.key, t.value])))
    } catch {
      showToast('Could not load design tokens. Try refreshing.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!session?.user) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user])

  const tokensByGroup = useMemo(() => {
    const map = new Map<TokenGroup, DesignToken[]>()
    for (const t of tokens ?? []) {
      if (!map.has(t.group)) map.set(t.group, [])
      map.get(t.group)!.push(t)
    }
    return map
  }, [tokens])

  const dirty = useMemo(() => {
    if (!tokens) return [] as { key: string; value: string }[]
    return tokens
      .filter((t) => pending.get(t.key) !== t.value)
      .map((t) => ({ key: t.key, value: pending.get(t.key) ?? t.value }))
  }, [tokens, pending])

  const dirtyTouchesLocked = dirty.some((d) => tokens?.find((t) => t.key === d.key)?.locked)

  // GEN-2609-108 - same checks the API runs (tokenValueError per value,
  // then the radius order over the full pending set), keyed by token so
  // each field can show its own message.
  const fieldErrors = useMemo(() => {
    const errors = new Map<string, string>()
    if (!tokens) return errors
    for (const d of dirty) {
      const type = tokens.find((t) => t.key === d.key)?.type
      const message = type ? tokenValueError(d.key, type, d.value) : 'Unknown token.'
      if (message) errors.set(d.key, message)
    }
    if (errors.size === 0) {
      for (const e of radiusOrderErrors(Object.fromEntries(pending), dirty.map((d) => d.key))) errors.set(e.key, e.message)
    }
    return errors
  }, [tokens, dirty, pending])

  function setValue(key: string, value: string) {
    setPending((prev) => {
      const next = new Map(prev)
      next.set(key, value)
      return next
    })
  }

  async function doSave(confirmLocked: boolean, confirmContrast: boolean) {
    if (dirty.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/design-tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: dirty, confirmLocked, confirmContrast }),
      })
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'contrast') setConfirmingContrast(data.contrastFailures ?? [])
        else {
          setContrastConfirmed(confirmContrast)
          setConfirmingLocked(true)
        }
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Save failed')
      }
      const data = await res.json()
      setTokens(data.tokens)
      setPending(new Map(data.tokens.map((t: DesignToken) => [t.key, t.value])))
      showToast('Saved. Live on the next page load everywhere.', 'success')
      loadVersionsQuiet()
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
      setConfirmingLocked(false)
    }
  }

  // Values as saved vs. with every pending edit applied - the two sides
  // of the contrast comparison, same as the API computes them.
  const savedValues = useMemo(() => Object.fromEntries((tokens ?? []).map((t) => [t.key, t.value])), [tokens])
  const pendingValues = useMemo(() => Object.fromEntries(pending), [pending])

  function continueAfterContrast(confirmContrast: boolean) {
    setConfirmingContrast(null)
    if (dirtyTouchesLocked) {
      setContrastConfirmed(confirmContrast)
      setConfirmingLocked(true)
      return
    }
    doSave(false, confirmContrast)
  }

  async function loadVersionsQuiet() {
    try {
      const res = await fetch('/api/admin/design-tokens')
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions)
      }
    } catch {
      // best-effort only — the main save already succeeded
    }
  }

  async function handleSave() {
    if (dirty.length === 0) return
    const [firstError] = fieldErrors.entries()
    if (firstError) {
      showToast(`${firstError[0]}: ${firstError[1]}`, 'error')
      return
    }
    const failures = contrastFailures(savedValues, pendingValues)
    if (failures.length > 0) {
      setConfirmingContrast(failures)
      return
    }
    continueAfterContrast(false)
  }

  async function handleReset() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/design-tokens/reset', { method: 'POST' })
      if (!res.ok) throw new Error('Reset failed')
      const data = await res.json()
      setTokens(data.tokens)
      setPending(new Map(data.tokens.map((t: DesignToken) => [t.key, t.value])))
      showToast('Reset to defaults.', 'success')
      loadVersionsQuiet()
    } catch {
      showToast('Reset failed.', 'error')
    } finally {
      setSaving(false)
      setConfirmingReset(false)
    }
  }

  // GEN-2609-108 - clears the site's token cache without saving, for DB
  // changes made outside this editor.
  async function handleRefreshCache() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/design-tokens/revalidate', { method: 'POST' })
      if (!res.ok) throw new Error('Refresh failed')
      showToast('Site cache cleared. The next page load uses the current database values.', 'success')
    } catch {
      showToast('Could not refresh the site cache.', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRevert(versionId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/design-tokens/versions/${versionId}/revert`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Revert failed.')
      }
      const data = await res.json()
      setTokens(data.tokens)
      setPending(new Map(data.tokens.map((t: DesignToken) => [t.key, t.value])))
      const skipped = data.skipped?.length ?? 0
      showToast(`Restored ${data.changed} token(s).${skipped ? ` ${skipped} out-of-range value(s) left as they are.` : ''}`, 'success')
      loadVersionsQuiet()
    } catch (err: any) {
      showToast(err.message || 'Revert failed.', 'error')
    } finally {
      setSaving(false)
      setConfirmingRevert(null)
    }
  }

  // Every dirty token, exposed as inline CSS custom properties on the
  // preview panel's wrapper — real Button instances rendered inside it
  // pick these up via normal CSS var inheritance, giving a true live
  // preview of UNSAVED edits with no global side effect. Only dirty
  // keys are set (not every token) so saved values still come from the
  // page's own inherited (globals.css / runtime-injected) styles.
  const previewStyle = useMemo(() => {
    const style: Record<string, string> = {}
    for (const [key, value] of pending.entries()) {
      const original = tokens?.find((t) => t.key === key)?.value
      if (original !== undefined && value !== original) style[key] = value
    }
    return style as React.CSSProperties
  }, [pending, tokens])

  if (status === 'loading' || loading) {
    return <BrandLoader />
  }

  if (forbidden) {
    return (
      <>
        <SiteNav />
        <DashboardShell>
          <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', padding: '48px 24px', fontFamily: 'var(--font-sans)' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title)', fontWeight: 700, marginBottom: 12, color: 'var(--afa-text-primary)' }}>
                Admins only
              </h1>
              <p style={{ opacity: 0.7, color: 'var(--afa-text-primary)' }}>This page is only visible to platform admins.</p>
              <Link href="/" style={{ color: 'var(--afa-amber)', fontWeight: 600 }}>
                ← Home
              </Link>
            </div>
          </main>
        </DashboardShell>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <DashboardShell>
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', padding: '32px 24px 120px', fontFamily: 'var(--font-sans)' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 4 }}>
                  Design System
                </h1>
                <p style={{ color: 'var(--afa-text-secondary)', fontSize: 'var(--afa-text-body)' }}>
                  Edit here, save, and it's live on the next page load — everywhere, no deploy.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  variant="outline-neutral"
                  size="md"
                  fullWidth={false}
                  onClick={() => setShowHistory((v) => !v)}
                >
                  {showHistory ? 'Hide' : 'Show'} version history
                </Button>
                <Button
                  variant="outline-neutral"
                  size="md"
                  fullWidth={false}
                  onClick={handleRefreshCache}
                  disabled={refreshing}
                  title="Re-read tokens from the database now. Use after changes made outside this editor; otherwise the site picks them up within 5 minutes."
                >
                  {refreshing ? 'Refreshing…' : 'Refresh site cache'}
                </Button>
                <Button variant="outline-neutral" size="md" fullWidth={false} onClick={() => setConfirmingReset(true)} disabled={saving}>
                  Reset to defaults
                </Button>
                <Button
                  variant="solid"
                  size="md"
                  fullWidth={false}
                  onClick={handleSave}
                  disabled={saving || dirty.length === 0}
                  // No-pending-changes state stays its own distinct grey
                  // (not just dimmed orange) - `solid`'s own disabled
                  // handling (Button.tsx) only lowers opacity, so this
                  // overrides background/color explicitly to keep that
                  // real, meaningful color difference (nothing to save,
                  // vs. saving is in flight).
                  style={dirty.length === 0 ? { background: 'var(--afa-tint-08)', color: 'var(--afa-text-secondary)' } : undefined}
                >
                  {saving ? 'Saving…' : dirty.length ? `Save ${dirty.length} change${dirty.length > 1 ? 's' : ''}` : 'Saved'}
                </Button>
              </div>
            </div>

            {showHistory && (
              <div style={panelStyle}>
                <h2 style={sectionTitleStyle}>Version history</h2>
                {versions.length === 0 ? (
                  <p style={{ color: 'var(--afa-text-secondary)', fontSize: 'var(--afa-text-ui)' }}>No versions yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {versions.map((v, i) => {
                      // versions is newest-first, so index i+1 is the
                      // version immediately BEFORE this one in time -
                      // diffing against it shows what THIS save changed.
                      const changedByThisSave = diffSnapshots(v.snapshot, versions[i + 1]?.snapshot)
                      // What reverting TO this version would actually
                      // change, compared to the CURRENTLY LIVE token
                      // values (not this list's snapshots) - the real
                      // answer to "what does this button do right now."
                      // GEN-2609-108 - planRestore is what the API runs, so
                      // this count is exactly what the restore will write.
                      const wouldRestore = planRestore(v.snapshot, tokens ?? []).changes.length
                      return (
                        <li key={v.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--afa-border-resting)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div>
                              <div style={{ color: 'var(--afa-text-primary)', fontSize: 'var(--afa-text-ui)', fontWeight: 600 }}>{v.note || 'Update'}</div>
                              <div style={{ color: 'var(--afa-text-muted)', fontSize: 'var(--afa-text-small)' }}>
                                {new Date(v.createdAt).toLocaleString()}
                                {v.creatorLabel && <> · by {v.creatorLabel}</>}
                              </div>
                            </div>
                            <Button
                              variant="outline-neutral"
                              size="sm"
                              fullWidth={false}
                              onClick={() => setConfirmingRevert(v)}
                              disabled={saving || wouldRestore === 0}
                              title={wouldRestore === 0 ? 'Already matches the current live values' : `Would change ${wouldRestore} token(s) back to this version's values`}
                              style={{ flexShrink: 0 }}
                            >
                              {wouldRestore === 0 ? 'Already current' : `Restore this version (${wouldRestore})`}
                            </Button>
                          </div>
                          {changedByThisSave.length > 0 && (
                            <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {changedByThisSave.map((c) => (
                                <li key={c.key} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-muted)' }}>
                                  {c.key}: <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{c.from}</span> → <span style={{ color: 'var(--afa-text-secondary)' }}>{c.to}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            <div style={{ ...panelStyle, marginBottom: 24 }}>
              <h2 style={sectionTitleStyle}>Live preview</h2>
              <p style={{ color: 'var(--afa-text-secondary)', fontSize: 'var(--afa-text-ui)', marginBottom: 16 }}>
                Reflects unsaved edits below: the real Button component, then a sample card. Nothing outside this box changes until you save.
              </p>
              <div style={{ ...previewStyle, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: 20, background: 'var(--afa-surface-page)' }}>
                <Button variant="primary" fullWidth={false} size={36}>Primary</Button>
                {/* GEN-2609-076 - `outline`'s text/border color is
                    --afa-on-fill-solid (near-black by design), meant to
                    read against a --afa-fill-solid background it sits
                    on top of (see Button.tsx's own GEN-2609-047
                    comment) - rendering it directly on this panel's
                    --afa-surface-page (near-black too) made it
                    functionally invisible. Its own small fill-solid
                    wrapper previews it in the context it's actually
                    used in, e.g. NotificationOptIn.tsx's banner. */}
                <div style={{ ...previewStyle, background: 'var(--afa-fill-solid)', padding: '10px 14px' }}>
                  <Button variant="outline" fullWidth={false} size={36}>Outline</Button>
                </div>
                <Button variant="form-submit" fullWidth={false} size={36}>Form submit</Button>
                <Button variant="outline-neutral" fullWidth={false} size="sm">Outline neutral</Button>
                <Button variant="solid" fullWidth={false} size="md">Solid</Button>
                <Button variant="outline-error" fullWidth={false} size="md">Outline error</Button>
                <Button variant="toggle-pill" fullWidth={false} size="pill-sm">Toggle pill</Button>
                <Button variant="toggle-pill" fullWidth={false} size="pill-sm" selected>Toggle pill (selected)</Button>
                <Button variant="secondary" fullWidth={false} size={36}>Secondary</Button>
                <Button variant="secondary-reveal" fullWidth={false} size={36}>See more →</Button>
                <Button variant="close" fullWidth={false} size={36}>✕</Button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" fullWidth={false} size="sm">Sm</Button>
                  <Button variant="primary" fullWidth={false} size="md">Md</Button>
                  <Button variant="primary" fullWidth={false} size="lg">Lg</Button>
                </div>
                <PreviewCard />
              </div>
            </div>

            {CONTRAST_PAIRS.length > 0 && (
              <div style={{ ...panelStyle, marginBottom: 24 }}>
                <h2 style={sectionTitleStyle}>Contrast check (WCAG)</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CONTRAST_PAIRS.map((pair) => {
                    const ratio = pairRatio(pair, pendingValues)
                    const min = contrastMinimum(pair)
                    const pass = ratio !== null && ratio >= min
                    return (
                      <li key={pair.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)' }}>
                        <span>{pair.label}</span>
                        {ratio === null ? (
                          <span style={{ color: 'var(--afa-text-muted)' }}>—</span>
                        ) : (
                          <span style={{ color: pass ? 'var(--afa-sage-bright)' : 'var(--afa-error-bright)', fontWeight: 700 }}>
                            {ratio.toFixed(2)}:1 {pass ? '✓ AA' : `⚠ below AA (${min}:1)`}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* GEN-2609-108 - filters every group by label, raw key or "used for". */}
            <div style={{ ...panelStyle, marginBottom: 'var(--afa-space-6)', display: 'flex', alignItems: 'center', gap: 'var(--afa-space-3)' }}>
              <label htmlFor="token-search" style={{ color: 'var(--afa-text-secondary)', fontSize: 'var(--afa-text-ui)', flexShrink: 0 }}>
                Find a token
              </label>
              <input
                id="token-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. muted, border, --afa-radius-md, timestamps"
                style={inputStyle}
              />
            </div>

            {GROUP_ORDER.map((group) => {
              const allGroupTokens = tokensByGroup.get(group) ?? []
              if (allGroupTokens.length === 0) return null
              const groupTokens = allGroupTokens.filter((t) => tokenMatches(t.key, query))
              if (groupTokens.length === 0) return null
              const coverage = groupCoverage(allGroupTokens)
              const groupDisabled = coverage === 'unused'
              // GEN-2609-077 - "applies to: <groups>" derived live from
              // the same consumerFiles the coverage badge itself uses
              // (src/lib/design-token-coverage.ts), not a hand-maintained
              // string that could drift out of date as later phases land.
              const groupAppliesTo = groupDisabled
                ? []
                : appliesTo(allGroupTokens.flatMap((t) => TOKEN_COVERAGE[t.key]?.consumerFiles ?? []))
              const renderGrid = (list: DesignToken[]) => (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--afa-space-14px)' }}>
                  {list.map((token) => (
                    <TokenField
                      key={token.key}
                      token={token}
                      value={pending.get(token.key) ?? token.value}
                      onChange={(v) => setValue(token.key, v)}
                      disabled={groupDisabled || tokenCoverage(token.key) === 'unused'}
                      coverage={tokenCoverage(token.key)}
                      error={fieldErrors.get(token.key) ?? null}
                    />
                  ))}
                </div>
              )
              return (
                <div key={group} style={{ ...panelStyle, marginBottom: 'var(--afa-space-6)', opacity: groupDisabled ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-10px)', marginBottom: 'var(--afa-space-1)' }}>
                    <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>{GROUP_META[group].label}</h2>
                    <CoverageBadge status={coverage} />
                  </div>
                  <p style={{ color: 'var(--afa-text-secondary)', fontSize: 'var(--afa-text-ui)', marginBottom: 'var(--afa-space-4)' }}>
                    {GROUP_META[group].blurb}
                    {groupAppliesTo.length > 0 && <> Applies to: {groupAppliesTo.join(', ')}.</>}
                  </p>
                  {groupDisabled && (
                    <p style={{ color: 'var(--afa-error-bright)', fontSize: 'var(--afa-text-ui)', fontWeight: 600, marginBottom: 'var(--afa-space-4)', padding: 'var(--afa-space-2) var(--afa-space-3)', background: STATUS_TONE.error.bg, border: '1px solid var(--afa-error)' }}>
                      Not consumed anywhere in the app right now (checked via a real grep of every var(--…) usage, not assumed). Editing these has no visible effect until a future ticket adopts them — disabled here so that isn't a trap.
                    </p>
                  )}
                  {group === 'color'
                    ? COLOR_SECTIONS.map((section) => {
                        const list = groupTokens.filter((t) => tokenMeta(t.key).section === section.id)
                        if (list.length === 0) return null
                        return (
                          <section key={section.id} style={{ marginBottom: 'var(--afa-space-6)' }}>
                            <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--afa-text-body)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-3)', paddingBottom: 'var(--afa-space-6px)', borderBottom: '1px solid var(--afa-border-resting)' }}>
                              {section.label}
                            </h3>
                            {renderGrid(list)}
                          </section>
                        )
                      })
                    : renderGrid(groupTokens)}
                </div>
              )
            })}
            {query && GROUP_ORDER.every((g) => !(tokensByGroup.get(g) ?? []).some((t) => tokenMatches(t.key, query))) && (
              <p style={{ color: 'var(--afa-text-muted)', fontSize: 'var(--afa-text-ui)' }}>No token matches “{query}”.</p>
            )}
          </div>
        </main>

        {confirmingLocked && (
          <ConfirmDialog
            title="Editing locked brand tokens"
            body="This change touches one or more of the 5 core brand tokens (surfaces, amber accent, or the primary CTA fill/text pair). These define the site's identity everywhere — are you sure?"
            confirmLabel={saving ? 'Saving…' : 'Yes, save anyway'}
            onConfirm={() => doSave(true, contrastConfirmed)}
            onCancel={() => setConfirmingLocked(false)}
          />
        )}
        {confirmingContrast && (
          <ConfirmDialog
            title="This lowers text contrast"
            body={<ContrastFailureList failures={confirmingContrast} />}
            confirmLabel={saving ? 'Saving…' : 'Save anyway'}
            onConfirm={() => continueAfterContrast(true)}
            onCancel={() => setConfirmingContrast(null)}
          />
        )}
        {confirmingReset && (
          <ConfirmDialog
            title="Reset all tokens to defaults"
            body="This restores every color/font/size/radius/spacing/button token to its globals.css default, including the 5 locked ones. This is recorded as a new version, so it can be reverted."
            confirmLabel={saving ? 'Resetting…' : 'Yes, reset everything'}
            onConfirm={handleReset}
            onCancel={() => setConfirmingReset(false)}
          />
        )}
        {confirmingRevert && (
          <ConfirmDialog
            title="Restore this version?"
            body={<RestorePreview plan={planRestore(confirmingRevert.snapshot, tokens ?? [])} />}
            confirmLabel={saving ? 'Restoring…' : 'Yes, restore'}
            onConfirm={() => handleRevert(confirmingRevert.id)}
            onCancel={() => setConfirmingRevert(null)}
          />
        )}
      </DashboardShell>
    </>
  )
}

function TokenField({
  token,
  value,
  onChange,
  disabled,
  coverage,
  error,
}: {
  token: DesignToken
  value: string
  onChange: (v: string) => void
  disabled: boolean
  coverage: CoverageStatus
  error: string | null
}) {
  const invalid = error !== null
  const meta = tokenMeta(token.key)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.55 : 1 }}>
      <label style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--afa-space-6px)', flexWrap: 'wrap' }}>
        {meta.label}
        {token.locked && (
          <span title="Locked — editable only with confirmation" style={{ color: 'var(--afa-amber)' }}>
            🔒
          </span>
        )}
        {coverage === 'unused' && (
          <span title="No consumers found anywhere in src/ — editing this has no visible effect" style={{ color: 'var(--afa-error-bright)', fontSize: 'var(--afa-text-caption)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            unused
          </span>
        )}
        {coverage === 'button-only' && (
          <span title="Only Button.tsx reads this token" style={{ color: 'var(--afa-amber)', fontSize: 'var(--afa-text-caption)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Button only
          </span>
        )}
      </label>
      {meta.usedFor && <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)', marginTop: 'calc(-1 * var(--afa-space-1))' }}>{meta.usedFor}</span>}
      <span style={{ fontSize: 'var(--afa-text-caption)', fontFamily: 'var(--font-mono)', color: 'var(--afa-text-muted)', marginTop: 'calc(-1 * var(--afa-space-1))' }}>{token.key}</span>

      {token.type === 'color' && <ColorInput value={value} onChange={onChange} disabled={disabled} invalid={invalid} />}

      {token.type === 'font-family' && (
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, cursor: disabled ? 'not-allowed' : 'pointer' }}>
          {FONT_ALLOWLIST.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      )}

      {token.type === 'dimension' && (
        <PxInput
          tokenKey={token.key}
          value={value}
          onChange={onChange}
          disabled={disabled}
          invalid={invalid}
          withSlider={token.group === 'radius' || token.group === 'size'}
        />
      )}

      {token.type === 'dimension-shorthand' && (
        <ShorthandInput tokenKey={token.key} value={value} onChange={onChange} disabled={disabled} invalid={invalid} />
      )}

      {error && (
        <span role="alert" style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-error-bright)' }}>
          {error}
        </span>
      )}

    </div>
  )
}

// GEN-2609-108 - a sample card for the live preview, so unsaved edits
// show on more than buttons. Rendered inside the previewStyle wrapper,
// so it reads every token through normal var() inheritance: pending
// values here, saved values everywhere else on the page.
const PREVIEW_TONES: { tone: keyof typeof STATUS_TONE; label: string }[] = [
  { tone: 'sage', label: 'Confirmed' },
  { tone: 'gold', label: 'Pending' },
  { tone: 'error', label: 'Cancelled' },
  { tone: 'muted', label: 'Draft' },
  { tone: 'orange', label: 'Declined' },
]

function PreviewCard() {
  return (
    <div
      style={{
        flexBasis: '100%',
        background: 'var(--afa-surface-raised)',
        border: '1px solid var(--afa-border-resting)',
        borderRadius: 'var(--afa-radius-lg)',
        padding: 'var(--afa-space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--afa-space-3)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--afa-amber)' }}>
        Sample card
      </span>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-heading)', color: 'var(--afa-text-primary)', margin: 0 }}>Friday night open mic</h3>
      <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', margin: 0 }}>
        Body text: ten performers, one room, and a crowd that listens.
      </p>
      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', margin: 0 }}>Secondary text: The Blue Door, Bandra West</p>
      <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', margin: 0 }}>Muted text: updated 2 hours ago</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
        {PREVIEW_TONES.map(({ tone, label }) => (
          <span
            key={tone}
            style={{
              fontSize: 'var(--afa-text-micro)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: 'var(--afa-space-1) var(--afa-space-10px)',
              borderRadius: 'var(--afa-radius-pill)',
              color: STATUS_TONE[tone].color,
              background: STATUS_TONE[tone].bg,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <input
        type="text"
        readOnly
        aria-label="Sample input"
        value="Sample input"
        style={{
          fontSize: 'var(--afa-text-ui)',
          padding: 'var(--afa-space-2) var(--afa-space-3)',
          background: 'var(--afa-surface-page)',
          color: 'var(--afa-text-primary)',
          border: '1px solid var(--afa-tint-12)',
          borderRadius: 'var(--afa-radius-md)',
        }}
      />
      <div style={{ padding: 'var(--afa-space-3)', background: 'var(--afa-amber-wash)', border: '1px solid var(--afa-amber-border)', borderRadius: 'var(--afa-radius-md)', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-soft)' }}>
        Tinted border: amber wash with an amber border.
      </div>
      <div style={{ padding: 'var(--afa-space-3)', background: 'var(--afa-error-tint)', border: '1px solid var(--afa-error-edge)', borderRadius: 'var(--afa-radius-md)', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-error-bright)' }}>
        Error notice: tint, border and text.
      </div>
    </div>
  )
}

// GEN-2609-108 - type-aware inputs. Each keeps a raw text/number field
// so any value the validator accepts can still be typed directly.

// Hex: native picker + text (as before). rgba(): base-colour picker +
// alpha slider, composed back into the DB's spaced rgba() form. var()
// and short hex forms: swatch + text only.
function ColorInput({ value, onChange, disabled, invalid }: { value: string; onChange: (v: string) => void; disabled: boolean; invalid: boolean }) {
  const isSimpleHex = /^#[0-9a-fA-F]{6}$/.test(value)
  const rgba = /^rgba?\(/.test(value) ? parseCssColor(value) : null
  const cursor = disabled ? 'not-allowed' : 'pointer'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-6px)' }}>
      <div style={{ display: 'flex', gap: 'var(--afa-space-6px)', alignItems: 'center' }}>
        {isSimpleHex ? (
          <input type="color" aria-label="Pick colour" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ ...swatchStyle, padding: 0, border: 'none', background: 'none', cursor }} />
        ) : rgba ? (
          <input
            type="color"
            aria-label="Pick base colour"
            value={rgbToHex(rgba)}
            disabled={disabled}
            onChange={(e) => {
              const base = parseCssColor(e.target.value)
              if (base) onChange(composeRgba(base[0], base[1], base[2], rgba[3]))
            }}
            style={{ ...swatchStyle, padding: 0, border: 'none', background: 'none', cursor }}
          />
        ) : (
          <div style={{ ...swatchStyle, flexShrink: 0, background: value, border: '1px solid var(--afa-border-resting)' }} />
        )}
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, borderColor: invalid ? 'var(--afa-error)' : 'var(--afa-border-resting)', cursor: disabled ? 'not-allowed' : 'text' }}
        />
      </div>
      {rgba && (
        <div style={{ display: 'flex', gap: 'var(--afa-space-2)', alignItems: 'center' }}>
          {/* The picker above shows the base hue at full strength; this
              swatch shows the real translucent value over the page. */}
          <div style={{ ...swatchStyle, flexShrink: 0, background: `linear-gradient(${value}, ${value}), var(--afa-surface-page)`, border: '1px solid var(--afa-border-resting)' }} />
          <input
            type="range"
            aria-label="Opacity"
            min={0}
            max={1}
            step={0.01}
            value={rgba[3]}
            disabled={disabled}
            onChange={(e) => onChange(composeRgba(rgba[0], rgba[1], rgba[2], Number(e.target.value)))}
            style={{ flex: 1, minWidth: 0, accentColor: 'var(--afa-amber)', cursor }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)', minWidth: '4ch', textAlign: 'right' }}>{formatAlpha(rgba[3])}</span>
        </div>
      )}
    </div>
  )
}

// One px dimension: number input with min/max from the range table and
// the unit shown; optional slider (radius and font size).
function PxInput({ tokenKey, value, onChange, disabled, invalid, withSlider }: { tokenKey: string; value: string; onChange: (v: string) => void; disabled: boolean; invalid: boolean; withSlider: boolean }) {
  const range = rangeFor(tokenKey)
  const raw = value.replace(/px$/, '')
  const px = parsePx(value)
  // The pill range runs to 9999px; the slider stops at 999 so it stays
  // usable. The number field still takes anything in range.
  const sliderMax = range ? Math.min(range.max, 999) : 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-6px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-6px)' }}>
        <input
          type="number"
          inputMode="decimal"
          value={raw}
          min={range?.min}
          max={range?.max}
          step="any"
          disabled={disabled}
          onChange={(e) => onChange(`${e.target.value}px`)}
          style={{ ...inputStyle, borderColor: invalid ? 'var(--afa-error)' : 'var(--afa-border-resting)', cursor: disabled ? 'not-allowed' : 'text' }}
        />
        <span style={{ color: 'var(--afa-text-muted)', fontSize: 'var(--afa-text-small)' }}>px</span>
      </div>
      {withSlider && range && (
        <input
          type="range"
          aria-label="Adjust"
          min={range.min}
          max={sliderMax}
          step={1}
          value={px === null ? range.min : Math.min(Math.max(px, range.min), sliderMax)}
          disabled={disabled}
          onChange={(e) => onChange(`${e.target.value}px`)}
          style={{ width: '100%', accentColor: 'var(--afa-amber)', cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
      )}
      {range && (
        <span style={{ fontSize: 'var(--afa-text-caption)', color: 'var(--afa-text-muted)' }}>
          {range.min}–{range.max}px
        </span>
      )}
    </div>
  )
}

// Button padding: one px field per part (top/bottom and left/right for
// the two-part values every padding token uses).
function ShorthandInput({ tokenKey, value, onChange, disabled, invalid }: { tokenKey: string; value: string; onChange: (v: string) => void; disabled: boolean; invalid: boolean }) {
  const range = rangeFor(tokenKey)
  const parts = value.trim().split(/\s+/)
  const names = parts.length === 2 ? ['Top/bottom', 'Left/right'] : parts.map((_, i) => `Part ${i + 1}`)
  return (
    <div style={{ display: 'flex', gap: 'var(--afa-space-2)' }}>
      {parts.map((part, i) => (
        <label key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2px)', fontSize: 'var(--afa-text-caption)', color: 'var(--afa-text-muted)' }}>
          {names[i]}
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-1)' }}>
            <input
              type="number"
              inputMode="decimal"
              value={part.replace(/px$/, '')}
              min={range?.min}
              max={range?.max}
              step="any"
              disabled={disabled}
              onChange={(e) => onChange(parts.map((p, j) => (j === i ? `${e.target.value}px` : p)).join(' '))}
              style={{ ...inputStyle, borderColor: invalid ? 'var(--afa-error)' : 'var(--afa-border-resting)', cursor: disabled ? 'not-allowed' : 'text' }}
            />
            <span style={{ fontSize: 'var(--afa-text-small)' }}>px</span>
          </span>
        </label>
      ))}
    </div>
  )
}

// BUG-2609-059 - what a Restore would change, as `token: current → will
// become`, capped at 10 rows so a large snapshot can't push the dialog's
// buttons off-screen.
const RESTORE_PREVIEW_MAX = 10
function RestorePreview({ plan }: { plan: RestorePlan }) {
  const { changes, skipped, newerKeys } = plan
  const shown = changes.slice(0, RESTORE_PREVIEW_MAX)
  return (
    <>
      <p style={{ marginBottom: 'var(--afa-space-10px)' }}>
        This changes {changes.length} token{changes.length === 1 ? '' : 's'} site-wide, immediately. It is recorded as a new version, so it can be undone.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-1)' }}>
        {shown.map((c) => (
          <li key={c.key} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', overflowWrap: 'anywhere' }}>
            {c.key}: {c.from} → {c.to}
          </li>
        ))}
      </ul>
      {changes.length > shown.length && (
        <p style={{ marginTop: 'var(--afa-space-6px)', fontSize: 'var(--afa-text-small)' }}>+{changes.length - shown.length} more</p>
      )}
      {/* GEN-2609-108 / BUG-2609-061 - what the restore leaves alone. */}
      {newerKeys.length > 0 && (
        <p style={{ marginTop: 'var(--afa-space-10px)', fontSize: 'var(--afa-text-small)' }}>
          {newerKeys.length} newer token{newerKeys.length === 1 ? ' is' : 's are'} not in this version and stay{newerKeys.length === 1 ? 's' : ''} as {newerKeys.length === 1 ? 'it is' : 'they are'}.
        </p>
      )}
      {skipped.length > 0 && (
        <p style={{ marginTop: 'var(--afa-space-6px)', fontSize: 'var(--afa-text-small)' }}>
          {skipped.length} value{skipped.length === 1 ? '' : 's'} in this version {skipped.length === 1 ? 'is' : 'are'} outside today&apos;s limits and stay{skipped.length === 1 ? 's' : ''} as {skipped.length === 1 ? 'it is' : 'they are'}: {skipped.map((k) => `${k.key} ${k.value}`).join(', ')}.
        </p>
      )}
    </>
  )
}

// GEN-2609-108 - each pair this save takes below AA, before → after.
function ContrastFailureList({ failures }: { failures: ContrastFailure[] }) {
  return (
    <>
      <p style={{ marginBottom: 'var(--afa-space-10px)' }}>
        {failures.length === 1 ? 'This pair drops' : `These ${failures.length} pairs drop`} below the WCAG AA minimum. Text using them gets harder to read site-wide.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-1)' }}>
        {failures.map((f) => (
          <li key={f.label} style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)' }}>
            {f.label}: {f.before === null ? '—' : `${f.before.toFixed(2)}:1`} → <span style={{ color: 'var(--afa-error-bright)', fontWeight: 700 }}>{f.after.toFixed(2)}:1</span>
            <span style={{ color: 'var(--afa-text-muted)' }}> (needs {f.min}:1)</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: { title: string; body: React.ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--afa-scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'var(--afa-surface-raised)', border: '1px solid var(--afa-border-resting)', padding: 24, maxWidth: 440, width: '100%' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', color: 'var(--afa-text-primary)', marginBottom: 10 }}>{title}</h3>
        {/* div, not p: body may be a ReactNode with block content (RestorePreview's list) */}
        <div style={{ color: 'var(--afa-text-secondary)', fontSize: 'var(--afa-text-body)', marginBottom: 20 }}>{body}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="outline-neutral" size="md" fullWidth={false} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="solid" size="md" fullWidth={false} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  background: 'var(--afa-surface-page)',
  border: '1px solid var(--afa-border-resting)',
  padding: 20,
}
const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--afa-text-lead)',
  color: 'var(--afa-text-primary)',
  marginBottom: 4,
}
const swatchStyle: React.CSSProperties = { width: 'var(--afa-space-32px)', height: 'var(--afa-space-32px)' }
const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '6px 10px',
  fontSize: 'var(--afa-text-ui)',
  background: 'var(--afa-surface-raised)',
  color: 'var(--afa-text-primary)',
  border: '1px solid var(--afa-border-resting)',
}
