// BUG-2610-022 - one star row for a rating, shared by the artist
// dashboard's Reviews header (an average, e.g. 4.5) and each review card
// (a whole number), so both draw the same star at the same colour. The
// average used to be '⭐'.repeat(Math.round(avg)), which showed 4.5 as
// five stars. Now: whole stars, then a half star for a remainder of
// .25-.75 (rounded to the nearest half). The half star is the same glyph
// with its right half clipped away.
//
// BUG-2610-025 - the star is the app's icon (components/Icon.tsx), not
// the ⭐ emoji, which each platform draws its own way.
import type { CSSProperties } from 'react'
import { starParts } from '@/lib/rating-stars'
import { Icon, INLINE_ICON_STYLE } from '@/components/Icon'

const STAR_STYLE: CSSProperties = { ...INLINE_ICON_STYLE, color: 'var(--afa-amber)', marginRight: '0.1em' }

export default function RatingStars({ rating, style }: { rating: number; style?: CSSProperties }) {
  const { full, half } = starParts(rating)
  return (
    <span role="img" aria-label={`${rating} out of 5`} data-afa-rating-stars={rating} style={{ whiteSpace: 'nowrap', ...style }}>
      {Array.from({ length: full }, (_, i) => <Icon key={i} name="star" size="1em" style={STAR_STYLE} />)}
      {half && <span data-afa-half-star style={{ display: 'inline-block', clipPath: 'inset(0 50% 0 0)' }}><Icon name="star" size="1em" style={STAR_STYLE} /></span>}
    </span>
  )
}
