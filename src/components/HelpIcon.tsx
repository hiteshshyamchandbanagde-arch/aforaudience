'use client'

import { useState } from 'react'

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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="More info"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1px solid rgba(14,12,10,0.35)',
          background: 'transparent',
          color: 'var(--afa-ink)',
          opacity: 0.7,
          fontSize: '10px',
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
        }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '22px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--afa-ink)',
            color: 'var(--afa-cream)',
            fontSize: '12px',
            fontWeight: 400,
            lineHeight: 1.45,
            padding: '8px 11px',
            borderRadius: '7px',
            width: '230px',
            zIndex: 30,
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
