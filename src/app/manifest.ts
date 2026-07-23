import type { MetadataRoute } from 'next';

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

export default function manifest(): MetadataRoute.Manifest {
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
    background_color: 'var(--afa-cream)',
    theme_color: 'var(--afa-terracotta)',
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
