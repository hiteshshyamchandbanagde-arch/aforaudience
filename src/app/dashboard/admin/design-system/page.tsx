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
import { contrastRatio, isValidTokenValue, FONT_ALLOWLIST, type TokenGroup, type TokenType } from '@/lib/design-tokens'

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
  createdAt: string
  note: string | null
}

const GROUP_META: Record<TokenGroup, { label: string; blurb: string }> = {
  color: { label: 'Color', blurb: 'Every --afa-* color token in globals.css.' },
  font: { label: 'Font', blurb: 'Which pre-loaded font plays each typographic role.' },
  size: { label: 'Size', blurb: 'Type scale — text sizes used across the app.' },
  radius: { label: 'Radius', blurb: 'Corner radius scale, consumed by the Button component.' },
  spacing: { label: 'Spacing', blurb: '8px-based spacing grid.' },
  button: { label: 'Button', blurb: 'Button padding scale (sm/md/lg), consumed by the Button component.' },
}
const GROUP_ORDER: TokenGroup[] = ['color', 'font', 'size', 'radius', 'spacing', 'button']

const FONT_ROLE_LABEL: Record<string, string> = {
  '--font-display': 'Display (headlines)',
  '--font-ui': 'UI (buttons, tabs, chrome)',
  '--font-sans': 'Sans (body copy)',
  '--font-mono': 'Mono (eyebrows, prices, labels)',
}

// Resolves one level of var(--afa-x) indirection — the only token that
// needs it today is --afa-on-fill-solid (var(--afa-brown-black)) — so
// contrast pairs below can be checked against pending, unsaved edits,
// not just whatever's already saved.
function resolveValue(key: string, pending: Map<string, string>): string {
  const raw = pending.get(key) ?? ''
  const ref = raw.match(/^var\((--afa-[a-z0-9-]+)\)$/)
  if (ref) return pending.get(ref[1]) ?? raw
  return raw
}

