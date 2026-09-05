/**
 * QA seed script — see docs/qa-seed-script-spec.md for the full brief.
 *
 * Wipes QA to a clean baseline (preserving ADMIN users) and reseeds a
 * "feels real" dataset: volume accounts, a couple handfuls of general
 * events, the fixed-ID e2e fixture accounts, and one hand-built "golden"
 * Competition Show scenario for the reputation epic to render against.
 *
 * Run: npm run db:seed:qa
 */

import "dotenv/config"
import { PrismaClient, Role, EventType, EventStatus, ApprovalMode, CompensationType, RateType, BookingStatus, InviteStatus } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { fakerEN_IN as faker } from "@faker-js/faker"
import bcrypt from "bcryptjs"

// ---------------------------------------------------------------------------
// Hard guard — must run before any DB connection object is constructed.
// A wipe-and-reseed pointed at prod would be catastrophic, so this checks
// the raw connection string's Supabase project ref before anything else in
// this file touches the network.
// ---------------------------------------------------------------------------

const QA_PROJECT_REF = "nqiyrypmjtogoocerxtu"
const PROD_PROJECT_REF = "cncumfwwnjcwacggrgsr"

function assertQaDatabase(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("[qa-seed] DATABASE_URL is not set. Refusing to run.")
    process.exit(1)
  }
  if (url.includes(PROD_PROJECT_REF)) {
    console.error(
      `[qa-seed] DATABASE_URL points at the PROD Supabase project (${PROD_PROJECT_REF}). ` +
        `Refusing to run — this script is destructive and QA-only, never point it at prod.`
    )
    process.exit(1)
  }
  if (!url.includes(QA_PROJECT_REF)) {
    console.error(
      `[qa-seed] DATABASE_URL does not reference the QA Supabase project (${QA_PROJECT_REF}). ` +
        `Refusing to run against an unrecognized database.`
    )
    process.exit(1)
  }
  return url
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const pad = (n: number, width: number) => String(n).padStart(width, "0")

const VOLUME_PASSWORD = "QaPass!2026"
const passwordHashCache = new Map<string, string>()
async function hashPassword(pw: string): Promise<string> {
  let hash = passwordHashCache.get(pw)
  if (!hash) {
    hash = await bcrypt.hash(pw, 10)
    passwordHashCache.set(pw, hash)
  }
  return hash
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

function pick<T>(arr: T[]): T {
  return faker.helpers.arrayElement(arr)
}

function pickMany<T>(arr: T[], count: number): T[] {
  return faker.helpers.arrayElements(arr, Math.min(count, arr.length))
}

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const GENRES = ["Stand-up Comedy", "Poetry", "Music - Acoustic", "Music - Band", "Theatre", "Storytelling", "Open Mic", "Dance", "Magic", "Improv"]
const STYLE_TAGS = ["Observational", "Dark Humor", "Romantic", "Experimental", "Classical", "Contemporary", "Folk", "Fusion", "High Energy", "Minimalist"]
const EVENT_TYPES: EventType[] = ["OPEN_MIC", "STAND_UP", "POETRY", "THEATER", "LINEUP"]
const VENUE_SUFFIXES = ["Lounge", "Hall", "Club", "Theatre", "Cafe", "Arena", "Bar", "Studio"]

// ---------------------------------------------------------------------------
// Wipe — FK-safe dependency order (children before parents).
// Preserves User rows where role='ADMIN' and leaves system/config/live-data
// tables (PlatformSettings, DisplayCurrencyRate, CodeCounter, GenreRequest,
// Otp, Feedback, FeedbackChangeLog) untouched — those aren't seeded test
// data. Feedback in particular is real project feedback (bug reports/
// feature ideas submitted through the live support widget), not a fixture
// to be wiped and reseeded. Feedback.userId is onDelete:SetNull, so
// deleting a non-admin User with existing Feedback rows is still FK-safe
// without deleting Feedback itself first.
// ---------------------------------------------------------------------------

async function wipe(prisma: PrismaClient) {
  console.log("\n[wipe] Deleting in FK-safe dependency order (preserving role=ADMIN users)...")

  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    ["ReviewReply", () => prisma.reviewReply.deleteMany()],
    ["CompanionTag", () => prisma.companionTag.deleteMany()],
    ["PlusOne", () => prisma.plusOne.deleteMany()],
    ["BookingSeat", () => prisma.bookingSeat.deleteMany()],
    ["OrganiserPayoutLedger", () => prisma.organiserPayoutLedger.deleteMany()],
    ["Payment", () => prisma.payment.deleteMany()],
    ["CompetitionVote", () => prisma.competitionVote.deleteMany()],
    ["OrganiserArtistRating", () => prisma.organiserArtistRating.deleteMany()],
    ["Celebrity", () => prisma.celebrity.deleteMany()],
    ["EventPanelist", () => prisma.eventPanelist.deleteMany()],
    ["Application", () => prisma.application.deleteMany()],
    ["VenueBookingOffer", () => prisma.venueBookingOffer.deleteMany()],
    ["TicketTier", () => prisma.ticketTier.deleteMany()],
    ["VenueAvailability", () => prisma.venueAvailability.deleteMany()],
    ["VenueLevelUnderlay", () => prisma.venueLevelUnderlay.deleteMany()],
    ["VenueMarker", () => prisma.venueMarker.deleteMany()],
    ["VenueZonePrice", () => prisma.venueZonePrice.deleteMany()],
    ["VenueDayRate", () => prisma.venueDayRate.deleteMany()],
    ["PushSubscription", () => prisma.pushSubscription.deleteMany()],
    ["PasswordResetToken", () => prisma.passwordResetToken.deleteMany()],
    ["EmailVerificationToken", () => prisma.emailVerificationToken.deleteMany()],
    ["Follow", () => prisma.follow.deleteMany()],
    ["Message", () => prisma.message.deleteMany()],
    ["ConversationParticipant", () => prisma.conversationParticipant.deleteMany()],
    ["Review", () => prisma.review.deleteMany()],
    ["Booking", () => prisma.booking.deleteMany()],
    ["Seat", () => prisma.seat.deleteMany()],
    ["Performance", () => prisma.performance.deleteMany()],
    ["VenueBookingRequest", () => prisma.venueBookingRequest.deleteMany()],
    ["VenueBooking", () => prisma.venueBooking.deleteMany()],
    ["Conversation", () => prisma.conversation.deleteMany()],
    ["Event", () => prisma.event.deleteMany()],
    // Pre-existing gap found while running this script (not previously hit
    // because these 4 tables happened to be empty on past runs): all four
    // reference Artist/Organiser with no onDelete cascade, so a non-empty
    // CorporateBookingInquiry/ArtistTourStop/TourArtistConsent/Tour blocks
    // the Artist/Organiser deleteMany below with a real FK violation, not
    // just a hypothetical one - reproduced against the live QA DB.
    ["TourArtistConsent", () => prisma.tourArtistConsent.deleteMany()],
    ["Tour", () => prisma.tour.deleteMany()],
    ["CorporateBookingInquiry", () => prisma.corporateBookingInquiry.deleteMany()],
    ["ArtistTourStop", () => prisma.artistTourStop.deleteMany()],
    ["Artist", () => prisma.artist.deleteMany()],
    ["Organiser", () => prisma.organiser.deleteMany()],
    ["Venue", () => prisma.venue.deleteMany()],
    ["VenueOwner", () => prisma.venueOwner.deleteMany()],
    ["User (non-admin)", () => prisma.user.deleteMany({ where: { role: { not: Role.ADMIN } } })],
  ]

  for (const [name, run] of steps) {
    const { count } = await run()
    console.log(`  - ${name}: ${count} deleted`)
  }
}

// ---------------------------------------------------------------------------
// Volume — 100 audience, 10 organiser, 10 venue owner (+1 venue each), 100
// artist. Faker supplies the "feels real" display name/bio/avatar content;
// login email/username stay deterministic (qa.audience001@example.com style)
// on purpose, so Hitesh can actually type them from memory while click-
// testing instead of hunting through a DB browser for a random Faker email.
// All volume accounts share VOLUME_PASSWORD.
// ---------------------------------------------------------------------------

type SeededUser = { id: string; email: string; displayName: string }
type SeededOrganiser = SeededUser & { organiserId: string }
type SeededVenueOwner = SeededUser & { venueOwnerId: string; venueId: string; venueName: string }
type SeededArtist = SeededUser & { artistId: string }

