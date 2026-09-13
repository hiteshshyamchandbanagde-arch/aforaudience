'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import OfflineBanner from './OfflineBanner';
import PhoneVerifyNudge from './PhoneVerifyNudge';
import DisplayNameNudge from './DisplayNameNudge';
import NotificationOptIn from './NotificationOptIn';
import { isOnboardingSequenceDue } from '@/lib/onboarding';

/**
 * Wraps the top-of-page nudge banners (phone verify, display name,
 * notification opt-in) in a single sticky stack.
 *
 * Previously each of the three banners independently declared
 * `position: sticky; top: 0`, and SiteNav (z-index 100) did the same.
 * Once scrolled far enough for SiteNav's sticky to engage, it visually
 * covered whichever banner was showing (SiteNav has the higher
 * z-index) - so e.g. the "Verify now" CTA disappeared entirely until
 * the user scrolled back to the very top of the page. Reported by
 * Hitesh via real QA testing (Nita's venue-publish flow), 19 Jul.
 *
 * Fix: only this outer wrapper is sticky now. The individual banners
 * render as normal-flow children inside it, so if more than one is
 * ever visible at once they stack vertically instead of overlapping.
 * The wrapper measures its own rendered height and publishes it as
 * the --nudge-stack-height CSS variable on the root element, which
 * SiteNav reads to offset its own sticky `top` - so nav docks *below*
 * the banner stack instead of competing for the same top:0 slot.
 */
export default function NudgeStack() {
  const ref = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--nudge-stack-height', `${el.offsetHeight}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--nudge-stack-height', '0px');
    };
  }, []);

  return (
    <div ref={ref} style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      {!suppressed && (
        <>
          <OfflineBanner />
          <PhoneVerifyNudge />
          <DisplayNameNudge />
          <NotificationOptIn />
        </>
      )}
    </div>
  );
}
