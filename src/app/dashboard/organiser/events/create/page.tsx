'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface VenueOption {
  id: string
  name: string
  city: string
  capacity: number
  seatMap?: { sections?: { price: number }[] } | null
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid rgba(14,12,10,0.15)',
  background: '#fff',
  fontSize: '14px',
  color: '#0E0C0A',
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
  color: '#0E0C0A',
}

const EVENT_TYPES = ['OPEN_MIC', 'STAND_UP', 'POETRY', 'THEATER', 'LINEUP']

export default function CreateEventPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [venues, setVenues] = useState<VenueOption[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'OPEN_MIC',
    date: '',
    startTime: '',
    endTime: '',
    totalSeats: '',
    dresscode: '',
    vibe: '',
  })
  const [isFree, setIsFree] = useState(true)
  const [ticketPrice, setTicketPrice] = useState('')
  const [surpriseAct, setSurpriseAct] = useState(false)
  const [venueId, setVenueId] = useState('')
  const [bookingAmount, setBookingAmount] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const res = await fetch('/api/venues')
        if (res.ok) {
          const data = await res.json()
          setVenues(data)
        }
      } catch {
        // Venue picker is optional; fail quietly and let the organiser create without one.
      }
    }
    fetchVenues()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const submit = async (publish: boolean) => {
    setSaving(true)
    setError('')

    if (!formData.title || !formData.description || !formData.date || !formData.startTime || !formData.endTime || !formData.totalSeats) {
      setError('Please fill in all required fields.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          isFree,
          ticketPrice: isFree ? null : ticketPrice,
          surpriseAct,
          venueId: venueId || null,
          bookingAmount: venueId ? bookingAmount : null,
          publish,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create event')
      }

      const newEvent = await res.json()
      router.push(`/dashboard/organiser/events/${newEvent.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/organiser" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Events
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '8px' }}>
            Create an Event
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Set up your event details, book a venue, and publish when ready.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Event details */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '20px' }}>
                Event Details
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g., Friday Night Open Mic" style={inputStyle} required />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Description *</label>
                <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Tell your audience what to expect" rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Event Type *</label>
                  <select name="type" value={formData.type} onChange={handleChange} style={inputStyle}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Start Time *</label>
                  <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>End Time *</label>
                  <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Dress Code</label>
                  <input type="text" name="dresscode" value={formData.dresscode} onChange={handleChange} placeholder="e.g., Casual" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Vibe</label>
                  <input type="text" name="vibe" value={formData.vibe} onChange={handleChange} placeholder="e.g., Chill, intimate" style={inputStyle} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px', fontSize: '14px', color: '#0E0C0A' }}>
                <input type="checkbox" checked={surpriseAct} onChange={(e) => setSurpriseAct(e.target.checked)} />
                This event includes a surprise act
              </label>
            </section>

            {/* Seats & pricing */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '20px' }}>
                Seats & Ticket Price
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Total Seats *</label>
                <input type="number" name="totalSeats" value={formData.totalSeats} onChange={handleChange} min="1" placeholder="e.g., 50" style={inputStyle} required />
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#0E0C0A' }}>
                  <input type="radio" checked={isFree} onChange={() => setIsFree(true)} /> Free entry
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#0E0C0A' }}>
                  <input type="radio" checked={!isFree} onChange={() => setIsFree(false)} /> Paid entry
                </label>
              </div>

              {!isFree && (
                <div>
                  <label style={labelStyle}>Ticket Price (₹)</label>
                  <input type="number" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} min="0" placeholder="e.g., 199" style={inputStyle} />
                </div>
              )}
            </section>

            {/* Venue booking */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                Book a Venue
              </h2>
              <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '18px' }}>
                Optional — you can add this later. Booking requests are sent as pending until the venue owner responds.
              </p>

              <div style={{ marginBottom: venueId ? '18px' : 0 }}>
                <label style={labelStyle}>Venue</label>
                <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={inputStyle}>
                  <option value="">No venue selected</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} — {v.city} ({v.capacity} seats)</option>
                  ))}
                </select>
              </div>

              {venueId && (
                <div>
                  <label style={labelStyle}>Offer Amount (₹) <span style={{ fontWeight: 400, opacity: 0.6 }}>— what you'll pay the venue</span></label>
                  <input type="number" value={bookingAmount} onChange={(e) => setBookingAmount(e.target.value)} min="0" placeholder="e.g., 5000" style={inputStyle} />
                </div>
              )}
            </section>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(true)}
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Publishing...' : 'Publish Event'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(false)}
                style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                Save as Draft
              </button>
              <Link href="/dashboard/organiser" style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, textDecoration: 'none', marginLeft: '4px' }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
