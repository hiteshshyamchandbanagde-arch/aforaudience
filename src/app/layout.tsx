import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "../fonts/fallbacks.css";
import "./globals.css";
import { getDesignTokensSafe } from "@/lib/design-tokens.server";
import { buildDesignTokenCss } from "@/lib/design-tokens";
import Providers from "@/components/Providers";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import NudgeStack from "@/components/NudgeStack";
import WelcomeSequence from "@/components/WelcomeSequence";
import SupportWidget from "@/components/SupportWidget";
import MobileTabBar from "@/components/mobile/MobileTabBar";
import MobileTopBar from "@/components/mobile/MobileTopBar";

// Real webfonts, not system-font fallbacks. "Georgia, serif" /
// "monospace" everywhere was a big part of why the site read as
// generic/templated (BUG-2607-036) - a designed typeface is one of the
// highest-leverage things separating "looks default" from "looks
// premium." Exposed as CSS custom properties so any component can opt
// in via var(--font-display) etc. without importing next/font itself.
// GEN-2609-003 (Mobile Redesign Phase 1): swapped from
// Newsreader/Manrope/IBM Plex Mono to the Mobile App v2 Figma Make
// export's type system - Archivo (display), Instrument Sans (body),
// JetBrains Mono (labels/prices/category tags/nav labels) - so desktop
// and mobile share one identity instead of diverging. Same variable
// names as before (--font-display/--font-sans/--font-mono), so every
// existing component that already opts in via var(--font-display) etc.
// (currently homepage-only, see FEAT-2607-028) picks up the new
// typefaces automatically with no per-component changes.
// style: both, not just "normal" - several real components (ArtistNoPhoto,
// FourRooms, HeroRotator, PlatformGrowthStrip) set fontStyle:"italic" on
// var(--font-display), same as Newsreader's real italics before. Loading
// normal-only here would've left those rendering as browser-synthesized
// fake-oblique Archivo instead - caught via the required before/after
// screenshot pass (see GEN-2609-003 build notes), not assumed away.
//
// Font migration (12 Sep, GEN-2609-030 sequence, Phase B step 1 of 6):
// Archivo -> two fonts, based on the v5 Figma Make exploration and the
// full-app font-display footprint audit (docs/design.md). --font-display
// keeps its name (third swap under this name: Newsreader -> Archivo ->
// Young Serif) and now means Young Serif - editorial/hero/discovery/name
// content. A new --font-ui carries Schibsted Grotesk - transactional/UI
// content (buttons, tabs, dashboard-tool chrome, price/CTA-adjacent
// text) that used to ride along on --font-display just because nothing
// else existed for it. --font-sans (Instrument Sans, plain body copy)
// and --font-mono are untouched - out of scope for this migration.
// Young Serif ships no italic style on Google Fonts (unlike
// Archivo before it) - components applying fontStyle:"italic" to
// var(--font-display) will get browser-synthesized fake-oblique, not a
// real italic. Flagged in this migration's report, not silently
// worked around - a handful of real components do this
// (ArtistNoPhoto.tsx, ArtistProfileClientPage.tsx, artists/page.tsx,
// FourRooms.tsx, PlatformGrowthStrip.tsx, HeroRotator.tsx).
//
// BUG-2609-062 - self-hosted via next/font/local (files + provenance in
// src/fonts/README.md). The Google Fonts loader fetched from Google at build
// time and that fetch started failing every Vercel build on 27 Sep. Each
// file is Google's own upstream font (same version Google served),
// subset to exactly the codepoints Google's per-subset files rendered
// (latin + latin-ext merged into one file, so e.g. the rupee sign still
// comes from Schibsted Grotesk), unhinted like Google's. Variable fonts:
// one file backs every weight, declared per weight exactly as Google's
// CSS did, so weight matching (and synthetic bold above the top weight)
// is unchanged.
// next/font requires literal arguments (no shared consts/helpers), so
// the per-weight src lists are spelled out - all entries of a family
// point at the same file.
const youngSerif = localFont({
  src: [
    { path: "../fonts/young-serif/YoungSerif-Regular.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-display", display: "swap", adjustFontFallback: false, fallback: ["Young Serif Fallback"],
});
const schibstedGrotesk = localFont({
  src: [
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "500", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "600", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "700", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "800", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "400", style: "italic" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "500", style: "italic" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "600", style: "italic" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "700", style: "italic" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "800", style: "italic" },
  ],
  variable: "--font-ui", display: "swap", adjustFontFallback: false, fallback: ["Schibsted Grotesk Fallback"],
});
const instrumentSans = localFont({
  src: [
    { path: "../fonts/instrument-sans/InstrumentSans-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/instrument-sans/InstrumentSans-VF.woff2", weight: "500", style: "normal" },
    { path: "../fonts/instrument-sans/InstrumentSans-VF.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans", display: "swap", adjustFontFallback: false, fallback: ["Instrument Sans Fallback"],
});
const jetBrainsMono = localFont({
  src: [
    { path: "../fonts/jetbrains-mono/JetBrainsMono-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/jetbrains-mono/JetBrainsMono-VF.woff2", weight: "500", style: "normal" },
    { path: "../fonts/jetbrains-mono/JetBrainsMono-VF.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono", display: "swap", adjustFontFallback: false, fallback: ["JetBrains Mono Fallback"],
});

// GEN-2609-075 - stable, role-independent aliases for the same 4
// families above, used only as the admin design-token panel's font
// allowlist (src/lib/design-tokens.ts's FONT_ALLOWLIST). Each of these
// re-requests the identical weight/subset config as its role sibling
// above, so Next emits the same static font file it already emitted
// for that sibling (same path - no duplicate file), just one extra
// @font-face declaration under its own CSS variable name.
// The indirection is the point: --font-display etc. are themselves
// admin-overridable (a role can be reassigned to a different physical
// font), so anything that names a PHYSICAL font unambiguously - e.g.
// "render this role as Schibsted Grotesk, whatever --font-ui currently
// points at" - needs a name that never itself gets reassigned.
const youngSerifPhys = localFont({
  src: [
    { path: "../fonts/young-serif/YoungSerif-Regular.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-phys-young-serif", display: "swap", adjustFontFallback: false, fallback: ["Young Serif Fallback"],
});
const schibstedGroteskPhys = localFont({
  src: [
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "500", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "600", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "700", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-VF.woff2", weight: "800", style: "normal" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "400", style: "italic" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "500", style: "italic" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "600", style: "italic" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "700", style: "italic" },
    { path: "../fonts/schibsted-grotesk/SchibstedGrotesk-Italic-VF.woff2", weight: "800", style: "italic" },
  ],
  variable: "--font-phys-schibsted-grotesk", display: "swap", adjustFontFallback: false, fallback: ["Schibsted Grotesk Fallback"],
});
const instrumentSansPhys = localFont({
  src: [
    { path: "../fonts/instrument-sans/InstrumentSans-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/instrument-sans/InstrumentSans-VF.woff2", weight: "500", style: "normal" },
    { path: "../fonts/instrument-sans/InstrumentSans-VF.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-phys-instrument-sans", display: "swap", adjustFontFallback: false, fallback: ["Instrument Sans Fallback"],
});
const jetBrainsMonoPhys = localFont({
  src: [
    { path: "../fonts/jetbrains-mono/JetBrainsMono-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/jetbrains-mono/JetBrainsMono-VF.woff2", weight: "500", style: "normal" },
    { path: "../fonts/jetbrains-mono/JetBrainsMono-VF.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-phys-jetbrains-mono", display: "swap", adjustFontFallback: false, fallback: ["JetBrains Mono Fallback"],
});

// Phase 2c multi-script fix (FEAT-2608-051): --font-sans (Manrope) only
// covers Latin, so headings/body silently fell back to a generic system
// font for 6 of AFA's 11 UI languages. Each Noto Sans script family gets
// its own CSS variable here; globals.css chains them all into a single
// --font-sans fallback stack. Browsers resolve font-family fallback per
// *character* via each font's unicode-range, so listing all 7 costs
// nothing extra for a Latin-only page - the Devanagari font file is
// only ever fetched when Devanagari characters are actually present.
// BUG-2609-062: each file holds only its script's subset (Google's
// latin/latin-ext files for these families are dropped - Latin always
// resolves earlier in the stack), the explicit unicode-range is that
// file's exact coverage, and preload is off so a Latin-only page never
// downloads them (the Google Fonts loader preloaded all 7 on every page).
const notoDevanagari = localFont({
  src: [
    { path: "../fonts/noto-sans-devanagari/NotoSansDevanagari-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-devanagari/NotoSansDevanagari-VF.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-devanagari", display: "swap", preload: false, adjustFontFallback: false, fallback: ["Noto Sans Devanagari Fallback"],
  declarations: [{ prop: "unicode-range", value: "U+900-97F,U+1CD0-1CF6,U+1CF8-1CF9,U+200C-200D,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09" }],
});
const notoTamil = localFont({
  src: [
    { path: "../fonts/noto-sans-tamil/NotoSansTamil-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-tamil/NotoSansTamil-VF.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-tamil", display: "swap", preload: false, adjustFontFallback: false, fallback: ["Noto Sans Tamil Fallback"],
  declarations: [{ prop: "unicode-range", value: "U+964-965,U+B82-B83,U+B85-B8A,U+B8E-B90,U+B92-B95,U+B99-B9A,U+B9C,U+B9E-B9F,U+BA3-BA4,U+BA8-BAA,U+BAE-BB9,U+BBE-BC2,U+BC6-BC8,U+BCA-BCD,U+BD0,U+BD7,U+BE6-BFA,U+200C-200D,U+20B9,U+25CC" }],
});
const notoTelugu = localFont({
  src: [
    { path: "../fonts/noto-sans-telugu/NotoSansTelugu-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-telugu/NotoSansTelugu-VF.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-telugu", display: "swap", preload: false, adjustFontFallback: false, fallback: ["Noto Sans Telugu Fallback"],
  declarations: [{ prop: "unicode-range", value: "U+951-952,U+964-965,U+C00-C0C,U+C0E-C10,U+C12-C28,U+C2A-C39,U+C3C-C44,U+C46-C48,U+C4A-C4D,U+C55-C56,U+C58-C5A,U+C5D,U+C60-C63,U+C66-C6F,U+C77-C7F,U+1CDA,U+1CF2,U+200C-200D,U+25CC" }],
});
const notoKannada = localFont({
  src: [
    { path: "../fonts/noto-sans-kannada/NotoSansKannada-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-kannada/NotoSansKannada-VF.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-kannada", display: "swap", preload: false, adjustFontFallback: false, fallback: ["Noto Sans Kannada Fallback"],
  declarations: [{ prop: "unicode-range", value: "U+951-952,U+964-965,U+C80-C8C,U+C8E-C90,U+C92-CA8,U+CAA-CB3,U+CB5-CB9,U+CBC-CC4,U+CC6-CC8,U+CCA-CCD,U+CD5-CD6,U+CDD-CDE,U+CE0-CE3,U+CE6-CEF,U+CF1-CF3,U+1CD0,U+1CD2,U+1CDA,U+1CF2,U+1CF4,U+200C-200D,U+20B9,U+25CC,U+A830-A835" }],
});
const notoMalayalam = localFont({
  src: [
    { path: "../fonts/noto-sans-malayalam/NotoSansMalayalam-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-malayalam/NotoSansMalayalam-VF.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-malayalam", display: "swap", preload: false, adjustFontFallback: false, fallback: ["Noto Sans Malayalam Fallback"],
  declarations: [{ prop: "unicode-range", value: "U+307,U+323,U+951-952,U+964-965,U+D00-D0C,U+D0E-D10,U+D12-D44,U+D46-D48,U+D4A-D4F,U+D54-D63,U+D66-D7F,U+1CDA,U+200C-200D,U+20B9,U+25CC,U+A830-A832" }],
});
const notoGujarati = localFont({
  src: [
    { path: "../fonts/noto-sans-gujarati/NotoSansGujarati-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-gujarati/NotoSansGujarati-VF.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-gujarati", display: "swap", preload: false, adjustFontFallback: false, fallback: ["Noto Sans Gujarati Fallback"],
  declarations: [{ prop: "unicode-range", value: "U+302-303,U+307-308,U+312,U+326-327,U+951-952,U+964-965,U+A81-A83,U+A85-A8D,U+A8F-A91,U+A93-AA8,U+AAA-AB0,U+AB2-AB3,U+AB5-AB9,U+ABC-AC5,U+AC7-AC9,U+ACB-ACD,U+AD0,U+AE0-AE3,U+AE6-AF1,U+AF9-AFF,U+200C-200D,U+20B9,U+25CC,U+A830-A839" }],
});
const notoBengali = localFont({
  src: [
    { path: "../fonts/noto-sans-bengali/NotoSansBengali-VF.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-bengali/NotoSansBengali-VF.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-bengali", display: "swap", preload: false, adjustFontFallback: false, fallback: ["Noto Sans Bengali Fallback"],
  declarations: [{ prop: "unicode-range", value: "U+951-952,U+964-965,U+980-983,U+985-98C,U+98F-990,U+993-9A8,U+9AA-9B0,U+9B2,U+9B6-9B9,U+9BC-9C4,U+9C7-9C8,U+9CB-9CE,U+9D7,U+9DC-9DD,U+9DF-9E3,U+9E6-9FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC,U+A8F1" }],
});

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
  // GEN-2609-094 (BUG-2609-056) - this was `"var(--afa-fill-solid)"`
  // from GEN-2609-067 onward, but a Viewport export renders straight
  // into `<meta name="theme-color" content="...">` - a meta tag's
  // `content` attribute is never a CSS context, so the browser can't
  // resolve a CSS custom property there and silently ignored it,
  // falling back to default chrome tinting instead of the brand color.
  // Resolved hex instead, matching --afa-fill-solid's own value in
  // globals.css/design-tokens.ts and manifest.ts's own hardcoded
  // theme_color - all 3 must stay in sync by hand (see docs/design.md's
  // GEN-2609-094 entry for the known limitation: this won't follow an
  // admin's live change to --afa-fill-solid the way most tokens do).
  themeColor: "#FF5A36", // token-ok(hex-color-literal): meta content attribute, not a CSS context - var() cannot resolve here; must equal manifest.ts's theme_color
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // GEN-2609-075 - cached (tag "design-tokens"), never throws: an empty
  // array here means either the DB has no rows yet or the read failed,
  // and buildDesignTokenCss('') for an empty array renders no <style>
  // at all - globals.css's own :root defaults apply untouched, so a
  // down DB degrades to "site looks like before this ticket shipped",
  // never a broken/unstyled page.
  const designTokens = await getDesignTokensSafe();
  const designTokenCss = buildDesignTokenCss(designTokens);

  return (
    <html lang="en" className={`${youngSerif.variable} ${schibstedGrotesk.variable} ${instrumentSans.variable} ${jetBrainsMono.variable} ${youngSerifPhys.variable} ${schibstedGroteskPhys.variable} ${instrumentSansPhys.variable} ${jetBrainsMonoPhys.variable} ${notoDevanagari.variable} ${notoTamil.variable} ${notoTelugu.variable} ${notoKannada.variable} ${notoMalayalam.variable} ${notoGujarati.variable} ${notoBengali.variable}`}>
      <head>
        {designTokenCss && (
          <style id="afa-design-tokens-runtime" dangerouslySetInnerHTML={{ __html: designTokenCss }} />
        )}
        {/*
          Theme Phase 1/2's pre-paint accent-theme-restoration script was
          removed (GEN-2608-048, 15 Aug) alongside the picker itself. Any
          stale 'afa-theme' value left in a returning user's localStorage
          is now simply never read - no data-theme attribute is ever set,
          so the CSS default (the Phase 2c dark-reskin look) always
          applies, with no flash and no cleanup needed.
        */}
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
              <div id="intro-splash" aria-hidden="true" style="position:fixed;inset:0;z-index:9999;background:var(--afa-surface-inverse);display:none;align-items:center;justify-content:center;flex-direction:column;pointer-events:none;">
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
                  #intro-wordmark { font-family: var(--font-display); font-size: clamp(36px, 9vw, 64px); font-weight: 700; color: var(--afa-text-primary); }
                  .intro-letter { opacity: 0; display: inline-block; }
                  #intro-cursor { display: inline-block; width: 3px; height: 0.85em; vertical-align: -0.1em; margin-left: 3px; background: var(--afa-surface-raised); opacity: 0; }
                  #intro-tagline { font-family: var(--font-display); font-style: italic; font-size: clamp(13px, 2.2vw, 17px); color: var(--afa-amber); opacity: 0; margin-top: var(--afa-space-14px); letter-spacing: 0.02em; }
                </style>
                <svg viewBox="0 0 64 64">
                  <rect x="18" y="42" width="14" height="8" style="fill:var(--afa-cream);animation:intro-bar-in 260ms ease-out 0ms both"></rect>
                  <rect x="18" y="30" width="20" height="8" style="fill:var(--afa-amber);animation:intro-bar-in 260ms ease-out 150ms both"></rect>
                  <rect x="18" y="18" width="28" height="8" style="fill:var(--afa-brand-mark);animation:intro-bar-in 260ms ease-out 300ms both"></rect>
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
                      if (i === 0) span.style.color = 'var(--afa-brand-mark)';
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
          <WelcomeSequence />
          <NudgeStack />
          <MobileTopBar />
          {children}
          <MobileTabBar />
        </Providers>
        <InstallPrompt />
        <SupportWidget />
      </body>
    </html>
  );
}