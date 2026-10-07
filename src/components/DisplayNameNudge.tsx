'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/translate';
import { NUDGE_ROW_STYLE, NUDGE_TEXT_STYLE } from './PhoneVerifyNudge';

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
  const { t } = useLocale();

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

  // BUG-2610-017 - same one-line neutral row as PhoneVerifyNudge.
  return (
    <div role="status" aria-label={t.displayNameNudge.ariaLabel} data-afa-nudge="display-name" style={NUDGE_ROW_STYLE}>
      <span aria-hidden="true" style={{ flexShrink: 0, lineHeight: 1 }}>
        ✨
      </span>
      <span style={NUDGE_TEXT_STYLE}>{t.displayNameNudge.message}</span>
      <Button
        variant="primary"
        size="pill-sm"
        fullWidth={false}
        href="/profile"
        onClick={() => {
          onDismiss();
        }}
        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {t.displayNameNudge.addName}
      </Button>
      <Button
        variant="icon"
        onClick={onDismiss}
        aria-label={t.displayNameNudge.dismiss}
        style={{
          color: 'var(--afa-text-primary)',
          padding: 'var(--afa-space-1) var(--afa-space-2)',
          fontSize: 'var(--afa-text-lead)',
          opacity: 0.6,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </Button>
    </div>
  );
}
