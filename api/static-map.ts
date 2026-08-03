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
