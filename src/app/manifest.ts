import type { MetadataRoute } from 'next';
import { appChromeColors } from '@/lib/design-tokens.server';

// Web app manifest — drives "Add to Home Screen" on Android/Chrome
// and is the source-of-truth PWABuilder reads to generate the TWA APK
// per Master Design Doc §11.
//
// Icon strategy:
//   any     — regular icons, used in tabs, task-switcher, some launchers
//   maskable — Android adaptive-icon system; the platform crops to
//              circle/squircle/rounded-square depending on OEM theme,
//              so the inner 80% must contain the whole logo. The
//              generator script (scripts/gen-pwa-icons.py) reserves
//              a 10% safe-zone on each side for maskable variants.

// GEN-2609-119 - a manifest route is cached by default, which would
// freeze the colours at build time. Regenerate it on the same clock as
// the token cache; an editor save also clears it through the tag.
export const revalidate = 300;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const chrome = await appChromeColors();
  return {
    id: '/',
    name: 'AforAudience — Where Art Finds Its Crowd',
    short_name: 'AforAudience',
    description:
      "The world's first live art universe — connecting comedians, poets, open mic artists, organisers, and venues in one living ecosystem.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // BUG-2609-015: a manifest is JSON, not CSS-aware - CSS variable
    // strings here were silently ignored by the browser. GEN-2609-119:
    // both colours are the admin's tokens resolved to concrete values:
    // theme_color is --afa-fill-solid (the same value layout.tsx's
    // theme-color meta gets) and background_color, the install splash,
    // is --afa-surface-page - the app is dark, so the splash is too
    // (decided 2 Oct; it was the legacy cream). An installed PWA keeps
    // its own copy of the manifest; that is the browser's behaviour.
    background_color: chrome.background,
    theme_color: chrome.theme,
    lang: 'en-IN',
    dir: 'ltr',
    categories: ['entertainment', 'events', 'music', 'social'],
    // Shown on long-press of the app icon (Android) or via right-click
    // on desktop. Deep links straight to high-intent destinations —
    // matches the browse-first / login-at-commitment model in the design
    // doc: none of these require auth to reach, only to act on.
    shortcuts: [
      {
        name: 'Browse events',
        short_name: 'Events',
        description: 'Discover live art happening near you',
        url: '/events',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'My tickets',
        short_name: 'Tickets',
        description: 'View your booked and confirmed tickets',
        url: '/tickets',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Find a venue',
        short_name: 'Venues',
        description: 'Browse venues hosting live performance',
        url: '/venues',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
