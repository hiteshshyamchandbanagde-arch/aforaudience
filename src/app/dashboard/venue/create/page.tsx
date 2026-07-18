'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
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
  const { showToast } = useToast()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fail = (message: string) => {
    setError(message)
    showToast(message, 'error')
  }
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    acousticRating: '',
    mapsUrl: '',
  })
  const [facilitiesInput, setFacilitiesInput] = useState('')
  const [sections, setSections] = useState<SeatSection[]>([
    { id: makeId(), name: '', seats: '', price: '' },
  ])

  // §4.5 - rental rate the Organiser pays to book this venue, separate
  // from the section ticket prices above (which are for the audience).
  const [rateType, setRateType] = useState<'HOURLY' | 'DAILY' | 'FLEXIBLE'>('FLEXIBLE')
  const [hourlyRate, setHourlyRate] = useState('')
  const [dailyRate, setDailyRate] = useState('')
  const [minDurationHours, setMinDurationHours] = useState('')
  const [useDayOverrides, setUseDayOverrides] = useState(false)
  const [dayRates, setDayRates] = useState<Record<string, string>>({
    MONDAY: '', TUESDAY: '', WEDNESDAY: '', THURSDAY: '', FRIDAY: '', SATURDAY: '', SUNDAY: '',
  })

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
      fail('Add at least one seating section with a name and seat count.')
      setSaving(false)
      return
    }

    if (rateType === 'HOURLY' && (!hourlyRate || Number(hourlyRate) <= 0)) {
      fail('Set an hourly rental rate.')
      setSaving(false)
      return
    }
    if (rateType === 'DAILY' && (!dailyRate || Number(dailyRate) <= 0)) {
      fail('Set a daily rental rate.')
      setSaving(false)
      return
    }

    try {
      const dayRatesPayload = useDayOverrides && rateType !== 'FLEXIBLE'
        ? Object.entries(dayRates)
            .filter(([, v]) => v && Number(v) > 0)
            .map(([dayOfWeek, v]) => ({
              dayOfWeek,
              ...(rateType === 'HOURLY' ? { hourlyRate: Number(v) } : { dailyRate: Number(v) }),
            }))
        : []

      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          acousticRating: formData.acousticRating ? parseFloat(formData.acousticRating) : null,
          facilities: facilitiesInput.split(',').map((f) => f.trim()).filter(Boolean),
          seatMap: { sections: validSections },
          rateType,
          hourlyRate: rateType === 'HOURLY' && hourlyRate ? Number(hourlyRate) : null,
          dailyRate: rateType === 'DAILY' && dailyRate ? Number(dailyRate) : null,
          minDurationHours: minDurationHours ? Number(minDurationHours) : null,
          dayRates: dayRatesPayload,
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
      fail(err.message)
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Facilities <span style={{ fontWeight: 400, opacity: 0.6 }}>(comma separated)</span></label>
                  <input type="text" value={facilitiesInput} onChange={(e) => setFacilitiesInput(e.target.value)} placeholder="e.g., Parking, Bar, AC" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Acoustic Rating <span style={{ fontWeight: 400, opacity: 0.6 }}>(0-5)</span></label>
                  <input type="number" name="acousticRating" value={formData.acousticRating} onChange={handleChange} placeholder="e.g., 4.5" min="0" max="5" step="0.5" style={inputStyle} />
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

            {/* Rental rate - what an Organiser pays to book this venue, separate from audience ticket prices */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                Rental Rate
              </h2>
              <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '18px' }}>
                What Organisers pay to book your space - separate from the ticket prices audiences pay, which you set per section above.
              </p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                {(['HOURLY', 'DAILY', 'FLEXIBLE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRateType(t)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      border: rateType === t ? '2px solid #C8441A' : '1px solid rgba(14,12,10,0.15)',
                      background: rateType === t ? 'rgba(200,68,26,0.08)' : '#fff',
                      color: rateType === t ? '#C8441A' : '#0E0C0A',
                    }}
                  >
                    {t === 'HOURLY' ? 'Hourly' : t === 'DAILY' ? 'Daily' : 'Flexible'}
                  </button>
                ))}
              </div>

              {rateType === 'HOURLY' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '8px' }}>
                  <div>
                    <label style={labelStyle}>Rate per hour (₹) *</label>
                    <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} min="0" placeholder="e.g., 2500" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Minimum duration (hours)</label>
                    <input type="number" value={minDurationHours} onChange={(e) => setMinDurationHours(e.target.value)} min="1" placeholder="e.g., 3" style={inputStyle} />
                  </div>
                </div>
              )}

              {rateType === 'DAILY' && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={labelStyle}>Rate per day (₹) *</label>
                  <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} min="0" placeholder="e.g., 15000" style={{ ...inputStyle, maxWidth: '240px' }} />
                </div>
              )}

              {rateType === 'FLEXIBLE' && (
                <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>
                  No fixed rate published. Organisers will send you a duration and date, and you'll respond with a quote before it's confirmed.
                </p>
              )}

              {rateType !== 'FLEXIBLE' && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(14,12,10,0.06)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#0E0C0A', marginBottom: useDayOverrides ? '14px' : 0 }}>
                    <input type="checkbox" checked={useDayOverrides} onChange={(e) => setUseDayOverrides(e.target.checked)} />
                    Charge differently on specific days <span style={{ fontWeight: 400, opacity: 0.6 }}>(e.g., a weekend premium)</span>
                  </label>

                  {useDayOverrides && (
                    <div>
                      <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '10px' }}>
                        Leave a day blank to use your base rate above for that day.
                      </p>
                      {(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(14,12,10,0.05)' }}>
                          <span style={{ fontSize: '13px', color: '#0E0C0A' }}>{day.charAt(0) + day.slice(1).toLowerCase()}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5 }}>₹</span>
                            <input
                              type="number"
                              value={dayRates[day]}
                              onChange={(e) => setDayRates((prev) => ({ ...prev, [day]: e.target.value }))}
                              min="0"
                              placeholder={rateType === 'HOURLY' ? hourlyRate || '—' : dailyRate || '—'}
                              style={{ ...inputStyle, width: '110px' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
