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

        // H3 - suspended accounts can't log in at all, checked before the
        // password so a suspended user gets a clear reason rather than a
        // generic credentials error.
        if (user.isSuspended) {
          throw new Error("SUSPENDED")
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
          displayName: user.displayName,
          role: user.role,
          tokenVersion: user.tokenVersion,
          code: user.code,
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

        // H3 - same suspension gate as the credentials provider.
        if (user.isSuspended) {
          throw new Error("SUSPENDED")
        }

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
          displayName: user.displayName,
          role: user.role,
          tokenVersion: user.tokenVersion,
          code: user.code,
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
        token.code = (user as any).code
        token.displayName = (user as any).displayName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).code = token.code;
        (session.user as any).displayName = token.displayName

        // B5 - if the password has been reset since this JWT was issued,
        // tokenVersion will have moved on. Flag the session as invalid
        // rather than trusting a stale token for its full 7-day life.
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, tokenVersion: true, displayName: true, isVerified: true, isSuspended: true },
        })

        // Refresh displayName, isVerified, and role on every session check -
        // the first so a Profile edit shows up immediately, the second so
        // completing phone verification (see /verify-phone) unblocks
        // booking without requiring a re-login, and the third so a one-time
        // Audience -> Organiser/Venue Owner/Artist elevation approved mid-
        // session takes effect immediately instead of waiting out the JWT's
        // life. Role only ever moves one-way from Audience, never laterally
        // between the elevated roles, so this can't downgrade an already-
        // elevated session - it only ever catches the session up to a
        // legitimate approval that happened after login.
        if (currentUser) {
          (session.user as any).displayName = currentUser.displayName
          ;(session.user as any).isVerified = currentUser.isVerified
          ;(session.user as any).role = currentUser.role
        }

        // H3 - a suspension applied mid-session shouldn't wait out the
        // JWT's 7-day life. Checked ahead of tokenVersion so the message
        // is specific rather than falling through to the generic one.
        if (currentUser?.isSuspended) {
          (session as any).error = "AccountSuspended"
        } else if (!currentUser || currentUser.tokenVersion !== token.tokenVersion) {
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