async function seedVolume(prisma: PrismaClient) {
  const passwordHash = await hashPassword(VOLUME_PASSWORD)

  console.log("\n[seed] Volume: 100 audience...")
  const audiences: SeededUser[] = await mapWithConcurrency(
    Array.from({ length: 100 }, (_, i) => i + 1),
    10,
    async (i) => {
      const id = `qa-audience-${pad(i, 3)}`
      const email = `qa.audience${pad(i, 3)}@example.com`
      const displayName = faker.person.fullName()
      await prisma.user.upsert({
        where: { id },
        update: { email, displayName, password: passwordHash },
        create: {
          id,
          name: `qa_audience_${pad(i, 3)}`,
          email,
          displayName,
          password: passwordHash,
          role: Role.AUDIENCE,
          phone: `+91${faker.string.numeric(10)}`,
          avatar: faker.image.avatarGitHub(),
          isVerified: true,
          isApproved: true,
        },
      })
      return { id, email, displayName }
    }
  )

  console.log("[seed] Volume: 10 organiser...")
  const organisers: SeededOrganiser[] = await mapWithConcurrency(
    Array.from({ length: 10 }, (_, i) => i + 1),
    5,
    async (i) => {
      const userId = `qa-organiser-user-${pad(i, 2)}`
      const organiserId = `qa-organiser-${pad(i, 2)}`
      const email = `qa.organiser${pad(i, 2)}@example.com`
      const displayName = faker.person.fullName()
      const orgName = `${faker.company.name()} Events`
      await prisma.user.upsert({
        where: { id: userId },
        update: { email, displayName, password: passwordHash },
        create: {
          id: userId,
          name: `qa_organiser_${pad(i, 2)}`,
          email,
          displayName,
          password: passwordHash,
          role: Role.ORGANISER,
          phone: `+91${faker.string.numeric(10)}`,
          avatar: faker.image.avatarGitHub(),
          isVerified: true,
          isApproved: true,
        },
      })
      await prisma.organiser.upsert({
        where: { id: organiserId },
        update: { orgName },
        create: { id: organiserId, userId, orgName, bio: faker.company.catchPhrase(), isApproved: true },
      })
      return { id: userId, email, displayName, organiserId }
    }
  )

  console.log("[seed] Volume: 10 venue owner (+1 venue each)...")
  const venueOwners: SeededVenueOwner[] = await mapWithConcurrency(
    Array.from({ length: 10 }, (_, i) => i + 1),
    5,
    async (i) => {
      const userId = `qa-venueowner-user-${pad(i, 2)}`
      const venueOwnerId = `qa-venueowner-${pad(i, 2)}`
      const venueId = `qa-venue-${pad(i, 2)}`
      const email = `qa.venueowner${pad(i, 2)}@example.com`
      const displayName = faker.person.fullName()
      const venueName = `${faker.location.city()} ${pick(VENUE_SUFFIXES)}`
      await prisma.user.upsert({
        where: { id: userId },
        update: { email, displayName, password: passwordHash },
        create: {
          id: userId,
          name: `qa_venueowner_${pad(i, 2)}`,
          email,
          displayName,
          password: passwordHash,
          role: Role.VENUE_OWNER,
          phone: `+91${faker.string.numeric(10)}`,
          avatar: faker.image.avatarGitHub(),
          isVerified: true,
          isApproved: true,
        },
      })
      await prisma.venueOwner.upsert({
        where: { id: venueOwnerId },
        update: {},
        create: { id: venueOwnerId, userId, isApproved: true },
      })
      const city = faker.location.city()
      await prisma.venue.upsert({
        where: { id: venueId },
        update: { name: venueName },
        create: {
          id: venueId,
          ownerId: venueOwnerId,
          name: venueName,
          address: faker.location.streetAddress(),
          city,
          state: faker.location.state(),
          country: "India",
          capacity: faker.number.int({ min: 40, max: 300 }),
          photos: [],
          facilities: pickMany(["Parking", "AC", "Sound System", "Green Room", "Bar", "Stage Lighting"], 3),
          isApproved: true,
          rateType: RateType.HOURLY,
          hourlyRate: faker.number.int({ min: 800, max: 4000 }),
          seatingMode: "GENERAL_ADMISSION",
        },
      })
      return { id: userId, email, displayName, venueOwnerId, venueId, venueName }
    }
  )

  console.log("[seed] Volume: 100 artist...")
  const artists: SeededArtist[] = await mapWithConcurrency(
    Array.from({ length: 100 }, (_, i) => i + 1),
    10,
    async (i) => {
      const userId = `qa-artist-user-${pad(i, 3)}`
      const artistId = `qa-artist-${pad(i, 3)}`
      const email = `qa.artist${pad(i, 3)}@example.com`
      const displayName = faker.person.fullName()
      await prisma.user.upsert({
        where: { id: userId },
        update: { email, displayName, password: passwordHash },
        create: {
          id: userId,
          name: `qa_artist_${pad(i, 3)}`,
          email,
          displayName,
          password: passwordHash,
          role: Role.ARTIST,
          phone: `+91${faker.string.numeric(10)}`,
          avatar: faker.image.avatarGitHub(),
          isVerified: true,
          isApproved: true,
        },
      })
      await prisma.artist.upsert({
        where: { id: artistId },
        update: {},
        create: {
          id: artistId,
          userId,
          bio: faker.lorem.sentence(),
          genre: pickMany(GENRES, faker.number.int({ min: 1, max: 3 })),
          styleTag: pickMany(STYLE_TAGS, faker.number.int({ min: 1, max: 2 })),
          videoReel: [],
          tagline: faker.lorem.words({ min: 3, max: 6 }),
        },
      })
      return { id: userId, email, displayName, artistId }
    }
  )

  return { audiences, organisers, venueOwners, artists }
}

// ---------------------------------------------------------------------------
// General events — a handful of ordinary events layered over the volume
// pool so /events isn't just the fixture + golden scenario. Mix of
// upcoming/past/draft/pending so every organiser-dashboard status has at
// least one real row to look at.
// ---------------------------------------------------------------------------

