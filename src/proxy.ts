import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import prisma from "@/lib/prisma"
import {
  LAUNCHING_SOON_PATH,
  PRERENDER_REVALIDATE_HEADER,
  isAdminRole,
  ttlCached,
  w1ProxyAction,
} from "@/lib/launch-waves"

// S1b-b1-fix - W1 holding check. Runs only on "/" and the held discovery
// prefixes (matcher below), so those pages stay static/ISR: the open path is
// one cached read and NextResponse.next(). When W1 is closed a non-admin is
// rewritten to the static /launching-soon page; ADMIN is read from the JWT
// cookie (session strategy is JWT, no DB). The decision is w1ProxyAction()
// in src/lib/launch-waves.ts (self-tested in
// scripts/launch-waves-proxy.test.ts, which also checks this matcher equals
// w1ProxyMatcher()).
//
// The W1 cache is per server instance and up to 30s stale after an admin
// save (the admin save's revalidateLaunchWaves() only reaches the Next data
// cache used by /register, not this module-level cache).
//
// RSC prefetches are NOT skipped: a prefetch of a held page must get the
// holding page too, otherwise the router would show the cached real page.

const w1Open = ttlCached(async () => {
  // Read-only findUnique (getPlatformSettings() upserts). Missing row =
  // closed, same as isWaveOpen(); a read error throws and counts as open.
  const row = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { waveDiscoveryOpen: true },
  })
  return row?.waveDiscoveryOpen === true
}, 30_000)

export async function proxy(request: NextRequest) {
  const action = await w1ProxyAction(request.nextUrl.pathname, {
    readW1Open: () => w1Open.get(),
    readIsAdmin: async () => {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
      return isAdminRole(token?.role)
    },
  }, {
    // ISR revalidation of "/" must store the real page (S1b-c1).
    prerenderRevalidate: request.headers.get(PRERENDER_REVALIDATE_HEADER),
    previewModeId: process.env.__NEXT_PREVIEW_MODE_ID,
  })
  if (action === "next") return NextResponse.next()
  return NextResponse.rewrite(new URL(LAUNCHING_SOON_PATH + "/", request.url))
}

export const config = {
  // Must equal w1ProxyMatcher() (static literal - Next reads it at build).
  matcher: [
    "/",
    "/events/:path*",
    "/artists/:path*",
    "/organisers/:path*",
    "/tours/:path*",
    "/venue-owners/:path*",
    "/wall-of-fame/:path*",
    "/venues/:path*",
    "/blog/:path*",
    "/livestreams/:path*",
    "/for-artists/:path*",
    "/careers/:path*",
  ],
}
