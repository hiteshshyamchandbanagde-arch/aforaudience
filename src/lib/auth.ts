import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

const LOCKOUT_THRESHOLD = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// Precomputed once at cold start so a lookup on a nonexistent email still
// does a bcrypt.compare of similar cost to a real one - keeps response
// timing from being a trivial way to enumerate accounts.
const DUMMY_HASH = bcrypt.hashSync("aforaudience-timing-guard", 12)

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.trim().toLowerCase()
        const user = await prisma.user.findUnique({ where: { email } })

        if (!user) {
          await bcrypt.compare(credentials.password, DUMMY_HASH)
          return null
        }

        // B6 - already locked out, reject before even checking the password
        // so a locked-out attacker can't keep guessing during the window.
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("LOCKED")
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          const attempts = user.failedLoginAttempts + 1
          const shouldLock = attempts >= LOCKOUT_THRESHOLD

          await prisma.user.update({
            where: { id: user.id },
            data: shouldLock
              ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
              : { failedLoginAttempts: attempts },
          })

          return null
        }

        // Successful login clears any prior failed-attempt count/lock.
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tokenVersion: user.tokenVersion,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
        token.tokenVersion = (user as any).tokenVersion
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id

        // B5 - if the password has been reset since this JWT was issued,
        // tokenVersion will have moved on. Flag the session as invalid
        // rather than trusting a stale token for its full 7-day life.
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true },
        })

        if (!currentUser || currentUser.tokenVersion !== token.tokenVersion) {
          (session as any).error = "SessionInvalidated"
        }
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET,
}
