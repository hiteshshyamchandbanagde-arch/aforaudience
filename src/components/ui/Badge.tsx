// GEN-2609-053 - shared rendering wrapper for the status-pill pattern
// built on src/lib/statusStyle.ts's STATUS_TONE (GEN-2609-051). The
// tone values (bg/color) stay domain-specific per caller - a booking
// status and an event status are different domains, per GEN-2609-051's
// own scoping decision - only the pill chrome (font-size/padding/
// border-radius) is shared here.
//
// Two variants, not one: audited dashboard/organiser/page.tsx's and
// tickets/page.tsx's actual pill chrome before assuming they matched
// (they don't) - organiser's is uppercase + letter-spaced + 5px/10px
// padding, tickets' is plain-case + 4px/10px padding. Forcing both into
// one shape would be a real visual change to whichever file didn't
// already look that way; `status` and `status-compact` preserve each
// file's exact current appearance instead.
import type { StatusToneStyle } from '@/lib/statusStyle'

export type BadgeVariant = 'status' | 'status-compact'

const CHROME: Record<BadgeVariant, React.CSSProperties> = {
  status: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '5px 10px',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
  },
  'status-compact': {
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
  },
}

export default function Badge({
  variant = 'status',
  tone,
  children,
  style,
}: {
  variant?: BadgeVariant
  tone: StatusToneStyle
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <span style={{ ...CHROME[variant], background: tone.bg, color: tone.color, ...style }}>
      {children}
    </span>
  )
}
