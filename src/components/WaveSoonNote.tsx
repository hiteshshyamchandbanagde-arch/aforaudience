import type { ReactNode } from "react"
import type { Wave } from "@/lib/launch-waves"

// S1b-b2 - the neutral "opening soon" state shown in place of a form/button
// while a launch wave is closed. Same look as the S1a "Booking opens soon"
// box on the event page (EventDetailClientPage.tsx).
export default function WaveSoonNote({ wave, children, compact = false }: { wave: Wave; children: ReactNode; compact?: boolean }) {
  return (
    <div
      data-afa-wave-soon={wave}
      role="status"
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: compact ? "var(--afa-text-small)" : "var(--afa-text-body)",
        color: "var(--afa-text-secondary)",
        textAlign: compact ? "left" : "center",
        padding: compact ? "var(--afa-space-2) var(--afa-space-3)" : "var(--afa-space-3)",
        border: "1px solid var(--afa-tint-10)",
        borderRadius: "var(--afa-radius-xs)",
      }}
    >
      {children}
    </div>
  )
}
