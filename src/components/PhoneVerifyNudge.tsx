'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/translate';

/**
 * "Verify your phone" nudge for logged-in users whose `isVerified` is
 * false. Mirrors DisplayNameNudge's rules of engagement, with one
 * difference: this one is NOT dismissible. Booking is now actually gated
 * on verification (see /api/bookings, /api/venue-bookings), so hiding the
 * nudge would just mean the user hits a confusing failure later at
 * checkout instead of an upfront explanation now.
 *
 * Rules of engagement:
 *   - Only visible when logged in AND isVerified is false
 *   - Hidden on auth pages, checkout, verify-phone itself, admin, and API
 *     routes (checkout hides so mid-flow attention isn't stolen there -
 *     the flow already redirects to /verify-phone directly if needed)
 *   - Self-contained: mounts in root layout, checks its own state
 */

const EXCLUDED_PATH_PREFIXES = [
  '/auth',
  '/checkout',
  '/verify-phone',
  '/api',
  '/admin',
];

export default function PhoneVerifyNudge() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const sessionVerified = (session?.user as any)?.isVerified;
    if (typeof sessionVerified === 'boolean') setIsVerified(sessionVerified);
  }, [status, session]);

  if (status !== 'authenticated' || !session?.user) return null;
  if (isVerified !== false) return null;

  if (pathname) {
    for (const prefix of EXCLUDED_PATH_PREFIXES) {
      if (pathname.startsWith(prefix)) return null;
    }
  }

  // BUG-2610-017 - one line at 390 on a neutral, solid dark surface (a
  // to-do, not an error: no error red), short copy, orange Verify CTA.
  return (
    <div role="status" aria-label={t.phoneVerifyNudge.ariaLabel} data-afa-nudge="phone-verify" style={NUDGE_ROW_STYLE}>
      <span aria-hidden="true" style={{ flexShrink: 0, lineHeight: 1 }}>
        📱
      </span>
      <span style={NUDGE_TEXT_STYLE}>{t.phoneVerifyNudge.message}</span>
      <Button
        variant="primary"
        size="pill-sm"
        fullWidth={false}
        href={`/verify-phone?next=${encodeURIComponent(pathname || '/')}`}
        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {t.phoneVerifyNudge.verifyNow}
      </Button>
    </div>
  );
}

// Shared with DisplayNameNudge: the to-do banners' one-line row.
export const NUDGE_ROW_STYLE: React.CSSProperties = {
  background: 'var(--afa-surface-raised)',
  color: 'var(--afa-text-primary)',
  borderBottom: '1px solid var(--afa-border-resting)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--afa-space-3)',
  padding: 'var(--afa-space-2) var(--afa-space-4)',
  fontSize: 'var(--afa-text-ui)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

export const NUDGE_TEXT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
