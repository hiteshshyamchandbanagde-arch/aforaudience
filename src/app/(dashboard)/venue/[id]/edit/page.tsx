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
  facilities: string[]
  acousticRating?: number
}

export default function VenueEditPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<Venue>>({})

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
        setFormData(data)
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/venues/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        throw new Error('Failed to update venue')
      }

      router.push(`/dashboard/venue/${params.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div className="p-8">Loading...</div></>)
  if (!session) return <SiteNav />
  if (error && !venue) return (<><SiteNav /><div className="p-8 text-red-600">{error}</div></>)
  if (!venue) return (<><SiteNav /><div className="p-8">Venue not found</div></>)

  return (
    <>
      <SiteNav />
      <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="mb-8">
        <Link href={`/dashboard/venue/${params.id}`} className="text-amber-600 hover:text-amber-700">
          ← Back to Venue
        </Link>
      </div>

      <div className="bg-white border rounded-lg p-8">
        <h1 className="text-3xl font-bold mb-8">Edit Venue</h1>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Venue Name</label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">City</label>
              <input
                type="text"
                name="city"
                value={formData.city || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Capacity</label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Acoustic Rating (0-5)</label>
              <input
                type="number"
                name="acousticRating"
                value={formData.acousticRating || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg"
                min="0"
                max="5"
                step="0.5"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/dashboard/venue/${params.id}`}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
      </div>
    </>
  )
}
