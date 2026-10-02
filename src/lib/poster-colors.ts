import { resolveDesignColors } from '@/lib/design-tokens.server'

// GEN-2609-119 - share posters follow the admin's colour tokens. Satori
// (next/og) can't read CSS custom properties, so each poster request
// resolves the tokens it needs to concrete values, in one cached read.
// Both poster routes use this palette so they can't drift apart.
export async function loadPosterColors() {
  const c = await resolveDesignColors([
    '--afa-surface-page',
    '--afa-text-primary',
    '--afa-text-soft',
    '--afa-text-secondary',
    '--afa-text-muted',
    '--afa-fill-solid',
    '--afa-on-fill-solid',
    '--afa-amber',
    '--afa-cream',
    '--afa-tint-08',
    '--afa-tint-20',
  ] as const)
  return {
    page: c['--afa-surface-page'],
    text: c['--afa-text-primary'],
    textSoft: c['--afa-text-soft'],
    textMuted: c['--afa-text-muted'],
    accent: c['--afa-fill-solid'],
    onAccent: c['--afa-on-fill-solid'],
    amber: c['--afa-amber'],
    rule: c['--afa-tint-20'],
    // The environment pill, coloured as EnvBadge.tsx colours it on the site.
    envBadge: (isQA: boolean) =>
      isQA ? { background: c['--afa-fill-solid'], color: c['--afa-cream'] } : { background: c['--afa-tint-08'], color: c['--afa-text-secondary'] },
  }
}

export type PosterColors = Awaited<ReturnType<typeof loadPosterColors>>

// The logo is fixed by design (Hitesh, 29 Sep): the tile, its three bars
// and the wordmark keep these values whatever the tokens say. The faint
// background watermark is the same three bars, so it uses them too.
export const POSTER_LOGO = {
  tile: '#0E0C0A', // token-ok(hex-color-literal): logo, fixed by design
  barTop: '#C8441A', // token-ok(hex-color-literal): logo, fixed by design
  barMiddle: '#C9973A', // token-ok(hex-color-literal): logo, fixed by design
  barBottom: '#F7F3EE', // token-ok(hex-color-literal): logo, fixed by design
  wordmark: '#F7F3EE', // token-ok(hex-color-literal): logo, fixed by design
} as const

// The QR and the plate it sits on are fixed too: a scanner needs dark
// modules on a light ground, whatever the page colour becomes.
export const POSTER_QR = {
  dark: '#1A0A1A', // token-ok(hex-color-literal): QR modules, fixed so the code always scans
  light: '#F7F3EE', // token-ok(hex-color-literal): QR ground and plate, fixed so the code always scans
} as const
