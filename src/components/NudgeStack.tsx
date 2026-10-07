'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import OfflineBanner from './OfflineBanner';
import PhoneVerifyNudge from './PhoneVerifyNudge';
import DisplayNameNudge from './DisplayNameNudge';
import NotificationOptIn from './NotificationOptIn';
import { isOnboardingSequenceDue } from '@/lib/onboarding';

/**
 * The top-of-page banners: offline state, phone verify, display name,
 * notification opt-in.
 *
 * BUG-2610-017 (decision 7 Oct): the to-do banners scroll away with the
 * page. Only the top bar (MobileTopBar / SiteNav) is pinned, at top 0.
 * This stack used to be sticky above it and publish its height as
 * --nudge-stack-height for the top bar's own sticky offset; with no
 * background of its own, scrolled content showed through the
 * translucent banner tints above the top bar. Now:
 *   - PhoneVerifyNudge / DisplayNameNudge / NotificationOptIn sit in
 *     normal flow on a solid page-surface base, so nothing shows through;
 *   - OfflineBanner alone stays pinned (live connection state), above
 *     the top bar (z-index 101) while it shows.
 * The booking gate is unchanged: Book / venue request still redirect to
 * /verify-phone.
 */
export default function NudgeStack() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // GEN-2609-042 - suppress the whole stack while WelcomeSequence's
  // full-screen takeover is showing for this user, so none of the four
  // banners stack (or even flash) underneath it. Same gate the takeover
  // itself uses (see lib/onboarding.ts) - kept in one place so the two
  // can't drift apart.
  const suppressed =
    status === 'authenticated' &&
    isOnboardingSequenceDue((session?.user as any)?.onboardedAt, pathname);

  if (suppressed) return null;

  return (
    <>
      <div data-afa-offline-pin style={{ position: 'sticky', top: 0, zIndex: 101 }}>
        <OfflineBanner />
      </div>
      <div data-afa-nudge-stack style={{ position: 'relative', background: 'var(--afa-surface-page)' }}>
        <PhoneVerifyNudge />
        <DisplayNameNudge />
        <NotificationOptIn />
      </div>
    </>
  );
}
