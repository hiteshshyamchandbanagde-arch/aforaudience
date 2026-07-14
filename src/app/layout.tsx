import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import DisplayNameNudge from "@/components/DisplayNameNudge";
import SupportWidget from "@/components/SupportWidget";

export const metadata: Metadata = {
  title: "A for Audience — Where Art Finds Its Crowd",
  description: "The world's first live art universe — connecting comedians, poets, open mic artists, organisers, and venues in one living ecosystem.",
  // iOS PWA metadata. Chrome/Android reads the web manifest; iOS Safari
  // reads these older meta tags. Both are required for a good "Add to
  // Home Screen" experience across platforms.
  applicationName: "AforAudience",
  appleWebApp: {
    capable: true,
    title: "AforAudience",
    // "black-translucent" lets the app's own background fill the status
    // bar area, which matches the standalone display mode better than
    // the default "default" grey band.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Prevent SEO indexing of the PWA install shell URLs — search engines
  // don't need /manifest.webmanifest or /sw.js in the index.
  robots: {
    index: true,
    follow: true,
  },
};

// Missing entirely until now - without this, mobile browsers assume the
// page is a ~980px desktop layout and render/crop accordingly instead of
// reflowing to the actual device width. This is also why the mobile nav
// fix's CSS media query never activated on a real phone: the query checks
// against the browser's reported viewport width, which stays fake-desktop-
// sized without this tag, regardless of the phone's actual screen size.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Match the manifest's theme_color so the browser chrome (Android
  // address bar, iOS status bar in standalone) tints correctly.
  themeColor: "#C8441A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/*
          Inline service worker registration.

          Deliberately placed in the raw HTML head (not a React component)
          for two reasons:

          1. PWA validators (PWABuilder, Lighthouse) do a static scan of
             the initial HTML response. A registration inside a client
             component only fires after React hydrates, which the
             validators don't wait for — so they mark the SW as missing
             even when it exists and works fine at runtime. Inline here,
             they see it immediately in the raw HTML.

          2. Chrome will register the SW even before hydration finishes,
             so the offline shell + caching kicks in on the very first
             visit rather than waiting for the JS bundle to hydrate.

          Kept short and dependency-free. The actual SW logic lives in
          /public/sw.js. Guarded on `'serviceWorker' in navigator` so it
          silently no-ops on browsers that don't support it (older iOS,
          some WebViews).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .catch(function (err) { console.warn('[sw] register failed', err); });
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          <DisplayNameNudge />
          {children}
        </Providers>
        <InstallPrompt />
        <SupportWidget />
      </body>
    </html>
  );
}