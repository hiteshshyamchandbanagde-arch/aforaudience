'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use, useCallback } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import { useToast } from '@/components/Toast'
import PresetSelectWithOther from '@/components/PresetSelectWithOther'
import BrandLoader from '@/components/BrandLoader'
import SeatLayoutPreview, { PreviewSeat, colorForZone } from '@/components/SeatLayoutPreview'
import { EVENT_TERMS_CHECKLIST, SPECIAL_NOTES_MAX_LENGTH, REFUND_POLICY_LINK } from '@/lib/event-terms'

interface SeatSection {
  id?: string
  name: string
  seats: number
  price: number
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

interface EventDetail {
  id: string
  title: string
  description: string
  type: string
  status: string
  date: string
  startTime: string
  endTime: string
  isFree: boolean
  ticketPrice: number | null
  totalSeats: number
  dresscode?: string | null
  vibe?: string | null
  surpriseAct: boolean
  plusOnesRequired: number
  termsChecklist?: string[]
  specialNotes?: string | null
  specialNotesStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  specialNotesRejectionReason?: string | null
  defaultCompensationType: 'FREE' | 'PAID' | 'BUY_IN'
  defaultFeeAmount: number | null
  defaultBuyInAmount: number | null
  venue: { id: string } | null
  venueBooking: { amount: number; fromDate: string; toDate: string } | null
  ticketTiers?: { sectionName: string; level?: string; price: number; totalSeats: number }[]
  isCompetitionShow?: boolean
  competitionPrizeFirst?: string | null
  competitionPrizeSecond?: string | null
  competitionPrizeThird?: string | null
  celebrities?: { id: string; name: string; photoUrl: string | null; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; userId: string | null }[]
  panelists?: { id: string; name: string; bio: string | null; photoUrl: string | null; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; userId: string | null }[]
  audienceVoteWeight?: number | null
  panelistVoteWeight?: number | null
  celebrityVoteWeight?: number | null
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid rgba(14,12,10,0.15)',
  background: 'var(--afa-white)',
  fontSize: '14px',
  color: 'var(--afa-ink)',
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
  color: 'var(--afa-ink)',
}

const EVENT_TYPES = ['OPEN_MIC', 'STAND_UP', 'POETRY', 'THEATER', 'LINEUP']
const DRESSCODE_PRESETS = ['Casual', 'Smart Casual', 'Formal', 'Costume / Theme']
const VIBE_PRESETS = ['High Energy', 'Intimate', 'Chill', 'Curated', 'Family-Friendly']

function toDateInputValue(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10)
}

