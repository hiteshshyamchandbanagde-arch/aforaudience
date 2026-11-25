'use client'

import { useSyncExternalStore } from 'react'

// BUG-2610-001 follow-up (14 Oct) - the device's network state, live.
// Offline, next-auth's session fetch fails and useSession reports
// unauthenticated, exactly like a sign-out; the top bars use this to stop
// showing Sign in / Sign up over the saved tickets. navigator.onLine is
// the interface state, not real reachability (see OfflineBanner.tsx).
function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine === false,
    // The server render (and the SW-cached shell) assumes online.
    () => false,
  )
}
