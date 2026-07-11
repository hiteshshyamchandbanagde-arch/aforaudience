import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { resolveIdentifierToUser } from "@/lib/auth-helpers"
import { verifyOtp } from "@/lib/otp"

const LOCKOUT_THRESHOLD = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// Precomputed once at cold start so a lookup on a nonexistent identifier
// still does a bcrypt.compare of similar cost to a real one - keeps
// response timing from being a trivial way to enumerate accounts.
const DUMMY_HASH = bcrypt.hashSync("aforaudience-timing-guard", 12)

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        // Accepts email, phone, username, or AFA/ART/ORG/VEN code - see
        // resolveIdentifierToUser for resolution order. Field is still
        // called "identifier" (not "email") end to end, including on the
        // login page.
        identifier: { label: "Email / Phone / Username / Code", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null

        const user = await resolveIdentifierToUser(credentials.identifier)

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
    }),
    // Separate provider (not a branch inside "credentials") so the login
    // page calls signIn("otp-login", {...}) explicitly - keeps the two
    // auth factors from being silently interchangeable inside one handler.
    // Deliberately does NOT check password lockedUntil: OTP possession is
    // an independent, already rate-limited factor (see lib/otp.ts) and
    // proves control of the phone, a stronger signal than the thing a
    // password lockout is protecting against. If you'd rather OTP respect
    // the same lock, add the same check as above here.
    CredentialsProvider({
      id: "otp-login",
      name: "otp-login",
      credentials: {
        identifier: { label: "Email / Phone / Username / Code", type: "text" },
        code: { label: "OTP", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.code) return null

        const user = await resolveIdentifierToUser(credentials.identifier)
        if (!user || !user.phone) return null

        const result = await verifyOtp(user.phone, credentials.code, "LOGIN")
        if (!result.ok) return null

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
