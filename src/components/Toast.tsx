'use client';

import { createContext, useCallback, useContext, useState } from 'react';

/**
 * Global toast/snackbar. Fixed-position, so it's visible regardless of
 * scroll position - the problem this solves: long dashboard forms render
 * their error banner at the top of the page, above the fold once you've
 * scrolled down to the submit button, so a failed submit silently fails
 * off-screen. Toasts float above everything and don't require scrolling
 * back up to notice.
 *
 * Usage: const { showToast } = useToast(); showToast('Something went wrong', 'error')
 */

type ToastKind = 'error' | 'success' | 'info';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail soft rather than crash a page that forgot the provider -
    // callers still get a no-op showToast instead of a hard error.
    return { showToast: () => {} };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = 'error') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-countdown {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxWidth: 'calc(100vw - 32px)',
          width: 420,
          // The rest of the app sets fontFamily per-page (e.g. `main`'s
          // system-ui, sans-serif) - this renders as a sibling of page
          // content, outside that wrapper, so without setting it here
          // explicitly it silently falls back to the browser's default
          // serif font. That mismatch is what read as "flat/rough."
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {toasts.map((t) => {
          const accent = t.kind === 'error' ? 'var(--afa-terracotta)' : t.kind === 'info' ? 'var(--afa-amber)' : 'var(--afa-green-mid)'
          const bg = t.kind === 'error' ? 'var(--afa-error-bg)' : t.kind === 'info' ? 'var(--afa-cream-tint-3)' : 'var(--afa-mint-tint-2)'
          const text = t.kind === 'error' ? 'var(--afa-maroon)' : t.kind === 'info' ? 'var(--afa-gold)' : 'var(--afa-green-forest)'
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                background: bg,
                color: text,
                borderRadius: 12,
                borderLeft: `4px solid ${accent}`,
                padding: '14px 16px 16px',
                fontSize: 14,
                lineHeight: 1.45,
                boxShadow: '0 10px 30px rgba(14,12,10,0.16)',
                animation: 'toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                overflow: 'hidden',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: accent,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  marginTop: 1,
                }}
              >
                {t.kind === 'error' ? '!' : t.kind === 'info' ? 'i' : '✓'}
              </span>
              <span style={{ flex: 1, fontWeight: 500 }}>{t.message}</span>
              <button
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                style={{
                  flexShrink: 0,
                  background: 'transparent',
                  border: 'none',
                  color: text,
                  opacity: 0.5,
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                ×
              </button>
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: 3,
                  background: accent,
                  opacity: 0.4,
                  animation: `toast-countdown ${AUTO_DISMISS_MS}ms linear forwards`,
                }}
              />
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  );
}
