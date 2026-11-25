import type { Metadata } from "next"
import LaunchHoldingPage from "@/components/LaunchHoldingPage"

// S1b-b1-fix - static target of the W1 proxy rewrite (src/proxy.ts). While
// launch wave W1 is closed, non-admin requests to "/" and the public
// discovery routes are rewritten here. Never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function LaunchingSoonPage() {
  return <LaunchHoldingPage />
}
