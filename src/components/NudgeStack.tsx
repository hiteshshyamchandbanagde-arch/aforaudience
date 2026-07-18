'use client';

import { useEffect, useRef } from 'react';
import PhoneVerifyNudge from './PhoneVerifyNudge';
import DisplayNameNudge from './DisplayNameNudge';
import NotificationOptIn from './NotificationOptIn';

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
      <PhoneVerifyNudge />
      <DisplayNameNudge />
      <NotificationOptIn />
    </div>
  );
}
