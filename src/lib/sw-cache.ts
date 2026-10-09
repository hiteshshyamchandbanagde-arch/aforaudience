import { signOut } from 'next-auth/react'

// BUG-2609-088. The service worker's runtime cache (public/sw.js,
// `afora-runtime-<CACHE_VERSION>`) holds the navigation HTML it falls
// back to when the network fails - that's what makes /tickets work
// offline. That HTML is rendered for whoever was signed in at the time,
// so it has to go whenever the identity on this device changes:
// otherwise the next person to lose signal here gets the previous
// user's page. Cleared from the page (the Cache Storage API is shared
// with the worker) rather than via a postMessage round-trip, so it works
// even when no worker controls the page yet. The prefix match covers
// every CACHE_VERSION - scripts/stamp-sw-version.js rewrites it per build.
const RUNTIME_CACHE_PREFIX = 'afora-runtime-'
const LAST_USER_KEY = 'afa-sw-last-user'

export async function clearSwRuntimeCache(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith(RUNTIME_CACHE_PREFIX)).map((k) => caches.delete(k)))
  } catch {
    // Cache Storage unavailable (private mode, blocked site data) - there
    // is nothing cached to leak in that case either.
  }
}

// Drop-in for next-auth's signOut - every sign-out in the app goes
// through this so the cache is gone before the session is.
// BUG-2610-021 - the city cookie (afa_loc) goes with it, so the next
// person on this device does not start in the last account's city.
export async function signOutAndClearCache(options?: Parameters<typeof signOut>[0]) {
  await Promise.all([
    clearSwRuntimeCache(),
    fetch('/api/user/location', { method: 'DELETE' }).catch(() => {
      // Offline: the cookie stays, the sign-out must still happen.
    }),
  ])
  return signOut(options)
}

// Covers the path signOutAndClearCache can't: a session that expired on
// its own, followed by a different user signing in on the same device.
// Only ever compares two signed-in ids - "signed out" is deliberately
// not treated as a change, because a failed session fetch while offline
// looks identical to it and clearing then would delete the offline
// tickets page at exactly the moment it's needed.
export async function clearSwRuntimeCacheOnUserChange(userId: string): Promise<void> {
  let lastUserId: string | null = null
  try {
    lastUserId = localStorage.getItem(LAST_USER_KEY)
  } catch {
    // localStorage unavailable - fall through and clear, the safe side.
  }
  if (lastUserId === userId) return
  await clearSwRuntimeCache()
  try {
    localStorage.setItem(LAST_USER_KEY, userId)
  } catch {
    // Not remembered - the next load clears again, which is harmless.
  }
}
