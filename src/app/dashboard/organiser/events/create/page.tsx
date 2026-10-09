'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import PresetSelectWithOther from '@/components/PresetSelectWithOther'
import BrandLoader from '@/components/BrandLoader'
import SeatLayoutPreview, { PreviewSeat, colorForZone } from '@/components/SeatLayoutPreview'
import DashboardShell from '@/components/DashboardShell'
import { ErrorBanner } from '@/components/ErrorBanner'
import Button from '@/components/ui/Button'
import { EVENT_TERMS_CHECKLIST, SPECIAL_NOTES_MAX_LENGTH, REFUND_POLICY_LINK, AGE_LIMIT_PRESETS } from '@/lib/event-terms'
import { billableHours, hourlyNote, hourlyTotal } from '@/lib/venue-billing'
import { presetLabels, longEventText, seatsText, sectionsText, weekdayName } from '@/components/dashboard/eventFormText'
import { useLocale } from '@/lib/i18n/translate'
import { PageTitle } from '@/components/dashboard/PageTitle'
import { formatINR } from '@/lib/money-display'

interface SeatSection {
  id?: string
  name: string
  seats: number
  price: number
  // NUMBERED venues only - empty/undefined for GA sections, which have no
  // levels concept. Lets a same-named zone on two different levels (e.g.
  // "General" on Ground and Balcony) be priced independently instead of
  // merging into one shared tier.
  level?: string
}

interface VenueDayRate {
  dayOfWeek: string
  hourlyRate: number | null
  dailyRate: number | null
}

