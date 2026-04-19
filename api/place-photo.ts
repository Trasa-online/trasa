export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const maxWidth = searchParams.get("w") ?? "800";

  if (!ref) {
    return new Response("Missing ref", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response("API key not configured", { status: 500 });
  }

  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;

  const upstream = await fetch(googleUrl);

  if (!upstream.ok) {
    return new Response("Photo not found", { status: upstream.status });
  }

  const body = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Cache at the CDN edge for 1 year — Google is called only once per unique photo_reference
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
