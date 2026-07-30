'use client';

import { useEffect, useState } from 'react';

/**
 * Offline / back-online status banner (YouTube-style top bar).
 *
 * The actual offline capability — service worker precache, network-first
 * navigation with cache/offline.html fallback — already exists and is
 * live (public/sw.js, registered in layout.tsx). This component is purely
 * the visible signal: without it, a user on patchy signal at a venue door
 * has no way to know *why* fresh data isn't loading, even though cached
 * pages/tickets still render fine.
 *
 * Two states:
 *   - Offline: persistent bar, stays up for as long as navigator.onLine
 *     is false. No auto-dismiss — the underlying condition hasn't changed.
 *   - Back online: brief confirmation bar after reconnecting, auto-hides.
 *     Skipped on first mount (we don't know anything was ever offline),
 *     only shown after an actual offline -> online transition.
 *
 * navigator.onLine reflects network *interface* state, not real
 * connectivity to our servers (e.g. connected to wifi with no internet
 * still reports true) - that's a known limitation of the browser API,
 * not something worth working around here. Good enough for the venue-door
 * patchy-signal case this exists for.
 */

const BACK_ONLINE_DISPLAY_MS = 3000;

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    setIsOffline(!navigator.onLine);

    let backOnlineTimer: ReturnType<typeof setTimeout> | undefined;

    const handleOffline = () => {
      if (backOnlineTimer) clearTimeout(backOnlineTimer);
      setShowBackOnline(false);
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline((wasOffline) => {
        if (wasOffline) {
          setShowBackOnline(true);
          backOnlineTimer = setTimeout(() => setShowBackOnline(false), BACK_ONLINE_DISPLAY_MS);
        }
        return false;
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (backOnlineTimer) clearTimeout(backOnlineTimer);
    };
  }, []);

  if (!isOffline && !showBackOnline) return null;

  const offline = isOffline;

  // Deliberately NOT position: fixed. This renders as a normal-flow child
  // inside NudgeStack's sticky wrapper (see NudgeStack.tsx), which measures
  // its own height and publishes --nudge-stack-height for SiteNav to read.
  // A fixed overlay here would sit outside that system and get covered by -
  // or itself cover - the sticky nav once scrolled, the same bug NudgeStack
  // was built to fix for the phone-verify/display-name/notification nudges.
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: offline ? 'var(--afa-error)' : 'var(--afa-green-bright)',
        color: 'white',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 600,
        padding: '8px 16px',
        letterSpacing: '0.01em',
      }}
    >
      {offline ? "You're offline — showing saved content" : 'Back online'}
    </div>
  );
}
