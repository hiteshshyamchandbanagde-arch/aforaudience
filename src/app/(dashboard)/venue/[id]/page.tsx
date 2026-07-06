'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface Venue {
  id: string
  name: string
  address: string
  city: string
  capacity: number
  description?: string
  acousticRating?: number
  facilities: string[]
  isApproved: boolean
  createdAt: string
}

export default function VenueDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const res = await fetch(`/api/venues/${params.id}/owner`)
        if (!res.ok) {
          if (res.status === 403) throw new Error('You do not have access to this venue')
          throw new Error('Venue not found')
        }
        const data = await res.json()
        setVenue(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchVenue()
    }
  }, [session, params.id])

  if (status === 'loading' || loading) return (<><SiteNav /><div className="p-8">Loading...</div></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><div className="p-8 text-red-600">{error}</div></>)
  if (!venue) return (<><SiteNav /><div className="p-8">Venue not found</div></>)

  return (
    <>
      <SiteNav />
      <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="mb-8">
        <Link href="/dashboard/venue" className="text-amber-600 hover:text-amber-700">
          ← Back to Venues
        </Link>
      </div>

      <div className="bg-white border rounded-lg p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-bold">{venue.name}</h1>
            <p className="text-muted-foreground mt-2">
              {venue.address}, {venue.city}
            </p>
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              venue.isApproved
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {venue.isApproved ? 'Approved' : 'Pending Approval'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-sm text-muted-foreground">Capacity</p>
            <p className="text-2xl font-bold">{venue.capacity}</p>
          </div>
          {venue.acousticRating && (
            <div>
              <p className="text-sm text-muted-foreground">Acoustic Rating</p>
              <p className="text-2xl font-bold">{venue.acousticRating}/5</p>
            </div>
          )}
        </div>

        {venue.facilities && venue.facilities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Facilities</h2>
            <div className="flex flex-wrap gap-2">
              {venue.facilities.map((facility) => (
                <span
                  key={facility}
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                >
                  {facility}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Link
            href={`/dashboard/venue/${venue.id}/edit`}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
          >
            Edit Venue
          </Link>
          <button className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition">
            View Bookings
          </button>
        </div>
      </div>
      </div>
    </>
  )
}
