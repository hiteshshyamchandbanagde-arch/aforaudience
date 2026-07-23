'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

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

  return (
    <div
      role="status"
      aria-label="Verify your phone"
      style={{
        background: 'var(--afa-error-bg)',
        color: 'var(--afa-maroon)',
        borderBottom: '1px solid var(--afa-error-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
        📱
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        Verify your phone number to book tickets or venues.
      </span>
      <Link
        href={`/verify-phone?next=${encodeURIComponent(pathname || '/')}`}
        style={{
          background: 'var(--afa-terracotta)',
          color: 'white',
          padding: '6px 14px',
          borderRadius: 999,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 13,
          whiteSpace: 'nowrap',
        }}
      >
        Verify now
      </Link>
    </div>
  );
}
