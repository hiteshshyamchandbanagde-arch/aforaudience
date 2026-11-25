import { randomInt } from 'crypto'

// BUG-2609-053 - customer-facing ticket reference (Booking.ticketCode).
// The column and its unique index have existed since the init migration
// but nothing ever wrote to it, so every booking showed "—".
//
// Format: AFA-XXXX-XXXX, 8 random characters from a 30-character
// alphabet with no look-alikes (no 0/O, 1/I/L, and no U). Random rather
// than a CodeCounter sequence on purpose: the code is accepted for
// manual entry at check-in, so it must not be guessable from a
// neighbour's ticket, and a numeric sequence would reintroduce 0 and 1.
// 30^8 ~ 6.6e11 combinations; collisions are still handled by the
// unique index + retry in assign-ticket-code.ts.
//
// Pure (no Prisma import) so scripts/ticket-code.test.ts can load it.
export const TICKET_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const TICKET_CODE_PREFIX = 'AFA'
const GROUP = 4

export const TICKET_CODE_RE = new RegExp(`^${TICKET_CODE_PREFIX}-[${TICKET_CODE_ALPHABET}]{${GROUP}}-[${TICKET_CODE_ALPHABET}]{${GROUP}}$`)

export function generateTicketCode(): string {
  let body = ''
  for (let i = 0; i < GROUP * 2; i++) body += TICKET_CODE_ALPHABET[randomInt(TICKET_CODE_ALPHABET.length)]
  return `${TICKET_CODE_PREFIX}-${body.slice(0, GROUP)}-${body.slice(GROUP)}`
}

// Manual entry at the door is typed by a person reading a printed or
// on-screen ticket: accept any case, spaces or missing dashes, and an
// omitted AFA prefix. Returns the canonical code, or null when the
// input isn't a ticket code at all (e.g. a raw booking id from a QR).
export function normalizeTicketCode(input: string): string | null {
  let s = input.toUpperCase().replace(/[\s-]/g, '')
  if (s.startsWith(TICKET_CODE_PREFIX) && s.length === TICKET_CODE_PREFIX.length + GROUP * 2) {
    s = s.slice(TICKET_CODE_PREFIX.length)
  }
  if (s.length !== GROUP * 2) return null
  const code = `${TICKET_CODE_PREFIX}-${s.slice(0, GROUP)}-${s.slice(GROUP)}`
  return TICKET_CODE_RE.test(code) ? code : null
}
