import EventDetailClientPage from './EventDetailClientPage';

export function generateStaticParams() {
  return [{ id: '1' }];
}

export default function EventDetailPage({ params }: { params: { id: string } }) {
  return <EventDetailClientPage params={params} />;
}