// Past-date calendar fix (31 Jul feedback) - same reasoning as
// create/page.tsx's identical helper: computed in LOCAL time, not UTC, so
// IST users don't get blocked from selecting today's own date during the
// first ~5.5 hours of the local day.
function todayLocalDateString() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Companion to todayLocalDateString (31 Jul follow-up) - see
// create/page.tsx for the identical helper and reasoning.
function nowLocalTimeString() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [venues, setVenues] = useState<VenueOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    title: '', description: '', type: 'OPEN_MIC', date: '', startTime: '', endTime: '',
    totalSeats: '', dresscode: '', vibe: '',
  })
  const [isFree, setIsFree] = useState(true)
  const [ticketPrice, setTicketPrice] = useState('')
  const [surpriseAct, setSurpriseAct] = useState(false)
  // FEAT-2608-045 - specialNotesOriginal tracks what was loaded from the
  // server so the "you're about to reset this to pending" warning only
  // shows when the organiser has actually typed something different, not
  // on every render just because the field has a value.
  const [termsChecklist, setTermsChecklist] = useState<string[]>([])
  const [specialNotes, setSpecialNotes] = useState('')
  const [specialNotesOriginal, setSpecialNotesOriginal] = useState('')
  const [specialNotesStatus, setSpecialNotesStatus] = useState<'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'>('NONE')
  const [specialNotesRejectionReason, setSpecialNotesRejectionReason] = useState<string | null>(null)
  const [isCompetitionShow, setIsCompetitionShow] = useState(false)
  const [competitionPrizeFirst, setCompetitionPrizeFirst] = useState('')
  const [competitionPrizeSecond, setCompetitionPrizeSecond] = useState('')
  const [competitionPrizeThird, setCompetitionPrizeThird] = useState('')
  // Accept-to-Appear (§8, session 57) - panelists/celebrities are no
  // longer free-text/full-replace state; they're server-owned rows fetched
  // straight from `event`, with their own dedicated invite/remove
  // endpoints. Only the search-and-invite UI needs local state.
  const [panelistSearch, setPanelistSearch] = useState('')
  const [panelistSearchResults, setPanelistSearchResults] = useState<{ id: string; name: string; displayName: string | null; avatar: string | null }[]>([])
  const [panelistBioDraft, setPanelistBioDraft] = useState('')
  const [panelistInviting, setPanelistInviting] = useState(false)
  const [celebritySearch, setCelebritySearch] = useState('')
  const [celebritySearchResults, setCelebritySearchResults] = useState<{ id: string; name: string; displayName: string | null; avatar: string | null }[]>([])
  const [celebrityInviting, setCelebrityInviting] = useState(false)

  // Audience Choice voting weight override (§6, session 58) - blank
  // means "follow the platform default", same nullable-resolve pattern
  // as PlatformSettings.artistRosterHypeScoreLookback elsewhere in this
  // epic.
  const [audienceVoteWeight, setAudienceVoteWeight] = useState('')
  const [panelistVoteWeight, setPanelistVoteWeight] = useState('')
  const [celebrityVoteWeight, setCelebrityVoteWeight] = useState('')
  const [voteWeightSaving, setVoteWeightSaving] = useState(false)
  const [plusOnesRequired, setPlusOnesRequired] = useState('0')
  const [defaultCompensationType, setDefaultCompensationType] = useState<'FREE' | 'PAID' | 'BUY_IN'>('FREE')
  const [defaultFeeAmount, setDefaultFeeAmount] = useState('')
  const [defaultBuyInAmount, setDefaultBuyInAmount] = useState('')
  const [venueId, setVenueId] = useState('')
  const [bookingAmount, setBookingAmount] = useState('')


  // §9.2 (26 Jul) - Edit Event was on an older/diverged pricing form that
  // never derived per-zone pricing for Numbered venues at all (only a
  // flat ticketPrice field existed here) - same derivation as the Create
  // page below, so Numbered-venue events can actually be repriced after
  // creation instead of silently falling back to a field that doesn't
  // apply to them.
  const [tierPrices, setTierPrices] = useState<Record<string, string>>({})
  const tierKey = (s: { name: string; level?: string }) => `${s.level || ''}::${s.name}`
  // Existing per-section prices already saved on this event, keyed by
  // `${level}::${sectionName}` (level-aware, 28 Jul - was sectionName
  // alone) - takes priority over the venue's own suggested default
  // when first populating tierPrices, since re-opening Edit shouldn't
  // silently reset an organiser's already-set prices back to the venue
  // owner's mere starting suggestion.
  const [existingTierPrices, setExistingTierPrices] = useState<Record<string, string>>({})
  const originalVenueId = event?.venue?.id || ''

  const selectedVenue = venues.find((v) => v.id === venueId)
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

  const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const eventDayOfWeek = formData.date ? DAY_NAMES[new Date(formData.date + 'T00:00:00').getDay()] : null
  const dayOverride = selectedVenue?.dayRates?.find((d) => d.dayOfWeek === eventDayOfWeek)

  const durationHours = (() => {
    if (!formData.startTime || !formData.endTime) return null
    const [sh, sm] = formData.startTime.split(':').map(Number)
    const [eh, em] = formData.endTime.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins <= 0) mins += 24 * 60
    return mins / 60
  })()

  let suggestedAmount: number | null = null
  let suggestedAmountNote = ''
  if (selectedVenue?.rateType === 'HOURLY') {
    const rate = dayOverride?.hourlyRate || selectedVenue.hourlyRate
    if (rate && durationHours) {
      const billedHours = Math.max(durationHours, selectedVenue.minDurationHours || 0)
      suggestedAmount = Math.round(rate * billedHours)
      suggestedAmountNote = `₹${rate}/hr × ${billedHours} hr${selectedVenue.minDurationHours && billedHours > durationHours ? ` (min ${selectedVenue.minDurationHours}hr)` : ''}${dayOverride?.hourlyRate ? ` — ${eventDayOfWeek?.charAt(0)}${eventDayOfWeek?.slice(1).toLowerCase()} rate` : ''}`
    }
  } else if (selectedVenue?.rateType === 'DAILY') {
    const rate = dayOverride?.dailyRate || selectedVenue.dailyRate
    if (rate) {
      suggestedAmount = rate
      suggestedAmountNote = `Day rate${dayOverride?.dailyRate ? ` — ${eventDayOfWeek?.charAt(0)}${eventDayOfWeek?.slice(1).toLowerCase()}` : ''}`
    }
  }

  // Unlike Create (nothing to preserve), Edit must not silently overwrite
  // an already-negotiated Offer Amount just because the suggested-rate
  // calculation re-runs (e.g. the organiser tweaks the event time). Only
  // auto-fills when the venue itself is being changed away from what was
  // originally attached - a genuinely new pick has no saved amount yet,
  // same as Create's fresh-pick behavior.
  useEffect(() => {
    if (venueId && venueId !== originalVenueId && suggestedAmount !== null) {
      setBookingAmount(String(suggestedAmount))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedAmount, venueId, originalVenueId])

  useEffect(() => {
    if (venueSections.length > 0) {
      const initial: Record<string, string> = {}
      venueSections.forEach((s) => {
        initial[tierKey(s)] = existingTierPrices[tierKey(s)] ?? (s.price ? String(s.price) : '')
      })
      setTierPrices(initial)
    } else {
      setTierPrices({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, venues.length])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, venuesRes] = await Promise.all([
          fetch(`/api/events/${id}/owner`),
          fetch('/api/venues'),
        ])
        if (!eventRes.ok) {
          if (eventRes.status === 403) throw new Error('You do not have access to this event')
          throw new Error('Event not found')
        }
        const data: EventDetail = await eventRes.json()
        setEvent(data)
        setAudienceVoteWeight(data.audienceVoteWeight != null ? String(data.audienceVoteWeight) : '')
        setPanelistVoteWeight(data.panelistVoteWeight != null ? String(data.panelistVoteWeight) : '')
        setCelebrityVoteWeight(data.celebrityVoteWeight != null ? String(data.celebrityVoteWeight) : '')
        setFormData({
          title: data.title,
          description: data.description,
          type: data.type,
          date: toDateInputValue(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
          totalSeats: String(data.totalSeats),
          dresscode: data.dresscode || '',
          vibe: data.vibe || '',
        })
        setIsFree(data.isFree)
        setTicketPrice(data.ticketPrice != null ? String(data.ticketPrice) : '')
        setSurpriseAct(data.surpriseAct)
        setTermsChecklist(data.termsChecklist || [])
        setSpecialNotes(data.specialNotes || '')
        setSpecialNotesOriginal(data.specialNotes || '')
        setSpecialNotesStatus(data.specialNotesStatus || 'NONE')
        setSpecialNotesRejectionReason(data.specialNotesRejectionReason || null)
        setIsCompetitionShow(Boolean(data.isCompetitionShow))
        setCompetitionPrizeFirst(data.competitionPrizeFirst || '')
        setCompetitionPrizeSecond(data.competitionPrizeSecond || '')
        setCompetitionPrizeThird(data.competitionPrizeThird || '')
        setPlusOnesRequired(String(data.plusOnesRequired ?? 0))
        setDefaultCompensationType(data.defaultCompensationType || 'FREE')
        setDefaultFeeAmount(data.defaultFeeAmount != null ? String(data.defaultFeeAmount) : '')
        setDefaultBuyInAmount(data.defaultBuyInAmount != null ? String(data.defaultBuyInAmount) : '')
        setVenueId(data.venue?.id || '')
        setBookingAmount(data.venueBooking?.amount != null ? String(data.venueBooking.amount) : '')
        const existingMap: Record<string, string> = {}
        for (const t of data.ticketTiers || []) {
          existingMap[`${t.level || ''}::${t.sectionName}`] = String(t.price)
        }
        setExistingTierPrices(existingMap)

        if (venuesRes.ok) {
          setVenues(await venuesRes.json())
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Same clamp-on-change discipline as the create page's equivalent field -
  // client-side is decorative, PATCH /api/events/[id] validates independently.
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

  const save = async (publishOverride?: boolean) => {
    const publishing = publishOverride !== undefined ? publishOverride : event?.status !== 'DRAFT'
    // Validation-gap cluster fix (26 Jul) - same as the create page: these
    // previously had no client-side check, blank sailed through to Publish.
    const MAX_INR_AMOUNT = 10_000_000
    if (publishing && venueId && !bookingAmount) {
      showToast('Please enter an Offer Amount before publishing, or remove the venue.', 'error')
      return
    }
    if (bookingAmount && Number(bookingAmount) > MAX_INR_AMOUNT) {
      showToast(`Offer Amount can't exceed ₹${MAX_INR_AMOUNT.toLocaleString('en-IN')}.`, 'error')
      return
    }
    if (publishing && defaultCompensationType === 'PAID' && !defaultFeeAmount) {
      showToast('Please enter a Fee per artist before publishing, or choose Free/Buy-in instead.', 'error')
      return
    }
    if (defaultFeeAmount && Number(defaultFeeAmount) > MAX_INR_AMOUNT) {
      showToast(`Fee per artist can't exceed ₹${MAX_INR_AMOUNT.toLocaleString('en-IN')}.`, 'error')
      return
    }
    if (publishing && defaultCompensationType === 'BUY_IN' && !defaultBuyInAmount) {
      showToast('Please enter a Buy-in amount before publishing, or choose Free/Paid instead.', 'error')
      return
    }
    if (defaultBuyInAmount && Number(defaultBuyInAmount) > MAX_INR_AMOUNT) {
      showToast(`Buy-in amount can't exceed ₹${MAX_INR_AMOUNT.toLocaleString('en-IN')}.`, 'error')
      return
    }
    if (usingTierPricing && !isFree) {
      const missingPrice = venueSections.some((s) => !tierPrices[tierKey(s)] || Number(tierPrices[tierKey(s)]) <= 0)
      if (missingPrice) {
        showToast('Please set a price for every section.', 'error')
        return
      }
    }
    const totalSeatsValue = usingTierPricing
      ? String(venueSections.reduce((sum, s) => sum + (Number(s.seats) || 0), 0))
      : formData.totalSeats
    const ticketTiers = usingTierPricing && !isFree
      ? venueSections.map((s) => ({
          sectionName: s.name,
          level: s.level || '',
          price: Number(tierPrices[tierKey(s)]),
          totalSeats: Number(s.seats),
        }))
      : usingTierPricing
        // Free entry on a tiered venue still needs `ticketTiers` sent (even
        // at ₹0) so PATCH's full-replace persists the current section/seat
        // breakdown rather than leaving stale priced tiers from a previous
        // Paid save in place.
        ? venueSections.map((s) => ({ sectionName: s.name, level: s.level || '', price: 0, totalSeats: Number(s.seats) }))
        : []
    setSaving(true)

    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          totalSeats: totalSeatsValue,
          isFree,
          ticketPrice: isFree || usingTierPricing ? null : ticketPrice,
          ticketTiers,
          surpriseAct,
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
          ...(publishOverride !== undefined ? { publish: publishOverride } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update event')
      }

      // Venue booking is a separate resource, so it's updated as its own request.
      if (venueId && (!event?.venue || event.venue.id !== venueId)) {
        const vbRes = await fetch('/api/venue-bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venueId,
            eventId: id,
            fromDate: formData.date,
            toDate: formData.date,
            amount: bookingAmount,
          }),
        })
        if (!vbRes.ok) {
          const vbData = await vbRes.json().catch(() => ({}))
          if (vbData.reason === 'PHONE_NOT_VERIFIED') {
            router.push(`/verify-phone?next=${encodeURIComponent(`/dashboard/organiser/events/${id}/edit`)}`)
            return
          }
          throw new Error(vbData.error || 'Failed to book venue')
        }
      }

      showToast('Event saved.', 'success')
      router.push(`/dashboard/organiser/events/${id}`)
    } catch (err: any) {
      showToast(err.message || 'Failed to save event', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Accept-to-Appear (§8, session 57) - replaces the old free-text
  // celebrity/panelist photo-upload handlers entirely. Public display
  // always reads the linked account's own avatar once ACCEPTED, so
  // organiser-side photo upload has no path to ever surface publicly
  // anymore; not worth keeping around. refetchEvent() re-pulls the full
  // owner payload after any invite/remove action, same pattern the rest
  // of this page already uses for server-owned state.
  const refetchEvent = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/owner`)
    if (res.ok) setEvent(await res.json())
  }, [id])

  const saveVoteWeights = async (useDefault: boolean) => {
    setVoteWeightSaving(true)
    try {
      const payload = useDefault
        ? { audienceVoteWeight: null, panelistVoteWeight: null, celebrityVoteWeight: null }
        : {
            audienceVoteWeight: Number(audienceVoteWeight),
            panelistVoteWeight: Number(panelistVoteWeight),
            celebrityVoteWeight: Number(celebrityVoteWeight),
          }
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      if (useDefault) {
        setAudienceVoteWeight('')
        setPanelistVoteWeight('')
        setCelebrityVoteWeight('')
      }
      showToast('Saved.', 'success')
      await refetchEvent()
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setVoteWeightSaving(false)
    }
  }

  const searchPanelistCandidates = async (q: string) => {
    setPanelistSearch(q)
    if (q.trim().length < 2) {
      setPanelistSearchResults([])
      return
    }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data = await res.json()
      setPanelistSearchResults(data.users)
    }
  }

  const invitePanelist = async (userId: string) => {
    setPanelistInviting(true)
    try {
      const res = await fetch(`/api/events/${id}/panelists/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bio: panelistBioDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invite failed')
      setPanelistSearch('')
      setPanelistSearchResults([])
      setPanelistBioDraft('')
      showToast('Invite sent. They\'ll appear on the public page once they accept.', 'success')
      await refetchEvent()
    } catch (err: any) {
      showToast(err.message || 'Invite failed', 'error')
    } finally {
      setPanelistInviting(false)
    }
  }

  const removePanelist = async (panelistId: string) => {
    if (!confirm('Remove this panelist?')) return
    try {
      const res = await fetch(`/api/events/${id}/panelists/${panelistId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
      await refetchEvent()
    } catch (err: any) {
      showToast(err.message || 'Failed to remove', 'error')
    }
  }

  const searchCelebrityCandidates = async (q: string) => {
    setCelebritySearch(q)
    if (q.trim().length < 2) {
      setCelebritySearchResults([])
      return
    }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data = await res.json()
      setCelebritySearchResults(data.users)
    }
  }

  const inviteCelebrity = async (userId: string) => {
    setCelebrityInviting(true)
    try {
      const res = await fetch(`/api/events/${id}/celebrities/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invite failed')
      setCelebritySearch('')
      setCelebritySearchResults([])
      showToast('Invite sent. They\'ll appear on the public page once they accept.', 'success')
      await refetchEvent()
    } catch (err: any) {
      showToast(err.message || 'Invite failed', 'error')
    } finally {
      setCelebrityInviting(false)
    }
  }

  const removeCelebrity = async (celebrityId: string) => {
    if (!confirm('Remove this celebrity invite?')) return
    try {
      const res = await fetch(`/api/events/${id}/celebrities/${celebrityId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
      await refetchEvent()
    } catch (err: any) {
      showToast(err.message || 'Failed to remove', 'error')
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (error && !event) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)
  if (!event) return (<><SiteNav /><div style={{ padding: '32px' }}>Event not found</div></>)

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <BackLink href={`/dashboard/organiser/events/${id}`} label="Back to Event" />

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginTop: '16px', marginBottom: '8px' }}>
            Edit Event
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
            Update your event details, seats, pricing, and venue.
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '8px' }}>
                Event Details
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '20px' }}>
                AforAudience is for live performances - music, comedy, theatre, spoken word, and similar. Movie screenings and film events aren&apos;t supported on the platform.
              </p>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} style={inputStyle} required />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Description *</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} required />
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
                  <input type="date" name="date" value={formData.date} onChange={handleChange} min={todayLocalDateString()} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Start Time *</label>
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
                  <label style={labelStyle}>End Time *</label>
                  <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Dress Code</label>
                  <PresetSelectWithOther
                    value={formData.dresscode}
                    onChange={(val) => setFormData((prev) => ({ ...prev, dresscode: val }))}
                    presets={DRESSCODE_PRESETS}
                    placeholder="e.g., Vintage cocktail attire"
                    inputStyle={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Vibe</label>
                  <PresetSelectWithOther
                    value={formData.vibe}
                    onChange={(val) => setFormData((prev) => ({ ...prev, vibe: val }))}
                    presets={VIBE_PRESETS}
                    placeholder="e.g., Underground, edgy"
                    inputStyle={inputStyle}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px', fontSize: '14px', color: 'var(--afa-ink)' }}>
                <input type="checkbox" checked={surpriseAct} onChange={(e) => setSurpriseAct(e.target.checked)} />
                This event includes a surprise act
              </label>

              {/* FEAT-2608-045 */}
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(14,12,10,0.08)' }}>
                <label style={labelStyle}>Event terms</label>
                <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '10px' }}>
                  Select anything that applies to this event. AFA's refund and cancellation policy applies to every
                  booking platform-wide — <Link href={REFUND_POLICY_LINK} target="_blank" style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}>view it here</Link>.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  {EVENT_TERMS_CHECKLIST.map((term) => (
                    <label key={term.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', color: 'var(--afa-ink)' }}>
                      <input
                        type="checkbox"
                        checked={termsChecklist.includes(term.key)}
                        onChange={(e) => {
                          setTermsChecklist((prev) =>
                            e.target.checked ? [...prev, term.key] : prev.filter((k) => k !== term.key)
                          )
                        }}
                        style={{ marginTop: '3px' }}
                      />
                      <span>{term.label}</span>
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: '18px' }}>
                  <label style={labelStyle}>Special notes (optional)</label>
                  <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.55, marginBottom: '6px' }}>
                    Anything specific to this event that isn't covered above. Reviewed by AFA before it's shown
                    publicly.
                  </p>

                  {specialNotesStatus !== 'NONE' && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '999px',
                        marginBottom: '8px',
                        ...(specialNotesStatus === 'APPROVED'
                          ? { background: 'var(--afa-success-bg)', color: 'var(--afa-green-deep)' }
                          : specialNotesStatus === 'REJECTED'
                            ? { background: 'var(--afa-error-bg)', color: 'var(--afa-error)' }
                            : { background: 'var(--afa-amber-tint)', color: 'var(--afa-brown-gold)' }),
                      }}
                    >
                      {specialNotesStatus === 'APPROVED' ? '✓ Approved — visible on your event page' : specialNotesStatus === 'REJECTED' ? '✕ Rejected' : '⏳ Pending review'}
                    </div>
                  )}
                  {specialNotesStatus === 'REJECTED' && specialNotesRejectionReason && (
                    <p style={{ fontSize: '13px', color: 'var(--afa-error)', marginBottom: '8px' }}>
                      Reason: {specialNotesRejectionReason}
                    </p>
                  )}
                  {specialNotesStatus === 'APPROVED' && specialNotes !== specialNotesOriginal && (
                    <p style={{ fontSize: '12px', color: 'var(--afa-brown-gold)', marginBottom: '8px' }}>
                      Editing this will send it back for review — it won't be visible on your event page until
                      re-approved.
                    </p>
                  )}

                  <textarea
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value.slice(0, SPECIAL_NOTES_MAX_LENGTH))}
                    maxLength={SPECIAL_NOTES_MAX_LENGTH}
                    rows={3}
                    placeholder="e.g., This show includes strobe lighting and haze effects."
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--afa-ink)', opacity: 0.4, marginTop: '4px', textAlign: 'right' }}>
                    {specialNotes.length}/{SPECIAL_NOTES_MAX_LENGTH}
                  </p>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '14px', color: 'var(--afa-ink)' }}>
                <input type="checkbox" checked={isCompetitionShow} onChange={(e) => setIsCompetitionShow(e.target.checked)} />
                This is a competition show (panelists, prizes, celebrity guest)
              </label>

              {isCompetitionShow && (
                <div style={{ marginTop: '16px', padding: '20px', background: 'var(--afa-cream)', borderRadius: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={labelStyle}>1st Prize</label>
                      <input style={inputStyle} value={competitionPrizeFirst} onChange={(e) => setCompetitionPrizeFirst(e.target.value)} placeholder="e.g. ₹10,000 + trophy" />
                    </div>
                    <div>
                      <label style={labelStyle}>2nd Prize</label>
                      <input style={inputStyle} value={competitionPrizeSecond} onChange={(e) => setCompetitionPrizeSecond(e.target.value)} placeholder="Optional" />
                    </div>
                    <div>
                      <label style={labelStyle}>3rd Prize</label>
                      <input style={inputStyle} value={competitionPrizeThird} onChange={(e) => setCompetitionPrizeThird(e.target.value)} placeholder="Optional" />
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={labelStyle}>Celebrity Attending</label>
                    <p style={{ fontSize: '11px', color: 'var(--afa-ink)', opacity: 0.55, marginBottom: '10px' }}>
                      Invited by AFA account — they'll only appear publicly once they accept.
                    </p>
                    {(event?.celebrities || []).map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '8px 10px', background: 'var(--afa-white)', borderRadius: '8px' }}>
                        {c.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.photoUrl} alt={c.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        )}
                        <span style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>{c.name}</span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', textTransform: 'uppercase',
                          background: c.status === 'ACCEPTED' ? 'rgba(74,103,65,0.15)' : c.status === 'DECLINED' ? 'rgba(200,68,26,0.1)' : 'rgba(201,151,58,0.15)',
                          color: c.status === 'ACCEPTED' ? 'var(--afa-sage)' : c.status === 'DECLINED' ? 'var(--afa-terracotta)' : 'var(--afa-gold)',
                        }}>
                          {c.status}
                        </span>
                        <button type="button" onClick={() => removeCelebrity(c.id)} style={{ background: 'transparent', border: 'none', color: 'var(--afa-ink)', opacity: 0.5, cursor: 'pointer', fontSize: '16px' }} aria-label="Remove">✕</button>
                      </div>
                    ))}
                    <div style={{ position: 'relative' }}>
                      <input
                        style={inputStyle}
                        value={celebritySearch}
                        onChange={(e) => searchCelebrityCandidates(e.target.value)}
                        placeholder="Search by name to invite..."
                        disabled={celebrityInviting}
                      />
                      {celebritySearchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '8px', marginTop: '4px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                          {celebritySearchResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => inviteCelebrity(u.id)}
                              disabled={celebrityInviting}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                            >
                              {u.displayName || u.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Panelists</label>
                    <p style={{ fontSize: '11px', color: 'var(--afa-ink)', opacity: 0.55, marginBottom: '10px' }}>
                      Same as Celebrity — invited by account, only shown publicly once accepted.
                    </p>
                    {(event?.panelists || []).map((p) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '8px 10px', background: 'var(--afa-white)', borderRadius: '8px' }}>
                        {p.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photoUrl} alt={p.name} style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.name}</div>
                          {p.bio && <div style={{ fontSize: '11px', opacity: 0.6 }}>{p.bio}</div>}
                        </div>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', textTransform: 'uppercase',
                          background: p.status === 'ACCEPTED' ? 'rgba(74,103,65,0.15)' : p.status === 'DECLINED' ? 'rgba(200,68,26,0.1)' : 'rgba(201,151,58,0.15)',
                          color: p.status === 'ACCEPTED' ? 'var(--afa-sage)' : p.status === 'DECLINED' ? 'var(--afa-terracotta)' : 'var(--afa-gold)',
                        }}>
                          {p.status}
                        </span>
                        <button type="button" onClick={() => removePanelist(p.id)} style={{ background: 'transparent', border: 'none', color: 'var(--afa-ink)', opacity: 0.5, cursor: 'pointer', fontSize: '16px' }} aria-label="Remove">✕</button>
                      </div>
                    ))}
                    <input
                      style={{ ...inputStyle, marginBottom: '8px' }}
                      value={panelistBioDraft}
                      onChange={(e) => setPanelistBioDraft(e.target.value)}
                      placeholder="Bio for next invite (optional)"
                    />
                    <div style={{ position: 'relative' }}>
                      <input
                        style={inputStyle}
                        value={panelistSearch}
                        onChange={(e) => searchPanelistCandidates(e.target.value)}
                        placeholder="Search by name to invite..."
                        disabled={panelistInviting}
                      />
                      {panelistSearchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '8px', marginTop: '4px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                          {panelistSearchResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => invitePanelist(u.id)}
                              disabled={panelistInviting}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                            >
                              {u.displayName || u.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(14,12,10,0.1)' }}>
                    <label style={labelStyle}>Audience Choice vote weighting</label>
                    <p style={{ fontSize: '11px', color: 'var(--afa-ink)', opacity: 0.55, marginBottom: '10px' }}>
                      How much each voter category counts toward the Audience Choice result. Leave blank to follow the platform default (currently 80/10/10). Must sum to 100, Audience at least 50.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--afa-terracotta)', display: 'block', marginBottom: '4px' }}>AUDIENCE</label>
                        <input
                          type="number"
                          style={inputStyle}
                          value={audienceVoteWeight}
                          onChange={(e) => setAudienceVoteWeight(e.target.value)}
                          placeholder="80"
                          min={50}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--afa-terracotta)', display: 'block', marginBottom: '4px' }}>PANELIST</label>
                        <input
                          type="number"
                          style={inputStyle}
                          value={panelistVoteWeight}
                          onChange={(e) => setPanelistVoteWeight(e.target.value)}
                          placeholder="10"
                          min={0}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--afa-terracotta)', display: 'block', marginBottom: '4px' }}>CELEBRITY</label>
                        <input
                          type="number"
                          style={inputStyle}
                          value={celebrityVoteWeight}
                          onChange={(e) => setCelebrityVoteWeight(e.target.value)}
                          placeholder="10"
                          min={0}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => saveVoteWeights(false)}
                        disabled={voteWeightSaving || !audienceVoteWeight || !panelistVoteWeight || !celebrityVoteWeight}
                        style={{ fontSize: '13px', fontWeight: 700, color: 'white', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: voteWeightSaving ? 'default' : 'pointer', opacity: voteWeightSaving || !audienceVoteWeight || !panelistVoteWeight || !celebrityVoteWeight ? 0.5 : 1 }}
                      >
                        {voteWeightSaving ? 'Saving…' : 'Save override'}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveVoteWeights(true)}
                        disabled={voteWeightSaving}
                        style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-ink)', opacity: 0.6, background: 'transparent', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '8px', padding: '8px 16px', cursor: voteWeightSaving ? 'default' : 'pointer' }}
                      >
                        Use platform default
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '20px' }}>
                Seats & Ticket Price
              </h2>

              {usingTierPricing ? (
                <div style={{ marginBottom: '18px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '14px' }}>
                    Sections and seat counts come from {selectedVenue?.name}'s seat map - you only set the price per section for this event.
                  </p>
                  {selectedVenue?.seatingMode === 'NUMBERED' && selectedVenue.seats && (
                    <SeatLayoutPreview seats={selectedVenue.seats} zoneOrder={Array.from(new Set(venueSections.map((s) => s.name)))} />
                  )}
                  {venueLevels.map((lvl) => (
                    <div key={lvl || '__single__'} style={{ marginBottom: venueLevels.length > 1 ? '10px' : 0 }}>
                      {venueLevels.length > 1 && (
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-ink)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '10px', marginBottom: '4px' }}>
                          {lvl || 'Main'}
                        </div>
                      )}
                      {venueSections.filter((s) => (s.level || '') === lvl).map((s) => (
                        <div key={tierKey(s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderBottom: '1px solid rgba(14,12,10,0.06)' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {selectedVenue?.seatingMode === 'NUMBERED' && (
                                <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: colorForZone(s.name, Array.from(new Set(venueSections.map((v) => v.name)))), display: 'inline-block', flexShrink: 0 }} />
                              )}
                              {s.name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5 }}>{s.seats} seats</div>
                          </div>
                          {!isFree ? (
                            <input
                              type="number"
                              value={tierPrices[tierKey(s)] || ''}
                              onChange={(e) => setTierPrices((prev) => ({ ...prev, [tierKey(s)]: e.target.value }))}
                              min="0"
                              placeholder="₹ price"
                              style={{ ...inputStyle, width: '120px' }}
                            />
                          ) : (
                            <span style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.5 }}>Free</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                  <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginTop: '14px' }}>
                    Total capacity: {venueSections.reduce((sum, s) => sum + (Number(s.seats) || 0), 0)} seats across {venueSections.length} section{venueSections.length === 1 ? '' : 's'}
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: '18px' }}>
                  <label style={labelStyle}>Total Seats *</label>
                  <input type="number" name="totalSeats" value={formData.totalSeats} onChange={handleChange} min="1" style={inputStyle} required />
                </div>
              )}

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Require a &quot;+1&quot; per artist <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="number" value={plusOnesRequired} onChange={handlePlusOnesRequiredChange} min="0" max="20" style={{ ...inputStyle, maxWidth: '120px' }} />
                <p style={{ fontSize: '11px', color: 'var(--afa-ink)', opacity: 0.5, marginTop: '4px' }}>
                  Each artist in the lineup must have this many audience members confirm support - included in their spot fee. Set to 0 if not required.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--afa-ink)' }}>
                  <input type="radio" checked={isFree} onChange={() => setIsFree(true)} /> Free entry
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--afa-ink)' }}>
                  <input type="radio" checked={!isFree} onChange={() => setIsFree(false)} /> Paid entry
                </label>
              </div>

              {!isFree && !usingTierPricing && (
                <div>
                  <label style={labelStyle}>Ticket Price (₹)</label>
                  <input type="number" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} min="0" style={inputStyle} />
                </div>
              )}
            </section>

            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                Artist Payment Terms
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '18px' }}>
                Shown to Artists before they apply. You can still negotiate a different amount with a specific artist when approving their application.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {([
                  { value: 'FREE', label: 'Free / Exposure' },
                  { value: 'PAID', label: 'Paid' },
                  { value: 'BUY_IN', label: 'Buy-in (pay to play)' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDefaultCompensationType(opt.value)}
                    style={{
                      padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      border: defaultCompensationType === opt.value ? '2px solid var(--afa-terracotta)' : '1px solid rgba(14,12,10,0.15)',
                      background: defaultCompensationType === opt.value ? 'rgba(200,68,26,0.08)' : 'var(--afa-white)',
                      color: defaultCompensationType === opt.value ? 'var(--afa-terracotta)' : 'var(--afa-ink)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {defaultCompensationType === 'PAID' && (
                <input type="number" value={defaultFeeAmount} onChange={(e) => setDefaultFeeAmount(e.target.value)} min="0" max="10000000" placeholder="Fee per artist (₹)" style={{ ...inputStyle, maxWidth: '200px' }} />
              )}
              {defaultCompensationType === 'BUY_IN' && (
                <input type="number" value={defaultBuyInAmount} onChange={(e) => setDefaultBuyInAmount(e.target.value)} min="0" placeholder="Buy-in amount (₹)" style={{ ...inputStyle, maxWidth: '200px' }} />
              )}
            </section>

            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                Venue
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '18px' }}>
                Changing the venue sends a new booking request.
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
                  {venueId !== originalVenueId && (selectedVenue?.rateType === 'HOURLY' || selectedVenue?.rateType === 'DAILY') && (
                    <div style={{ background: 'var(--afa-cream)', borderRadius: '8px', padding: '12px 14px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '2px' }}>
                        {selectedVenue.rateType === 'HOURLY' ? 'Hourly rate' : 'Daily rate'}
                        {suggestedAmountNote && ` · ${suggestedAmountNote}`}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--afa-ink)' }}>
                        {suggestedAmount !== null ? `₹${suggestedAmount.toLocaleString('en-IN')}` : 'Set your event date & time to calculate'}
                      </div>
                    </div>
                  )}
                  <label style={labelStyle}>Offer Amount (₹) {venueId !== originalVenueId && <span style={{ fontWeight: 400, opacity: 0.6 }}>— pre-filled from the venue's rate, editable</span>}</label>
                  <input type="number" value={bookingAmount} onChange={(e) => setBookingAmount(e.target.value)} min="0" max="10000000" style={inputStyle} />
                </div>
              )}
            </section>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(event.status === 'APPROVED' ? true : undefined)}
                style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-cream)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : event.status === 'APPROVED' ? 'Save Changes' : 'Save & Publish'}
              </button>
              {event.status !== 'APPROVED' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(false)}
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-ink)', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  Save as Draft
                </button>
              )}
              <Link href={`/dashboard/organiser/events/${id}`} style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.6, textDecoration: 'none' }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
