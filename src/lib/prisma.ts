import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client/edge"

const adapter = new PrismaPg({ 
  connectionString: process.env.DATABASE_URL! 
})

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