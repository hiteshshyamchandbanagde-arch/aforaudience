'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

/**
 * "Add your display name" nudge for existing users whose `displayName`
 * is null.
 *
 * Context: Fix B (Sixth amendment) added `User.displayName` as separate
 * from `User.name` (username). New signups persist their Full Name into
 * `displayName`. Existing users have `displayName = null` and their
 * tickets currently show either their username or "Guest" (see
 * `ticket-pdf.ts`'s fallback chain). This nudges them to fix it, once,
 * without gating anything.
 *
 * Rules of engagement:
 *   - Only visible when logged in AND displayName is null
 *   - Dismissible; dismissal is remembered for 14 days
 *   - Hidden on auth pages, checkout, admin, and API routes
 *     (checkout hides so mid-flow attention isn't stolen; auth pages
 *     because the user might be *becoming* logged in)
 *   - Self-contained: mounts in root layout, checks its own state,
 *     renders nothing when it shouldn't be visible
 *
 * NOT built here (deliberate):
 *   - A soft-gate on booking that requires displayName ("Add your name
 *     before booking"). That would be more effective but crosses the
 *     "browse-first, never block" line the design doc §2 draws. If
 *     tickets-with-usernames turn out to embarrass audiences at the
 *     door, revisit — for MVP, subtle-nudge-once is enough.
 */

const DISMISS_KEY = 'afora_displayname_nudge_dismissed_at';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Paths where the nudge must not appear. Anything under these prefixes.
// Kept as a small explicit list rather than regex — easier to reason
// about, easier to grep for.
const EXCLUDED_PATH_PREFIXES = [
  '/auth',
  '/checkout',
  '/api',
  '/admin', // admin dashboard is dense; extra chrome unwelcome there
];

export default function DisplayNameNudge() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  // Read the dismissal timestamp on mount. State default is `false`
  // (i.e. "assume not dismissed"); we only flip it to `true` if a
  // recent dismissal is on record. Server render matches "not dismissed"
  // so hydration never causes a flash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_MS) {
          setDismissed(true);
        }
      }
    } catch {
      // localStorage disabled (private mode / iOS restrictions). Not fatal.
    }
  }, []);

  // Loading state — session is unknown yet; render nothing to avoid flash.
  if (status !== 'authenticated' || !session?.user) return null;

  const user = session.user as { displayName?: string | null };
  if (user.displayName && user.displayName.trim().length > 0) return null;

  if (dismissed) return null;

  if (pathname) {
    for (const prefix of EXCLUDED_PATH_PREFIXES) {
      if (pathname.startsWith(prefix)) return null;
    }
  }

  const onDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="status"
      aria-label="Add your display name"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: '#FFF3E6',
        color: '#4A2E1A',
        borderBottom: '1px solid #F0D9BF',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
        ✨
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        Add your name so tickets say your name, not your username.
      </span>
      <Link
        href="/profile"
        onClick={() => {
          // Dismiss on click-through too — user is going to fix it now,
          // so we don't need to keep the banner around after they return.
          onDismiss();
        }}
        style={{
          background: '#C8441A',
          color: 'white',
          padding: '6px 14px',
          borderRadius: 999,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 13,
          whiteSpace: 'nowrap',
        }}
      >
        Add name
      </Link>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#4A2E1A',
          padding: '4px 8px',
          fontSize: 18,
          opacity: 0.6,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
