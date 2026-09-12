'use client'

// The "contribution moment" - shown right after a user's seats are
// confirmed (free/no-payment booking, or a paid booking's payment
// success), replacing the old plain "booking confirmed" text with the
// audit's Strategic Call #1 (docs/afa-uiux-design-audit.md, Section 11):
// own the moment someone would screenshot and send a friend - the
// decision to go, not the payment. Deliberately payment-agnostic copy
// throughout (no "Booking confirmed" / receipt framing) per that brief.
//
// Mobile/desktop split is deliberate (task brief, not a bug): mobile
// reuses this codebase's existing .afa-sheet-mount/.afa-backdrop-mount
// mount animations (defined in globals.css, already used by
// MobileEventFilterSheet.tsx) full-bleed; desktop is a centered modal
// over the same 60%-black backdrop convention, sized as a card rather
// than a full-bleed sheet. Both variants render the same inner content -
// only the outer chrome differs, gated by the app's existing 1023px
// breakpoint (see HomeHeader.tsx's identical @media convention).
//
// Type sizes/spacing below follow docs/afa-design-tokens-reference.md
// Section 8's proposed scale (11/12/13/14/16/24px type, 4/8/12/16/20/24px
// spacing) wherever a value cleanly maps to it. Two values don't and are
// called out inline rather than silently forced onto that scale: the
// headline and seal count are both display-sized "moment" typography,
// which Section 8.1 explicitly carves out as its own separate, not-yet-
// specified gap (hero/display headings) - 32px/900 here matches the
// checkout page's own pre-existing "You're in" celebratory headline
// (checkout/[bookingId]/page.tsx) rather than inventing a new one.

type ContributionMomentProps = {
  seatSummary: string
  venueLabel: string
  supporterCount: number
  artistName: string
  onClose: () => void
  onViewTicket: () => void
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(245,245,240,0.08)', color: 'var(--afa-text-secondary)',
        border: 'none', cursor: 'pointer', fontSize: 16, fontFamily: 'var(--font-sans)',
      }}
    >
      ×
    </button>
  )
}

function ContributionBody({
  seatSummary,
  venueLabel,
  supporterCount,
  artistName,
  onClose,
}: Omit<ContributionMomentProps, 'onViewTicket'>) {
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <CloseButton onClose={onClose} />
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--afa-amber)', marginBottom: 8 }}>
        CONFIRMED
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, color: 'var(--afa-text-primary)', margin: 0, lineHeight: 1.05 }}>
        You&rsquo;re going.
      </h1>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--afa-text-secondary)', marginTop: 8 }}>
        {seatSummary} · {venueLabel}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0' }}>
        <div
          style={{
            width: 140, height: 140, borderRadius: '50%', flexShrink: 0,
            background: 'var(--afa-fill-solid)', border: '3px solid var(--afa-amber)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 800, color: 'var(--afa-on-fill-solid)' }}>
            {supporterCount}
          </span>
        </div>
      </div>

      <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 16, padding: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--afa-amber)', marginBottom: 8 }}>
          YOUR CONTRIBUTION
        </div>
        <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.6, color: 'var(--afa-text-primary)' }}>
          You&rsquo;re one of {supporterCount} people supporting {artistName}&rsquo;s show — every seat helps decide if this show happens.
        </p>
      </div>
    </>
  )
}

// Same copy as the old confirmed-state screen's tr.checkoutPage.emailedTicketNote
// (src/lib/i18n/dictionaries/en.ts) - carried forward as hardcoded English,
// matching the rest of this screen's copy, rather than wired through the
// 11-locale dictionary (see build report's flagged i18n scope call).
function EmailedTicketNote() {
  return (
    <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.6, color: 'var(--afa-text-secondary)', textAlign: 'center' }}>
      We&rsquo;ve also emailed the ticket to you. Show the QR at the door — screen or print is fine.
    </p>
  )
}

function ViewTicketButton({ onViewTicket }: { onViewTicket: () => void }) {
  return (
    <button
      onClick={onViewTicket}
      style={{
        width: '100%', background: 'var(--afa-fill-solid)', color: 'var(--afa-on-fill-solid)',
        padding: 16, border: 'none', borderRadius: 999, fontSize: 16, fontWeight: 700,
        fontFamily: 'var(--font-sans)', cursor: 'pointer', flexShrink: 0,
      }}
    >
      View My Ticket
    </button>
  )
}

export default function ContributionMoment(props: ContributionMomentProps) {
  return (
    <>
      <style>{`
        .cm-desktop { display: flex; }
        .cm-mobile { display: none; }
        @media (max-width: 1023px) {
          .cm-desktop { display: none; }
          .cm-mobile { display: flex; }
        }
        @keyframes cm-modal-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .cm-modal-mount { animation: cm-modal-in 0.2s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .cm-modal-mount { animation: none; }
        }
      `}</style>

      {/* Mobile - full-bleed sheet, reuses the app's existing sheet-mount
          animation. CTA pinned to the bottom of the viewport (marginTop:
          auto) rather than following straight on from the card, matching
          the mockup - a plain top-to-bottom stack left it floating with
          empty space beneath it instead of anchored like the reference. */}
      <div
        className="cm-mobile afa-sheet-mount"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'var(--afa-surface-page)',
          flexDirection: 'column',
          padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
          overflowY: 'auto',
        }}
      >
        <ContributionBody {...props} />
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <ViewTicketButton onViewTicket={props.onViewTicket} />
          <EmailedTicketNote />
        </div>
      </div>

      {/* Desktop - centered modal over a dimmed backdrop, not full-page */}
      <div className="cm-desktop" style={{ position: 'fixed', inset: 0, zIndex: 1000, alignItems: 'center', justifyContent: 'center' }}>
        <button
          aria-label="Close"
          onClick={props.onClose}
          className="afa-backdrop-mount"
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer' }}
        />
        <div
          className="cm-modal-mount"
          style={{
            position: 'relative', width: '100%', maxWidth: 440, margin: '0 20px',
            background: 'var(--afa-surface-raised)', borderRadius: 20,
            padding: '24px 24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          <ContributionBody {...props} />
          <div style={{ marginTop: 24 }}>
            <ViewTicketButton onViewTicket={props.onViewTicket} />
            <EmailedTicketNote />
          </div>
        </div>
      </div>
    </>
  )
}
