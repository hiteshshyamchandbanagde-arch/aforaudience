import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PRESET_GENRES } from '@/lib/genres'

// Public, no auth needed (same trust level as GET /api/artists itself -
// browse-first). Session 39, PR #224: the /artists filter-chip list used
// to be derived client-side from every artist's raw genre data, which
// meant any "Other" free-text value - however garbled - became a public
// filter option the moment one artist saved it. This endpoint is the
// gated alternative: presets are always safe, "Other" values only join
// once an admin has approved them here.
export async function GET() {
  const approved = await prisma.genreRequest.findMany({
    where: { status: 'APPROVED' },
    select: { value: true },
  })
  const genres = Array.from(new Set([...PRESET_GENRES, ...approved.map((a: { value: string }) => a.value)]))
  return NextResponse.json({ genres })
}
