// GEN-2609-056 - shared extraction of the isNavigating spinner-overlay
// markup, previously duplicated across VenuesGridClient.tsx's inline
// venue card and EventCard.tsx's EventCard/EventRow. The three sites
// were NOT byte-identical on closer inspection - ring size (24 vs 26px),
// scrim darkness (two near-black alphas, now both --afa-scrim) and accent
// color (--afa-amber vs --afa-fill-solid) all differed - so this takes
// those as props rather than hardcoding one look, preserving each
// site's exact current appearance (no visual change is the bar).
//
// GEN-2609-062 - `@keyframes afa-spin` now lives once in globals.css
// (was independently duplicated via inline <style> tags in 10 files,
// this one included) - the own-copy fallback this component originally
// carried (to avoid depending on some other page-mounted component
// injecting the keyframe first) is no longer needed now that the
// keyframe is guaranteed to exist globally.
export default function SpinnerOverlay({
  isNavigating,
  size,
  accentColor,
  scrimBackground,
}: {
  isNavigating: boolean
  size: number
  accentColor: string
  scrimBackground: string
}) {
  if (!isNavigating) return null
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 2, background: scrimBackground, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: "50%", border: "3px solid var(--afa-border-resting)", borderTopColor: accentColor, animation: "afa-spin 0.7s linear infinite" }} />
    </div>
  )
}
