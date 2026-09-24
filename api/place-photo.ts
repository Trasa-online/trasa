import { allowEdgeCall, quotaExceeded } from "./_quota";

export const config = { runtime: "edge" };

// Szerokosci z ALLOWLISTY (audyt naduzyc 2026-09-24). Kazda inna wartosc \`w\` to inny adres,
// czyli pudlo w CDN i nowe PLATNE wywolanie Google - bez tej listy wystarczy petla po
// \`w=1..2000\`, zeby z jednego zdjecia zrobic dwa tysiace zapytan. Aplikacja uzywa 300/400/600/800.
const ALLOWED_WIDTHS = [200, 300, 400, 600, 800, 1200];
const REF_RE = /^[A-Za-z0-9_-]{20,600}$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const placeIdRaw = searchParams.get("place_id");
  const placeId = placeIdRaw && PLACE_ID_RE.test(placeIdRaw) ? placeIdRaw : null;
  const wanted = Number(searchParams.get("w") ?? "800");
  const maxWidth = String(
    ALLOWED_WIDTHS.includes(wanted)
      ? wanted
      : ALLOWED_WIDTHS.reduce((best, w) => (Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best), 800),
  );

  if (!ref || !REF_RE.test(ref)) {
    return new Response("Missing ref", { status: 400 });
  }

  // Limit NA IP (godzina) + globalny (doba). Patrz api/_quota.ts.
  if (!(await allowEdgeCall("photo", req))) return quotaExceeded();

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response("API key not configured", { status: 500 });
  }

  // AU_... format = New Places API (v1). Requires placeId for full photo name.
  // Older CmRaAAAA... format uses the legacy Photos endpoint.
  const googleUrl = ref.startsWith("AU_") && placeId
    ? `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}/photos/${encodeURIComponent(ref)}/media?maxHeightPx=${maxWidth}&key=${apiKey}`
    : `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;

  // Preferuj JPEG. Bez Accept Google potrafi zwrocic image/webp, ktory na natywnym iOS
  // (WebKit) czasem nie dekoduje sie ("makeImagePlus ... 'WEBP' err=-50") -> zdjecie
  // ladowalo sie jako przezroczyste/puste. Nudge w strone JPEG/PNG ogranicza ten przypadek.
  const upstream = await fetch(googleUrl, {
    headers: { Accept: "image/jpeg,image/png;q=0.9,image/*;q=0.8" },
  });

  if (!upstream.ok) {
    return new Response("Photo not found", { status: upstream.status });
  }

  const body = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
