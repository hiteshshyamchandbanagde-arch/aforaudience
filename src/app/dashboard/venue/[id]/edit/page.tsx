'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import SeatSectionEditor, { SeatSection, findDuplicateSectionNames, findIncompleteSections } from '@/components/SeatSectionEditor'
import FacilitiesPicker from '@/components/FacilitiesPicker'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import CityAutocomplete from '@/components/CityAutocomplete'
import HelpIcon from '@/components/HelpIcon'
import { buildDirectionsUrl } from '@/lib/maps-url'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import Button, { variantStyle } from '@/components/ui/Button'
import { PageTitle } from '@/components/dashboard/PageTitle'
import { Icon, INLINE_ICON_STYLE } from '@/components/Icon'
import { useLocale } from '@/lib/i18n/translate'
import { countText } from '@/lib/i18n/plural'

interface Venue {
  id: string
  name: string
  address: string
  city: string
  state?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  placeId?: string | null
  capacity: number
  facilities: string[]
  acousticRating?: number
  mapsUrl?: string | null
  seatMap?: { sections?: SeatSection[] } | null
  isApproved: boolean
  seatingMode: 'GENERAL_ADMISSION' | 'NUMBERED'
  rateType?: 'HOURLY' | 'DAILY' | 'FLEXIBLE' | null
  hourlyRate?: number | null
  dailyRate?: number | null
  minDurationHours?: number | null
  dayRates?: { dayOfWeek: string; hourlyRate: number | null; dailyRate: number | null }[]
}

const inputStyle = {
  width: '100%',
  padding: 'var(--afa-space-10px) var(--afa-space-3)',
  borderRadius: 'var(--afa-radius-sm)',
  border: '1px solid var(--afa-border-resting)',
  background: 'var(--afa-surface-raised)',
  fontSize: 'var(--afa-text-body)',
  color: 'var(--afa-text-primary)',
}

const labelStyle = {
  display: 'block',
  fontSize: 'var(--afa-text-ui)',
  fontWeight: 600,
  marginBottom: 'var(--afa-space-6px)',
  color: 'var(--afa-text-primary)',
}

const WEEK_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const

