// GEN-2609-056 - shared extraction of the isNavigating spinner-overlay
// markup, previously duplicated across VenuesGridClient.tsx's inline
// venue card and EventCard.tsx's EventCard/EventRow. The three sites
// were NOT byte-identical on closer inspection - ring size (24 vs 26px),
// scrim darkness (rgba(10,10,10,0.6) vs rgba(20,20,20,0.7)) and accent
// color (--afa-amber vs --afa-fill-solid) all differed - so this takes
// those as props rather than hardcoding one look, preserving each
// site's exact current appearance (no visual change is the bar).
//
// Also closes a latent fragility: EventCard/EventRow used
// `animation: "afa-spin ..."` without ever defining `@keyframes afa-spin`
// themselves - it only worked because some other component on the same
// page (there are 12+ across the app) happened to inject the keyframe
// via its own inline <style> tag first. This component is self-
// contained so that dependency is gone for these three consumers. The
// other 12+ duplicate keyframe injections elsewhere are a separate,
// wider pattern - flagged in docs/design.md, not touched here (out of
// this ticket's stated 3-file scope).
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
      <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: "50%", border: "3px solid rgba(245,245,240,0.15)", borderTopColor: accentColor, animation: "afa-spin 0.7s linear infinite" }} />
      <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
