import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { requireVerifiedPhone } from '@/lib/verification'
import { fetchLinkedAccount } from '@/lib/razorpay'

// K2 — organiser direct payout (Route split). An organiser's own Razorpay
// account_id is linked here, then used in POST /api/bookings to split
// audience payments (booking fee to platform, ticket subtotal straight to
// the organiser). Account creation itself is a manual, one-time step on
// the Razorpay Dashboard (test mode, Route > Accounts > Add Account, no
// KYC docs needed) — see design.md §9 for why the /v2/accounts create API
// isn't wired here yet. This route only links an existing account_id and
// keeps its activation status current.
//
// Gated behind requireVerifiedPhone the same as venue/event publish and
// application acceptance — an unverified identity shouldn't be able to
// redirect real audience money to a bank account it controls.

async function getOrganiserOrError(userId: string) {
  const organiser = await prisma.organiser.findUnique({ where: { userId } })
  if (!organiser) {
    return { error: NextResponse.json({ error: 'Not an Organiser account' }, { status: 403 }) }
  }
  return { organiser }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { organiser, error } = await getOrganiserOrError(user.id)
  if (error) return error

  if (!organiser!.razorpayAccountId) {
    return NextResponse.json({ linked: false, accountId: null, status: null })
  }

  // Refresh from Razorpay rather than serving the locally-cached status —
  // activation happens entirely on Razorpay's side (bank verification /
  // Penny Testing), so a stale local value could show "created" long
  // after the account actually finished activating, or vice versa.
  try {
    const info = await fetchLinkedAccount(organiser!.razorpayAccountId)
    if (info.status !== organiser!.razorpayAccountStatus) {
      await prisma.organiser.update({
        where: { id: organiser!.id },
        data: { razorpayAccountStatus: info.status },
      })
    }
    return NextResponse.json({ linked: true, accountId: info.id, status: info.status })
  } catch (err) {
    console.error('[payout-account.GET] Razorpay lookup failed:', err)
    return NextResponse.json(
      { linked: true, accountId: organiser!.razorpayAccountId, status: organiser!.razorpayAccountStatus, refreshError: true },
      { status: 200 }
    )
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const phoneCheck = requireVerifiedPhone(user, 'linking a payout account')
  if (phoneCheck) return phoneCheck

  const { organiser, error } = await getOrganiserOrError(user.id)
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const accountId = typeof body?.accountId === 'string' ? body.accountId.trim() : ''
  if (!accountId || !/^acc_[A-Za-z0-9]+$/.test(accountId)) {
    return NextResponse.json(
      { error: 'Enter a valid Razorpay account ID (starts with "acc_").' },
      { status: 400 }
    )
  }

  // Verify the account actually exists on our Razorpay account before
  // storing it - a typo'd or someone-else's account_id here would mean
  // future bookings' transfer calls fail loudly at checkout time instead
  // of being caught right now, at link time, where it's cheap to fix.
  let info
  try {
    info = await fetchLinkedAccount(accountId)
  } catch (err) {
    console.error('[payout-account.POST] Razorpay lookup failed:', err)
    return NextResponse.json(
      { error: "Couldn't verify that account with Razorpay. Double-check the account ID and try again." },
      { status: 400 }
    )
  }

  const updated = await prisma.organiser.update({
    where: { id: organiser!.id },
    data: { razorpayAccountId: info.id, razorpayAccountStatus: info.status },
  })

  return NextResponse.json({
    linked: true,
    accountId: updated.razorpayAccountId,
    status: updated.razorpayAccountStatus,
  })
}
