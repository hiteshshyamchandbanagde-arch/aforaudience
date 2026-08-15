'use client'

import { useEffect, useState } from 'react'
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
  PENDING: { label: 'Pending', color: 'var(--afa-gold)', bg: 'var(--afa-amber-tint)' },
  IN_PROGRESS: { label: 'In Progress', color: 'var(--afa-blue)', bg: '#EAF0F8' },
  COMPLETED: { label: 'Completed', color: 'var(--afa-green-mid)', bg: 'var(--afa-mint-tint)' },
}

const STATUS_ORDER: DiaryStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED']

export default function AdminDiaryPage() {
  const { showToast } = useToast()
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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
      setShowForm(false)
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

  return (
    <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
      <SiteNav />
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', margin: 0 }}>
            Admin Diary
          </h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            style={{ background: 'var(--afa-terracotta)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            {showForm ? 'Cancel' : '+ Add entry'}
          </button>
        </div>
        <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6, fontSize: '14px', marginBottom: '28px' }}>
          Company, legal, and administrative milestones — registration, PAN, GST, current account, CA sign-offs, and anything else worth tracking outside the product Feedback board.
        </p>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid rgba(245,245,240,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (e.g. GST registration)"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '15px', marginBottom: '10px', boxSizing: 'border-box' }}
            />
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{ background: 'var(--afa-fill-solid)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save entry'}
            </button>
          </div>
        )}

        {loading ? (
          <BrandLoader label="Loading diary..." />
        ) : entries && entries.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {entries.map((entry) => {
              const meta = STATUS_META[entry.status]
              return (
                <div key={entry.id} style={{ background: 'white', border: '1px solid rgba(245,245,240,0.1)', borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: entry.notes ? '8px' : '0' }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--afa-text-primary)' }}>{entry.title}</div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: meta.color, background: meta.bg, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                      {meta.label}
                    </span>
                  </div>
                  {entry.notes && (
                    <div style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.7, lineHeight: 1.5, marginBottom: '12px' }}>{entry.notes}</div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {STATUS_ORDER.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(entry.id, s)}
                        disabled={updatingId === entry.id || s === entry.status}
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '6px 12px',
                          borderRadius: '999px',
                          border: s === entry.status ? `1.5px solid ${STATUS_META[s].color}` : '1px solid rgba(245,245,240,0.15)',
                          background: s === entry.status ? STATUS_META[s].bg : 'transparent',
                          color: s === entry.status ? STATUS_META[s].color : 'var(--afa-text-primary)',
                          opacity: s === entry.status ? 1 : 0.55,
                          cursor: s === entry.status ? 'default' : 'pointer',
                        }}
                      >
                        {STATUS_META[s].label}
                      </button>
                    ))}
                    <span style={{ fontSize: '11px', color: 'var(--afa-text-primary)', opacity: 0.4, marginLeft: 'auto' }}>
                      Updated {new Date(entry.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--afa-text-primary)', opacity: 0.5, fontSize: '15px' }}>
            No diary entries yet. Add the first one above.
          </div>
        )}
      </div>
    </main>
  )
}
