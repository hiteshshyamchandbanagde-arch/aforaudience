import React from 'react'
import prisma from '@/lib/prisma'
import SiteNav from '@/components/SiteNav'

async function getVenue(id: string) {
  try {
    return await prisma.venue.findUnique({ where: { id } })
  } catch (err) {
    console.error('Failed to fetch venue:', err)
    return null
  }
}

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const venue = await getVenue(id)

  return (
    <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav backHref="/venues" backLabel="← Back to Venues" />
      {!venue ? (
        <div className="max-w-4xl mx-auto py-12 px-4">Venue not found.</div>
      ) : (
        <div className="max-w-4xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold">{venue.name}</h1>
          <p className="text-sm text-muted-foreground">{venue.address}, {venue.city}</p>
          <div className="mt-4">
            <p>Capacity: {venue.capacity}</p>
          </div>
        </div>
      )}
    </main>
  )
}
