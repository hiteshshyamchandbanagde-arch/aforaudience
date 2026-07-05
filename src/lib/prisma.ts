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

if (process.env.NODE_ENV === "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
}

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