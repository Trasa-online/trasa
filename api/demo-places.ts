export const config = { runtime: "edge" };

const CATEGORY_QUERIES: Record<string, string> = {
  cafe: "kawiarnia",
  restaurant: "restauracja",
  bar: "bar koktajlowy",
  museum: "muzeum",
  park: "park",
  experience: "atrakcja turystyczna",
};

const TYPE_LABELS: Record<string, string> = {
  cafe: "kawiarnia",
  restaurant: "restauracja",
  bar: "bar",
  museum: "muzeum",
  park: "park",
  art_gallery: "galeria",
  tourist_attraction: "atrakcja",
  food: "jedzenie",
  night_club: "klub",
  lodging: "hotel",
  store: "sklep",
  spa: "spa",
  gym: "siłownia",
  church: "kościół",
  natural_feature: "natura",
  amusement_park: "park rozrywki",
};

function tagsFromTypes(types: string[]): string[] {
  const skip = new Set(["point_of_interest", "establishment", "food", "premise", "geocode"]);
  return types
    .filter(t => !skip.has(t))
    .slice(0, 3)
    .map(t => TYPE_LABELS[t] ?? t.replace(/_/g, " "));
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const category = searchParams.get("category");

  if (!city || !category) {
    return new Response("Missing city or category", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response("API key not configured", { status: 500 });
  }

  const query = `${CATEGORY_QUERIES[category] ?? category} ${city}`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=pl&key=${apiKey}`;

  const res = await fetch(url);
  const data: any = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return new Response(JSON.stringify({ error: data.status }), { status: 502 });
  }

  const places = (data.results as any[])
    .filter(p => p.photos?.length > 0)
    .slice(0, 8)
    .map(p => ({
      id: p.place_id,
      name: p.name,
      photo: `/api/place-photo?ref=${encodeURIComponent(p.photos[0].photo_reference)}&w=800`,
      rating: p.rating ?? 4.5,
      address: p.vicinity ?? p.formatted_address ?? "",
      tags: tagsFromTypes(p.types ?? []),
      description: "",
    }));

  return new Response(JSON.stringify(places), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Cache same city+category for 24h on CDN — 1 Google call per day max
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
    },
  });
}
