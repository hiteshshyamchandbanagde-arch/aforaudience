// GEN-2609-042 - extracted from NotificationOptIn.tsx so the onboarding
// welcome sequence's notification-opt-in screen can reuse the exact same
// VAPID subscribe + persist logic instead of forking it. No behavior
// change from the original inline version.

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeAndSave() {
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
