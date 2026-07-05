import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import UserHeader from "@/components/auth/UserHeader";

export const metadata: Metadata = {
  title: "A for Audience — Where Art Finds Its Crowd",
  description: "The world's first live art universe — connecting comedians, poets, open mic artists, organisers, and venues in one living ecosystem.",
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
          <UserHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}