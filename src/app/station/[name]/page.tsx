type StationPageProps = {
  params: Promise<{
    name: string;
  }>;
};

export default async function StationPage({ params }: StationPageProps) {
  const { name } = await params;
  const stationName = decodeURIComponent(name);

  return (
    <main>
      <h1>{stationName}</h1>
    </main>
  );
}
