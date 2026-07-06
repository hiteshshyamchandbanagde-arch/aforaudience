import React from 'react'
import Link from 'next/link'
import prisma from '@/lib/prisma'

async function getVenues() {
  try {
    const venues = await prisma.venue.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: 'desc' },
    })
    return venues
  } catch (err) {
    console.error('Failed to fetch venues:', err)
    return []
  }
}

export default async function VenuesPage() {
  const venues = await getVenues()

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Venues</h1>
      {venues.length === 0 ? (
        <p className="text-muted-foreground">No venues found yet. Check back soon!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {venues.map((v) => (
            <Link key={v.id} href={`/venues/${v.id}`} className="block p-4 border rounded-lg hover:shadow">
              <h2 className="text-xl font-semibold">{v.name}</h2>
              <p className="text-sm text-muted-foreground">{v.city} — Capacity {v.capacity}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
