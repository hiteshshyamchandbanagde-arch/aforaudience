'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import SeatSectionEditor, { SeatSection } from '@/components/SeatSectionEditor'

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

export default function CreateVenuePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    acousticRating: '',
  })
  const [facilitiesInput, setFacilitiesInput] = useState('')
  const [sections, setSections] = useState<SeatSection[]>([
    { id: makeId(), name: '', seats: '', price: '' },
  ])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const submit = async (publish: boolean) => {
    setSaving(true)
    setError('')

    const validSections = sections.filter((s) => s.name.trim() && Number(s.seats) > 0)

    if (validSections.length === 0) {
      setError('Add at least one seating section with a name and seat count.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          acousticRating: formData.acousticRating ? parseFloat(formData.acousticRating) : null,
          facilities: facilitiesInput.split(',').map((f) => f.trim()).filter(Boolean),
          seatMap: { sections: validSections },
          publish,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create venue')
      }

      const newVenue = await res.json()
      router.push(`/dashboard/venue/${newVenue.id}`)
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
          <Link href="/dashboard/venue" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Venues
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '8px' }}>
            Register Your Venue
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Add your space, design its seating layout, and set your prices per section.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Basic details */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '20px' }}>
                Basic Details
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Venue Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., The Grand Theater" style={inputStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Address *</label>
                  <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="e.g., 123 Main Street" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>City *</label>
                  <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g., Mumbai" style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Facilities <span style={{ fontWeight: 400, opacity: 0.6 }}>(comma separated)</span></label>
                  <input type="text" value={facilitiesInput} onChange={(e) => setFacilitiesInput(e.target.value)} placeholder="e.g., Parking, Bar, AC" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Acoustic Rating <span style={{ fontWeight: 400, opacity: 0.6 }}>(0-5)</span></label>
                  <input type="number" name="acousticRating" value={formData.acousticRating} onChange={handleChange} placeholder="e.g., 4.5" min="0" max="5" step="0.5" style={inputStyle} />
                </div>
              </div>
            </section>

            {/* Seating & pricing */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                Seating & Pricing
              </h2>
              <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '18px' }}>
                Design your own layout — add as many sections as you like (e.g. "VIP Front Row", "General", "Balcony") and set a price for each.
              </p>
              <SeatSectionEditor sections={sections} onChange={setSections} />
            </section>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(true)}
                style={{
                  fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A',
                  border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Publishing...' : 'Publish Venue'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(false)}
                style={{
                  fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent',
                  border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                Save as Draft
              </button>
              <Link href="/dashboard/venue" style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, textDecoration: 'none', marginLeft: '4px' }}>
                Cancel
              </Link>
            </div>
            <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginTop: '14px' }}>
              Published venues appear immediately on the public Explore Venues page. Drafts stay private until you publish them.
            </p>
          </form>
        </div>
      </main>
    </>
  )
}
