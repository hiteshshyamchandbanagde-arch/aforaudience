import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { resolveIdentifierToUser } from "@/lib/auth-helpers"
import { suggestAvailableUsername } from "@/lib/auth-helpers"
import { verifyOtp } from "@/lib/otp"

const LOCKOUT_THRESHOLD = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// Precomputed once at cold start so a lookup on a nonexistent identifier
// still does a bcrypt.compare of similar cost to a real one - keeps
// response timing from being a trivial way to enumerate accounts.
const DUMMY_HASH = bcrypt.hashSync("aforaudience-timing-guard", 12)

// QST-2607-009 (10 Aug) - the default PrismaAdapter.createUser only ever
// receives {email, name, image} from Google and would pass that straight
// to prisma.user.create - which fails outright here: `password` is a
// required column (no OAuth-only accounts in this schema) and `name`
// doubles as the unique, format-constrained login username (3-20 chars,
// [a-zA-Z0-9_]), not a free-text display name like "Priya Sharma". This
// override only fires for a genuinely new email (returning users resolve
// via getUserByAccount/getUserByEmail before createUser is ever called,
// see allowDangerousEmailAccountLinking below) - reuses the same
// suggestAvailableUsername() the manual signup flow's username-suggestions
// endpoint already uses, and the same "new account defaults to Audience,
// pre-approved, phone unverified" shape as /api/auth/register. The random
// password hash is intentionally never returned to the user anywhere -
// only "Forgot password" can ever produce a usable one for this account.
const prismaAdapter = PrismaAdapter(prisma) as any
const adapter = {
  ...prismaAdapter,
  createUser: async (data: { email: string; name?: string | null; image?: string | null }) => {
    const username = await suggestAvailableUsername(data.name || data.email.split("@")[0])
    return prisma.user.create({
      data: {
        name: username,
        displayName: data.name || null,
        email: data.email,
        avatar: data.image || null,
        password: bcrypt.hashSync(randomUUID(), 12),
        role: "AUDIENCE",
        isApproved: true,
        isVerified: false,
      },
    })
  },
}

export const authOptions: NextAuthOptions = {
  adapter,
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
          phone: user.phone,
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
          phone: user.phone,
        }
      }
    }),
    // QST-2607-009 (10 Aug) - Google Sign-In, additive alongside credentials/OTP,
    // not a replacement. Conditionally included so a QA/preview environment
    // without GOOGLE_CLIENT_ID/SECRET set yet still boots normally with the
    // other two providers - the login page only renders the Google button
    // when NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED is set (see login page), so
    // there's no dead button pointing at a disabled provider either.
    // allowDangerousEmailAccountLinking is safe specifically because Google
    // itself verifies the email before ever handing it to us - an existing
    // credentials-registered account with the same email gets linked, not
    // duplicated. Never enable this flag for a provider that doesn't
    // guarantee email verification.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
        token.tokenVersion = (user as any).tokenVersion
        token.code = (user as any).code
        token.displayName = (user as any).displayName
        token.phone = (user as any).phone
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).code = token.code;
        (session.user as any).displayName = token.displayName
        ;(session.user as any).phone = token.phone

        // B5 - if the password has been reset since this JWT was issued,
        // tokenVersion will have moved on. Flag the session as invalid
        // rather than trusting a stale token for its full 7-day life.
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, tokenVersion: true, displayName: true, isVerified: true, isSuspended: true, phone: true },
        })

        // Refresh displayName, isVerified, role, and phone on every session
        // check - the first so a Profile edit shows up immediately, the
        // second so completing phone verification (see /verify-phone)
        // unblocks booking without requiring a re-login, the third so a
        // one-time Audience -> Organiser/Venue Owner/Artist elevation
        // approved mid-session takes effect immediately instead of
        // waiting out the JWT's life, and the fourth (29 Jul - Razorpay
        // prefill fix) so a changed phone number reaches checkout
        // without a re-login too. Role only ever moves one-way from
        // Audience, never laterally between the elevated roles, so this
        // can't downgrade an already-elevated session - it only ever
        // catches the session up to a legitimate approval that happened
        // after login.
        if (currentUser) {
          (session.user as any).displayName = currentUser.displayName
          ;(session.user as any).isVerified = currentUser.isVerified
          ;(session.user as any).role = currentUser.role
          ;(session.user as any).phone = currentUser.phone
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
