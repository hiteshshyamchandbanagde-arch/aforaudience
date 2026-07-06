'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

export default function CreateVenuePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    capacity: '',
    acousticRating: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          capacity: parseInt(formData.capacity),
          acousticRating: formData.acousticRating ? parseFloat(formData.acousticRating) : null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create venue')
      }

      const newVenue = await res.json()
      router.push(`/dashboard/venue/${newVenue.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return (<><SiteNav /><div className="p-8">Loading...</div></>)
  if (!session) return <SiteNav />

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
        <h1 className="text-3xl font-bold mb-2">Create New Venue</h1>
        <p className="text-muted-foreground mb-8">
          Add a new venue to your portfolio. Your venue will be submitted for admin approval.
        </p>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Venue Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g., The Grand Theater"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g., 123 Main Street"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g., Mumbai"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Seating Capacity *</label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g., 200"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Acoustic Rating (0-5)</label>
              <input
                type="number"
                name="acousticRating"
                value={formData.acousticRating}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g., 4.5"
                min="0"
                max="5"
                step="0.5"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">About Venue Approval</p>
            <p>Your venue will be reviewed by our team within 24-48 hours. We verify venue details and ensure quality standards for our platform.</p>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition"
            >
              {saving ? 'Creating...' : 'Create Venue'}
            </button>
            <Link
              href="/dashboard/venue"
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
