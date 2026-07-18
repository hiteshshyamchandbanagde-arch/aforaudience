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

type ToastKind = 'error' | 'success';

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
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
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
          gap: 10,
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
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            onClick={() => dismiss(t.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: t.kind === 'error' ? '#FDECEA' : '#E7F4EC',
              color: t.kind === 'error' ? '#B3261E' : '#1E4620',
              border: `1px solid ${t.kind === 'error' ? '#F5C2C0' : '#B7DEC2'}`,
              borderRadius: 10,
              padding: '14px 16px',
              fontSize: 14,
              lineHeight: 1.4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              cursor: 'pointer',
              animation: 'toast-in 0.2s ease-out',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.2 }}>
              {t.kind === 'error' ? '⚠️' : '✓'}
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
