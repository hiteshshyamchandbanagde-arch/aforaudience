"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { ALL_WAVES_OPEN, wavesForViewer, type WaveHint } from "@/lib/launch-waves-ui"

// S1b-b2 - client read of the public launch-wave hint
// (GET /api/platform-settings/launch-waves) for client components that
// show an "opening soon" state. ADMIN sees everything open (bypass, same
// as the server). Until the hint loads, or if it fails, everything reads
// open: the server still refuses and waveErrorMessage() maps the 403.
export function useLaunchWaves(): WaveHint {
  const { data: session } = useSession()
  const [hint, setHint] = useState<WaveHint | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/platform-settings/launch-waves")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data && typeof data === "object") setHint(data as WaveHint) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN"
  return hint ? wavesForViewer(hint, isAdmin) : ALL_WAVES_OPEN
}
