// BUG-2610-022 - how many stars a rating draws (src/components/ui/RatingStars.tsx):
// whole stars, then a half star for a remainder of .25-.75 (rounded to the
// nearest half). Clamped to 0-5.
export function starParts(rating: number): { full: number; half: boolean } {
  const halves = Math.round(Math.max(0, Math.min(5, rating)) * 2)
  return { full: Math.floor(halves / 2), half: halves % 2 === 1 }
}
