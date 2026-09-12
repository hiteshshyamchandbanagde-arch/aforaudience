'use client'

// Shared Input - Step 4 of the UI/UX audit sequence, same pass as
// Button.tsx. The Step 1 audit found 4 slightly different text-field
// styles (padding/radius/border-width all drifted independently)
// doing the same job. `standard` below is AuthPromptSheet.tsx's
// treatment verbatim (the build decision: most complete, and it
// already shares CorporateInquiryModal's 1.5px border weight) -
// CorporateInquiryModal's own INPUT_STYLE and checkout's companion-
// search input both migrate to it. `compact` is SeatSelectionClientPage's
// booking-fee number input's existing tight style, kept as its own
// documented variant rather than a 5th undocumented one-off - the
// standard padding/radius doesn't fit that field's 64px width.
//
// Exports both the <Input> component and the raw style objects
// (INPUT_STYLES) - CorporateInquiryModal.tsx passes a plain style
// object into CityAutocomplete/PresetSelectWithOther's `inputStyle`
// prop (both outside this pass's 6-file scope), so the style needs to
// exist standalone, not only wired into this component's own JSX.

export type InputVariant = 'standard' | 'compact'

const FONT_FAMILY = 'var(--font-sans)'

export const INPUT_STYLES: Record<InputVariant, React.CSSProperties> = {
  standard: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: '1.5px solid rgba(245,245,240,0.15)',
    fontSize: 14,
    fontFamily: FONT_FAMILY,
    color: 'var(--afa-text-primary)',
    background: 'var(--afa-surface-page)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  compact: {
    padding: '6px 8px',
    borderRadius: 3,
    border: '1px solid rgba(245,245,240,0.2)',
    fontSize: 14,
    fontFamily: FONT_FAMILY,
    color: 'var(--afa-cream)',
    background: 'transparent',
    outline: 'none',
    boxSizing: 'border-box',
  },
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> & {
  variant?: InputVariant
  style?: React.CSSProperties
}

export default function Input({ variant = 'standard', style, ...rest }: InputProps) {
  return <input {...rest} style={{ ...INPUT_STYLES[variant], ...style }} />
}