/** The weekday's name in the UI language (5 Jan 2026 is a Monday). */
function weekdayName(locale: string, index: number) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 5 + index)))
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
  const { locale, t: tr } = useLocale()
  const ve = tr.venueDashboard.venueEdit
  const view = tr.venueDashboard.venueView
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ name: '', address: '', city: '', state: '', country: '', lat: '', lng: '', placeId: '', acousticRating: '', mapsUrl: '' })
  const [facilities, setFacilities] = useState<string[]>([])
  const [sections, setSections] = useState<SeatSection[]>([])
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

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const res = await fetch(`/api/venues/${id}/owner`)
        if (!res.ok) {
          if (res.status === 403) throw new Error(view.accessDenied)
          throw new Error(view.notFound)
        }
        const data: Venue = await res.json()
        setVenue(data)
        setFormData({
          name: data.name,
          address: data.address,
          city: data.city,
          state: data.state || '',
          country: data.country || '',
          lat: data.lat != null ? String(data.lat) : '',
          lng: data.lng != null ? String(data.lng) : '',
          placeId: data.placeId || '',
          acousticRating: data.acousticRating != null ? String(data.acousticRating) : '',
          mapsUrl: data.mapsUrl || '',
        })
        setFacilities(data.facilities || [])
        setSections(
          data.seatMap?.sections && data.seatMap.sections.length > 0
            ? data.seatMap.sections
            : [{ id: makeId(), name: '', seats: '', price: '' }]
        )
        setRateType(data.rateType || 'FLEXIBLE')
        setHourlyRate(data.hourlyRate != null ? String(data.hourlyRate) : '')
        setDailyRate(data.dailyRate != null ? String(data.dailyRate) : '')
        setMinDurationHours(data.minDurationHours != null ? String(data.minDurationHours) : '')
        if (data.dayRates && data.dayRates.length > 0) {
          setUseDayOverrides(true)
          setDayRates((prev) => {
            const next = { ...prev }
            for (const d of data.dayRates!) {
              const val = data.rateType === 'HOURLY' ? d.hourlyRate : d.dailyRate
              if (val != null) next[d.dayOfWeek] = String(val)
            }
            return next
          })
        }
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

  const save = async (publishOverride?: boolean) => {
    setSaving(true)

    // Rule (Hitesh, 27 Jul): same as venue creation - a section row that
    // exists must be filled in or removed by the owner, never silently
    // dropped at save time.
    if (venue?.seatingMode === 'GENERAL_ADMISSION') {
      if (sections.length === 0) {
        showToast(ve.noSectionsError, 'error')
        setSaving(false)
        return
      }
      const incomplete = findIncompleteSections(sections)
      if (incomplete.length > 0) {
        showToast(countText(locale, incomplete.length, ve.incompleteSectionsOne, ve.incompleteSectionsOther), 'error')
        setSaving(false)
        return
      }
    }
    // Same decoupling as venue creation (PR #146) - a NUMBERED venue's
    // real seat structure lives in Seat Map Builder, not this GA section
    // editor. This form was never updated for that when #146 shipped,
    // so editing a NUMBERED venue was incorrectly forced through GA
    // section validation regardless of seatingMode.
    const duplicateSectionNames = findDuplicateSectionNames(sections)
    if (venue?.seatingMode === 'GENERAL_ADMISSION' && duplicateSectionNames.length > 0) {
      showToast(countText(locale, duplicateSectionNames.length, tr.venueDashboard.venueForm.duplicateNamesOne, tr.venueDashboard.venueForm.duplicateNamesOther).replace('{names}', duplicateSectionNames.join('", "')), 'error')
      setSaving(false)
      return
    }

    if (rateType === 'HOURLY' && (!hourlyRate || Number(hourlyRate) <= 0)) {
      showToast(ve.setHourlyRate, 'error')
      setSaving(false)
      return
    }
    if (rateType === 'DAILY' && (!dailyRate || Number(dailyRate) <= 0)) {
      showToast(ve.setDailyRate, 'error')
      setSaving(false)
      return
    }

    const dayRatesPayload = useDayOverrides && rateType !== 'FLEXIBLE'
      ? Object.entries(dayRates)
          .filter(([, v]) => v && Number(v) > 0)
          .map(([dayOfWeek, v]) => ({
            dayOfWeek,
            ...(rateType === 'HOURLY' ? { hourlyRate: Number(v) } : { dailyRate: Number(v) }),
          }))
      : []

    try {
      const res = await fetch(`/api/venues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          acousticRating: formData.acousticRating ? parseFloat(formData.acousticRating) : null,
          facilities,
          seatMap: venue?.seatingMode === 'GENERAL_ADMISSION' ? { sections } : undefined,
          rateType,
          hourlyRate: rateType === 'HOURLY' && hourlyRate ? Number(hourlyRate) : null,
          dailyRate: rateType === 'DAILY' && dailyRate ? Number(dailyRate) : null,
          minDurationHours: minDurationHours ? Number(minDurationHours) : null,
          dayRates: dayRatesPayload,
          ...(publishOverride !== undefined ? { publish: publishOverride } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || ve.updateFailed)
      }

      showToast(ve.saved, 'success')
      router.push(`/dashboard/venue/${id}`)
    } catch (err: any) {
      showToast(err.message || ve.updateFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader label={tr.dashboardChrome.loading} /></>)
  if (!session) return <SiteNav />
  if (error && !venue) return (<><SiteNav /><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error-bright)' }}>{error}</div></>)
  if (!venue) return (<><SiteNav /><div style={{ padding: 'var(--afa-space-32px)' }}>{view.notFound}</div></>)

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <BackLink href={`/dashboard/venue/${id}`} label={ve.backToVenue} />

          <PageTitle size="lg" style={{ marginTop: 'var(--afa-space-4)', marginBottom: 'var(--afa-space-2)' }}>
            {ve.title}
          </PageTitle>
          <p style={{ fontSize: 'var(--afa-text-body-lg)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-32px)' }}>
            {ve.subtitle}
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            <section style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-5)' }}>
                {ve.basicDetails}
              </h2>

              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{ve.venueName}</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} style={inputStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--afa-space-18px)', marginBottom: 'var(--afa-space-18px)' }}>
                <div>
                  <label style={labelStyle}>{ve.address}</label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(address) => setFormData((prev) => ({ ...prev, address }))}
                    onManualEdit={() => setFormData((prev) => ({ ...prev, lat: '', lng: '', placeId: '' }))}
                    onResolved={(loc) =>
                      setFormData((prev) => ({
                        ...prev,
                        city: loc.city || prev.city,
                        state: loc.state ?? prev.state,
                        country: loc.country ?? prev.country,
                        lat: loc.lat != null ? String(loc.lat) : prev.lat,
                        lng: loc.lng != null ? String(loc.lng) : prev.lng,
                        placeId: loc.placeId ?? prev.placeId,
                      }))
                    }
                    inputStyle={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{ve.city}</label>
                  <CityAutocomplete
                    value={formData.city}
                    onChange={(city) => setFormData((prev) => ({ ...prev, city, state: '', country: '' }))}
                    onResolved={(loc) =>
                      setFormData((prev) => ({ ...prev, city: loc.city || prev.city, state: loc.state ?? '', country: loc.country ?? '' }))
                    }
                    inputStyle={inputStyle}
                  />
                  {(formData.state || formData.country) && (
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.55, marginTop: 'var(--afa-space-1)' }}>
                      {[formData.state, formData.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Moved directly after Address/City/State/Country (PR #212) -
                  see venue create page for the full rationale. */}
              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{ve.mapsLink}</label>
                {formData.lat && formData.lng ? (
                  <>
                    <a
                      href={buildDirectionsUrl({
                        placeId: formData.placeId,
                        lat: formData.lat ? Number(formData.lat) : null,
                        lng: formData.lng ? Number(formData.lng) : null,
                        address: formData.address,
                        city: formData.city,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...inputStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'var(--afa-fill-solid)', fontWeight: 600 }}
                    >
                      <Icon name="pin" size={14} style={INLINE_ICON_STYLE} />&nbsp;{ve.directions}
                    </a>
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-6px)' }}>
                      {ve.mapsDerived}
                    </p>
                  </>
                ) : (
                  <>
                    <input type="url" name="mapsUrl" value={formData.mapsUrl} onChange={handleChange} placeholder={ve.mapsPlaceholder} style={inputStyle} />
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-6px)' }}>
                      {ve.mapsOptional}
                    </p>
                  </>
                )}
              </div>

              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{view.facilities}</label>
                <FacilitiesPicker value={facilities} onChange={setFacilities} />
              </div>

              <div>
                <label style={labelStyle}>{view.acousticRating} <span style={{ fontWeight: 400, opacity: 0.6 }}>(0-5)</span></label>
                <p style={{ fontSize: 'var(--afa-text-body-lg)', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: 0.5 }}>{view.notRatedYet}</p>
                <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-1)' }}>
                  {ve.acousticNote}
                </p>
              </div>
            </section>

            {/* Rental Rate - was entirely missing from this edit form until
                now (session 39 finding, Hitesh) - an owner had no way to
                update their rate, including day-wise overrides, after
                venue creation. Mirrors venue create page's section exactly. */}
            <section style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }}>
                {ve.rentalRate}
              </h2>
              <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-18px)' }}>
                {ve.rentalRateNote}
              </p>

              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                {ve.rateType}
                <HelpIcon text={ve.rateTypeHelp} />
              </label>
              <div style={{ display: 'flex', gap: 'var(--afa-space-2)', marginBottom: 'var(--afa-space-18px)' }}>
                {(['HOURLY', 'DAILY', 'FLEXIBLE'] as const).map((t) => (
                  <Button
                    key={t}
                    variant="toggle-box"
                    size="md"
                    fullWidth={false}
                    selected={rateType === t}
                    type="button"
                    onClick={() => setRateType(t)}
                    style={{ flex: 1 }}
                  >
                    {t === 'HOURLY' ? ve.hourly : t === 'DAILY' ? ve.daily : ve.flexible}
                  </Button>
                ))}
              </div>

              {rateType === 'HOURLY' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--afa-space-18px)', marginBottom: 'var(--afa-space-2)' }}>
                  <div>
                    <label style={labelStyle}>{ve.ratePerHour}</label>
                    <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} min="0" placeholder={ve.ratePerHourPlaceholder} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{ve.minDuration}</label>
                    <input type="number" value={minDurationHours} onChange={(e) => setMinDurationHours(e.target.value)} min="1" placeholder={ve.minDurationPlaceholder} style={inputStyle} />
                  </div>
                </div>
              )}

              {rateType === 'DAILY' && (
                <div style={{ marginBottom: 'var(--afa-space-2)' }}>
                  <label style={labelStyle}>{ve.ratePerDay}</label>
                  <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} min="0" placeholder={ve.ratePerDayPlaceholder} style={{ ...inputStyle, maxWidth: '240px' }} />
                </div>
              )}

              {rateType === 'FLEXIBLE' && (
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                  {ve.flexibleNote}
                </p>
              )}

              {rateType !== 'FLEXIBLE' && (
                <div style={{ marginTop: 'var(--afa-space-4)', paddingTop: 'var(--afa-space-4)', borderTop: '1px solid var(--afa-tint-06)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-2)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', marginBottom: useDayOverrides ? 'var(--afa-space-14px)' : 0 }}>
                    <input type="checkbox" checked={useDayOverrides} onChange={(e) => setUseDayOverrides(e.target.checked)} />
                    {ve.dayOverrides} <span style={{ fontWeight: 400, opacity: 0.6 }}>{ve.dayOverridesHint}</span>
                  </label>

                  {useDayOverrides && (
                    <div>
                      <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-10px)' }}>
                        {ve.dayOverridesNote}
                      </p>
                      {WEEK_DAYS.map((day, dayIndex) => (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--afa-space-2) 0', borderBottom: '1px solid var(--afa-tint-04)' }}>
                          <span style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)' }}>{weekdayName(locale, dayIndex)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-1)' }}>
                            <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>₹</span>
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

            <section style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }}>
                {ve.seatingPricing}
              </h2>

              {venue.seatingMode === 'GENERAL_ADMISSION' && (
                <>
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-18px)' }}>
                    {ve.sectionsNote}
                  </p>
                  <SeatSectionEditor sections={sections} onChange={setSections} />

                  <div style={{ marginTop: 'var(--afa-space-5)', padding: 'var(--afa-space-4)', borderRadius: 'var(--afa-radius-lg)', background: 'var(--afa-tint-04)', border: '1px solid var(--afa-tint-08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--afa-space-3)', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{ve.numberedInsteadTitle}</div>
                      <div style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                        {ve.numberedInsteadBody}
                      </div>
                    </div>
                    {/* GEN-2609-118 - outline (both links): Save is this screen's one primary action. */}
                    <Link
                      href={`/dashboard/venue/${id}/seat-map`}
                      style={{ ...variantStyle('outline-neutral', false, 'md'), flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      {ve.openSeatMap}
                    </Link>
                  </div>
                </>
              )}

              {venue.seatingMode === 'NUMBERED' && (
                <div style={{ padding: 'var(--afa-space-4)', borderRadius: 'var(--afa-radius-lg)', background: 'var(--afa-tint-04)', border: '1px solid var(--afa-tint-08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--afa-space-3)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{ve.numberedTitle}</div>
                    <div style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                      {countText(locale, venue.capacity, ve.numberedBodyOne, ve.numberedBodyOther)}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/venue/${id}/seat-map`}
                    style={{ ...variantStyle('outline-neutral', false, 'md'), flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {ve.openSeatMap}
                  </Link>
                </div>
              )}
            </section>

            <div data-afa-action-row style={{ display: 'flex', gap: 'var(--afa-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="lg"
                fullWidth={false}
                type="button"
                disabled={saving}
                onClick={() => save(true)}
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? tr.dashboardChrome.saving : venue.isApproved ? ve.saveChanges : ve.savePublish}
              </Button>
              {venue.isApproved ? (
                <Button
                  variant="outline-neutral"
                  size="lg"
                  fullWidth={false}
                  type="button"
                  disabled={saving}
                  onClick={() => save(false)}
                >
                  {ve.saveUnpublish}
                </Button>
              ) : (
                <Button
                  variant="outline-neutral"
                  size="lg"
                  fullWidth={false}
                  type="button"
                  disabled={saving}
                  onClick={() => save(undefined)}
                >
                  {ve.saveDraft}
                </Button>
              )}
              <Link href={`/dashboard/venue/${id}`} style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, textDecoration: 'none' }}>
                {tr.dashboardChrome.cancel}
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
