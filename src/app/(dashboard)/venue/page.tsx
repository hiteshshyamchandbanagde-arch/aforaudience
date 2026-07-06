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
  isApproved: boolean
  createdAt: string
}

export default function VenueDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const res = await fetch('/api/venues/my-venues')
        if (!res.ok) throw new Error('Failed to fetch venues')
        const data = await res.json()
        setVenues(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchVenues()
    }
  }, [session])

  if (status === 'loading' || loading) return (<><SiteNav /><div className="p-8">Loading...</div></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Your Venues</h1>
          <p className="text-muted-foreground mt-2">Manage your venue listings and bookings</p>
        </div>
        <Link
          href="/dashboard/venue/create"
          className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
        >
          + Add Venue
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
          {error}
        </div>
      )}

      {venues.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <p className="text-muted-foreground text-lg mb-4">No venues yet</p>
          <p className="text-sm text-muted-foreground mb-6">Create your first venue to start hosting events</p>
          <Link
            href="/dashboard/venue/create"
            className="inline-block px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
          >
            Create Venue
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {venues.map((venue) => (
            <div key={venue.id} className="border rounded-lg p-6 hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{venue.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {venue.address}, {venue.city}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    venue.isApproved
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {venue.isApproved ? 'Approved' : 'Pending Approval'}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-muted-foreground">Capacity: {venue.capacity}</p>
                <p className="text-sm text-muted-foreground">
                  Added: {new Date(venue.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/dashboard/venue/${venue.id}`}
                  className="flex-1 px-4 py-2 border rounded-lg text-center hover:bg-gray-50 transition"
                >
                  View Details
                </Link>
                <Link
                  href={`/dashboard/venue/${venue.id}/edit`}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-center hover:bg-amber-700 transition"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  )
}
