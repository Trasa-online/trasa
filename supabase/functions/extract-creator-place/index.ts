import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = ["https://trasa.travel", "https://trasa.lovable.app", "http://localhost:8080", "http://localhost:5173"];

interface OEmbedData {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

interface ExtractedPlace {
  place_name: string;
  city: string | null;
  category: string | null;
  creator_handle: string | null;
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

async function fetchYouTubeSnippet(
  videoId: string,
  apiKey: string
): Promise<{ title: string; description: string; channelTitle: string } | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const snippet = data.items?.[0]?.snippet;
    if (!snippet) return null;
    return {
      title: snippet.title ?? "",
      description: (snippet.description ?? "").slice(0, 3000),
      channelTitle: snippet.channelTitle ?? "",
    };
  } catch {
    return null;
  }
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1. Fetch metadata ─────────────────────────────────────────────────────
    let oembedData: OEmbedData | null = null;
    let platform = "unknown";
    let richDescription: string | null = null;

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      platform = "youtube";

      // Try YouTube Data API for full description
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
      const videoId = extractYouTubeId(url);
      if (GOOGLE_API_KEY && videoId) {
        const snippet = await fetchYouTubeSnippet(videoId, GOOGLE_API_KEY);
        if (snippet) {
          oembedData = { title: snippet.title, author_name: snippet.channelTitle };
          richDescription = snippet.description;
        }
      }

      // Fallback: oEmbed (title + author only)
      if (!oembedData) {
        try {
          const res = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
          );
          if (res.ok) oembedData = await res.json();
        } catch { /* ignore */ }
      }
    } else if (url.includes("tiktok.com")) {
      platform = "tiktok";
      try {
        const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
        if (res.ok) oembedData = await res.json();
      } catch { /* ignore */ }
    } else if (url.includes("instagram.com")) {
      platform = "instagram";
    }

    // ── 2. Build context ──────────────────────────────────────────────────────
    const contextLines: string[] = [`Platforma: ${platform}`, `URL: ${url}`];
    if (oembedData?.title) contextLines.push(`Tytuł materiału: ${oembedData.title}`);
    if (oembedData?.author_name) contextLines.push(`Autor/kanał: ${oembedData.author_name}`);
    if (richDescription) contextLines.push(`\nOpis materiału:\n${richDescription}`);
    const context = contextLines.join("\n");

    // ── 3. AI extraction (returns ARRAY of places) ────────────────────────────
    const aiPrompt = `Jesteś asystentem który analizuje materiały wideo z mediów społecznościowych i wyciąga z nich informacje o polecanych miejscach (restauracje, kawiarnie, bary, widoki, muzea, parki itp.).

Na podstawie poniższych danych z materiału:

${context}

Wyodrębnij WSZYSTKIE wspomniane miejsca i zwróć WYŁĄCZNIE tablicę JSON (bez markdown, bez \`\`\`):
[
  {
    "place_name": "oficjalna nazwa miejsca",
    "city": "miasto małymi literami bez polskich znaków (np. krakow, warszawa, gdansk)",
    "category": "jedna z: bar/cafe/restaurant/viewpoint/museum/park/shopping/gallery/monument/nightlife",
    "creator_handle": "@handle twórcy (z @)"
  }
]

Zasady:
- Zwróć PUSTĄ tablicę [] jeśli materiał nie dotyczy konkretnych miejsc
- Każde miejsce = osobny obiekt w tablicy
- city ZAWSZE małymi literami, bez polskich znaków (ó→o, ą→a, ę→e, ś→s, ź→z, ż→z, ć→c, ń→n, ł→l)
- Nie wymyślaj nazw — tylko to co jasno wynika z tytułu lub opisu
- Max 10 miejsc
- Jeśli jakieś pole jest nieznane, użyj null`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: aiPrompt }],
        max_tokens: 1500,
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

    let places: ExtractedPlace[] = [];
    try {
      const jsonStr = rawContent.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(jsonStr);
      places = Array.isArray(parsed) ? parsed : [];
    } catch {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response", raw: rawContent }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        places,
        photo_url: oembedData?.thumbnail_url ?? null,
        source_url: url,
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
