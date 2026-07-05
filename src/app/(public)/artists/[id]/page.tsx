import ArtistProfileClientPage from './ArtistProfileClientPage';

export function generateStaticParams() {
  return [{ id: '1' }];
}

export default function ArtistProfilePage({ params }: { params: { id: string } }) {
  return <ArtistProfileClientPage params={params} />;
}
