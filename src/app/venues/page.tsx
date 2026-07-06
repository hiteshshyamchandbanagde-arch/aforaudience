import React from 'react'
import Link from 'next/link'

async function getVenues() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/venues`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export default async function VenuesPage() {
  const venues = await getVenues()

  return (
    <div className="max-w-5xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-6">Venues</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {venues.map((v: any) => (
          <Link key={v.id} href={`/venues/${v.id}`} className="block p-4 border rounded-lg hover:shadow">
            <h2 className="text-xl font-semibold">{v.name}</h2>
            <p className="text-sm text-muted-foreground">{v.city} — Capacity {v.capacity}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
