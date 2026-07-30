import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/display-currencies
//
// Public, guest-accessible - the checkout page and the profile currency
// picker both need this before/without a session in some flows. Read-only;
// admin-side rate editing is a separate route (not yet built - see
// design.md §9, "admin rate-editing UI" flagged as a fast follow).
export async function GET() {
  const currencies = await prisma.displayCurrencyRate.findMany({
    orderBy: { code: 'asc' },
  })
  return NextResponse.json({ currencies })
}
