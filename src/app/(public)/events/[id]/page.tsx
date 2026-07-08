import prisma from '@/lib/prisma'
import EventDetailClientPage from './EventDetailClientPage'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      venue: true,
      lineup: { include: { artist: { include: { user: true } } }, orderBy: { slot: 'asc' } },
    },
  })

  if (!event || event.status !== 'APPROVED') {
    return <EventDetailClientPage event={null} />
  }

  return <EventDetailClientPage event={JSON.parse(JSON.stringify(event))} />
}

// Same reasoning as venues/page.tsx - no dynamic API is used here otherwise,
// so force per-request rendering instead of a frozen build-time snapshot.
export const dynamic = 'force-dynamic'
