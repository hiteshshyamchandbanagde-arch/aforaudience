// Run F (16 Oct 2026) - pure data builders for scripts/qa-seed.ts, kept
// free of Prisma/dotenv/DB so scripts/qa-seed-data.test.ts can run them in
// CI without a database.
//
// Two seed bugs Hitesh found on his phone pass (13-14 Oct):
// - qa-demo-booking-full-atul-1 had `seats: {}` (no tier, no quantity) and a
//   createdAt (seed run time) 4 days AFTER its checkedInAt (event date).
// - Event descriptions were faker.lorem (Latin placeholder).

const DAY_MS = 24 * 60 * 60 * 1000

// Same shape POST /api/bookings stores for a general-admission booking:
// `{ [sectionName]: qty }`, with the flat-price/free event's single implicit
// section named "General" (SeatSelectionClientPage sends selectedSeats.General
// for free events too). Only numbered-venue bookings store `{}`, and those
// carry BookingSeat rows instead - the seed never creates those here.
export function seededGaSeats(qty = 1): Record<string, number> {
  return { General: qty }
}

// A seeded booking is made a few days before the event, and a past one is
// checked in at the event, so createdAt < checkedInAt <= event date always.
export const BOOKED_DAYS_BEFORE_EVENT = 5

export type SeedBookingInput = {
  id: string
  userId: string
  eventId: string
  eventDate: Date
  ticketPrice: number | null
  isPast: boolean
  checkedInByUserId: string | null
  now?: Date
}

export function buildSeedBooking(input: SeedBookingInput) {
  const now = input.now ?? new Date()
  const subtotal = input.ticketPrice ?? 0
  const bookedAt = new Date(input.eventDate.getTime() - BOOKED_DAYS_BEFORE_EVENT * DAY_MS)
  return {
    id: input.id,
    userId: input.userId,
    eventId: input.eventId,
    seats: seededGaSeats(1),
    totalAmount: subtotal,
    subtotalAmount: subtotal,
    bookingFeeAmount: 0,
    status: "CONFIRMED" as const,
    // Never in the future: an upcoming event's booking 5 days out from a
    // show 3 days away would otherwise be dated after the seed ran.
    createdAt: bookedAt.getTime() < now.getTime() ? bookedAt : now,
    checkedInAt: input.isPast ? input.eventDate : null,
    checkedInByUserId: input.isPast ? input.checkedInByUserId : null,
  }
}

// Seeded event descriptions: short, India-first copy in the platform's
// plain editorial voice. Says what the night is, nothing invented about real
// people. Replaces faker.lorem.paragraph().
export const DEMO_EVENT_DESCRIPTIONS: Record<string, string> = {
  "qa-demo-event-full-1": "Our weekly open mic in Koregaon Park. Comics, poets and the odd guitarist get eight minutes each, first come, first on. Walk in, grab a chai, and cheer for someone's first time on stage.",
  "qa-demo-event-full-2": "One comic, one room, a full hour. A solo stand-up set built over months of open mics, about growing up in Pune, family WhatsApp groups and everything in between.",
  "qa-demo-event-full-3": "Poetry in Hindi, Marathi and English, read between records spinning on the house turntable. Six poets, a warm room and plenty of tea.",
  "qa-demo-event-full-4": "An evening of short one-act plays by local theatre groups. Five pieces, each under twenty minutes, from quiet two-handers to full-cast comedy.",
  "qa-demo-event-full-5": "A mixed lineup of six comics, from first-timers to regulars of the Pune circuit. Clean, dark, observational: a bit of everything, all in one night.",
  "qa-demo-event-full-6": "Open mic night with a small, packed lineup. Poetry, songs and stand-up, three performers, two hours, one mic.",
  "qa-demo-event-full-7": "A headline stand-up night: two opening sets and a closing comic doing a longer set. Expect stories from the road and new material being tried out.",
  "qa-demo-event-full-8": "Sunday evening spoken word. Poets and storytellers share new pieces in a small, quiet room. Come to listen, or sign up to read.",
  "qa-demo-event-full-9": "Long-form improv: performers build scenes from audience suggestions, live. No script, no rehearsal, and no two shows alike.",
  "qa-demo-event-full-10": "The season's closing lineup night. Six performers from this season's shows return for one last evening of comedy, poetry and music.",
}

// General events get a random title and type, so their copy comes from a
// per-type pool keyed by the plan index.
export const GENERAL_EVENT_DESCRIPTIONS: Record<string, string[]> = {
  OPEN_MIC: [
    "An open mic for anyone with five minutes and something to say. Comedy, poetry, music, all welcome. Sign up at the door.",
    "Monthly open mic night. New voices and regulars share the same stage, eight minutes each.",
  ],
  STAND_UP: [
    "A night of stand-up from comics on the local circuit. Short sets, new jokes, and a friendly crowd.",
    "Stand-up comedy in an intimate room. Three comics, about an hour of material, and no front-row roasting unless you ask for it.",
  ],
  POETRY: [
    "A poetry slam with timed rounds and audience scoring. Poems in any language, three minutes each.",
    "An evening of poetry and spoken word. Readers share new work, and the open slots at the end are for you.",
  ],
  THEATER: [
    "Short plays and scenes by a local theatre collective. Under ninety minutes, with a chat with the cast afterwards.",
    "A live theatre evening: two short pieces, one comic and one quiet, performed in the round.",
  ],
  LINEUP: [
    "A curated lineup of comics, poets and musicians, one after another. A sampler of the local scene in a single night.",
    "Lineup night with four performers across comedy and music. Come for one act, stay for the rest.",
  ],
}

export function generalEventDescription(type: string, index: number): string {
  const pool = GENERAL_EVENT_DESCRIPTIONS[type] ?? GENERAL_EVENT_DESCRIPTIONS.OPEN_MIC
  return pool[index % pool.length]
}

export const PLACEHOLDER_TEXT = /lorem|ipsum|dolor sit|consectetur/i
