'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { MOBILE_BREAKPOINT_MAX } from '@/components/mobile/chromeOffsets'
import { useModalSheet } from '@/lib/use-modal-sheet'
import { useLocale } from '@/lib/i18n/translate'

/**
 * BUG-2609-086 - the one in-app confirm dialog. Replaces every native
 * window.confirm() / alert() / prompt() in src/ (the browser's own box
 * showed the raw Vercel host as its title, over the My Tickets money flow).
 *
 * Usage:
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Remove this panelist?', confirmLabel: 'Remove', destructive: true }))) return
 *
 *   const prompt = usePrompt()
 *   const name = await prompt({ title: 'Add a level', inputLabel: 'Level name' }) // null = cancelled
 *
 * Esc, the backdrop and the cancel button all cancel. Focus is trapped in
 * the panel and handed back on close (useModalSheet). Below the mobile
 * breakpoint it is a bottom sheet; above it, a centred card. A
 * `destructive` confirm uses the red outline (GEN-2609-118: destructive is
 * red outline). `alertOnly` shows a single OK button.
 */

export type ConfirmOptions = {
  title: string
  body?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  alertOnly?: boolean
}

export type PromptOptions = Omit<ConfirmOptions, 'alertOnly'> & { inputLabel: string; placeholder?: string }

type DialogRequest = ConfirmOptions & { input?: { label: string; placeholder?: string } }
type Pending = DialogRequest & { resolve: (value: string | null) => void }

// Resolves null when cancelled; a confirm resolves '' when accepted, a prompt its text.
type Open = (o: DialogRequest) => Promise<string | null>
const ConfirmContext = createContext<Open | null>(null)

function useOpen(): Open {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm needs <ConfirmProvider> (src/components/Providers.tsx)')
  return ctx
}

export function useConfirm(): (o: ConfirmOptions) => Promise<boolean> {
  const open = useOpen()
  return useCallback((o: ConfirmOptions) => open(o).then((v) => v !== null), [open])
}

export function usePrompt(): (o: PromptOptions) => Promise<string | null> {
  const open = useOpen()
  return useCallback(
    ({ inputLabel, placeholder, ...rest }: PromptOptions) => open({ ...rest, input: { label: inputLabel, placeholder } }),
    [open],
  )
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const open = useCallback<Open>(
    (o) =>
      new Promise<string | null>((resolve) => {
        setPending((prev) => {
          // A second dialog while one is open: the first one is cancelled.
          prev?.resolve(null)
          return { ...o, resolve }
        })
      }),
    [],
  )

  const close = useCallback((value: string | null) => {
    setPending((prev) => {
      prev?.resolve(value)
      return null
    })
  }, [])

  return (
    <ConfirmContext.Provider value={open}>
      {children}
      {pending && <ConfirmDialogView options={pending} onClose={close} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialogView({ options, onClose }: { options: DialogRequest; onClose: (value: string | null) => void }) {
  const { t } = useLocale()
  const panelRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  useModalSheet(true, panelRef, () => onClose(null))
  const { title, body, destructive, alertOnly, input } = options
  const confirmLabel = options.confirmLabel ?? (alertOnly ? t.common.dialogOk : t.common.dialogConfirm)
  const cancelLabel = options.cancelLabel ?? t.common.dialogCancel
  const accept = () => onClose(input ? text : '')

  return (
    <div className="afa-confirm" data-afa-confirm-dialog>
      <style>{`
        .afa-confirm { position: fixed; inset: 0; z-index: 1100; display: flex; align-items: center; justify-content: center; padding: var(--afa-space-5); }
        .afa-confirm-scrim { position: absolute; inset: 0; background: var(--afa-scrim); }
        .afa-confirm-panel { position: relative; width: 100%; max-width: 440px; max-height: 88vh; overflow-y: auto; box-sizing: border-box; background: var(--afa-surface-raised); border: 1px solid var(--afa-border-resting); border-radius: var(--afa-radius-lg); padding: var(--afa-space-6); box-shadow: 0 8px 40px var(--afa-shadow); }
        .afa-confirm-actions { display: flex; gap: var(--afa-space-10px); justify-content: flex-end; }
        @media (max-width: ${MOBILE_BREAKPOINT_MAX}px) {
          .afa-confirm { align-items: flex-end; padding: 0; }
          .afa-confirm-panel { max-width: none; border-radius: var(--afa-radius-2xl) var(--afa-radius-2xl) var(--afa-radius-sharp) var(--afa-radius-sharp); border-bottom: none; padding-bottom: calc(var(--afa-space-6) + env(safe-area-inset-bottom)); }
          .afa-confirm-actions { flex-direction: column-reverse; }
          .afa-confirm-actions > * { width: 100%; }
        }
      `}</style>
      <div className="afa-confirm-scrim" onClick={() => onClose(null)} data-afa-confirm-scrim />
      <div ref={panelRef} className="afa-confirm-panel" role={alertOnly ? 'alertdialog' : 'dialog'} aria-modal="true">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', margin: '0 0 var(--afa-space-10px)' }}>
          {title}
        </h2>
        {/* div, not p: body may hold block content (the refund lines) */}
        {body && <div style={{ color: 'var(--afa-text-secondary)', fontSize: 'var(--afa-text-body)', marginBottom: 'var(--afa-space-5)' }}>{body}</div>}
        {input && (
          <label style={{ display: 'block', marginBottom: 'var(--afa-space-5)' }}>
            <span style={{ display: 'block', fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-6px)' }}>{input.label}</span>
            <Input
              value={text}
              placeholder={input.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') accept()
              }}
            />
          </label>
        )}
        <div className="afa-confirm-actions">
          {!alertOnly && (
            <Button variant="outline-neutral" size="md" fullWidth={false} onClick={() => onClose(null)}>
              {cancelLabel}
            </Button>
          )}
          <Button variant={destructive ? 'outline-error' : 'solid'} size="md" fullWidth={false} onClick={accept} data-afa-confirm-ok>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
