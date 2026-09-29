'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { ABOVE_CHAT_BUTTON_MOBILE, MOBILE_BREAKPOINT_MAX } from '@/components/mobile/chromeOffsets';
import { useActionRowClearance } from '@/components/mobile/useActionRowClearance';

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
  // BUG-2609-072 - on mobile the stack rests above the chat button, which
  // is where form action rows sit when scrolled into view (the Publish row
  // after Publish). While a data-afa-action-row overlaps that band, the
  // stack moves to the top, under the top bar, instead of covering it.
  // The probe is the stack's resting spot at its current height.
  const stackRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [stackHeight, setStackHeight] = useState(0);
  useLayoutEffect(() => {
    setStackHeight(stackRef.current?.offsetHeight ?? 0);
  }, [toasts]);
  const clearance = useActionRowClearance(probeRef, toasts.length > 0);
  const atTop = clearance.bottom !== null || clearance.hidden;

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
        /* BUG-2609-072 - clear of page content: top-right under the
           sticky nav on desktop; on mobile, above the tab bar and the
           chat button (it used to sit bottom-centre, on top of form
           action rows). */
        .afa-toast-stack { top: calc(var(--nudge-stack-height, 0px) + 80px); right: 24px; }
        @media (max-width: ${MOBILE_BREAKPOINT_MAX}px) {
          .afa-toast-stack { top: auto; bottom: ${ABOVE_CHAT_BUTTON_MOBILE}; right: 16px; left: 16px; width: auto !important; }
          .afa-toast-stack.afa-toast-stack-top { top: calc(var(--nudge-stack-height, 0px) + 72px); bottom: auto; }
        }
      `}</style>
      <div
        ref={probeRef}
        aria-hidden="true"
        className="afa-toast-stack"
        style={{ position: 'fixed', width: 420, maxWidth: 'calc(100vw - 32px)', height: stackHeight, visibility: 'hidden', pointerEvents: 'none' }}
      />
      <div
        ref={stackRef}
        className={atTop ? 'afa-toast-stack afa-toast-stack-top' : 'afa-toast-stack'}
        style={{
          position: 'fixed',
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
          fontFamily: 'var(--font-sans)',
        }}
      >
        {toasts.map((t) => {
          // BUG-2608-092/BUG-2608-095 (see ErrorBanner.tsx) - this was still
          // on the pre-dark-redesign light tokens (--afa-error-bg #FDECEA,
          // --afa-cream-tint-3, --afa-mint-tint-2 - all near-white), which
          // read as a stray light-themed box floating on the otherwise-dark
          // page. Same translucent-on-dark treatment ErrorBanner/
          // SuccessBanner already use, extended to the 'info' kind they
          // don't have.
          //
          // BUG-2609-072 - those tints are translucent (0.1-0.15 alpha), so
          // whatever sat behind a toast printed through it (the button row
          // after Publish, the version-history row after a restore). Every
          // kind now shares one opaque raised surface with a border and a
          // shadow; the kind's colour lives only on the edge and the icon.
          const accent = t.kind === 'error' ? 'var(--afa-error)' : t.kind === 'info' ? 'var(--afa-amber)' : 'var(--afa-green-mid)'
          // BUG-2609-043: the badge glyph's color was a hardcoded 'white'
          // literal - only actually legible against 2 of these 3 dynamic
          // `accent` backgrounds (measured ~6.5:1 on error/green, but only
          // ~2.6:1 on amber). --afa-on-fill-solid is the correct token for
          // amber (its proven pairing app-wide, ~7.1:1) but drops error/
          // green to ~2.9:1 - so this can't be a single static swap either.
          // Same light-or-dark-per-fill pattern already used for seat-map
          // marker glyphs (labelDark ? brown-black : --afa-cream).
          const badgeText = t.kind === 'info' ? 'var(--afa-on-fill-solid)' : 'var(--afa-cream)'
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                background: 'var(--afa-surface-raised)',
                color: 'var(--afa-text-primary)',
                borderRadius: 'var(--afa-radius-lg)',
                border: '1px solid var(--afa-border-resting)',
                borderLeft: `4px solid ${accent}`,
                padding: '14px 16px 16px',
                fontSize: 'var(--afa-text-body)',
                lineHeight: 1.45,
                boxShadow: '0 10px 30px var(--afa-shadow)',
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
                  color: badgeText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--afa-text-small)',
                  fontWeight: 700,
                  marginTop: 1,
                }}
              >
                {t.kind === 'error' ? '!' : t.kind === 'info' ? 'i' : '✓'}
              </span>
              <span style={{ flex: 1, fontWeight: 500 }}>{t.message}</span>
              <Button
                variant="icon"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                style={{
                  flexShrink: 0,
                  color: 'var(--afa-text-secondary)',
                  fontSize: 'var(--afa-text-title)',
                  lineHeight: 1,
                  padding: 2,
                }}
              >
                ×
              </Button>
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
