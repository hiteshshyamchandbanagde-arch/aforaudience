'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import SeatSectionEditor, { SeatSection } from '@/components/SeatSectionEditor'
import { useToast } from '@/components/Toast'

interface Venue {
  id: string
  name: string
  address: string
  city: string
  capacity: number
  facilities: string[]
  acousticRating?: number
  mapsUrl?: string | null
  seatMap?: { sections?: SeatSection[] } | null
  isApproved: boolean
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

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function VenueEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ name: '', address: '', city: '', acousticRating: '', mapsUrl: '' })
  const [facilitiesInput, setFacilitiesInput] = useState('')
  const [sections, setSections] = useState<SeatSection[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const res = await fetch(`/api/venues/${id}/owner`)
        if (!res.ok) {
          if (res.status === 403) throw new Error('You do not have access to this venue')
          throw new Error('Venue not found')
        }
        const data: Venue = await res.json()
        setVenue(data)
        setFormData({
          name: data.name,
          address: data.address,
          city: data.city,
          acousticRating: data.acousticRating != null ? String(data.acousticRating) : '',
          mapsUrl: data.mapsUrl || '',
        })
        setFacilitiesInput((data.facilities || []).join(', '))
        setSections(
          data.seatMap?.sections && data.seatMap.sections.length > 0
            ? data.seatMap.sections
            : [{ id: makeId(), name: '', seats: '', price: '' }]
        )
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchVenue()
    }
  }, [session, id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Same class of bug as the Seating & Pricing totals (PR #102): the
  // input's `max` attribute is cosmetic on these custom-submit forms,
  // so it doesn't stop anyone typing past it. Clamp on change instead.
  const handleAcousticRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (value === '') {
      setFormData((prev) => ({ ...prev, acousticRating: '' }))
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num)) return
    const clamped = Math.max(0, Math.min(num, 5))
    setFormData((prev) => ({ ...prev, acousticRating: String(clamped) }))
  }

  const save = async (publishOverride?: boolean) => {
    setSaving(true)

    const validSections = sections.filter((s) => s.name.trim() && Number(s.seats) > 0)
    if (validSections.length === 0) {
      showToast('Add at least one seating section with a name and seat count.', 'error')
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/venues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          acousticRating: formData.acousticRating ? parseFloat(formData.acousticRating) : null,
          facilities: facilitiesInput.split(',').map((f) => f.trim()).filter(Boolean),
          seatMap: { sections: validSections },
          ...(publishOverride !== undefined ? { publish: publishOverride } : {}),
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to update venue')
      }

      showToast('Venue saved.', 'success')
      router.push(`/dashboard/venue/${id}`)
    } catch (err: any) {
      showToast(err.message || 'Failed to update venue', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error && !venue) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{error}</div></>)
  if (!venue) return (<><SiteNav /><div style={{ padding: '32px' }}>Venue not found</div></>)

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href={`/dashboard/venue/${id}`} style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Venue
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '8px' }}>
            Edit Venue
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Update your venue details and seating layout.
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '20px' }}>
                Basic Details
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Venue Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} style={inputStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Address *</label>
                  <input type="text" name="address" value={formData.address} onChange={handleChange} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>City *</label>
                  <input type="text" name="city" value={formData.city} onChange={handleChange} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Facilities <span style={{ fontWeight: 400, opacity: 0.6 }}>(comma separated)</span></label>
                  <input type="text" value={facilitiesInput} onChange={(e) => setFacilitiesInput(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Acoustic Rating <span style={{ fontWeight: 400, opacity: 0.6 }}>(0-5)</span></label>
                  <input type="number" name="acousticRating" value={formData.acousticRating} onChange={handleAcousticRatingChange} min="0" max="5" step="0.5" maxLength={3} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Google Maps Link <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="url" name="mapsUrl" value={formData.mapsUrl} onChange={handleChange} placeholder="e.g., https://maps.app.goo.gl/..." style={inputStyle} />
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginTop: '6px' }}>
                  Paste a share link from Google Maps for an exact pin. If left blank, we'll use your address to build directions.
                </p>
              </div>
            </section>

            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                Seating & Pricing
              </h2>
              <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '18px' }}>
                Add, edit, or remove sections freely — capacity updates automatically.
              </p>
              <SeatSectionEditor sections={sections} onChange={setSections} />

              <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', background: '#FBF8F3', border: '1px solid rgba(14,12,10,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0E0C0A' }}>Have real numbered seats instead?</div>
                  <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6 }}>
                    Section pricing above is for General Admission. Use the Seat Map builder to lay out individual numbered seats on a canvas matching your venue's shape.
                  </div>
                </div>
                <Link
                  href={`/dashboard/venue/${id}/seat-map`}
                  style={{ flexShrink: 0, fontSize: '13px', fontWeight: 700, color: '#F7F3EE', background: '#0E0C0A', textDecoration: 'none', padding: '10px 18px', borderRadius: '8px', whiteSpace: 'nowrap' }}
                >
                  Open Seat Map Builder →
                </Link>
              </div>
            </section>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(true)}
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : venue.isApproved ? 'Save Changes' : 'Save & Publish'}
              </button>
              {venue.isApproved ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(false)}
                  style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  Save & Unpublish
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(undefined)}
                  style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  Save as Draft
                </button>
              )}
              <Link href={`/dashboard/venue/${id}`} style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, textDecoration: 'none' }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
