'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'

// /dashboard/admin/diary — Admin Diary
//
// Structured, status-tracked version of docs/admin-diary.md's free-form
// milestone log (company registration, PAN, GST, current account, CA
// sign-offs, etc.). The markdown file stays as the dated narrative
// record; this page is the actionable view an admin can update without
// a code session — add an entry, flip its status as things progress.

type DiaryStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

interface DiaryEntry {
  id: string
  title: string
  notes: string | null
  status: DiaryStatus
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_META: Record<DiaryStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'var(--afa-amber)', bg: 'rgba(201,151,58,0.15)' },
  IN_PROGRESS: { label: 'In Progress', color: 'var(--afa-blue)', bg: 'rgba(74,111,165,0.15)' },
  COMPLETED: { label: 'Completed', color: 'var(--afa-green-deep)', bg: 'rgba(22,101,52,0.15)' },
}

const STATUS_ORDER: DiaryStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED']

export default function AdminDiaryPage() {
  const { showToast } = useToast()
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/diary')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setEntries(data.entries)
    } catch {
      showToast('Could not load the diary. Try refreshing.', 'error')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (!newTitle.trim()) {
      showToast('Give the entry a title first.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), notes: newNotes.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const data = await res.json()
      setEntries((prev) => [data.entry, ...(prev || [])])
      setNewTitle('')
      setNewNotes('')
      showToast('Entry added.', 'success')
    } catch {
      showToast('Could not add the entry. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, status: DiaryStatus) {
    setUpdatingId(id)
    const prevEntries = entries
    // optimistic update
    setEntries((prev) => (prev || []).map((e) => (e.id === id ? { ...e, status } : e)))
    try {
      const res = await fetch('/api/admin/diary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error('Failed to update')
    } catch {
      setEntries(prevEntries)
      showToast('Could not update status. Try again.', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(245,245,240,0.1)',
    fontSize: '14px',
    boxSizing: 'border-box',
    background: 'var(--afa-surface-inverse)',
    color: 'var(--afa-text-primary)',
  }

  const newEntryForm = (
    <div
      style={{
        background: 'var(--afa-surface-page)',
        border: '1px solid rgba(245,245,240,0.08)',
        borderRadius: '16px',
        padding: '20px',
      }}
    >
      <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--afa-text-secondary)', marginBottom: '14px' }}>
        New entry
      </p>
      <input
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="Title (e.g. GST registration)"
        style={{ ...inputStyle, marginBottom: '10px' }}
      />
      <textarea
        value={newNotes}
        onChange={(e) => setNewNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={3}
        style={{ ...inputStyle, marginBottom: '14px', fontFamily: 'inherit', resize: 'vertical' }}
      />
      <button
        onClick={handleCreate}
        disabled={saving || !newTitle.trim()}
        style={{
          width: '100%',
          background: 'var(--afa-fill-solid)',
          color: 'var(--afa-on-fill-solid)',
          border: 'none',
          borderRadius: '10px',
          padding: '11px 22px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: saving || !newTitle.trim() ? 'default' : 'pointer',
          opacity: saving || !newTitle.trim() ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Add entry'}
      </button>
    </div>
  )

  const entriesList = (
    <div
      style={{
        background: 'var(--afa-surface-page)',
        border: '1px solid rgba(245,245,240,0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--afa-text-secondary)', padding: '18px 20px 4px' }}>
        Past entries
      </p>
      {loading ? (
        <div style={{ padding: '24px 20px 32px' }}>
          <BrandLoader label="Loading diary..." />
        </div>
      ) : entries && entries.length > 0 ? (
        <div>
          {entries.map((entry, i) => {
            const meta = STATUS_META[entry.status]
            return (
              <div
                key={entry.id}
                style={{
                  padding: '16px 20px',
                  borderTop: i > 0 ? '1px solid rgba(245,245,240,0.06)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: entry.notes ? '6px' : '0' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--afa-text-primary)' }}>{entry.title}</div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: meta.color, background: meta.bg, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {meta.label}
                  </span>
                </div>
                {entry.notes && (
                  <div style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>{entry.notes}</div>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(entry.id, s)}
                      disabled={updatingId === entry.id || s === entry.status}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '5px 12px',
                        borderRadius: '999px',
                        border: s === entry.status ? `1px solid ${STATUS_META[s].color}` : '1px solid rgba(245,245,240,0.12)',
                        background: s === entry.status ? STATUS_META[s].bg : 'var(--afa-surface-raised)',
                        color: s === entry.status ? STATUS_META[s].color : 'var(--afa-text-secondary)',
                        opacity: s === entry.status ? 1 : 0.7,
                        cursor: s === entry.status ? 'default' : 'pointer',
                      }}
                    >
                      {STATUS_META[s].label}
                    </button>
                  ))}
                  <span style={{ fontSize: '11px', color: 'var(--afa-text-secondary)', opacity: 0.7, marginLeft: 'auto' }}>
                    Updated {new Date(entry.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 20px 40px', color: 'var(--afa-text-secondary)', fontSize: '14px' }}>
          No diary entries yet. Add the first one on the left.
        </div>
      )}
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
      <SiteNav />
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 20px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, color: 'var(--afa-text-primary)', margin: '0 0 6px' }}>
          Admin Diary
        </h1>
        <p style={{ color: 'var(--afa-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Company, legal, and administrative milestones — registration, PAN, GST, current account, CA sign-offs, and anything else worth tracking outside the product Feedback board.
        </p>

        {/* Mobile: form stacked above the list. Desktop: form pinned beside the list. */}
        <div className="flex flex-col gap-4 lg:hidden">
          {newEntryForm}
          {entriesList}
        </div>
        <div className="hidden lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 lg:items-start">
          <div style={{ position: 'sticky', top: '24px' }}>{newEntryForm}</div>
          {entriesList}
        </div>
      </div>
    </main>
  )
}
