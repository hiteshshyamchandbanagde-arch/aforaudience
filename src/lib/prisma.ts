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