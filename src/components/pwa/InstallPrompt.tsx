'use client';

import { useEffect, useState } from 'react';

/**
 * "Add to Home Screen" prompt.
 *
 * Chrome/Edge on Android fire a `beforeinstallprompt` event when the
 * PWA meets the installability criteria (has manifest, has SW, served
 * over HTTPS, engagement heuristics met). Default browser behavior is
 * to show a subtle install banner; we intercept and defer that so we
 * can present a brand-consistent prompt instead of the OS chrome.
 *
 * iOS Safari does NOT fire this event — there's no equivalent API. The
 * only path there is manual: Share button → "Add to Home Screen". If
 * we detect standalone-mode iOS Safari or the event never fires, this
 * component just renders nothing. That's fine — the goal is a
 * distraction-free path on Android where installability is a first-class
 * signal, not a nag on every device.
 *
 * Dismissal is remembered in localStorage so we don't keep bugging the
 * same user across sessions. If the user actually installs, Chrome
 * fires `appinstalled` and we tear down the UI regardless.
 */

// Chrome's proprietary event type; not in the standard TypeScript DOM lib.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'afora_pwa_install_dismissed_at';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If the app is already running in standalone mode, don't prompt.
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as { standalone?: boolean }).standalone === true) return;

    // Respect a recent dismissal.
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_MS) return;
      }
    } catch {
      // localStorage disabled (private mode / iOS restrictions). Not fatal.
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const onInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'dismissed') {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    } finally {
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  const onDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 50,
        background: 'var(--afa-ink)',
        color: 'var(--afa-cream)',
        borderRadius: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div id="pwa-install-title" style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
          Install AforAudience
        </div>
        <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>
          Quick access, offline tickets, feels like an app.
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss install prompt"
        style={{
          background: 'transparent',
          color: 'var(--afa-cream)',
          border: 'none',
          padding: '8px 12px',
          fontSize: 14,
          opacity: 0.7,
          cursor: 'pointer',
        }}
      >
        Not now
      </button>
      <button
        onClick={onInstall}
        style={{
          background: 'var(--afa-terracotta)',
          color: 'white',
          border: 'none',
          borderRadius: 999,
          padding: '10px 18px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Install
      </button>
    </div>
  );
}
