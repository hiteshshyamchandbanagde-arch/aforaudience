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

// GEN-2609-060 - 3 more real pill shapes found during the -055 audit,
// each re-verified fresh against qa before adding (not trusted from
// the earlier flag). None fit `status`/`status-compact` - forcing them
// in would have been a visible change (font-size/padding/weight all
// differ) - so each gets its own variant instead, additive only.
export type BadgeVariant = 'status' | 'status-compact' | 'micro' | 'tag' | 'pill'

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
  // admin/feedback's category/severity badges. The two real call sites
  // differ only in `letterSpacing` (category: 0.03em, severity: none) -
  // baseline matches severity (no letter-spacing), category applies the
  // 0.03em via its own `style` override rather than picking one value
  // and quietly changing the other site.
  micro: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '999px',
  },
  // admin/bookings' "FREE" tag - deliberately not folded into `status`/
  // `status-compact` conceptually either: it's a fixed fact about an
  // event (isFree), not a lifecycle state with multiple tone-driven
  // values, so `tag` rather than another `status-*` name.
  tag: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '999px',
  },
  // artist/events' compensation pill + "Lineup full" pill - identical
  // chrome on both real call sites, no per-site override needed.
  pill: {
    fontSize: '13px',
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: '999px',
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
