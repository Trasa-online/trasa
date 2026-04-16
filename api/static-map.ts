export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response("API key not configured", { status: 500 });
  }

  // Forward all query params from the client, but inject the server-side key
  const params = new URLSearchParams(searchParams);
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
