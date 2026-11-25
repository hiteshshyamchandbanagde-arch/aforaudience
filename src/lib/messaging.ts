import prisma from "@/lib/prisma"
import type { ConversationContextType } from "@prisma/client"

// In-app messaging (session 36, 26 Jul) - design.md §9.4. One generic
// Conversation shape backs all three confirmed-relationship pairs;
// this file is the single place that knows how to resolve each
// contextType into its two participants and its "is this still live"
// window, so API routes don't duplicate that per pair.

// Combines Event.date + a "HH:mm" time string into a real instant.
// Overnight shows store endTime <= startTime and wrap past midnight
// (same convention as formatEventTimeRange in eventTime.ts) - add a day
// in that case so "until event over" doesn't close a thread hours
// before the show actually ends.
function eventEndInstant(date: Date, startTime: string, endTime: string): Date {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const end = new Date(date)
  end.setHours(eh, em, 0, 0)
  if (eh * 60 + em <= sh * 60 + sm) {
    end.setDate(end.getDate() + 1)
  }
  return end
}

export interface ConversationContext {
  /** The two userIds who should be participants in this thread. */
  participantUserIds: string[]
  /** Short label for the thread header, e.g. event title. */
  label: string
  /** Once past this instant, the thread is read-only (event's over). */
  activeUntil: Date | null
}

/**
 * Resolves a (contextType, contextId) pair to who's allowed in the
 * thread and how long it stays writable. Returns null if the
 * underlying record doesn't exist (bad id) or isn't in a state that
 * should have a thread yet (e.g. a PENDING venue booking).
 */
export async function resolveConversationContext(
  contextType: ConversationContextType,
  contextId: string
): Promise<ConversationContext | null> {
  if (contextType === "PERFORMANCE") {
    const performance = await prisma.performance.findUnique({
      where: { id: contextId },
      include: { artist: true, event: { include: { organiser: true } } },
    })
    if (!performance) return null
    return {
      participantUserIds: [performance.artist.userId, performance.event.organiser.userId],
      label: performance.event.title,
      activeUntil: eventEndInstant(performance.event.date, performance.event.startTime, performance.event.endTime),
    }
  }

  if (contextType === "VENUE_BOOKING") {
    const booking = await prisma.venueBooking.findUnique({
      where: { id: contextId },
      include: { venue: { include: { owner: true } }, organiser: true },
    })
    // Only a CONFIRMED booking represents an actual relationship worth
    // messaging over - a PENDING/CANCELLED one has nothing settled yet.
    if (!booking || booking.status !== "CONFIRMED") return null
    return {
      participantUserIds: [booking.organiser.userId, booking.venue.owner.userId],
      label: booking.venue.name,
      // No linked Event on every VenueBooking (eventId is optional) -
      // fall back to the booking's own toDate as the close-out instant.
      activeUntil: booking.toDate,
    }
  }

  if (contextType === "BOOKING") {
    const ticket = await prisma.booking.findUnique({
      where: { id: contextId },
      include: { user: true, event: { include: { organiser: true } } },
    })
    if (!ticket || ticket.status !== "CONFIRMED") return null
    return {
      participantUserIds: [ticket.userId, ticket.event.organiser.userId],
      label: ticket.event.title,
      activeUntil: eventEndInstant(ticket.event.date, ticket.event.startTime, ticket.event.endTime),
    }
  }

  return null
}

/**
 * Finds the conversation for a context, creating it (and its two
 * participant rows) if this is the first message. Idempotent - safe to
 * call on every "open thread" / "send message" request rather than
 * requiring a separate explicit "start conversation" step.
 */
export async function getOrCreateConversation(
  contextType: ConversationContextType,
  contextId: string,
  participantUserIds: string[]
) {
  const existing = await prisma.conversation.findUnique({
    where: { contextType_contextId: { contextType, contextId } },
  })
  if (existing) return existing

  return prisma.conversation.create({
    data: {
      contextType,
      contextId,
      participants: {
        create: participantUserIds.map((userId) => ({ userId })),
      },
    },
  })
}