const CONTRAST_PAIRS: { fg: string; bg: string; label: string }[] = [
  { fg: '--afa-text-primary', bg: '--afa-surface-page', label: 'Primary text on page background' },
  { fg: '--afa-text-secondary', bg: '--afa-surface-page', label: 'Secondary text on page background' },
  { fg: '--afa-on-fill-solid', bg: '--afa-fill-solid', label: 'Button text on Primary button fill' },
  { fg: '--afa-cream', bg: '--afa-surface-raised', label: 'Cream text on raised surface' },
  { fg: '--afa-amber', bg: '--afa-surface-page', label: 'Amber accent on page background' },
]

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
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

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

  function setValue(key: string, value: string) {
    setPending((prev) => {
      const next = new Map(prev)
      next.set(key, value)
      return next
    })
  }

  async function doSave(confirmLocked: boolean) {
    if (dirty.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/design-tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: dirty, confirmLocked }),
      })
      if (res.status === 409) {
        setConfirmingLocked(true)
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
    const invalid = dirty.find((d) => {
      const type = tokens?.find((t) => t.key === d.key)?.type
      return !type || !isValidTokenValue(type, d.value)
    })
    if (invalid) {
      showToast(`"${invalid.key}" has an invalid value for its type.`, 'error')
      return
    }
    if (dirtyTouchesLocked) {
      setConfirmingLocked(true)
      return
    }
    doSave(false)
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

  async function handleRevert(versionId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/design-tokens/versions/${versionId}/revert`, { method: 'POST' })
      if (!res.ok) throw new Error('Revert failed')
      const data = await res.json()
      setTokens(data.tokens)
      setPending(new Map(data.tokens.map((t: DesignToken) => [t.key, t.value])))
      showToast('Reverted.', 'success')
      loadVersionsQuiet()
    } catch {
      showToast('Revert failed.', 'error')
    } finally {
      setSaving(false)
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
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 12, color: 'var(--afa-text-primary)' }}>
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
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 4 }}>
                  Design System
                </h1>
                <p style={{ color: 'var(--afa-text-secondary)', fontSize: 14 }}>
                  Edit here, save, and it's live on the next page load — everywhere, no deploy.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  style={secondaryBtnStyle}
                >
                  {showHistory ? 'Hide' : 'Show'} version history
                </button>
                <button onClick={() => setConfirmingReset(true)} disabled={saving} style={secondaryBtnStyle}>
                  Reset to defaults
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || dirty.length === 0}
                  style={{
                    ...secondaryBtnStyle,
                    background: dirty.length ? 'var(--afa-fill-solid)' : 'rgba(245,245,240,0.08)',
                    color: dirty.length ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-secondary)',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  {saving ? 'Saving…' : dirty.length ? `Save ${dirty.length} change${dirty.length > 1 ? 's' : ''}` : 'Saved'}
                </button>
              </div>
            </div>

            {showHistory && (
              <div style={panelStyle}>
                <h2 style={sectionTitleStyle}>Version history</h2>
                {versions.length === 0 ? (
                  <p style={{ color: 'var(--afa-text-secondary)', fontSize: 13 }}>No versions yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {versions.map((v) => (
                      <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--afa-border-resting)' }}>
                        <div>
                          <div style={{ color: 'var(--afa-text-primary)', fontSize: 13, fontWeight: 600 }}>{v.note || 'Update'}</div>
                          <div style={{ color: 'var(--afa-text-muted)', fontSize: 12 }}>{new Date(v.createdAt).toLocaleString()}</div>
                        </div>
                        <button onClick={() => handleRevert(v.id)} disabled={saving} style={{ ...secondaryBtnStyle, padding: '6px 12px', fontSize: 12 }}>
                          Revert to this
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{ ...panelStyle, marginBottom: 24 }}>
              <h2 style={sectionTitleStyle}>Live preview</h2>
              <p style={{ color: 'var(--afa-text-secondary)', fontSize: 13, marginBottom: 16 }}>
                Reflects unsaved edits below, using the real Button component.
              </p>
              <div style={{ ...previewStyle, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: 20, background: 'var(--afa-surface-page)' }}>
                <Button variant="primary" fullWidth={false} size={36}>Primary</Button>
                <Button variant="outline" fullWidth={false} size={36}>Outline</Button>
                <Button variant="form-submit" fullWidth={false} size={36}>Form submit</Button>
                <Button variant="outline-neutral" fullWidth={false} size="sm">Outline neutral</Button>
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
              </div>
            </div>

            {CONTRAST_PAIRS.length > 0 && (
              <div style={{ ...panelStyle, marginBottom: 24 }}>
                <h2 style={sectionTitleStyle}>Contrast check (WCAG)</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CONTRAST_PAIRS.map((pair) => {
                    const fg = resolveValue(pair.fg, pending)
                    const bg = resolveValue(pair.bg, pending)
                    const ratio = contrastRatio(fg, bg)
                    const pass = ratio !== null && ratio >= 4.5
                    return (
                      <li key={pair.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--afa-text-secondary)' }}>
                        <span>{pair.label}</span>
                        {ratio === null ? (
                          <span style={{ color: 'var(--afa-text-muted)' }}>—</span>
                        ) : (
                          <span style={{ color: pass ? 'var(--afa-sage-bright)' : 'var(--afa-error-bright)', fontWeight: 700 }}>
                            {ratio.toFixed(2)}:1 {pass ? '✓ AA' : '⚠ below AA (4.5:1)'}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {GROUP_ORDER.map((group) => {
              const groupTokens = tokensByGroup.get(group) ?? []
              if (groupTokens.length === 0) return null
              return (
                <div key={group} style={{ ...panelStyle, marginBottom: 24 }}>
                  <h2 style={sectionTitleStyle}>{GROUP_META[group].label}</h2>
                  <p style={{ color: 'var(--afa-text-secondary)', fontSize: 13, marginBottom: 16 }}>{GROUP_META[group].blurb}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                    {groupTokens.map((token) => (
                      <TokenField key={token.key} token={token} value={pending.get(token.key) ?? token.value} onChange={(v) => setValue(token.key, v)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </main>

        {confirmingLocked && (
          <ConfirmDialog
            title="Editing locked brand tokens"
            body="This change touches one or more of the 5 core brand tokens (surfaces, amber accent, or the primary CTA fill/text pair). These define the site's identity everywhere — are you sure?"
            confirmLabel={saving ? 'Saving…' : 'Yes, save anyway'}
            onConfirm={() => doSave(true)}
            onCancel={() => setConfirmingLocked(false)}
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
      </DashboardShell>
    </>
  )
}

function TokenField({ token, value, onChange }: { token: DesignToken; value: string; onChange: (v: string) => void }) {
  const invalid = !isValidTokenValue(token.type, value)
  const isSimpleHex = /^#[0-9a-fA-F]{6}$/.test(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--afa-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {token.key}
        {token.locked && (
          <span title="Locked — editable only with confirmation" style={{ color: 'var(--afa-amber)' }}>
            🔒
          </span>
        )}
      </label>

      {token.type === 'color' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isSimpleHex ? (
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 32, height: 32, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
          ) : (
            <div style={{ width: 32, height: 32, flexShrink: 0, background: value, border: '1px solid var(--afa-border-resting)' }} />
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, borderColor: invalid ? 'var(--afa-error)' : 'var(--afa-border-resting)' }}
          />
        </div>
      )}

      {token.type === 'font-family' && (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          {FONT_ALLOWLIST.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      )}

      {token.type === 'dimension' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            value={parseFloat(value) || 0}
            onChange={(e) => onChange(`${e.target.value}px`)}
            style={{ ...inputStyle, borderColor: invalid ? 'var(--afa-error)' : 'var(--afa-border-resting)' }}
          />
          <span style={{ color: 'var(--afa-text-muted)', fontSize: 12 }}>px</span>
        </div>
      )}

      {token.type === 'dimension-shorthand' && (
        <input
          type="text"
          value={value}
          placeholder="e.g. 9px 17px"
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, borderColor: invalid ? 'var(--afa-error)' : 'var(--afa-border-resting)', fontFamily: 'var(--font-mono)' }}
        />
      )}

      {token.group === 'font' && <span style={{ fontSize: 11, color: 'var(--afa-text-muted)' }}>{FONT_ROLE_LABEL[token.key] ?? ''}</span>}
    </div>
  )
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'var(--afa-surface-raised)', border: '1px solid var(--afa-border-resting)', padding: 24, maxWidth: 440, width: '100%' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--afa-text-primary)', marginBottom: 10 }}>{title}</h3>
        <p style={{ color: 'var(--afa-text-secondary)', fontSize: 14, marginBottom: 20 }}>{body}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ ...secondaryBtnStyle, background: 'var(--afa-fill-solid)', color: 'var(--afa-on-fill-solid)', border: 'none', fontWeight: 700 }}>
            {confirmLabel}
          </button>
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
  fontSize: 18,
  color: 'var(--afa-text-primary)',
  marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '6px 10px',
  fontSize: 13,
  background: 'var(--afa-surface-raised)',
  color: 'var(--afa-text-primary)',
  border: '1px solid var(--afa-border-resting)',
}
const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 17px',
  fontSize: 13,
  fontWeight: 600,
  background: 'transparent',
  color: 'var(--afa-text-primary)',
  border: '1px solid var(--afa-border-resting)',
  cursor: 'pointer',
}
