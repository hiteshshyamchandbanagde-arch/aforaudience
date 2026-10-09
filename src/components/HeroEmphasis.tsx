import type { CSSProperties, ReactNode } from 'react'

// BUG-2610-031 - the gold italic word in a hero heading ("Where the *show*
// happens."). The display face has no italic cut, so the browser slants
// the upright glyphs; the top of the last glyph then leans past its own
// advance width, into the space after it. In Devanagari, whose headline
// runs the full height of the word, the slanted "शो" visibly touched
// "होता" on /venues (hi). The trailing padding is the italic correction:
// in em, so it scales with every hero size, and on the inline end, so it
// follows the reading direction.
//
// The space between words stays OUTSIDE this element, in the prefix and
// suffix strings (scripts/hero-emphasis.test.ts checks every locale).

export const HERO_EMPHASIS_STYLE: CSSProperties = {
  color: 'var(--afa-amber)',
  fontStyle: 'italic',
  paddingInlineEnd: '0.12em',
}

export default function HeroEmphasis({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return (
    <em data-afa-hero-emphasis="" style={{ ...HERO_EMPHASIS_STYLE, ...style }}>
      {children}
    </em>
  )
}
