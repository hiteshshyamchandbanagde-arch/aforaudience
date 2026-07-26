import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPlaceDetails } from '@/lib/places'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { placeId, sessionToken } = await req.json()
    if (typeof placeId !== 'string' || !placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 })
    }
    if (typeof sessionToken !== 'string' || !sessionToken) {
      return NextResponse.json({ error: 'sessionToken is required' }, { status: 400 })
    }

    const location = await getPlaceDetails(placeId, sessionToken)
    return NextResponse.json(location)
  } catch (err) {
    console.error('Error in places details:', err)
    return NextResponse.json({ error: 'Could not resolve that place' }, { status: 500 })
  }
}