async function seedGeneralEvents(
  prisma: PrismaClient,
  pools: { organisers: SeededOrganiser[]; venueOwners: SeededVenueOwner[]; artists: SeededArtist[]; audiences: SeededUser[] }
) {
  console.log("\n[seed] General events (handful, for browsing/dashboard realism)...")

  type Plan = { status: EventStatus; dateOffsetDays: number; withBookingsReviews: boolean }
  const plans: Plan[] = [
    { status: EventStatus.APPROVED, dateOffsetDays: 7, withBookingsReviews: true },
    { status: EventStatus.APPROVED, dateOffsetDays: 14, withBookingsReviews: true },
    { status: EventStatus.APPROVED, dateOffsetDays: 21, withBookingsReviews: true },
    { status: EventStatus.APPROVED, dateOffsetDays: 30, withBookingsReviews: false },
    { status: EventStatus.APPROVED, dateOffsetDays: 45, withBookingsReviews: false },
    { status: EventStatus.APPROVED, dateOffsetDays: 60, withBookingsReviews: false },
    { status: EventStatus.COMPLETED, dateOffsetDays: -10, withBookingsReviews: true },
    { status: EventStatus.COMPLETED, dateOffsetDays: -25, withBookingsReviews: true },
    { status: EventStatus.DRAFT, dateOffsetDays: 40, withBookingsReviews: false },
    { status: EventStatus.PENDING_APPROVAL, dateOffsetDays: 35, withBookingsReviews: false },
  ]

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]
    const eventId = `qa-general-event-${pad(i + 1, 2)}`
    const organiser = pick(pools.organisers)
    const venueOwner = pick(pools.venueOwners)
    const type = pick(EVENT_TYPES)
    const isFree = faker.datatype.boolean(0.3)
    const title = `${venueOwner.venueName.split(" ")[0]} ${faker.helpers.arrayElement(["Mic Night", "Comedy Jam", "Poetry Slam", "Live Session", "Showcase"])} #${i + 1}`

    await prisma.event.upsert({
      where: { id: eventId },
      update: { status: plan.status },
      create: {
        id: eventId,
        organiserId: organiser.organiserId,
        venueId: venueOwner.venueId,
        title,
        description: faker.lorem.paragraph(),
        type,
        status: plan.status,
        date: daysFromNow(plan.dateOffsetDays),
        startTime: "19:00",
        endTime: "21:30",
        isFree,
        ticketPrice: isFree ? null : faker.number.int({ min: 150, max: 600 }),
        totalSeats: 80,
        availableSeats: 80,
        maxPerformers: 4,
        applicationApprovalMode: ApprovalMode.MANUAL,
        defaultCompensationType: CompensationType.FREE,
      },
    })

    const lineupArtists = pickMany(pools.artists, faker.number.int({ min: 2, max: 4 }))
    for (let slot = 0; slot < lineupArtists.length; slot++) {
      const performanceId = `${eventId}-perf-${slot + 1}`
      await prisma.performance.upsert({
        where: { id: performanceId },
        update: {},
        create: {
          id: performanceId,
          eventId,
          artistId: lineupArtists[slot].artistId,
          slot: slot + 1,
          duration: 10,
          compensationType: CompensationType.FREE,
        },
      })
    }

    if (plan.withBookingsReviews) {
      const bookers = pickMany(pools.audiences, faker.number.int({ min: 2, max: 5 }))
      for (let b = 0; b < bookers.length; b++) {
        const bookingId = `${eventId}-booking-${b + 1}`
        const subtotal = isFree ? 0 : faker.number.int({ min: 150, max: 600 })
        const isPastEvent = plan.status === EventStatus.COMPLETED
        await prisma.booking.upsert({
          where: { id: bookingId },
          update: {},
          create: {
            id: bookingId,
            userId: bookers[b].id,
            eventId,
            seats: isFree ? {} : { General: 1 },
            totalAmount: subtotal,
            subtotalAmount: subtotal,
            bookingFeeAmount: 0,
            status: BookingStatus.CONFIRMED,
            checkedInAt: isPastEvent ? daysFromNow(plan.dateOffsetDays) : null,
            checkedInByUserId: isPastEvent ? organiser.id : null,
          },
        })
        if (isPastEvent && b < 3) {
          await prisma.review.upsert({
            where: { id: `${eventId}-review-${b + 1}` },
            update: {},
            create: {
              id: `${eventId}-review-${b + 1}`,
              userId: bookers[b].id,
              eventId,
              rating: faker.number.int({ min: 3, max: 5 }),
              comment: faker.lorem.sentence(),
            },
          })
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// E2E fixtures — must exactly match e2e/helpers/roles.ts and the literal
// strings asserted in e2e/smoke.spec.ts / numbered-seat-booking.spec.ts.
// Kept empty of Applications/Performances/Bookings on the waitlist fixture
// event (maxPerformers:1) so waitlist-wallet-credit.spec.ts's ordering
// assumption (A applies -> approved -> B waitlisted) holds on every fresh
// run.
// ---------------------------------------------------------------------------

async function seedE2eFixtures(prisma: PrismaClient) {
  console.log("\n[seed] E2E fixtures (waitlist/wallet organiser+venue+event, Jaipur Mic Gala 100)...")

  const passwordHash = await hashPassword("E2eFixture!2026")

  const fixtureUserId = "e2efixtureorguser01"
  const fixtureOrganiserId = "e2efixtureorg0001org"
  const fixtureVenueOwnerId = "e2efixturevo0001own"
  const fixtureVenueId = "e2efixturevenue0001"
  const fixtureEventId = "e2efixtureevt00001"
  const fixtureVenueBookingId = "e2efixturevb0001"

  await prisma.user.upsert({
    where: { id: fixtureUserId },
    update: { password: passwordHash },
    create: {
      id: fixtureUserId,
      name: "e2e_fixture_org",
      email: "e2e.fixture.organiser@example.com",
      displayName: "E2E Fixture Organiser",
      password: passwordHash,
      role: Role.ORGANISER,
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.organiser.upsert({
    where: { id: fixtureOrganiserId },
    update: {},
    create: { id: fixtureOrganiserId, userId: fixtureUserId, orgName: "E2E Fixture Organiser Co.", isApproved: true },
  })

  const fixtureVenueOwnerUserId = "e2efixturevo0001usr"
  await prisma.user.upsert({
    where: { id: fixtureVenueOwnerUserId },
    update: { password: passwordHash },
    create: {
      id: fixtureVenueOwnerUserId,
      name: "e2e_fixture_venowner",
      email: "e2e.fixture.venueowner.internal@example.com",
      displayName: "E2E Fixture Venue Owner",
      password: passwordHash,
      role: Role.VENUE_OWNER,
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.venueOwner.upsert({
    where: { id: fixtureVenueOwnerId },
    update: {},
    create: { id: fixtureVenueOwnerId, userId: fixtureVenueOwnerUserId, isApproved: true },
  })
  await prisma.venue.upsert({
    where: { id: fixtureVenueId },
    update: {},
    create: {
      id: fixtureVenueId,
      ownerId: fixtureVenueOwnerId,
      name: "The Vintage Club",
      address: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      capacity: 120,
      photos: [],
      facilities: ["Sound System", "Bar"],
      isApproved: true,
      rateType: RateType.HOURLY,
      hourlyRate: 1500,
      seatingMode: "GENERAL_ADMISSION",
    },
  })

  // BUY_IN, maxPerformers:1, APPROVED - see e2e/helpers/roles.ts comment.
  // Deliberately no Applications/Performances/Bookings seeded here so
  // waitlist-wallet-credit.spec.ts always starts from zero occupancy.
  await prisma.event.upsert({
    where: { id: fixtureEventId },
    update: {
      title: "E2E Fixture: Waitlist/Wallet Flow",
      status: EventStatus.APPROVED,
      maxPerformers: 1,
      defaultCompensationType: CompensationType.BUY_IN,
      defaultBuyInAmount: 300,
    },
    create: {
      id: fixtureEventId,
      organiserId: fixtureOrganiserId,
      venueId: fixtureVenueId,
      title: "E2E Fixture: Waitlist/Wallet Flow",
      description: "Reusable fixture event for the waitlist/wallet-credit e2e spec. Do not delete.",
      type: EventType.OPEN_MIC,
      status: EventStatus.APPROVED,
      date: daysFromNow(60),
      startTime: "19:00",
      endTime: "22:00",
      isFree: false,
      ticketPrice: 0,
      totalSeats: 50,
      availableSeats: 50,
      maxPerformers: 1,
      applicationApprovalMode: ApprovalMode.MANUAL,
      defaultCompensationType: CompensationType.BUY_IN,
      defaultBuyInAmount: 300,
      isCompetitionShow: false,
    },
  })

  // ₹199 platform fee - waitlist-wallet-credit.spec.ts asserts this exact
  // amount on the FIRST run only (see that spec's file-header comment on
  // non-idempotency of the fee-application step itself).
  await prisma.venueBooking.upsert({
    where: { id: fixtureVenueBookingId },
    update: { platformFeeAmount: 199 },
    create: {
      id: fixtureVenueBookingId,
      venueId: fixtureVenueId,
      organiserId: fixtureOrganiserId,
      eventId: fixtureEventId,
      fromDate: daysFromNow(60),
      toDate: daysFromNow(60),
      status: BookingStatus.CONFIRMED,
      amount: 1500,
      agreedRateType: RateType.HOURLY,
      durationHours: 3,
      platformFeeAmount: 199,
      snapshotHourlyRate: 1500,
    },
  })

  // "Jaipur Mic Gala 100" - literal title asserted in smoke.spec.ts and
  // numbered-seat-booking.spec.ts. NUMBERED venue with real available
  // (priced, unbooked) seats so the seat-picker's `[title*="₹"]` tooltip
  // check has something to match.
  const jaipurVenueOwnerId = "qa-jaipur-venowner01"
  const jaipurVenueOwnerUserId = "qa-jaipur-venowneru1"
  const jaipurVenueId = "qa-jaipur-venue-0001"
  const jaipurEventId = "qa-jaipur-event-0001"

  await prisma.user.upsert({
    where: { id: jaipurVenueOwnerUserId },
    update: { password: passwordHash },
    create: {
      id: jaipurVenueOwnerUserId,
      name: "qa_jaipur_venowner",
      email: "qa.jaipur.venueowner@example.com",
      displayName: "Jaipur Venue Owner",
      password: passwordHash,
      role: Role.VENUE_OWNER,
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.venueOwner.upsert({
    where: { id: jaipurVenueOwnerId },
    update: {},
    create: { id: jaipurVenueOwnerId, userId: jaipurVenueOwnerUserId, isApproved: true },
  })
  await prisma.venue.upsert({
    where: { id: jaipurVenueId },
    update: {},
    create: {
      id: jaipurVenueId,
      ownerId: jaipurVenueOwnerId,
      name: "Jaipur Convention Grounds",
      address: "Civil Lines",
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      capacity: 100,
      photos: [],
      facilities: ["Parking", "AC"],
      isApproved: true,
      rateType: RateType.HOURLY,
      hourlyRate: 2000,
      seatingMode: "NUMBERED",
    },
  })

  // 10 rows x 10 seats, one tier "General" at ₹250.
  const seatRows = "ABCDEFGHIJ".split("")
  for (const row of seatRows) {
    for (let num = 1; num <= 10; num++) {
      const seatId = `${jaipurVenueId}-${row}${num}`
      await prisma.seat.upsert({
        where: { id: seatId },
        update: {},
        create: {
          id: seatId,
          venueId: jaipurVenueId,
          tierLabel: "General",
          row,
          number: String(num),
          x: num * 20,
          y: seatRows.indexOf(row) * 20,
        },
      })
    }
  }

  await prisma.event.upsert({
    where: { id: jaipurEventId },
    update: { title: "Jaipur Mic Gala 100", status: EventStatus.APPROVED },
    create: {
      id: jaipurEventId,
      organiserId: "qa-organiser-01",
      venueId: jaipurVenueId,
      title: "Jaipur Mic Gala 100",
      description: "A 100-seat numbered-venue mic night in Jaipur.",
      type: EventType.LINEUP,
      status: EventStatus.APPROVED,
      date: daysFromNow(21),
      startTime: "18:30",
      endTime: "21:00",
      isFree: false,
      ticketPrice: null,
      totalSeats: 100,
      availableSeats: 100,
      maxPerformers: 6,
      applicationApprovalMode: ApprovalMode.AUTO,
      defaultCompensationType: CompensationType.FREE,
    },
  })

  await prisma.ticketTier.upsert({
    where: { id: `${jaipurEventId}-tier-general` },
    update: { price: 250 },
    create: {
      id: `${jaipurEventId}-tier-general`,
      eventId: jaipurEventId,
      sectionName: "General",
      price: 250,
      totalSeats: 100,
    },
  })

  return {
    fixtureOrganiserEmail: "e2e.fixture.organiser@example.com",
    fixtureOrganiserPassword: "E2eFixture!2026",
  }
}

// ---------------------------------------------------------------------------
// Golden scenario — one hand-built past Competition Show with a full
// lineup, a checked-in booking, an accepted panelist + celebrity, 5+
// reviews on the hero artist, 5 distinct-organiser Featured vouches (hits
// PlatformSettings.sceneStatusFeaturedVouchThreshold default exactly), and
// an admin-granted Headliner tag — so a fresh QA reset always has one fully
// "ready to click-test" artist/event to look at, not just empty volume.
// ---------------------------------------------------------------------------

async function seedGoldenScenario(
  prisma: PrismaClient,
  pools: { organisers: SeededOrganiser[]; venueOwners: SeededVenueOwner[]; artists: SeededArtist[]; audiences: SeededUser[] }
) {
  console.log("\n[seed] Golden scenario (past Competition Show, hero artist)...")

  const heroArtist = pools.artists[0]
  const lineupArtists = pools.artists.slice(0, 5) // hero + 4 support
  const goldenOrganiser = pools.organisers[0]
  const goldenVenue = pools.venueOwners[0]
  const eventDate = daysFromNow(-14)

  const goldenEventId = "qa-golden-event-01"
  await prisma.event.upsert({
    where: { id: goldenEventId },
    update: { status: EventStatus.COMPLETED, isCompetitionShow: true },
    create: {
      id: goldenEventId,
      organiserId: goldenOrganiser.organiserId,
      venueId: goldenVenue.venueId,
      title: "QA Golden: Standup Showdown Finale",
      description: "Hand-built golden Competition Show fixture for the reputation epic (Scene Status, Hype Score, Accept-to-Appear, Audience Choice).",
      type: EventType.STAND_UP,
      status: EventStatus.COMPLETED,
      date: eventDate,
      startTime: "19:00",
      endTime: "22:30",
      isFree: false,
      ticketPrice: 400,
      totalSeats: 120,
      availableSeats: 114,
      maxPerformers: 5,
      applicationApprovalMode: ApprovalMode.MANUAL,
      defaultCompensationType: CompensationType.FREE,
      isCompetitionShow: true,
      competitionPrizeFirst: "₹10,000 + trophy",
      competitionPrizeSecond: "₹5,000",
      competitionPrizeThird: "Goodie hamper",
    },
  })

  // Full lineup: hero + 4 supporting artists.
  let heroPerformanceId = ""
  for (let slot = 0; slot < lineupArtists.length; slot++) {
    const performanceId = `${goldenEventId}-perf-${slot + 1}`
    if (slot === 0) heroPerformanceId = performanceId
    const applicationId = `${goldenEventId}-app-${slot + 1}`
    await prisma.application.upsert({
      where: { id: applicationId },
      update: {},
      create: {
        id: applicationId,
        eventId: goldenEventId,
        artistId: lineupArtists[slot].artistId,
        status: "APPROVED",
      },
    })
    await prisma.performance.upsert({
      where: { id: performanceId },
      update: { isFeaturedVouch: true },
      create: {
        id: performanceId,
        eventId: goldenEventId,
        artistId: lineupArtists[slot].artistId,
        slot: slot + 1,
        duration: 12,
        compensationType: CompensationType.FREE,
        isFeaturedVouch: slot === 0, // hero's vouch #1 of 5 (this organiser)
      },
    })
  }

  // Checked-in booking (audience #6 in the pool, 1-indexed pool[5]).
  const checkedInBooker = pools.audiences[5]
  await prisma.booking.upsert({
    where: { id: `${goldenEventId}-booking-checkedin` },
    update: { checkedInAt: eventDate },
    create: {
      id: `${goldenEventId}-booking-checkedin`,
      userId: checkedInBooker.id,
      eventId: goldenEventId,
      seats: { General: 1 },
      totalAmount: 400,
      subtotalAmount: 400,
      bookingFeeAmount: 0,
      status: BookingStatus.CONFIRMED,
      checkedInAt: eventDate,
      checkedInByUserId: goldenOrganiser.id,
    },
  })

  // Accepted panelist + celebrity, linked to real seeded users (audience
  // #7, #8) per the Accept-to-Appear consent model.
  const panelistUser = pools.audiences[6]
  const celebrityUser = pools.audiences[7]
  await prisma.eventPanelist.upsert({
    where: { id: `${goldenEventId}-panelist-1` },
    update: { status: InviteStatus.ACCEPTED },
    create: {
      id: `${goldenEventId}-panelist-1`,
      eventId: goldenEventId,
      name: panelistUser.displayName,
      bio: faker.lorem.sentence(),
      order: 0,
      status: InviteStatus.ACCEPTED,
      userId: panelistUser.id,
      respondedAt: eventDate,
    },
  })
  await prisma.celebrity.upsert({
    where: { id: `${goldenEventId}-celebrity-1` },
    update: { status: InviteStatus.ACCEPTED },
    create: {
      id: `${goldenEventId}-celebrity-1`,
      eventId: goldenEventId,
      name: celebrityUser.displayName,
      order: 0,
      status: InviteStatus.ACCEPTED,
      userId: celebrityUser.id,
      respondedAt: eventDate,
    },
  })

  // 5+ reviews on the hero artist's performance (audiences #1-#5).
  const reviewers = pools.audiences.slice(0, 5)
  for (let r = 0; r < reviewers.length; r++) {
    await prisma.review.upsert({
      where: { id: `${goldenEventId}-hero-review-${r + 1}` },
      update: {},
      create: {
        id: `${goldenEventId}-hero-review-${r + 1}`,
        userId: reviewers[r].id,
        eventId: goldenEventId,
        performanceId: heroPerformanceId,
        rating: faker.number.int({ min: 4, max: 5 }),
        comment: faker.lorem.sentence(),
      },
    })
  }

  // 4 more Featured vouches for the hero artist from 4 OTHER organisers
  // (distinct-organiser count, not raw vouch count - see Performance.
  // isFeaturedVouch schema comment). Combined with the golden event's own
  // vouch above, this hits the default threshold of 5 exactly.
  const vouchOrganisers = pools.organisers.slice(1, 5)
  for (let v = 0; v < vouchOrganisers.length; v++) {
    const vouchOrganiser = vouchOrganisers[v]
    const vouchVenue = pools.venueOwners[(v + 1) % pools.venueOwners.length]
    const vouchEventId = `qa-golden-vouch-event-${v + 1}`
    await prisma.event.upsert({
      where: { id: vouchEventId },
      update: {},
      create: {
        id: vouchEventId,
        organiserId: vouchOrganiser.organiserId,
        venueId: vouchVenue.venueId,
        title: `QA Featured Vouch Night ${v + 1}`,
        description: "Minimal past event supporting the golden hero artist's Featured-tier vouch count.",
        type: EventType.STAND_UP,
        status: EventStatus.COMPLETED,
        date: daysFromNow(-20 - v * 5),
        startTime: "19:00",
        endTime: "21:00",
        isFree: true,
        totalSeats: 60,
        availableSeats: 60,
        maxPerformers: 1,
        applicationApprovalMode: ApprovalMode.AUTO,
        defaultCompensationType: CompensationType.FREE,
      },
    })
    await prisma.performance.upsert({
      where: { id: `${vouchEventId}-perf-1` },
      update: { isFeaturedVouch: true },
      create: {
        id: `${vouchEventId}-perf-1`,
        eventId: vouchEventId,
        artistId: heroArtist.artistId,
        slot: 1,
        duration: 10,
        compensationType: CompensationType.FREE,
        isFeaturedVouch: true,
      },
    })
  }

  // Admin-granted Headliner.
  await prisma.artist.update({
    where: { id: heroArtist.artistId },
    data: {
      isSceneStatusHeadliner: true,
      headlinerNote: "QA seed: admin-granted Headliner for golden scenario testing.",
    },
  })

  return {
    heroArtistEmail: heroArtist.email,
    heroArtistDisplayName: heroArtist.displayName,
    goldenOrganiserEmail: goldenOrganiser.email,
    checkedInBookerEmail: checkedInBooker.email,
    panelistEmail: panelistUser.email,
    celebrityEmail: celebrityUser.email,
  }
}

// ---------------------------------------------------------------------------
// Demo personas — 8 fixed-ID, named QA accounts for manual click-testing.
// Distinct from both the volume pool (randomized Faker content, generic
// qa.audience001-style logins) and the e2e/golden fixtures above (protected -
// other code asserts against their exact ids/strings). These are hand-built,
// human-named personas so Hitesh can log in as "Omkar" or "Hrithik" and see a
// specific, deliberately-shaped account rather than hunting through a random
// volume row. Four are cross-linked into one shared story (Vinayak's venues
// host Omkar's events, Hrithik performs at them, Atul attends) so the story
// renders coherently across all 4 dashboards; the other four are
// deliberately sparse and NOT linked to that story, for testing empty/thin-
// state UI on a still-legitimate account.
//
// Every id here uses the "qa-demo-" prefix — NEVER "e2efixture"
// (e2e/helpers/roles.ts) or "qa-golden" (the golden scenario above), both of
// which other code asserts against by literal id/string.
// ---------------------------------------------------------------------------

async function seedDemoPersonas(
  prisma: PrismaClient,
  pools: { organisers: SeededOrganiser[]; venueOwners: SeededVenueOwner[]; artists: SeededArtist[]; audiences: SeededUser[] }
) {
  console.log("\n[seed] Demo personas (8 fixed-ID named accounts: 4 cross-linked 'full', 4 sparse 'partial')...")

  const passwordHash = await hashPassword(VOLUME_PASSWORD)

  // -- Vinayak — Venue Owner Full: 6 fully-fleshed venues ------------------
  const vinayakId = "qa-demo-vo-full"
  const vinayakRoleId = "qa-demo-vo-full-role"
  await prisma.user.upsert({
    where: { id: vinayakId },
    update: { email: "vinayak.venue@aforaudience.qa", displayName: "Vinayak", password: passwordHash },
    create: {
      id: vinayakId,
      name: "qa_demo_vo_full",
      email: "vinayak.venue@aforaudience.qa",
      displayName: "Vinayak",
      password: passwordHash,
      role: Role.VENUE_OWNER,
      phone: `+91${faker.string.numeric(10)}`,
      avatar: faker.image.avatarGitHub(),
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.venueOwner.upsert({
    where: { id: vinayakRoleId },
    update: {},
    create: {
      id: vinayakRoleId,
      userId: vinayakId,
      isApproved: true,
      // Venue itself has no description field in the schema (see
      // docs/qa-seed-script-spec.md follow-up note) - the "real, not lorem"
      // descriptive content the brief asked for lives here on the owner's
      // bio instead, since that's the closest real field available.
      bio: "Running live music and comedy spaces across Pune for the last six years - from an 80-seat basement club to a 300-capacity rooftop arena. If it's got a stage and decent acoustics, there's a good chance it's one of ours.",
    },
  })

  type DemoVenuePlan = {
    id: string
    name: string
    address: string
    capacity: number
    rateType: RateType
    hourlyRate?: number
    dailyRate?: number
    facilities: string[]
  }
  const venuePlans: DemoVenuePlan[] = [
    { id: "qa-demo-venue-full-1", name: "Koregaon Park Lounge", address: "Lane 5, Koregaon Park", capacity: 80, rateType: RateType.HOURLY, hourlyRate: 2500, facilities: ["Sound System", "Bar", "Air Conditioning"] },
    { id: "qa-demo-venue-full-2", name: "FC Road Comedy Hall", address: "FC Road, Shivajinagar", capacity: 150, rateType: RateType.DAILY, dailyRate: 18000, facilities: ["Sound System", "Green Room", "Parking", "Stage Lighting"] },
    { id: "qa-demo-venue-full-3", name: "Baner Underground Club", address: "Baner Road", capacity: 60, rateType: RateType.HOURLY, hourlyRate: 1800, facilities: ["Sound System", "Bar"] },
    { id: "qa-demo-venue-full-4", name: "Aundh Heritage Theatre", address: "Aundh-Baner Link Road", capacity: 300, rateType: RateType.DAILY, dailyRate: 35000, facilities: ["Sound System", "Green Room", "Parking", "Stage Lighting", "Wheelchair Accessible"] },
    { id: "qa-demo-venue-full-5", name: "Camp Corner Cafe", address: "East Street, Camp", capacity: 40, rateType: RateType.HOURLY, hourlyRate: 1200, facilities: ["Sound System", "Bar", "WiFi"] },
    { id: "qa-demo-venue-full-6", name: "Viman Nagar Arena", address: "Viman Nagar Main Road", capacity: 250, rateType: RateType.DAILY, dailyRate: 28000, facilities: ["Sound System", "Parking", "Power Backup", "Stage Lighting"] },
  ]
  for (const v of venuePlans) {
    await prisma.venue.upsert({
      where: { id: v.id },
      update: { name: v.name, capacity: v.capacity },
      create: {
        id: v.id,
        ownerId: vinayakRoleId,
        name: v.name,
        address: v.address,
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        capacity: v.capacity,
        photos: [],
        facilities: v.facilities,
        isApproved: true,
        rateType: v.rateType,
        hourlyRate: v.hourlyRate,
        dailyRate: v.dailyRate,
        seatingMode: "GENERAL_ADMISSION",
      },
    })
  }

  // -- Omkar — Organiser Full: 10 events across Vinayak's 6 venues ---------
  const omkarId = "qa-demo-org-full"
  const omkarRoleId = "qa-demo-org-full-role"
  await prisma.user.upsert({
    where: { id: omkarId },
    update: { email: "omkar.organiser@aforaudience.qa", displayName: "Omkar", password: passwordHash },
    create: {
      id: omkarId,
      name: "qa_demo_org_full",
      email: "omkar.organiser@aforaudience.qa",
      displayName: "Omkar",
      password: passwordHash,
      role: Role.ORGANISER,
      phone: `+91${faker.string.numeric(10)}`,
      avatar: faker.image.avatarGitHub(),
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.organiser.upsert({
    where: { id: omkarRoleId },
    update: {},
    create: {
      id: omkarRoleId,
      userId: omkarId,
      orgName: "Omkar Live Presents",
      bio: "Independent event organiser bringing stand-up, poetry, and open-mic nights to Pune every week. Booked 200+ shows since 2022 - always looking for fresh voices.",
      isApproved: true,
    },
  })

  // 2 already past (Sept 1-4 2026, COMPLETED) + 8 upcoming (Sept 5 - Oct 31
  // 2026). One (index 3, "One-Act Play Festival") gets a pending Application
  // left in its queue below; one (index 5, "Full House Open Mic") gets its
  // lineup filled to capacity. Venues repeat (10 events > 6 venues).
  type DemoEventPlan = {
    id: string
    title: string
    type: EventType
    status: EventStatus
    dayOffset: number
    venueId: string
    isFree: boolean
    ticketPrice: number | null
    maxPerformers: number
  }
  const eventPlans: DemoEventPlan[] = [
    { id: "qa-demo-event-full-1", title: "Tuesday Night Open Mic", type: EventType.OPEN_MIC, status: EventStatus.COMPLETED, dayOffset: -4, venueId: venuePlans[0].id, isFree: true, ticketPrice: null, maxPerformers: 6 },
    { id: "qa-demo-event-full-2", title: "Solo Stand-up Showcase", type: EventType.STAND_UP, status: EventStatus.COMPLETED, dayOffset: -2, venueId: venuePlans[1].id, isFree: false, ticketPrice: 300, maxPerformers: 4 },
    { id: "qa-demo-event-full-3", title: "Verses & Vinyl: Poetry Night", type: EventType.POETRY, status: EventStatus.APPROVED, dayOffset: 3, venueId: venuePlans[2].id, isFree: false, ticketPrice: 200, maxPerformers: 6 },
    { id: "qa-demo-event-full-4", title: "One-Act Play Festival", type: EventType.THEATER, status: EventStatus.APPROVED, dayOffset: 10, venueId: venuePlans[3].id, isFree: false, ticketPrice: 400, maxPerformers: 5 },
    { id: "qa-demo-event-full-5", title: "Mixed Bag Comedy Lineup", type: EventType.LINEUP, status: EventStatus.APPROVED, dayOffset: 17, venueId: venuePlans[4].id, isFree: false, ticketPrice: 250, maxPerformers: 6 },
    { id: "qa-demo-event-full-6", title: "Full House Open Mic", type: EventType.OPEN_MIC, status: EventStatus.APPROVED, dayOffset: 24, venueId: venuePlans[5].id, isFree: true, ticketPrice: null, maxPerformers: 3 },
    { id: "qa-demo-event-full-7", title: "Headliner Stand-up Night", type: EventType.STAND_UP, status: EventStatus.APPROVED, dayOffset: 31, venueId: venuePlans[0].id, isFree: false, ticketPrice: 350, maxPerformers: 4 },
    { id: "qa-demo-event-full-8", title: "Spoken Word Sundays", type: EventType.POETRY, status: EventStatus.APPROVED, dayOffset: 38, venueId: venuePlans[1].id, isFree: false, ticketPrice: 200, maxPerformers: 6 },
    { id: "qa-demo-event-full-9", title: "Improv Theatre Jam", type: EventType.THEATER, status: EventStatus.APPROVED, dayOffset: 45, venueId: venuePlans[2].id, isFree: false, ticketPrice: 400, maxPerformers: 5 },
    { id: "qa-demo-event-full-10", title: "Grand Finale Lineup Night", type: EventType.LINEUP, status: EventStatus.APPROVED, dayOffset: 52, venueId: venuePlans[3].id, isFree: false, ticketPrice: 300, maxPerformers: 6 },
  ]
  for (const e of eventPlans) {
    const isPast = e.dayOffset < 0
    await prisma.event.upsert({
      where: { id: e.id },
      update: { status: e.status },
      create: {
        id: e.id,
        organiserId: omkarRoleId,
        venueId: e.venueId,
        title: e.title,
        description: faker.lorem.paragraph(),
        type: e.type,
        status: e.status,
        date: daysFromNow(e.dayOffset),
        startTime: "19:00",
        endTime: "21:30",
        isFree: e.isFree,
        ticketPrice: e.ticketPrice,
        totalSeats: 80,
        availableSeats: isPast ? 74 : 80,
        maxPerformers: e.maxPerformers,
        applicationApprovalMode: ApprovalMode.MANUAL,
        defaultCompensationType: CompensationType.FREE,
      },
    })
  }

  // -- Hrithik — Artist Full: applies/performs across 6 of Omkar's events -
  const hrithikId = "qa-demo-artist-full"
  const hrithikRoleId = "qa-demo-artist-full-role"
  await prisma.user.upsert({
    where: { id: hrithikId },
    update: { email: "hrithik.artist@aforaudience.qa", displayName: "Hrithik", password: passwordHash },
    create: {
      id: hrithikId,
      name: "qa_demo_art_full",
      email: "hrithik.artist@aforaudience.qa",
      displayName: "Hrithik",
      password: passwordHash,
      role: Role.ARTIST,
      phone: `+91${faker.string.numeric(10)}`,
      avatar: faker.image.avatarGitHub(),
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.artist.upsert({
    where: { id: hrithikRoleId },
    update: {},
    create: {
      id: hrithikRoleId,
      userId: hrithikId,
      bio: "Observational stand-up comedian turning everyday Pune chaos - traffic, landlords, WFH calls - into material.",
      genre: ["Stand-up Comedy"],
      styleTag: ["Observational", "High Energy"],
      videoReel: [],
      tagline: "Turning Pune traffic into 45 minutes of material.",
    },
  })

  // Schema note: ApplicationStatus has no "ACCEPTED" value (PENDING /
  // APPROVED / REJECTED / WAITLISTED) - "ACCEPTED" in the brief maps to
  // APPROVED, same as the golden scenario above already does.
  type HeroLineupPlan = {
    eventId: string
    appStatus: "APPROVED" | "PENDING"
    compensationType?: CompensationType
    feeAmount?: number
    buyInAmount?: number
  }
  const heroLineupEvents: HeroLineupPlan[] = [
    { eventId: "qa-demo-event-full-1", appStatus: "APPROVED", compensationType: CompensationType.PAID, feeAmount: 1500 },
    { eventId: "qa-demo-event-full-2", appStatus: "APPROVED", compensationType: CompensationType.BUY_IN, buyInAmount: 300 },
    { eventId: "qa-demo-event-full-3", appStatus: "APPROVED", compensationType: CompensationType.FREE },
    { eventId: "qa-demo-event-full-4", appStatus: "PENDING" }, // the pending-queue event - no performance yet
    { eventId: "qa-demo-event-full-5", appStatus: "APPROVED", compensationType: CompensationType.FREE },
    { eventId: "qa-demo-event-full-6", appStatus: "APPROVED", compensationType: CompensationType.FREE }, // the lineup-full event
  ]

  const hrithikPerformanceIdByEvent: Record<string, string> = {}
  for (let i = 0; i < heroLineupEvents.length; i++) {
    const plan = heroLineupEvents[i]
    const applicationId = `qa-demo-app-full-hrithik-${i + 1}`
    await prisma.application.upsert({
      where: { id: applicationId },
      update: { status: plan.appStatus },
      create: {
        id: applicationId,
        eventId: plan.eventId,
        artistId: hrithikRoleId,
        status: plan.appStatus,
      },
    })
    if (plan.appStatus === "APPROVED") {
      const performanceId = `qa-demo-perf-full-hrithik-${i + 1}`
      hrithikPerformanceIdByEvent[plan.eventId] = performanceId
      await prisma.performance.upsert({
        where: { id: performanceId },
        update: {},
        create: {
          id: performanceId,
          eventId: plan.eventId,
          artistId: hrithikRoleId,
          slot: 1,
          duration: 15,
          compensationType: plan.compensationType,
          feeAmount: plan.feeAmount,
          buyInAmount: plan.buyInAmount,
        },
      })
    }
  }

  // Fill event-6's lineup the rest of the way (maxPerformers: 3) with 2
  // filler performances from the volume artist pool, so it's genuinely
  // lineup-full, not just "Hrithik + empty seats."
  const lineupFillerArtists = pools.artists.slice(0, 2)
  for (let i = 0; i < lineupFillerArtists.length; i++) {
    const applicationId = `qa-demo-app-full-6-filler-${i + 1}`
    await prisma.application.upsert({
      where: { id: applicationId },
      update: {},
      create: { id: applicationId, eventId: "qa-demo-event-full-6", artistId: lineupFillerArtists[i].artistId, status: "APPROVED" },
    })
    await prisma.performance.upsert({
      where: { id: `qa-demo-perf-full-6-filler-${i + 1}` },
      update: {},
      create: {
        id: `qa-demo-perf-full-6-filler-${i + 1}`,
        eventId: "qa-demo-event-full-6",
        artistId: lineupFillerArtists[i].artistId,
        slot: i + 2,
        duration: 10,
        compensationType: CompensationType.FREE,
      },
    })
  }
  // event-4 (the pending-queue event) gets one already-approved filler too,
  // so it reads as "a queue in progress" against a partially-filled lineup,
  // not a totally empty one.
  await prisma.application.upsert({
    where: { id: "qa-demo-app-full-4-filler-1" },
    update: {},
    create: { id: "qa-demo-app-full-4-filler-1", eventId: "qa-demo-event-full-4", artistId: pools.artists[2].artistId, status: "APPROVED" },
  })
  await prisma.performance.upsert({
    where: { id: "qa-demo-perf-full-4-filler-1" },
    update: {},
    create: { id: "qa-demo-perf-full-4-filler-1", eventId: "qa-demo-event-full-4", artistId: pools.artists[2].artistId, slot: 1, duration: 15, compensationType: CompensationType.FREE },
  })

  // -- Atul — Audience Full: tickets across Omkar's events -----------------
  const atulId = "qa-demo-audience-full"
  await prisma.user.upsert({
    where: { id: atulId },
    update: { email: "atul.audience@aforaudience.qa", displayName: "Atul", password: passwordHash },
    create: {
      id: atulId,
      name: "qa_demo_aud_full",
      email: "atul.audience@aforaudience.qa",
      displayName: "Atul",
      password: passwordHash,
      role: Role.AUDIENCE,
      phone: `+91${faker.string.numeric(10)}`,
      avatar: faker.image.avatarGitHub(),
      isVerified: true,
      isApproved: true,
    },
  })

  type DemoBookingPlan = { eventId: string; dayOffset: number; isPast: boolean; ticketPrice: number | null }
  const atulBookings: DemoBookingPlan[] = [
    { eventId: "qa-demo-event-full-1", dayOffset: -4, isPast: true, ticketPrice: null },
    { eventId: "qa-demo-event-full-2", dayOffset: -2, isPast: true, ticketPrice: 300 },
    { eventId: "qa-demo-event-full-3", dayOffset: 3, isPast: false, ticketPrice: 200 },
    { eventId: "qa-demo-event-full-5", dayOffset: 17, isPast: false, ticketPrice: 250 },
  ]
  for (let i = 0; i < atulBookings.length; i++) {
    const b = atulBookings[i]
    const bookingId = `qa-demo-booking-full-atul-${i + 1}`
    const subtotal = b.ticketPrice ?? 0
    await prisma.booking.upsert({
      where: { id: bookingId },
      update: {},
      create: {
        id: bookingId,
        userId: atulId,
        eventId: b.eventId,
        seats: b.ticketPrice === null ? {} : { General: 1 },
        totalAmount: subtotal,
        subtotalAmount: subtotal,
        bookingFeeAmount: 0,
        status: BookingStatus.CONFIRMED,
        checkedInAt: b.isPast ? daysFromNow(b.dayOffset) : null,
        checkedInByUserId: b.isPast ? omkarId : null,
      },
    })
  }

  // Reviews on the 2 past events - doubles as Hrithik's "reviews on the 2
  // completed events" requirement, since these are reviews on his own
  // performances there. Deliberately Review (ratings/comments), not the
  // Feedback model - Feedback is real support-widget bug/feature data
  // (see wipe()'s own comment: explicitly not seeded test data), unrelated
  // to event ratings.
  await prisma.review.upsert({
    where: { id: "qa-demo-review-full-atul-1" },
    update: {},
    create: {
      id: "qa-demo-review-full-atul-1",
      userId: atulId,
      eventId: "qa-demo-event-full-1",
      performanceId: hrithikPerformanceIdByEvent["qa-demo-event-full-1"],
      rating: 5,
      comment: "Hrithik's traffic bit killed. Genuinely one of the best open mic sets I've seen here.",
    },
  })
  await prisma.review.upsert({
    where: { id: "qa-demo-review-full-atul-2" },
    update: {},
    create: {
      id: "qa-demo-review-full-atul-2",
      userId: atulId,
      eventId: "qa-demo-event-full-2",
      performanceId: hrithikPerformanceIdByEvent["qa-demo-event-full-2"],
      rating: 4,
      comment: "Solid headline set - venue sound was a bit rough but the material carried it.",
    },
  })

  // Messages - getOrCreateConversation() (src/lib/messaging.ts) is only
  // ever called lazily from the message-thread API routes, never
  // automatically on booking/application confirmation, so Atul's inbox
  // stays genuinely empty unless a thread is seeded directly here.
  const atulOmkarConversationId = "qa-demo-conv-atul-omkar-1"
  await prisma.conversation.upsert({
    where: { id: atulOmkarConversationId },
    update: {},
    create: {
      id: atulOmkarConversationId,
      contextType: "BOOKING",
      contextId: "qa-demo-booking-full-atul-3", // event-3, Poetry Night, upcoming
    },
  })
  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId: atulOmkarConversationId, userId: atulId } },
    update: {},
    create: { id: "qa-demo-convpart-atul-1", conversationId: atulOmkarConversationId, userId: atulId },
  })
  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId: atulOmkarConversationId, userId: omkarId } },
    update: {},
    create: { id: "qa-demo-convpart-omkar-1", conversationId: atulOmkarConversationId, userId: omkarId },
  })
  await prisma.message.upsert({
    where: { id: "qa-demo-msg-1" },
    update: {},
    create: { id: "qa-demo-msg-1", conversationId: atulOmkarConversationId, senderId: atulId, body: "Hi! What time should I get there for the poetry night?" },
  })
  await prisma.message.upsert({
    where: { id: "qa-demo-msg-2" },
    update: {},
    create: { id: "qa-demo-msg-2", conversationId: atulOmkarConversationId, senderId: omkarId, body: "Doors open 6:30pm, show starts 7pm sharp. See you there!" },
  })

  // Follows - Atul + 2 volume audiences, so Hrithik's follower count > 0.
  // No stored counter on Artist - follower count is a live count of Follow
  // rows (targetType ARTIST, targetId = Artist.id), same shape used by
  // src/app/api/artists/me/route.ts.
  const hrithikFollowerIds = [atulId, pools.audiences[0].id, pools.audiences[1].id]
  for (let i = 0; i < hrithikFollowerIds.length; i++) {
    await prisma.follow.upsert({
      where: { userId_targetType_targetId: { userId: hrithikFollowerIds[i], targetType: "ARTIST", targetId: hrithikRoleId } },
      update: {},
      create: { id: `qa-demo-follow-hrithik-${i + 1}`, userId: hrithikFollowerIds[i], targetType: "ARTIST", targetId: hrithikRoleId },
    })
  }

  // -- Orri — Organiser Partial: 1 draft event, nothing else ---------------
  const orriId = "qa-demo-org-partial"
  const orriRoleId = "qa-demo-org-partial-role"
  await prisma.user.upsert({
    where: { id: orriId },
    update: { email: "orri.organiser@aforaudience.qa", displayName: "Orri", password: passwordHash },
    create: {
      id: orriId,
      name: "qa_demo_org_partial",
      email: "orri.organiser@aforaudience.qa",
      displayName: "Orri",
      password: passwordHash,
      role: Role.ORGANISER,
      phone: `+91${faker.string.numeric(10)}`,
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.organiser.upsert({
    where: { id: orriRoleId },
    update: {},
    create: { id: orriRoleId, userId: orriId, orgName: "Orri Events (Draft)", isApproved: true },
  })
  // Deliberately no venueId (Orri isn't linked to Vinayak's venues - this
  // persona is sparse/unlinked on purpose) - Event.venueId is nullable.
  await prisma.event.upsert({
    where: { id: "qa-demo-event-partial-org-1" },
    update: {},
    create: {
      id: "qa-demo-event-partial-org-1",
      organiserId: orriRoleId,
      venueId: null,
      title: "Untitled Draft Show",
      description: "Draft event, still working out the details.",
      type: EventType.OPEN_MIC,
      status: EventStatus.DRAFT,
      date: daysFromNow(20),
      startTime: "19:00",
      endTime: "21:00",
      isFree: true,
      totalSeats: 50,
      availableSeats: 50,
    },
  })

  // -- Vijay — Venue Owner Partial: 1 thin venue, no availability rows -----
  const vijayId = "qa-demo-vo-partial"
  const vijayRoleId = "qa-demo-vo-partial-role"
  await prisma.user.upsert({
    where: { id: vijayId },
    update: { email: "vijay.venue@aforaudience.qa", displayName: "Vijay", password: passwordHash },
    create: {
      id: vijayId,
      name: "qa_demo_vo_partial",
      email: "vijay.venue@aforaudience.qa",
      displayName: "Vijay",
      password: passwordHash,
      role: Role.VENUE_OWNER,
      phone: `+91${faker.string.numeric(10)}`,
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.venueOwner.upsert({
    where: { id: vijayRoleId },
    update: {},
    create: { id: vijayRoleId, userId: vijayId, isApproved: true },
  })
  // Thin fields only - no photos, no rate configured, and (deliberately,
  // per the brief) no VenueAvailability rows created for it anywhere below.
  await prisma.venue.upsert({
    where: { id: "qa-demo-venue-partial-1" },
    update: {},
    create: {
      id: "qa-demo-venue-partial-1",
      ownerId: vijayRoleId,
      name: "Kothrud Backyard",
      address: "Kothrud",
      city: "Pune",
      capacity: 30,
      photos: [],
      facilities: [],
      isApproved: true,
      seatingMode: "GENERAL_ADMISSION",
    },
  })

  // -- Shahrukh — Artist Partial: bare profile, nothing else ---------------
  const shahrukhId = "qa-demo-artist-partial"
  const shahrukhRoleId = "qa-demo-artist-partial-role"
  await prisma.user.upsert({
    where: { id: shahrukhId },
    update: { email: "shahrukh.artist@aforaudience.qa", displayName: "Shahrukh", password: passwordHash },
    create: {
      id: shahrukhId,
      name: "qa_demo_art_partial",
      email: "shahrukh.artist@aforaudience.qa",
      displayName: "Shahrukh",
      password: passwordHash,
      role: Role.ARTIST,
      phone: `+91${faker.string.numeric(10)}`,
      isVerified: true,
      isApproved: true,
    },
  })
  await prisma.artist.upsert({
    where: { id: shahrukhRoleId },
    update: {},
    create: { id: shahrukhRoleId, userId: shahrukhId, genre: ["Improv"], styleTag: [], videoReel: [] },
  })

  // -- Amit — Audience Partial: zero everything ----------------------------
  const amitId = "qa-demo-audience-partial"
  await prisma.user.upsert({
    where: { id: amitId },
    update: { email: "amit.audience@aforaudience.qa", displayName: "Amit", password: passwordHash },
    create: {
      id: amitId,
      name: "qa_demo_aud_partial",
      email: "amit.audience@aforaudience.qa",
      displayName: "Amit",
      password: passwordHash,
      role: Role.AUDIENCE,
      phone: `+91${faker.string.numeric(10)}`,
      isVerified: true,
      isApproved: true,
    },
  })

  return {
    vinayak: { label: "Vinayak (Venue Owner, full/cross-linked)", email: "vinayak.venue@aforaudience.qa" },
    omkar: { label: "Omkar (Organiser, full/cross-linked)", email: "omkar.organiser@aforaudience.qa" },
    hrithik: { label: "Hrithik (Artist, full/cross-linked)", email: "hrithik.artist@aforaudience.qa" },
    atul: { label: "Atul (Audience, full/cross-linked)", email: "atul.audience@aforaudience.qa" },
    orri: { label: "Orri (Organiser, partial/sparse)", email: "orri.organiser@aforaudience.qa" },
    vijay: { label: "Vijay (Venue Owner, partial/sparse)", email: "vijay.venue@aforaudience.qa" },
    shahrukh: { label: "Shahrukh (Artist, partial/sparse)", email: "shahrukh.artist@aforaudience.qa" },
    amit: { label: "Amit (Audience, partial/sparse)", email: "amit.audience@aforaudience.qa" },
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

type DemoPersonaCreds = Record<"vinayak" | "omkar" | "hrithik" | "atul" | "orri" | "vijay" | "shahrukh" | "amit", { label: string; email: string }>

async function printSummary(
  prisma: PrismaClient,
  fixtureCreds: { fixtureOrganiserEmail: string; fixtureOrganiserPassword: string },
  goldenCreds: {
    heroArtistEmail: string
    heroArtistDisplayName: string
    goldenOrganiserEmail: string
    checkedInBookerEmail: string
    panelistEmail: string
    celebrityEmail: string
  },
  demoCreds: DemoPersonaCreds
) {
  console.log("\n[summary] Row counts:")
  const counts: Array<[string, number]> = [
    ["User", await prisma.user.count()],
    ["Artist", await prisma.artist.count()],
    ["Organiser", await prisma.organiser.count()],
    ["VenueOwner", await prisma.venueOwner.count()],
    ["Venue", await prisma.venue.count()],
    ["Seat", await prisma.seat.count()],
    ["Event", await prisma.event.count()],
    ["Performance", await prisma.performance.count()],
    ["Application", await prisma.application.count()],
    ["Booking", await prisma.booking.count()],
    ["Review", await prisma.review.count()],
    ["EventPanelist", await prisma.eventPanelist.count()],
    ["Celebrity", await prisma.celebrity.count()],
    ["VenueBooking", await prisma.venueBooking.count()],
    ["TicketTier", await prisma.ticketTier.count()],
    ["Conversation", await prisma.conversation.count()],
    ["ConversationParticipant", await prisma.conversationParticipant.count()],
    ["Message", await prisma.message.count()],
    ["Follow", await prisma.follow.count()],
  ]
  for (const [name, count] of counts) {
    console.log(`  - ${name}: ${count}`)
  }

  console.log("\n[summary] Fixture / login credentials:")
  console.log(`  - E2E fixture organiser:  ${fixtureCreds.fixtureOrganiserEmail} / ${fixtureCreds.fixtureOrganiserPassword}`)
  console.log(`  - Golden hero artist (Headliner, Featured, 5+ reviews): ${goldenCreds.heroArtistEmail} / ${VOLUME_PASSWORD} (${goldenCreds.heroArtistDisplayName})`)
  console.log(`  - Golden event organiser: ${goldenCreds.goldenOrganiserEmail} / ${VOLUME_PASSWORD}`)
  console.log(`  - Golden event checked-in booker: ${goldenCreds.checkedInBookerEmail} / ${VOLUME_PASSWORD}`)
  console.log(`  - Golden event accepted panelist: ${goldenCreds.panelistEmail} / ${VOLUME_PASSWORD}`)
  console.log(`  - Golden event accepted celebrity: ${goldenCreds.celebrityEmail} / ${VOLUME_PASSWORD}`)
  console.log(`  - All other volume accounts (qa.audience001..100 / qa.organiser01..10 / qa.venueowner01..10 / qa.artist001..100 @example.com): password ${VOLUME_PASSWORD}`)

  console.log("\n[summary] Demo persona credentials (all password " + VOLUME_PASSWORD + "):")
  for (const key of ["vinayak", "omkar", "hrithik", "atul", "orri", "vijay", "shahrukh", "amit"] as const) {
    const c = demoCreds[key]
    console.log(`  - Demo: ${c.label}: ${c.email} / ${VOLUME_PASSWORD}`)
  }
  console.log("")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = assertQaDatabase() // must be the first thing that touches DATABASE_URL

  // --check-only: confirm the guard recognizes the QA project ref and exit
  // before constructing any DB connection at all - no pool, no client,
  // nothing touches the network. Useful to verify DATABASE_URL is pointed
  // correctly before ever running the real wipe+seed.
  if (process.argv.includes("--check-only")) {
    console.log(`[qa-seed] Guard check passed: DATABASE_URL references the QA Supabase project (${QA_PROJECT_REF}).`)
    console.log("[qa-seed] --check-only: exiting before any database connection is made. No wipe, no seed, no writes.")
    return
  }

  // pg-connection-string@2.14+ now aliases sslmode=require to verify-full
  // (full cert-chain + hostname verification), which overrides the explicit
  // `ssl: { rejectUnauthorized: false }` below and breaks against Supabase's
  // pooler cert chain (same underlying issue src/lib/prisma.ts's
  // rejectUnauthorized:false was already working around, before this pg
  // dependency bump changed the semantics). uselibpqcompat=true is pg's own
  // documented escape hatch back to the old, weaker-but-working semantics -
  // applied here in-memory, not written back to .env.
  const connectionString = databaseUrl.includes("uselibpqcompat=")
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}uselibpqcompat=true`

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 5 })
  const adapter = new PrismaPg(pool, { disposeExternalPool: false })
  const prisma = new PrismaClient({ adapter })

  try {
    await wipe(prisma)

    const pools = await seedVolume(prisma)
    await seedGeneralEvents(prisma, pools)
    const fixtureCreds = await seedE2eFixtures(prisma)
    const goldenCreds = await seedGoldenScenario(prisma, pools)
    const demoCreds = await seedDemoPersonas(prisma, pools)

    await printSummary(prisma, fixtureCreds, goldenCreds, demoCreds)
    console.log("[qa-seed] Done.")
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("[qa-seed] Failed:", err)
  process.exit(1)
})
