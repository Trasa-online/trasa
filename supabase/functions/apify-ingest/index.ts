import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { datasetId, runId, city = "Kraków", debug = false } = await req.json();

    if (!datasetId && !runId) {
      return new Response(
        JSON.stringify({ error: "datasetId or runId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apifyToken = Deno.env.get("APIFY_API_TOKEN")!;
    const openAiKey = Deno.env.get("OPENAI_API_KEY")!;
    

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let resolvedDatasetId = datasetId;
    if (!resolvedDatasetId && runId) {
      const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const runData = await runRes.json();
      resolvedDatasetId = runData?.data?.defaultDatasetId;
      if (!resolvedDatasetId) {
        return new Response(
          JSON.stringify({ error: "Could not find dataset for this runId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const datasetRes = await fetch(
      `https://api.apify.com/v2/datasets/${resolvedDatasetId}/items?token=${apifyToken}&limit=500`
    );
    if (!datasetRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch Apify dataset" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const items = await datasetRes.json();

    if (debug) {
      const sample = items.slice(0, 3).map((item: any) => ({
        keys: Object.keys(item),
        caption: item.caption,
        likesCount: item.likesCount,
        ownerUsername: item.ownerUsername,
        displayUrl: item.displayUrl,
        locationName: item.locationName,
      }));
      return new Response(
        JSON.stringify({ debug: true, sample }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let inserted = 0;
    let skippedLikes = 0;
    let skippedParse = 0;
    let skippedConfidence = 0;
    let skippedEmbed = 0;
    let skippedDb = 0;

    for (const item of items) {
      const caption = item.caption || item.alt || item.accessibility_caption || "";
      const creatorName = item.ownerUsername || item.owner?.username || "";
      const thumbnailUrl = item.displayUrl || item.imageUrl || item.images?.[0] || "";
      const postUrl = item.url || (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : "");
      const likes = item.likesCount || item.likes || 0;
      const locationHint = item.locationName || item.location?.name || city;

      if (likes < 3 || caption.length < 15) { skippedLikes++; continue; }

      const placeName = item.ownerFullName || item.ownerUsername || null;
      if (!placeName || caption.length < 15) {
        skippedParse++;
        continue;
      }
      const parsed = {
        place_name: placeName,
        category: null,
        description: caption.slice(0, 400),
        tags: item.hashtags?.slice(0, 5) ?? [],
      };

      const embedText = `${parsed.place_name}. ${parsed.description}. ${(parsed.tags ?? []).join(", ")}`;
      let embedding: number[];
      try {
        const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: embedText }),
        });
        const embedData = await embedRes.json();
        embedding = embedData.data?.[0]?.embedding;
        if (!embedding) throw new Error("no embedding");
      } catch { skippedEmbed++; continue; }

      const { error } = await supabase.from("scraped_places").upsert({
        city,
        place_name: parsed.place_name,
        category: parsed.category ?? null,
        description: parsed.description ?? null,
        tags: parsed.tags ?? [],
        source_platform: "instagram",
        creator_name: creatorName,
        post_url: postUrl,
        thumbnail_url: thumbnailUrl,
        embedding,
      }, { onConflict: "place_name,city,source_platform" });

      if (error) { skippedDb++; } else { inserted++; }
    }

    return new Response(
      JSON.stringify({ inserted, skippedLikes, skippedParse, skippedConfidence, skippedEmbed, skippedDb, total: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
