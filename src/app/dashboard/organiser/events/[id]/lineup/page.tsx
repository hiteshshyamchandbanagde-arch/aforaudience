'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use, useCallback } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface LineupSlot {
  id: string
  slot: number
  duration: number
  artistId: string
  artistName: string
  compensationType: 'PAID' | 'FREE' | 'BUY_IN'
  feeAmount: number | null
  buyInAmount: number | null
  startLabel: string | null
  endLabel: string | null
}

interface EventInfo {
  id: string
  title: string
  startTime: string
  endTime: string
  maxPerformers: number | null
}

const COMP_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  PAID: { label: 'Paid', bg: 'rgba(74,103,65,0.12)', color: '#4A6741' },
  FREE: { label: 'Free', bg: 'rgba(14,12,10,0.06)', color: '#0E0C0A' },
  BUY_IN: { label: 'Buy-in', bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f' },
}

function SortableRow({
  item,
  onDurationChange,
}: {
  item: LineupSlot
  onDurationChange: (id: string, duration: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const comp = COMP_LABEL[item.compensationType] || COMP_LABEL.FREE
  const compAmount = item.compensationType === 'PAID' ? item.feeAmount : item.compensationType === 'BUY_IN' ? item.buyInAmount : null

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px',
        background: '#fff',
        borderRadius: '10px',
        border: '1px solid rgba(14,12,10,0.08)',
      }}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{
          cursor: 'grab',
          background: 'transparent',
          border: 'none',
          fontSize: '18px',
          color: 'rgba(14,12,10,0.4)',
          padding: '4px 8px',
          touchAction: 'none',
        }}
      >
        ⠿
      </button>

      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0E0C0A', color: '#F7F3EE', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {item.slot}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: '14px', color: '#0E0C0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.artistName}
        </p>
        {item.startLabel && item.endLabel && (
          <p style={{ fontSize: '12px', color: 'rgba(14,12,10,0.5)' }}>{item.startLabel} – {item.endLabel}</p>
        )}
      </div>

      <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: comp.bg, color: comp.color, whiteSpace: 'nowrap' }}>
        {comp.label}{compAmount ? ` · ₹${compAmount}` : ''}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="number"
          min={1}
          max={180}
          value={item.duration}
          onChange={(e) => onDurationChange(item.id, Number(e.target.value))}
          style={{ width: '56px', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '13px', textAlign: 'center' }}
        />
        <span style={{ fontSize: '12px', color: 'rgba(14,12,10,0.5)' }}>min</span>
      </div>
    </div>
  )
}

export default function LineupBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [lineup, setLineup] = useState<LineupSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { showToast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchLineup = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}/lineup`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this event')
        throw new Error('Could not load lineup')
      }
      const json = await res.json()
      setEvent(json.event)
      setLineup(json.lineup)
      setError('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchLineup()
  }, [status, fetchLineup])

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setLineup((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({ ...item, slot: idx + 1 }))
      return reordered
    })
    setDirty(true)
  }

  const handleDurationChange = (itemId: string, duration: number) => {
    setLineup((items) => {
      const updated = items.map((i) => (i.id === itemId ? { ...i, duration: Math.max(1, Math.min(180, duration || 1)) } : i))
      return recomputeLabels(updated, event?.startTime)
    })
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/events/${id}/lineup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: lineup.map((i) => ({ performanceId: i.id, duration: i.duration })) }),
      })
      if (!res.ok) throw new Error('Could not save lineup')
      const json = await res.json()
      setLineup(json.lineup)
      setDirty(false)
      showToast('Lineup saved.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error && !event) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{error}</div></>)
  if (!event) return (<><SiteNav /><div style={{ padding: '32px' }}>No data</div></>)

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px 96px' }}>
          <Link href={`/dashboard/organiser/events/${id}`} style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to event
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '30px', fontWeight: 700, color: '#0E0C0A', marginTop: '12px', marginBottom: '6px' }}>
            🎤 {event.title} — Lineup
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(14,12,10,0.55)', marginBottom: '24px' }}>
            Drag ⠿ to reorder. Set each artist's duration in minutes — start/end times recalculate automatically from the event's start time ({event.startTime}).
            {event.maxPerformers !== null && ` Max ${event.maxPerformers} performer${event.maxPerformers === 1 ? '' : 's'}.`}
          </p>

          {error && (
            <div style={{ fontSize: '13px', color: '#B3261E', marginBottom: '16px' }}>{error}</div>
          )}

          {lineup.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', textAlign: 'center', border: '1px solid rgba(14,12,10,0.06)' }}>
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.6)' }}>
                No approved performers yet. Approve an Artist application to add them to the lineup.
              </p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={lineup.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lineup.map((item) => (
                    <SortableRow key={item.id} item={item} onDurationChange={handleDurationChange} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {lineup.length > 0 && (
            <div style={{ position: 'sticky', bottom: '24px', marginTop: '24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                style={{
                  fontSize: '14px', fontWeight: 600, color: '#F7F3EE',
                  background: dirty ? '#C8441A' : 'rgba(14,12,10,0.3)',
                  border: 'none', padding: '12px 28px', borderRadius: '8px',
                  cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? 'Saving...' : 'Save Lineup'}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

// Client-side recompute so duration edits reflect in the visible time
// blocks immediately, without waiting on a round trip. The server
// recomputes the same way on save/fetch — this is just for responsive
// UI, not the source of truth.
function recomputeLabels(items: LineupSlot[], startTime?: string): LineupSlot[] {
  if (!startTime) return items
  const base = parseTimeToMinutes(startTime)
  if (base === null) return items
  let cursor = base
  return items.map((item) => {
    const start = cursor
    const end = cursor + item.duration
    cursor = end
    return { ...item, startLabel: minutesToLabel(start), endLabel: minutesToLabel(end) }
  })
}

function parseTimeToMinutes(value: string): number | null {
  if (!value) return null
  let m = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (m) {
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h >= 0 && h < 24 && min >= 0 && min < 60) return h * 60 + min
  }
  m = value.trim().match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/)
  if (m) {
    let h = parseInt(m[1], 10) % 12
    const min = parseInt(m[2], 10)
    if (/pm/i.test(m[3])) h += 12
    return h * 60 + min
  }
  return null
}

function minutesToLabel(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440
  const h24 = Math.floor(wrapped / 60)
  const min = wrapped % 60
  const period = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(min).padStart(2, '0')} ${period}`
}
