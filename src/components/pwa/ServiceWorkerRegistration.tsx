'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker after the app has mounted.
 *
 * Runs client-side only. Deliberately kept out of Providers so the
 * registration doesn't block hydration — the SW registers asynchronously
 * after the first paint. Failures are logged but never surfaced to the
 * user; a failed SW registration should degrade to a normal SPA, not
 * an error state.
 *
 * Only enabled in production. In dev the SW would cache stale HTML and
 * make hot reload confusing. Also skipped when the browser doesn't
 * support service workers (older iOS, some WebViews).
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Defer registration slightly so it doesn't compete with the initial
    // render for main-thread time. Idle-ish scheduling is enough here.
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          console.warn('[sw] registration failed', err);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
