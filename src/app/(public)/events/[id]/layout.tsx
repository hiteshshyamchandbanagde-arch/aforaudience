// GEN-2609-003 (Mobile Redesign Phase 1) - mount-in push transition for
// this full-screen route when reached from the mobile tab shell's
// Discover tab. A route-segment layout rather than editing
// EventDetailClientPage.tsx (911 lines, several early-return states) -
// see globals.css's .afa-push-mount rule for the actual animation
// (mobile-only, reduced-motion aware). Also wraps /events/[id]/rate,
// which is harmless (same subtle entrance feel, not a restyle).
export default function EventDetailLayout({ children }: { children: React.ReactNode }) {
  return <div className="afa-push-mount">{children}</div>
}
