'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n/translate';
import { subscribeAndSave } from '@/lib/push-subscribe';
import Button from '@/components/ui/Button';
import { BellIcon } from '@/components/icons/VenueIcons';

/**
 * "Enable notifications" nudge. Any logged-in role can benefit (admin
 * approvals today; organiser/venue-owner/artist notifications are planned
 * fast-follows on the same plumbing) so this isn't role-gated.
 *
 * Rules of engagement:
 *   - Only shown if the browser supports Push (serviceWorker + PushManager)
 *     and Notification.permission is still 'default' (not yet granted or
 *     denied - if the user already said no, don't nag them every visit)
 *   - Dismissible, unlike PhoneVerifyNudge - this isn't a required gate on
 *     any flow, so respecting a "not now" is the right call
 *   - Hidden on auth/checkout/verify-phone/api, same exclusion list as the
 *     other nudges, so it never competes with a page that has its own
 *     time-sensitive ask
 *
 * BUG-2608-045: banner text/button were hardcoded English regardless of
 * language toggle - this is a global cross-page component so it was a
 * wide-surface-area gap. Now reads tr.notificationOptIn.
 */

const EXCLUDED_PATH_PREFIXES = ['/auth', '/checkout', '/verify-phone', '/api'];
const DISMISSED_KEY = 'afora-notif-nudge-dismissed';

export default function NotificationOptIn() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { t: tr } = useLocale();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(true); // default true until checked, avoids a flash
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
    setDismissed(window.sessionStorage.getItem(DISMISSED_KEY) === '1');
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    subscribeAndSave().catch((err) => console.warn('[push] silent subscribe/re-link failed', err));
  }, [status, (session?.user as any)?.id]);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;
      await subscribeAndSave();
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  if (status !== 'authenticated' || !session?.user) return null;
  if (!supported || permission !== 'default') return null;
  if (dismissed) return null;
  if (pathname) {
    for (const prefix of EXCLUDED_PATH_PREFIXES) {
      if (pathname.startsWith(prefix)) return null;
    }
  }

  return (
    <div
      role="status"
      aria-label={tr.notificationOptIn.ariaLabel}
      style={{
        background: 'var(--afa-fill-solid)',
        color: 'var(--afa-on-fill-solid)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        fontSize: 'var(--afa-text-body)',
        lineHeight: 1.4,
      }}
    >
      <BellIcon style={{ width: 18, height: 18, flexShrink: 0, color: 'var(--afa-on-fill-solid)' }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        {tr.notificationOptIn.message}
      </span>
      <Button
        variant="outline"
        fullWidth={false}
        onClick={enable}
        disabled={busy}
        style={{ padding: '6px 14px', fontSize: 'var(--afa-text-ui)', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        {busy ? tr.notificationOptIn.enabling : tr.notificationOptIn.enable}
      </Button>
      <Button
        variant="bare"
        onClick={dismiss}
        aria-label={tr.notificationOptIn.dismissAriaLabel}
        style={{
          color: 'rgba(247,243,238,0.6)',
          fontSize: 'var(--afa-text-lead)',
          lineHeight: 1,
          padding: '0 4px',
        }}
      >
        ×
      </Button>
    </div>
  );
}