interface VenueOption {
  id: string
  name: string
  city: string
  capacity: number
  seatMap?: { sections?: SeatSection[] } | null
  seatingMode?: 'GENERAL_ADMISSION' | 'NUMBERED'
  seats?: PreviewSeat[]
  zonePrices?: { level: string; zoneName: string; suggestedPrice: number | null }[]
  rateType?: 'HOURLY' | 'DAILY' | 'FLEXIBLE' | null
  hourlyRate?: number | null
  dailyRate?: number | null
  minDurationHours?: number | null
  dayRates?: VenueDayRate[]
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

const EVENT_TYPES = ['OPEN_MIC', 'STAND_UP', 'POETRY', 'THEATER', 'LINEUP']
// design.md \u00a79.5 "Settled" mapping - auto-fills a sensible default per
// EventType, pre-selected but always editable (not disabled/ghosted).
const DRESSCODE_PRESETS = ['Casual', 'Smart Casual', 'Formal', 'Costume / Theme']
const VIBE_PRESETS = ['High Energy', 'Intimate', 'Chill', 'Curated', 'Family-Friendly']
const EVENT_TYPE_DEFAULTS: Record<string, { dresscode: string; vibe: string }> = {
  OPEN_MIC: { dresscode: 'Casual', vibe: 'High Energy' },
  STAND_UP: { dresscode: 'Casual', vibe: 'High Energy' },
  LINEUP: { dresscode: 'Casual', vibe: 'High Energy' },
  POETRY: { dresscode: 'Casual', vibe: 'Intimate' },
  THEATER: { dresscode: 'Smart Casual', vibe: 'Curated' },
}
// Generous but real-world cap, same reasoning as MAX_EVENT_SEATS server-side
// (src/app/api/events/route.ts) - no legitimate lineup approaches this,
// it's here purely to stop a fat-fingered huge number from reaching the
// DB unclamped.
const MAX_PERFORMERS = 500

// Past-date calendar fix (31 Jul feedback) - the date picker previously had
// no `min`, so its native calendar UI let you pick a past date even though
// the server already rejects one at Publish ("Event date and time must be
// in the future"). Computed in LOCAL time deliberately, not
// `toISOString().split('T')[0]` (UTC) - for IST users (UTC+5:30), a UTC-
// based "today" would read as yesterday's date for roughly the first ~5.5
// hours of every IST day, incorrectly blocking today itself from being
// selectable during that window.
function todayLocalDateString() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Companion to todayLocalDateString (31 Jul follow-up) - Start Time's
// picker should only floor at "right now" when the selected Date is
// actually today; a future date has no such constraint. Also local time,
// same UTC-offset reasoning as the date helper above.
function nowLocalTimeString() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function CreateEventPage() {
  // GEN-2610-007 - the form reads organiserDashboard.eventForm (shared with
  // Edit Event) and .createEvent; the terms checklist its translated labels.
  const { t: tr, locale } = useLocale()
  const f = tr.organiserDashboard.eventForm
  const c = tr.organiserDashboard.createEvent
  const labels = presetLabels(f)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [venues, setVenues] = useState<VenueOption[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Surfaces an error both inline (existing banner, kept for context/
  // accessibility) and as a toast (visible without scrolling back up -
  // this form is long and the submit button sits well below the fold).
  const fail = (message: string) => {
    setError(message)
    showToast(message, 'error')
  }
  // Bug fix (Feedback 09c05b22, 25 Jul): the error banner previously only
  // cleared at the top of the next submit() call, so a user who corrected
  // every field the banner listed - but hadn't clicked Save/Publish again -
  // saw the exact same stale "missing fields" text sitting on screen even
  // though it was already fully resolved. The banner is meant to persist
  // until real user action (not auto-vanish like a toast), but editing a
  // flagged field IS that action, so it should clear immediately rather
  // than waiting for a resubmit to notice. Skips the mount render so this
  // doesn't fire before any error has ever been shown.
  const isFirstRender = useRef(true)

  // Feedback cms9ynuxi - UX hint for the date picker's max, mirroring
  // the server-enforced window. Not the real enforcement (that's
  // server-side, see events/route.ts) - if this fetch fails for any
  // reason, maxDateString just stays null and the input has no upper
  // bound client-side, same as before this feature existed; the
  // server still rejects out-of-window submissions either way.
  const [maxDateString, setMaxDateString] = useState<string | null>(null)
  const [windowMonths, setWindowMonths] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/platform-settings/event-window')
      .then((res) => res.json())
      .then((data) => {
        const months = Number(data?.eventCreationWindowMonths)
        if (!Number.isFinite(months) || months <= 0) return
        setWindowMonths(months)
        const max = new Date()
        max.setMonth(max.getMonth() + months)
        setMaxDateString(max.toISOString().slice(0, 10))
      })
      .catch(() => {})
  }, [])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'OPEN_MIC',
    date: '',
    startTime: '',
    endTime: '',
    totalSeats: '',
    dresscode: EVENT_TYPE_DEFAULTS.OPEN_MIC.dresscode,
    vibe: EVENT_TYPE_DEFAULTS.OPEN_MIC.vibe,
  })
  // Once the organiser directly edits Dress Code or Vibe, stop
  // auto-overwriting them when Event Type changes - the whole point of
  // "pre-selected but editable" is that a deliberate choice sticks.
  const [dressVibeTouched, setDressVibeTouched] = useState(false)
  const [isFree, setIsFree] = useState(true)
  const [ticketPrice, setTicketPrice] = useState('')
  const [surpriseAct, setSurpriseAct] = useState(false)
  // Competition show (31 Jul feedback) - an optional layer on top of any
  // event type, not a new type itself. Photos for panelists/celebrity can
  // only be added after the event exists (upload routes are keyed by
  // eventId/panelistId) - collected here as text only, photo upload lives
  // on the Edit page.
  const [isCompetitionShow, setIsCompetitionShow] = useState(false)
  const [competitionPrizeFirst, setCompetitionPrizeFirst] = useState('')
  const [competitionPrizeSecond, setCompetitionPrizeSecond] = useState('')
  const [competitionPrizeThird, setCompetitionPrizeThird] = useState('')
  const [venueId, setVenueId] = useState('')
  const [bookingAmount, setBookingAmount] = useState('')
  // FEAT-2608-045 - event-specific terms checklist + special notes
  // (admin-reviewed before shown publicly). AFA's own refund/cancellation
  // policy is platform-wide, not entered here - see REFUND_POLICY_LINK.
  const [termsChecklist, setTermsChecklist] = useState<string[]>([])
  const [specialNotes, setSpecialNotes] = useState('')
  const [ageLimit, setAgeLimit] = useState('')
  // §4.5 - performer economics + booking cap, Event-level (E8/E9/E13)
  const [maxPerformers, setMaxPerformers] = useState('')
  const [applicationApprovalMode, setApplicationApprovalMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
  const [maxSeatsPerBooking, setMaxSeatsPerBooking] = useState('4')

  // Same class of bug as the Seating & Pricing totals (PR #102): the
  // input's `max` attribute is cosmetic on this custom-submit form,
  // so it doesn't stop anyone typing past it - the label right below
  // promises "1-10" but nothing enforced that at the field itself.
  const handleMaxSeatsPerBookingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (value === '') {
      setMaxSeatsPerBooking('')
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num)) return
    setMaxSeatsPerBooking(String(Math.max(1, Math.min(num, 10))))
  }
  // Same class of bug as PR #100/#102/#103 (unbounded numeric inputs) -
  // this field was missed in those passes. A user typed an enormous
  // number here (1e18), which had no server-side cap and no client-side
  // clamp, and crashed prisma.event.create() with a Postgres integer
  // overflow instead of a real validation message. Found via a live
  // feedback report + Vercel runtime error correlation, not code review.
  const handleMaxPerformersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (value === '') {
      setMaxPerformers('')
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num)) return
    setMaxPerformers(String(Math.max(1, Math.min(num, MAX_PERFORMERS))))
  }
  const [plusOnesRequired, setPlusOnesRequired] = useState('0')
  const [defaultCompensationType, setDefaultCompensationType] = useState<'FREE' | 'PAID' | 'BUY_IN'>('FREE')
  const [defaultFeeAmount, setDefaultFeeAmount] = useState('')
  const [defaultBuyInAmount, setDefaultBuyInAmount] = useState('')
  // Same clamp-on-change discipline as maxSeatsPerBooking/maxPerformers
  // above - unbounded numeric inputs have crashed prisma.event.create()
  // before (PR #100-103), server-side cap exists too, this is just the UX
  // half. 20 is a generous ceiling - no realistic open-mic circuit needs
  // more mandatory supporters than that per artist.
  const handlePlusOnesRequiredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (value === '') {
      setPlusOnesRequired('')
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num)) return
    setPlusOnesRequired(String(Math.max(0, Math.min(num, 20))))
  }
  // §4.5 - per-section ticket pricing. Keyed by `${level}::${name}` (see
  // tierKey below), not name alone - a same-named zone on two different
  // venue levels needs two independent prices. Organiser only ever edits
  // price here - section names/capacities/levels stay owned by the Venue
  // Owner's own seat map.
  const [tierPrices, setTierPrices] = useState<Record<string, string>>({})
  const tierKey = (s: { name: string; level?: string }) => `${s.level || ''}::${s.name}`

  const selectedVenue = venues.find((v) => v.id === venueId)
  // GA: unchanged, reads the Venue Owner's own seatMap.sections. NUMBERED:
  // that field is dead weight for these venues (never populated by the
  // seat-map builder) - real pricing sections come from Seat.tierLabel
  // (the zone) grouped into counts, with VenueZonePrice as a starting
  // suggested price the organiser can still override below, same as GA.
  // Level-aware (28 Jul): grouped by (level, zoneName) so a same-named
  // zone on two different levels prices independently instead of merging.
  const numberedZoneSections: SeatSection[] =
    selectedVenue?.seatingMode === 'NUMBERED'
      ? Object.entries(
          (selectedVenue.seats || []).reduce<Record<string, number>>((acc, s) => {
            const key = `${s.level || ''}::${s.tierLabel}`
            acc[key] = (acc[key] || 0) + 1
            return acc
          }, {})
        ).map(([key, seatCount]) => {
          const sepIdx = key.indexOf('::')
          const level = key.slice(0, sepIdx)
          const zoneName = key.slice(sepIdx + 2)
          return {
            name: zoneName,
            level,
            seats: seatCount,
            price: selectedVenue.zonePrices?.find((z) => z.zoneName === zoneName && (z.level || '') === level)?.suggestedPrice || 0,
          }
        })
      : []
  const venueSections =
    selectedVenue?.seatingMode === 'NUMBERED'
      ? numberedZoneSections
      : selectedVenue?.seatMap?.sections?.filter((s) => s.name && s.seats) || []
  const usingTierPricing = venueSections.length > 0
  const venueLevels = Array.from(new Set(venueSections.map((s) => s.level || '')))

  // §4.5 - suggested rental amount, computed from the venue's own published
  // rate rather than asking the Organiser to guess a number blind. Only
  // possible for Hourly/Daily venues, which have an actual rate to compute
  // from - Flexible venues don't publish one, that's the whole point.
  const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const eventDayOfWeek = formData.date ? DAY_NAMES[new Date(formData.date + 'T00:00:00').getDay()] : null
  const dayOverride = selectedVenue?.dayRates?.find((d) => d.dayOfWeek === eventDayOfWeek)

  // BUG-2609-083 - length and billed hours come from one shared helper
  // (src/lib/venue-billing.ts), the same one the server records with.
  const eventLength = billableHours(formData.startTime, formData.endTime)
  const timeWarning = eventLength ? longEventText(f, eventLength) : null

  let suggestedAmount: number | null = null
  let suggestedAmountNote = ''
  if (selectedVenue?.rateType === 'HOURLY') {
    const rate = dayOverride?.hourlyRate || selectedVenue.hourlyRate
    if (rate && eventLength) {
      const hire = billableHours(formData.startTime, formData.endTime, selectedVenue.minDurationHours) ?? eventLength
      suggestedAmount = hourlyTotal(rate, hire.billedHours)
      // TODO i18n: hourlyNote's "₹/hr × n hr (…, billed as n hr)" formula stays English (venue-billing.ts, shared and unit-tested).
      suggestedAmountNote = `${hourlyNote(rate, hire, selectedVenue.minDurationHours)}${dayOverride?.hourlyRate ? ` — ${f.dayRateSuffix.replace('{day}', weekdayName(locale, formData.date))}` : ''}`
    }
  } else if (selectedVenue?.rateType === 'DAILY') {
    const rate = dayOverride?.dailyRate || selectedVenue.dailyRate
    if (rate) {
      suggestedAmount = rate
      suggestedAmountNote = `${f.dayRate}${dayOverride?.dailyRate ? ` — ${weekdayName(locale, formData.date)}` : ''}`
    }
  }

  useEffect(() => {
    if (suggestedAmount !== null) setBookingAmount(String(suggestedAmount))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedAmount])

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

  useEffect(() => {
    if (venueSections.length > 0) {
      const initial: Record<string, string> = {}
      venueSections.forEach((s) => {
        initial[tierKey(s)] = s.price ? String(s.price) : ''
      })
      setTierPrices(initial)
    } else {
      setTierPrices({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (error) setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData, isFree, ticketPrice, surpriseAct, venueId, bookingAmount,
    maxPerformers, applicationApprovalMode, maxSeatsPerBooking,
    plusOnesRequired, defaultCompensationType, defaultFeeAmount,
    defaultBuyInAmount, tierPrices,
    isCompetitionShow, competitionPrizeFirst, competitionPrizeSecond, competitionPrizeThird,
  ])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'type' && !dressVibeTouched && EVENT_TYPE_DEFAULTS[value]) {
      setFormData((prev) => ({ ...prev, type: value, ...EVENT_TYPE_DEFAULTS[value] }))
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDresscodeChange = (val: string) => {
    setDressVibeTouched(true)
    setFormData((prev) => ({ ...prev, dresscode: val }))
  }
  const handleVibeChange = (val: string) => {
    setDressVibeTouched(true)
    setFormData((prev) => ({ ...prev, vibe: val }))
  }

  const submit = async (publish: boolean) => {
    setSaving(true)
    setError('')

    const totalSeatsValue = usingTierPricing
      ? String(venueSections.reduce((sum, s) => sum + (Number(s.seats) || 0), 0))
      : formData.totalSeats

    const requiredFields: [unknown, string][] = [
      [formData.title, f.fieldTitle],
      [formData.description, f.fieldDescription],
      [formData.date, f.fieldDate],
      [formData.startTime, f.fieldStartTime],
      [formData.endTime, f.fieldEndTime],
      [totalSeatsValue, f.fieldTotalSeats],
    ]
    const missing = requiredFields.filter(([value]) => !value).map(([, label]) => label)
    if (missing.length > 0) {
      fail(f.missingFields.replace('{fields}', missing.join(', ')))
      setSaving(false)
      return
    }

    if (usingTierPricing && !isFree) {
      const missingPrice = venueSections.some((s) => !tierPrices[tierKey(s)] || Number(tierPrices[tierKey(s)]) <= 0)
      if (missingPrice) {
        fail(f.missingSectionPrice)
        setSaving(false)
        return
      }
    }

    const ticketTiers = usingTierPricing && !isFree
      ? venueSections.map((s) => ({
          sectionName: s.name,
          level: s.level || '',
          price: Number(tierPrices[tierKey(s)]),
          totalSeats: Number(s.seats),
        }))
      : undefined

    const seatsCap = Number(maxSeatsPerBooking)
    if (!seatsCap || seatsCap < 1 || seatsCap > 10) {
      fail(f.maxSeatsRange)
      setSaving(false)
      return
    }

    // Validation-gap cluster fix (26 Jul): these two previously had no
    // client-side check at all - blank sailed straight through to Publish.
    // Server-side (POST /api/events) is the real enforcement point; this
    // is just so the person doesn't wait on a round-trip to find out.
    const MAX_INR_AMOUNT = 10_000_000
    if (publish && !venueId) {
      fail(f.venueBeforePublish)
      setSaving(false)
      return
    }
    if (publish && venueId && !bookingAmount) {
      fail(f.offerBeforePublish)
      setSaving(false)
      return
    }
    if (bookingAmount && Number(bookingAmount) > MAX_INR_AMOUNT) {
      fail(f.offerTooHigh.replace('{max}', formatINR(MAX_INR_AMOUNT)))
      setSaving(false)
      return
    }
    if (publish && defaultCompensationType === 'PAID' && !defaultFeeAmount) {
      fail(f.feeBeforePublish)
      setSaving(false)
      return
    }
    if (defaultFeeAmount && Number(defaultFeeAmount) > MAX_INR_AMOUNT) {
      fail(f.feeTooHigh.replace('{max}', formatINR(MAX_INR_AMOUNT)))
      setSaving(false)
      return
    }
    if (publish && defaultCompensationType === 'BUY_IN' && !defaultBuyInAmount) {
      fail(f.buyInBeforePublish)
      setSaving(false)
      return
    }
    if (defaultBuyInAmount && Number(defaultBuyInAmount) > MAX_INR_AMOUNT) {
      fail(f.buyInTooHigh.replace('{max}', formatINR(MAX_INR_AMOUNT)))
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          totalSeats: totalSeatsValue,
          isFree,
          ticketPrice: isFree || usingTierPricing ? null : ticketPrice,
          ticketTiers,
          surpriseAct,
          venueId: venueId || null,
          bookingAmount: venueId ? bookingAmount : null,
          maxPerformers: maxPerformers ? Number(maxPerformers) : null,
          applicationApprovalMode,
          maxSeatsPerBooking: seatsCap,
          plusOnesRequired: plusOnesRequired ? Number(plusOnesRequired) : 0,
          defaultCompensationType,
          defaultFeeAmount: defaultCompensationType === 'PAID' ? defaultFeeAmount : null,
          defaultBuyInAmount: defaultCompensationType === 'BUY_IN' ? defaultBuyInAmount : null,
          isCompetitionShow,
          competitionPrizeFirst: isCompetitionShow ? competitionPrizeFirst : null,
          competitionPrizeSecond: isCompetitionShow ? competitionPrizeSecond : null,
          competitionPrizeThird: isCompetitionShow ? competitionPrizeThird : null,
          termsChecklist,
          specialNotes: specialNotes.trim() || null,
          ageLimit: ageLimit || null,
          publish,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || c.createFailed)
      }

      const newEvent = await res.json()
      const isVerified = (session?.user as any)?.isVerified
      if (!publish && !isVerified) {
        showToast(c.savedDraftVerify, 'info')
      } else if (publish && venueId) {
        showToast(c.submittedPending, 'info')
      }
      router.push(`/dashboard/organiser/events/${newEvent.id}`)
    } catch (err: any) {
      fail(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return (<><SiteNav /><DashboardShell><BrandLoader label={tr.dashboardChrome.loading} /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <PageTitle size="lg" style={{ marginBottom: 'var(--afa-space-2)' }}>
            {c.title}
          </PageTitle>
          <p style={{ fontSize: 'var(--afa-text-body-lg)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-32px)' }}>
            {c.subtitle}
          </p>

          {error && (
            <ErrorBanner style={{ marginBottom: 'var(--afa-space-6)' }}>{error}</ErrorBanner>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Event details */}
            <section style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>
                {f.eventDetails}
              </h2>
              <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-5)' }}>
                {f.liveOnlyNote}
              </p>

              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{f.titleLabel}</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder={f.titlePlaceholder} style={inputStyle} required />
              </div>

              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{f.descriptionLabel}</label>
                <textarea name="description" value={formData.description} onChange={handleChange} placeholder={f.descriptionPlaceholder} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-18px)', marginBottom: 'var(--afa-space-18px)' }}>
                <div>
                  <label style={labelStyle}>{f.eventTypeLabel}</label>
                  <select name="type" value={formData.type} onChange={handleChange} style={inputStyle}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{tr.eventTypes[t as keyof typeof tr.eventTypes] ?? t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{f.dateLabel}</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} min={todayLocalDateString()} max={maxDateString ?? undefined} style={inputStyle} required />
                  {windowMonths && (
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-1)' }}>
                      {f.dateWindowHint.replace('{months}', String(windowMonths))}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-18px)', marginBottom: 'var(--afa-space-18px)' }}>
                <div>
                  <label style={labelStyle}>{f.startTimeLabel}</label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    min={formData.date === todayLocalDateString() ? nowLocalTimeString() : undefined}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>{f.endTimeLabel}</label>
                  <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} style={inputStyle} required />
                </div>
              </div>
              {timeWarning && (
                <p role="status" data-afa-time-warning style={{ margin: '0 0 var(--afa-space-18px)', padding: 'var(--afa-space-10px) var(--afa-space-14px)', borderRadius: 'var(--afa-radius-md)', border: '1px solid var(--afa-amber-border)', background: 'var(--afa-amber-wash)', color: 'var(--afa-text-primary)', fontSize: 'var(--afa-text-ui)', lineHeight: 1.5 }}>
                  {timeWarning}
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-18px)' }}>
                <div>
                  <label style={labelStyle}>{f.dressCode}</label>
                  <PresetSelectWithOther
                    value={formData.dresscode}
                    onChange={handleDresscodeChange}
                    presets={DRESSCODE_PRESETS}
                    placeholder={f.dressCodePlaceholder}
                    presetLabels={labels}
                    noneLabel={f.presetNone}
                    otherLabel={f.presetOther}
                    inputStyle={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{f.vibe}</label>
                  <PresetSelectWithOther
                    value={formData.vibe}
                    onChange={handleVibeChange}
                    presets={VIBE_PRESETS}
                    placeholder={f.vibePlaceholder}
                    presetLabels={labels}
                    noneLabel={f.presetNone}
                    otherLabel={f.presetOther}
                    inputStyle={inputStyle}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-2)', marginTop: 'var(--afa-space-18px)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                <input type="checkbox" checked={surpriseAct} onChange={(e) => setSurpriseAct(e.target.checked)} />
                {f.surpriseAct}
              </label>

              {/* FEAT-2608-045 - curated checklist rather than free text,
                  so an organiser can't accidentally write something that
                  conflicts with AFA's own refund/cancellation policy
                  (linked below, platform-wide, not editable here). */}
              <div style={{ marginTop: 'var(--afa-space-6)', paddingTop: 'var(--afa-space-5)', borderTop: '1px solid var(--afa-tint-08)' }}>
                <label style={labelStyle}>{f.eventTerms}</label>
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-10px)' }}>
                  {f.eventTermsIntro.split('{link}')[0]}<Link href={REFUND_POLICY_LINK} target="_blank" style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>{f.refundPolicyLink}</Link>{f.eventTermsIntro.split('{link}')[1]}
                </p>

                <div style={{ marginBottom: 'var(--afa-space-4)', maxWidth: '260px' }}>
                  <label style={labelStyle}>{f.ageLimit}</label>
                  <PresetSelectWithOther
                    value={ageLimit}
                    onChange={setAgeLimit}
                    presets={AGE_LIMIT_PRESETS}
                    placeholder={f.ageLimitPlaceholder}
                    presetLabels={labels}
                    noneLabel={f.presetNone}
                    otherLabel={f.presetOther}
                    inputStyle={inputStyle}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-2) var(--afa-space-4)' }}>
                  {EVENT_TERMS_CHECKLIST.map((term) => (
                    <label key={term.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--afa-space-2)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={termsChecklist.includes(term.key)}
                        onChange={(e) => {
                          setTermsChecklist((prev) =>
                            e.target.checked ? [...prev, term.key] : prev.filter((k) => k !== term.key)
                          )
                        }}
                        style={{ marginTop: '3px' }} // token-ok(spacing-literal): 3px odd value, no exact token (GEN-2609-107)
                      />
                      <span>{tr.eventTermsChecklist[term.key as keyof typeof tr.eventTermsChecklist] || term.label}</span>
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: 'var(--afa-space-18px)' }}>
                  <label style={labelStyle}>{f.specialNotes}</label>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.55, marginBottom: 'var(--afa-space-6px)' }}>
                    {f.specialNotesHint}
                  </p>
                  <textarea
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value.slice(0, SPECIAL_NOTES_MAX_LENGTH))}
                    maxLength={SPECIAL_NOTES_MAX_LENGTH}
                    rows={3}
                    placeholder={f.specialNotesPlaceholder}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <p style={{ fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-primary)', opacity: 0.4, marginTop: 'var(--afa-space-1)', textAlign: 'right' }}>
                    {specialNotes.length}/{SPECIAL_NOTES_MAX_LENGTH}
                  </p>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-2)', marginTop: 'var(--afa-space-14px)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                <input type="checkbox" data-afa-competition-toggle checked={isCompetitionShow} onChange={(e) => setIsCompetitionShow(e.target.checked)} />
                {f.competitionToggle}
              </label>

              {isCompetitionShow && (
                <div style={{ marginTop: 'var(--afa-space-4)', padding: 'var(--afa-space-5)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)' }}>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-4)' }}>
                    {c.panelistsNote}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--afa-space-3)' }}>
                    <div>
                      <label style={labelStyle}>{f.prizeFirst}</label>
                      <input data-afa-prize="1" style={inputStyle} value={competitionPrizeFirst} onChange={(e) => setCompetitionPrizeFirst(e.target.value)} placeholder={f.prizeFirstPlaceholder} />
                    </div>
                    <div>
                      <label style={labelStyle}>{f.prizeSecond}</label>
                      <input data-afa-prize="2" style={inputStyle} value={competitionPrizeSecond} onChange={(e) => setCompetitionPrizeSecond(e.target.value)} placeholder={f.optional} />
                    </div>
                    <div>
                      <label style={labelStyle}>{f.prizeThird}</label>
                      <input data-afa-prize="3" style={inputStyle} value={competitionPrizeThird} onChange={(e) => setCompetitionPrizeThird(e.target.value)} placeholder={f.optional} />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Venue booking - moved before pricing since section pricing depends on the selected venue's seat map */}
            <section style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }}>
                {f.bookVenue}
              </h2>
              <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-18px)' }}>
                {f.bookVenueHint}
              </p>

              <div style={{ marginBottom: venueId ? 'var(--afa-space-18px)' : 0 }}>
                <label style={labelStyle}>{f.venue}</label>
                <select data-afa-venue-select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={inputStyle}>
                  <option value="">{f.noVenueSelected}</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{f.venueOption.replace('{name}', v.name).replace('{city}', v.city).replace('{seats}', seatsText(locale, f, v.capacity))}</option>
                  ))}
                </select>
              </div>

              {venueId && (
                <div>
                  {selectedVenue?.rateType === 'FLEXIBLE' || !selectedVenue?.rateType ? (
                    <>
                      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-10px)' }}>
                        {selectedVenue?.rateType === 'FLEXIBLE'
                          ? f.flexibleRateNote
                          : f.noRateNote}
                      </p>
                      <label style={labelStyle}>{f.offerAmount} <span style={{ fontWeight: 400, opacity: 0.6 }}>{f.offerAmountHint}</span></label>
                      <input type="number" value={bookingAmount} onChange={(e) => setBookingAmount(e.target.value)} min="0" max="10000000" placeholder={f.offerPlaceholder} style={inputStyle} />
                    </>
                  ) : (
                    <>
                      <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)', padding: 'var(--afa-space-3) var(--afa-space-14px)', marginBottom: 'var(--afa-space-10px)' }}>
                        <div data-afa-rate-note style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-2px)' }}>
                          {selectedVenue.rateType === 'HOURLY' ? f.hourlyRate : f.dailyRate}
                          {suggestedAmountNote && ` · ${suggestedAmountNote}`}
                        </div>
                        <div style={{ fontSize: 'var(--afa-text-lead)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>
                          {suggestedAmount !== null ? formatINR(suggestedAmount) : f.setDateTimeToCalculate}
                        </div>
                      </div>
                      <label style={labelStyle}>{f.offerAmount} <span style={{ fontWeight: 400, opacity: 0.6 }}>{f.offerAmountPrefilledHint}</span></label>
                      <input type="number" value={bookingAmount} onChange={(e) => setBookingAmount(e.target.value)} min="0" max="10000000" placeholder={f.offerPlaceholder} style={inputStyle} />
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Seats & pricing */}
            <section style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-5)' }}>
                {f.seatsAndPrice}
              </h2>

              <div style={{ display: 'flex', gap: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-18px)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-6px)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                  <input type="radio" checked={isFree} onChange={() => setIsFree(true)} /> {f.freeEntry}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-6px)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                  <input type="radio" checked={!isFree} onChange={() => setIsFree(false)} /> {f.paidEntry}
                </label>
              </div>

              {usingTierPricing ? (
                <div>
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-14px)' }}>
                    {f.sectionsFromSeatMap.replace('{venue}', selectedVenue?.name ?? '')}
                  </p>
                  {selectedVenue?.seatingMode === 'NUMBERED' && selectedVenue.seats && (
                    <SeatLayoutPreview seats={selectedVenue.seats} zoneOrder={Array.from(new Set(venueSections.map((s) => s.name)))} />
                  )}
                  {venueLevels.map((lvl) => (
                    <div key={lvl || '__single__'} style={{ marginBottom: venueLevels.length > 1 ? 'var(--afa-space-10px)' : 0 }}>
                      {venueLevels.length > 1 && (
                        <div style={{ fontSize: 'var(--afa-text-small)', fontWeight: 700, color: 'var(--afa-text-primary)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 'var(--afa-space-10px)', marginBottom: 'var(--afa-space-1)' }}>
                          {lvl || f.mainLevel}
                        </div>
                      )}
                      {venueSections.filter((s) => (s.level || '') === lvl).map((s) => (
                        <div key={tierKey(s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--afa-space-3)', padding: 'var(--afa-space-3) 0', borderBottom: '1px solid var(--afa-tint-06)' }}>
                          <div>
                            <div style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--afa-space-6px)' }}>
                              {selectedVenue?.seatingMode === 'NUMBERED' && (
                                <span style={{ width: '9px', height: '9px', borderRadius: 'var(--afa-radius-xs)', background: colorForZone(s.name, Array.from(new Set(venueSections.map((v) => v.name)))), display: 'inline-block', flexShrink: 0 }} />
                              )}
                              {s.name}
                            </div>
                            <div style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>{seatsText(locale, f, Number(s.seats) || 0)}</div>
                          </div>
                          {!isFree ? (
                            <input
                              type="number"
                              value={tierPrices[tierKey(s)] || ''}
                              onChange={(e) => setTierPrices((prev) => ({ ...prev, [tierKey(s)]: e.target.value }))}
                              min="0"
                              placeholder={f.pricePlaceholder}
                              style={{ ...inputStyle, width: '120px' }}
                            />
                          ) : (
                            <span style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>{f.free}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-14px)' }}>
                    {f.totalCapacity.replace('{seats}', seatsText(locale, f, venueSections.reduce((sum, s) => sum + (Number(s.seats) || 0), 0))).replace('{sections}', sectionsText(locale, f, venueSections.length))}
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                    <label style={labelStyle}>{f.totalSeatsLabel}</label>
                    <input type="number" name="totalSeats" value={formData.totalSeats} onChange={handleChange} min="1" placeholder={f.totalSeatsPlaceholder} style={inputStyle} required />
                  </div>
                  {!isFree && (
                    <div>
                      <label style={labelStyle}>{f.ticketPriceLabel}</label>
                      <input type="number" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} min="0" placeholder={f.ticketPricePlaceholder} style={inputStyle} />
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Lineup & approvals */}
            <section style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-18px)' }}>
                {f.lineupApprovals}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-18px)', marginBottom: 'var(--afa-space-18px)' }}>
                <div>
                  <label style={labelStyle}>{f.maxPerformers} <span style={{ fontWeight: 400, opacity: 0.6 }}>{f.optionalParen}</span></label>
                  <input type="number" value={maxPerformers} onChange={handleMaxPerformersChange} min="1" max={MAX_PERFORMERS} maxLength={3} placeholder={f.maxPerformersPlaceholder} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{f.maxSeatsPerBooking}</label>
                  <input type="number" value={maxSeatsPerBooking} onChange={handleMaxSeatsPerBookingChange} min="1" max="10" maxLength={2} style={inputStyle} />
                  <p style={{ fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-1)' }}>{f.maxSeatsHint}</p>
                </div>
              </div>

              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{f.plusOnes} <span style={{ fontWeight: 400, opacity: 0.6 }}>{f.optionalParen}</span></label>
                <input type="number" value={plusOnesRequired} onChange={handlePlusOnesRequiredChange} min="0" max="20" maxLength={2} placeholder="0" style={{ ...inputStyle, maxWidth: '120px' }} />
                <p style={{ fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-1)' }}>
                  {f.plusOnesHint}
                </p>
              </div>

              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{f.paymentTerms}</label>
                <p style={{ fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-2)' }}>
                  {f.paymentTermsHint}
                </p>
                <div style={{ display: 'flex', gap: 'var(--afa-space-2)', marginBottom: 'var(--afa-space-10px)' }}>
                  {([
                    { value: 'FREE', label: f.compFree },
                    { value: 'PAID', label: f.compPaid },
                    { value: 'BUY_IN', label: f.compBuyIn },
                  ] as const).map((opt) => (
                    <Button
                      key={opt.value}
                      variant="toggle-box"
                      size="md"
                      fullWidth={false}
                      selected={defaultCompensationType === opt.value}
                      type="button"
                      onClick={() => setDefaultCompensationType(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                {defaultCompensationType === 'PAID' && (
                  <input type="number" value={defaultFeeAmount} onChange={(e) => setDefaultFeeAmount(e.target.value)} min="0" max="10000000" placeholder={f.feePlaceholder} style={{ ...inputStyle, maxWidth: "200px" }} />
                )}
                {defaultCompensationType === 'BUY_IN' && (
                  <input type="number" value={defaultBuyInAmount} onChange={(e) => setDefaultBuyInAmount(e.target.value)} min="0" placeholder={f.buyInPlaceholder} style={{ ...inputStyle, maxWidth: '200px' }} />
                )}
              </div>

              <div>
                <label style={labelStyle}>{f.approvalMode}</label>
                <div style={{ display: 'flex', gap: 'var(--afa-space-2)' }}>
                  {(['MANUAL', 'AUTO'] as const).map((mode) => (
                    <Button
                      key={mode}
                      variant="toggle-box"
                      size="md"
                      fullWidth={false}
                      selected={applicationApprovalMode === mode}
                      type="button"
                      onClick={() => setApplicationApprovalMode(mode)}
                      style={{ flex: 1 }}
                    >
                      {mode === 'MANUAL' ? f.approvalManual : f.approvalAuto}
                    </Button>
                  ))}
                </div>
                {applicationApprovalMode === 'AUTO' && (
                  <p style={{ fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-6px)' }}>
                    {f.approvalAutoHint}
                  </p>
                )}
              </div>
            </section>

            {/* Actions */}
            {venueId && (
              <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-3)' }}>
                {f.pendingOnPublish.split('{pending}')[0]}<strong>{f.pendingWord}</strong>{f.pendingOnPublish.split('{pending}')[1]}
              </p>
            )}
            <div data-afa-action-row style={{ display: 'flex', gap: 'var(--afa-space-3)', alignItems: 'center' }}>
              <Button
                variant="primary"
                size="lg"
                fullWidth={false}
                type="button"
                disabled={saving}
                data-afa-publish-event
                onClick={() => submit(true)}
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? f.publishing : f.publishEvent}
              </Button>
              <Button
                variant="outline-neutral"
                size="lg"
                fullWidth={false}
                type="button"
                disabled={saving}
                onClick={() => submit(false)}
              >
                {f.saveDraft}
              </Button>
              <Link href="/dashboard/organiser" style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, textDecoration: 'none', marginLeft: 'var(--afa-space-1)' }}>
                {f.cancel}
              </Link>
            </div>
          </form>
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
