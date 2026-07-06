import React from 'react'

async function getVenue(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/venues/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export default async function VenuePage({ params }: { params: { id: string } }) {
  const venue = await getVenue(params.id)

  if (!venue) return <div className="p-8">Venue not found</div>

  return (
    <div className="max-w-4xl mx-auto py-12">
      <h1 className="text-3xl font-bold">{venue.name}</h1>
      <p className="text-sm text-muted-foreground">{venue.address}, {venue.city}</p>
      <div className="mt-4">
        <p>{venue.description || 'No description yet.'}</p>
        <p className="mt-2">Capacity: {venue.capacity}</p>
      </div>
    </div>
  )
}
