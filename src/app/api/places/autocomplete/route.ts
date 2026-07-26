import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { autocompletePlaces } from '@/lib/places'

// Requires login (not a public endpoint) - this is only ever called
// from the venue create/edit forms, both already behind auth. Keeping
// it auth-gated rather than public avoids an anonymous script hammering
// our billed Google quota for free.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { input, sessionToken } = await req.json()
    const query = typeof input === 'string' ? input.trim() : ''
    if (!query || query.length < 2) {
      return NextResponse.json({ predictions: [] })
    }
    if (typeof sessionToken !== 'string' || !sessionToken) {
      return NextResponse.json({ error: 'sessionToken is required' }, { status: 400 })
    }

    const predictions = await autocompletePlaces(query, sessionToken)
    return NextResponse.json({ predictions })
  } catch (err) {
    console.error('Error in places autocomplete:', err)
    return NextResponse.json({ error: 'City search is temporarily unavailable' }, { status: 500 })
  }
}
