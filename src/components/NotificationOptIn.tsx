'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

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
 */

const EXCLUDED_PATH_PREFIXES = ['/auth', '/checkout', '/verify-phone', '/api'];
const DISMISSED_KEY = 'afora-notif-nudge-dismissed';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeAndSave() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set');
    return;
  }

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  // Permission being 'granted' does NOT guarantee a subscription object
  // exists on this device - e.g. if permission was granted at some point
  // before the VAPID public key was available client-side, subscribe()
  // was never actually called. Create one now if that's the case; since
  // permission is already decided, this won't show any prompt.
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
}

export default function NotificationOptIn() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
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

  // Handles two cases the banner-based flow above can't reach:
  //   1. Permission was already granted (on any account, possibly a while
  //      ago) and the person has since switched to a different logged-in
  //      account on this same device/browser. Notification.permission is a
  //      per-origin browser setting, not per-account, so once it's
  //      'granted' the banner correctly never asks again - but that also
  //      means a newly logged-in account never gets its own
  //      PushSubscription row without this.
  //   2. Permission is 'granted' but no subscription object was ever
  //      actually created (e.g. granted before the VAPID key was live -
  //      see subscribeAndSave's comment). subscribeAndSave() handles
  //      creating one silently in that case too.
  // No permission prompt needed either way since the browser already
  // decided; the subscribe endpoint upserts on endpoint + reassigns
  // userId, so this is safe to call on every login.
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
      aria-label="Enable notifications"
      style={{
        background: '#0E0C0A',
        color: '#F7F3EE',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
        🔔
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        Turn on notifications so you don&apos;t miss approvals, bookings and updates.
      </span>
      <button
        onClick={enable}
        disabled={busy}
        style={{
          background: '#C8441A',
          color: 'white',
          padding: '6px 14px',
          borderRadius: 999,
          border: 'none',
          fontWeight: 600,
          fontSize: 13,
          whiteSpace: 'nowrap',
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? 'Enabling…' : 'Enable'}
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          color: 'rgba(247,243,238,0.6)',
          border: 'none',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '0 4px',
        }}
      >
        ×
      </button>
    </div>
  );
}
