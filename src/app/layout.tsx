import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "A for Audience — Where Art Finds Its Crowd",
  description: "The world's first live art universe — connecting comedians, poets, open mic artists, organisers, and venues in one living ecosystem.",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}