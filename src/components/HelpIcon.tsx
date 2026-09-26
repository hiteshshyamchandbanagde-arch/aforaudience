'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

// Feedback c6416be5 (Hitesh's decision, 26 Jul session 36): a small (i)
// icon attached to a field's label, showing a short explanation on
// hover/tap - not a persistent inline textbox. One reusable component,
// usable anywhere in the app, not scoped to venue creation. Narrow use
// intentionally - most fields are self-explanatory, only a genuine
// handful need this (see call sites).
export default function HelpIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: '5px', verticalAlign: 'middle' }}>
      <Button
        variant="icon"
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="More info"
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1px solid var(--afa-tint-30)',
          color: 'var(--afa-text-primary)',
          opacity: 0.7,
          fontSize: 'var(--afa-text-caption)',
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          padding: 0,
          lineHeight: 1,
        }}
      >
        i
      </Button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '22px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--afa-fill-solid)',
            color: 'var(--afa-on-fill-solid)',
            fontSize: 'var(--afa-text-small)',
            fontWeight: 400,
            lineHeight: 1.45,
            padding: '8px 11px',
            borderRadius: 'var(--afa-radius-sm)',
            width: '230px',
            zIndex: 30,
            boxShadow: '0 4px 14px var(--afa-shadow)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
