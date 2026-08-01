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
// Summary
// ---------------------------------------------------------------------------

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
  }
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

    await printSummary(prisma, fixtureCreds, goldenCreds)
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
