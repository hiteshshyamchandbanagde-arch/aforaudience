import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import NudgeStack from "@/components/NudgeStack";
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
  themeColor: "var(--afa-terracotta)",
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
        {/*
          Intro splash - deliberately NOT individual React-managed JSX
          elements, and deliberately not even a normal client component.

          First attempt (this session) rendered the overlay as JSX with
          explicit style props (style={{ display: 'none', ... }}) plus a
          separate inline script that mutated those same elements before
          hydration. That caused a real bug, not a timing issue: React
          hydration compares the live DOM against what it originally
          rendered, and when it sees the script's changes (display now
          'flex', extra letter spans, etc.) it "corrects" the DOM back to
          match its own render output - undoing the script within
          milliseconds. Fast enough to look like a flash on desktop, fast
          enough to look like nothing happened at all on mobile.

          Fix: the entire splash (style, svg bars, wordmark, tagline, and
          the script that animates them) is now one single
          dangerouslySetInnerHTML block. React treats that as an opaque
          string it sets once and never diffs into - hydration leaves
          every element inside it alone, so the script's mutations stick.

          Hidden by default (display:none) so repeat-this-session loads
          never even flash the black overlay; the script only shows it
          and animates when sessionStorage says this session hasn't seen
          it yet.
        */}
        <div
          dangerouslySetInnerHTML={{
            __html: `
              <div id="intro-splash" aria-hidden="true" style="position:fixed;inset:0;z-index:9999;background:var(--afa-ink);display:none;align-items:center;justify-content:center;flex-direction:column;pointer-events:none;">
                <style>
                  @keyframes intro-bar-in { 0% { opacity: 0; transform: translateX(-10px); } 100% { opacity: 1; transform: translateX(0); } }
                  @keyframes intro-icon-shrink { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.3); } }
                  @keyframes intro-fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
                  @keyframes intro-cursor-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
                  @keyframes intro-overlay-out { 0% { opacity: 1; } 100% { opacity: 0; } }
                  #intro-splash.intro-out { animation: intro-overlay-out 450ms ease forwards; }
                  #intro-splash svg {
                    position: absolute;
                    width: clamp(240px, 68vw, 440px);
                    height: clamp(240px, 68vw, 440px);
                    animation: intro-icon-shrink 350ms ease 750ms both;
                  }
                  #intro-wordmark { font-family: Georgia, serif; font-size: clamp(36px, 9vw, 64px); font-weight: 700; color: var(--afa-cream); }
                  .intro-letter { opacity: 0; display: inline-block; }
                  #intro-cursor { display: inline-block; width: 3px; height: 0.85em; vertical-align: -0.1em; margin-left: 3px; background: var(--afa-cream); opacity: 0; }
                  #intro-tagline { font-family: Georgia, serif; font-style: italic; font-size: clamp(13px, 2.2vw, 17px); color: var(--afa-amber); opacity: 0; margin-top: 14px; letter-spacing: 0.02em; }
                </style>
                <svg viewBox="0 0 64 64">
                  <rect x="18" y="42" width="14" height="8" fill="var(--afa-cream)" style="animation:intro-bar-in 260ms ease-out 0ms both"></rect>
                  <rect x="18" y="30" width="20" height="8" fill="var(--afa-amber)" style="animation:intro-bar-in 260ms ease-out 150ms both"></rect>
                  <rect x="18" y="18" width="28" height="8" fill="var(--afa-terracotta)" style="animation:intro-bar-in 260ms ease-out 300ms both"></rect>
                </svg>
                <div id="intro-wordmark">
                  <span id="intro-letters"></span>
                  <span id="intro-cursor"></span>
                </div>
                <div id="intro-tagline">Where Art Finds Its Crowd</div>
              </div>
              <script>
                (function () {
                  try {
                    var KEY = 'introShown';
                    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    var shown = sessionStorage.getItem(KEY);
                    if (shown || reduced) {
                      sessionStorage.setItem(KEY, '1');
                      return;
                    }
                    sessionStorage.setItem(KEY, '1');

                    var el = document.getElementById('intro-splash');
                    if (!el) return;
                    document.body.style.overflow = 'hidden';
                    el.style.display = 'flex';

                    var word = 'AforAudience';
                    var lettersEl = document.getElementById('intro-letters');
                    var TYPE_START = 750;
                    var STAGGER = 70;
                    var DUR = 40;
                    for (var i = 0; i < word.length; i++) {
                      var span = document.createElement('span');
                      span.className = 'intro-letter';
                      span.textContent = word[i];
                      if (i === 0) span.style.color = 'var(--afa-terracotta)';
                      span.style.animation = 'intro-fade-in ' + DUR + 'ms linear ' + (TYPE_START + i * STAGGER) + 'ms both';
                      lettersEl.appendChild(span);
                    }
                    var typingEnd = TYPE_START + (word.length - 1) * STAGGER + DUR;

                    var cursor = document.getElementById('intro-cursor');
                    cursor.style.opacity = '1';
                    cursor.style.animation = 'intro-cursor-blink 0.9s step-end ' + TYPE_START + 'ms infinite';

                    var tagline = document.getElementById('intro-tagline');
                    var taglineStart = typingEnd + 150;
                    tagline.style.animation = 'intro-fade-in 500ms ease ' + taglineStart + 'ms both';

                    var HOLD_MS = taglineStart + 900;
                    var TOTAL_MS = HOLD_MS + 450;

                    setTimeout(function () {
                      cursor.style.animation = 'none';
                      cursor.style.opacity = '0';
                      el.classList.add('intro-out');
                    }, HOLD_MS);

                    setTimeout(function () {
                      el.style.display = 'none';
                      document.body.style.overflow = '';
                    }, TOTAL_MS);
                  } catch (err) {
                    console.warn('[intro] failed', err);
                  }
                })();
              </script>
            `,
          }}
        />
        <Providers>
          <NudgeStack />
          {children}
        </Providers>
        <InstallPrompt />
        <SupportWidget />
      </body>
    </html>
  );
}