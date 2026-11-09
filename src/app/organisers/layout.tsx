import type { ReactNode } from "react"
import WaveHoldingGate from "@/components/WaveHoldingGate"

// S1b-b1 - held while launch wave W1 is closed (non-admins see the
// "opening soon" page). See src/lib/launch-waves.server.ts.
export default function Layout({ children }: { children: ReactNode }) {
  return <WaveHoldingGate path="/organisers">{children}</WaveHoldingGate>
}
