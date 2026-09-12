'use client'

import ContributionMoment from '@/components/ContributionMoment'

// TEMP verification-only route for the new ContributionMoment component
// (see docs/afa-uiux-design-audit.md Section 11/12 build) - screenshot-
// checked against the Figma mockups. Kept on this branch at chat's
// request for a second verification pass before cleanup. Not wired into
// any real flow.
export default function ContributionMomentPreview() {
  return (
    <ContributionMoment
      seatSummary="SEAT A7 · ROW A"
      venueLabel="Blue Frog, Pune"
      supporterCount={43}
      artistName="Ritviz"
      onClose={() => {}}
      onViewTicket={() => {}}
    />
  )
}
