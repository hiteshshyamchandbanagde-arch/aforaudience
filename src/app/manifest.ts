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
    background_color: '#F7F3EE',
    theme_color: '#C8441A',
    categories: ['entertainment', 'events', 'music', 'social'],
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
