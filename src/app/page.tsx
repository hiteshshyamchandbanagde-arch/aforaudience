import HomePageClient from "./HomePageClient"
import { getLiveCitiesSafe } from "@/lib/live-cities.server"
import WaveHoldingGate from "@/components/WaveHoldingGate"

// Events copy A (Hitesh, 14 Oct) - the hero tag counts the cities with an
// upcoming APPROVED show. Read here on the server, cached for 5 minutes
// (live-cities.server.ts), so there is no client fetch for it. The page
// itself is regenerated on the same 5-minute clock (ISR); without this the
// count would stay at whatever the build saw.
// S1b-b1 - the W1 holding-page check below reads the session, so "/" is now
// rendered per request; the city count is still the 5-minute cached read.
export const revalidate = 300

export default async function Home() {
  const liveCities = await getLiveCitiesSafe()
  return (
    <WaveHoldingGate path="/">
      <HomePageClient liveCities={liveCities} />
    </WaveHoldingGate>
  )
}
