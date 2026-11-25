// Formats real seat labels for a NUMBERED-venue booking (e.g. "A5",
// "Balcony B12"). GA bookings have no BookingSeat rows at all - the
// section+quantity summary (Booking.seats JSON) remains the only display
// for those, unchanged by this helper.
//
// Sort order: level (empty/ground level first, alphabetical after), then
// row, then number (numeric-aware so A2 sorts before A10).
interface SeatLike {
  level: string
  row: string
  number: string
}

export function formatSeatLabels(seats: SeatLike[]): string[] {
  const sorted = [...seats].sort((a, b) => {
    if (a.level !== b.level) return a.level.localeCompare(b.level)
    if (a.row !== b.row) return a.row.localeCompare(b.row)
    return Number(a.number) - Number(b.number)
  })
  return sorted.map((s) => (s.level ? `${s.level} ${s.row}${s.number}` : `${s.row}${s.number}`))
}
