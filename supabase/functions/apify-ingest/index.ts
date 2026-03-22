import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { datasetId, city, source_platform = "apify" } = await req.json();

    if (!datasetId || !city) {
      return new Response(
        JSON.stringify({ error: "datasetId and city are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch items from Apify dataset
    const apifyUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&format=json`;
    const apifyRes = await fetch(apifyUrl);

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      throw new Error(`Apify API error [${apifyRes.status}]: ${errText}`);
    }

    const items = await apifyRes.json();
    console.log(`Fetched ${items.length} items from Apify dataset ${datasetId}`);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      // Map Apify item to scraped_places schema
      // Adjust field mapping based on your Apify actor output
      const place = {
        place_name: item.title || item.name || item.place_name || item.placeName,
        city,
        description: item.description || item.text || item.snippet || null,
        category: item.category || item.type || null,
        tags: item.tags || item.hashtags || [],
        source_platform,
        creator_name: item.creator || item.author || item.username || item.creatorName || null,
        post_url: item.url || item.postUrl || item.link || null,
        thumbnail_url: item.imageUrl || item.thumbnailUrl || item.image || item.photo || null,
        latitude: item.latitude || item.lat || item.location?.lat || null,
        longitude: item.longitude || item.lng || item.lon || item.location?.lng || null,
        is_active: true,
      };

      if (!place.place_name) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("scraped_places").insert(place);

      if (error) {
        console.error(`Error inserting "${place.place_name}":`, error.message);
        errors++;
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: items.length,
        inserted,
        skipped,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("apify-ingest error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
