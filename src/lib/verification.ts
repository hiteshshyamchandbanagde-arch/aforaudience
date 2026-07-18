import { NextResponse } from 'next/server'

// Gate for actions where an unverified identity becomes something someone
// else relies on or is bound by - a published venue listing an Organiser
// plans around, an accepted venue booking, a submitted spot application an
// Organiser builds a lineup on. NOT for browsing, profile edits, or role
// apply itself (see design.md §9.5 - verify at first external commitment,
// not at signup).
export function requireVerifiedPhone(user: { isVerified: boolean }) {
  if (!user.isVerified) {
    return NextResponse.json(
      { error: 'Please verify your mobile number before doing this.' },
      { status: 403 }
    )
  }
  return null
}
