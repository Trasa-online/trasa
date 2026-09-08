export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response("API key not configured", { status: 500 });
  }

  // Allowlist parametrow (anti cost-abuse) - nie forwardujemy dowolnych.
  const ALLOWED = new Set(["center", "zoom", "size", "markers", "path", "maptype", "scale", "format", "language", "region", "visible"]);
  const params = new URLSearchParams();
  for (const [k, v] of searchParams) {
    if (ALLOWED.has(k)) params.append(k, v);
  }
  // Clamp rozmiaru do <=640x640 (Google free max), scale do 1|2, maptype whitelist.
  const size = params.get("size");
  if (!size || !/^\d{1,4}x\d{1,4}$/.test(size)) {
    params.set("size", "400x400");
  } else {
    const [w, h] = size.split("x").map((n) => Math.min(Math.max(parseInt(n) || 400, 1), 640));
    params.set("size", `${w}x${h}`);
  }
  const scale = params.get("scale");
  if (scale && scale !== "1" && scale !== "2") params.delete("scale");
  const maptype = params.get("maptype");
  if (maptype && !["roadmap", "satellite", "terrain", "hybrid"].includes(maptype)) params.delete("maptype");

  // [sec] audyt 2026-09-08. Odpowiedz siedzi w CDN na dobe, wiec powtorzone zapytanie nic
  // nie kosztuje - place Google tylko za ROZNE adresy. Bez tego wystarczy krecic czwarta
  // cyfra po przecinku, zeby generowac nieskonczenie wiele "nowych" map z jednego widoku.
  // Zaokraglenie do 4 miejsc (~11 m, na statycznej mapie niewidoczne) skleja te zapytania
  // w jeden wpis w CDN. Przy okazji: zoom bez ograniczen szedl do Google jak leci.
  const roundCoords = (v: string) =>
    v.replace(/-?\d+\.\d{5,}/g, (n) => Number(n).toFixed(4));
  // UWAGA: `markers` wystepuje WIELOKROTNIE (jeden parametr na pin). `get()` zwraca tylko
  // pierwszy, a `set()` kasuje cala reszte - przez to mini-mapka pokazywala JEDEN pin zamiast
  // wszystkich (zgloszenie Nat 2026-09-09; regresja z zaokraglania wspolrzednych 2026-09-08).
  for (const k of ["center", "markers", "path", "visible"]) {
    const all = params.getAll(k);
    if (!all.length) continue;
    params.delete(k);
    for (const v of all) params.append(k, roundCoords(v));
  }
  const zoom = params.get("zoom");
  if (zoom !== null) {
    const z = parseInt(zoom, 10);
    if (Number.isNaN(z)) params.delete("zoom");
    else params.set("zoom", String(Math.min(Math.max(z, 0), 20)));
  }

  params.set("key", apiKey);

  const googleUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  const upstream = await fetch(googleUrl);

  if (!upstream.ok) {
    return new Response("Static map error", { status: upstream.status });
  }

  const body = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") ?? "image/png";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "CDN-Cache-Control": "public, max-age=86400",
    },
  });
}
