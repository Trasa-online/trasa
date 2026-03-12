import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];

interface OEmbedData {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

serve(async (req) => {
  const reqOrigin = req.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ error: "url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1. Fetch oEmbed metadata ──────────────────────────────────────────────
    let oembedData: OEmbedData | null = null;
    let platform = "unknown";

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      platform = "youtube";
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );
        if (res.ok) oembedData = await res.json();
      } catch { /* ignore */ }
    } else if (url.includes("tiktok.com")) {
      platform = "tiktok";
      try {
        const res = await fetch(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
        );
        if (res.ok) oembedData = await res.json();
      } catch { /* ignore */ }
    } else if (url.includes("instagram.com")) {
      platform = "instagram";
      // Instagram oEmbed requires FB token — skip, just pass URL through
    }

    // ── 2. Build AI prompt ────────────────────────────────────────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contextLines: string[] = [`Platforma: ${platform}`, `URL: ${url}`];
    if (oembedData?.title) contextLines.push(`Tytuł materiału: ${oembedData.title}`);
    if (oembedData?.author_name) contextLines.push(`Autor/kanał: ${oembedData.author_name}`);
    const context = contextLines.join("\n");

    const aiPrompt = `Jesteś asystentem który analizuje materiały wideo z mediów społecznościowych i wyciąga z nich informacje o polecanych miejscach (restauracje, kawiarnie, bary, widoki, muzea, parki itp.).

Na podstawie poniższych metadanych z materiału:

${context}

Wyodrębnij informacje o poleconym miejscu i zwróć WYŁĄCZNIE obiekt JSON (bez markdown, bez \`\`\`):
{
  "place_name": "oficjalna nazwa miejsca lub null",
  "city": "miasto małymi literami bez polskich znaków (np. krakow, warszawa, gdansk) lub null",
  "category": "jedna z: bar/cafe/restaurant/viewpoint/museum/park/shopping/gallery/monument/nightlife lub null",
  "description": "1-2 zdania czym jest to miejsce i dlaczego warto lub null",
  "creator_handle": "@handle twórcy (z małą @) lub null"
}

Zasady:
- Jeśli tytuł nie dotyczy konkretnego miejsca (np. ogólny vlog), zwróć wszystkie pola jako null
- city ZAWSZE małymi literami, bez polskich znaków (ó→o, ą→a, ę→e, ś→s, ź→z, ż→z, ć→c, ń→n, ł→l)
- Nie wymyślaj nazw — tylko to co jasno wynika z tytułu/autora`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: aiPrompt }],
        max_tokens: 400,
        temperature: 0.2,
      }),
    });

    if (!aiRes.ok) {
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const rawContent = (aiData.choices?.[0]?.message?.content ?? "").trim();

    let extracted: Record<string, string | null> = {};
    try {
      // Strip possible markdown code fences
      const jsonStr = rawContent.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response", raw: rawContent }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        place_name: extracted.place_name ?? null,
        city: extracted.city ?? null,
        category: extracted.category ?? null,
        description: extracted.description ?? null,
        creator_handle: extracted.creator_handle ?? null,
        photo_url: oembedData?.thumbnail_url ?? null,
        instagram_reel_url: url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("extract-creator-place error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
