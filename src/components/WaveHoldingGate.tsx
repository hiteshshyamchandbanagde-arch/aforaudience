import type { ReactNode } from "react"
import LaunchHoldingPage from "@/components/LaunchHoldingPage"
import { shouldShowHoldingPage } from "@/lib/launch-waves.server"

// S1b-b1 - wraps a held discovery segment (its layout.tsx) or the homepage.
// `path` is the segment's own URL prefix; every page under it shares the
// same answer, so a layout not re-rendering between sibling pages is fine.
export default async function WaveHoldingGate({ path, children }: { path: string; children: ReactNode }) {
  if (await shouldShowHoldingPage(path)) return <LaunchHoldingPage />
  return <>{children}</>
}
