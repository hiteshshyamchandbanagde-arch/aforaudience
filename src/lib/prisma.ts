import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import type { PoolConfig } from "pg"

const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable")
  }

  return url
}

const connectionString = getDatabaseUrl()

// Previously also set NODE_TLS_REJECT_UNAUTHORIZED=0 globally here, which
// disabled certificate verification for every outbound TLS connection the
// whole app makes in production - not just this one. That's a much bigger
// blast radius than intended (affects Resend today, Razorpay once it's
// wired up, anything else added later). Removed - the ssl config below is
// scoped specifically to this Postgres connection, which is what actually
// needed it. Left that one in place rather than guessing at removing it
// too: this sandbox has no network path to Supabase to verify the
// connection still works without it, and breaking the live DB connection
// would be worse than the current downgrade. Worth testing removal of
// `rejectUnauthorized: false` below against a real deploy - Supabase's
// Postgres uses a normal CA-signed certificate, so it may not actually be
// necessary at all, just added as a blunt fix for a connection error at
// some point.

const prismaPgConfig: PoolConfig = {
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  // No max was set here at all, which means node-postgres' default of 10
  // connections PER Pool instance. Vercel spins up a separate serverless
  // instance (with its own module scope, hence its own Pool) per
  // concurrent invocation - so even 2 concurrent instances at the old
  // default could open up to 20 connections against Supabase's Session
  // Pooler, which caps at 15 total. Confirmed live: (EMAXCONNSESSION)
  // "max clients reached in session mode - max clients are limited to
  // pool_size: 15" errors across /artists/[id], /api/artists/me,
  // /api/auth/[...nextauth], /api/reviews, and more - a real, live bug
  // affecting real users, not a testing artifact, first seen July 9 and
  // made worse by heavier concurrent traffic.
  //
  // Standard fix for Prisma + node-postgres + Supabase + serverless:
  // each invocation typically only needs one connection at a time, so
  // cap it there and let Supabase's own pooler handle multiplexing
  // across however many concurrent instances Vercel actually runs.
  max: 1,
  // Release a connection back quickly rather than holding it open
  // between requests on a warm instance - keeps the aggregate count
  // low even under sustained concurrent traffic.
  idleTimeoutMillis: 10_000,
}

const pool = new (require("pg").Pool)(prismaPgConfig)
const adapter = new PrismaPg(pool, { disposeExternalPool: false })

const prismaClientSingleton = () => {
  return new PrismaClient({ adapter })
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma