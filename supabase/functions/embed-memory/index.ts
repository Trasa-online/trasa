import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];

async function getEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: text,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

async function extractPreferences(
  content: string,
  apiKey: string
): Promise<Array<{ key: string; value: string; confidence: number }>> {
  try {
    const prompt = `Analizujesz podsumowanie dnia podróży i wyciągasz sygnały preferencji podróżniczych.

Podsumowanie:
${content}

Wyodrębnij 3-5 konkretnych preferencji w formacie JSON. Każda preferencja:
- key: snake_case identyfikator (np. "avoids_crowds", "likes_local_food", "prefers_morning_start", "dislikes_museums")
- value: konkretna wartość ("true", "strongly", "when possible", "dislikes", "occasionally")
- confidence: pewność 0.0-1.0

Odpowiedz TYLKO tablicą JSON, bez dodatkowego tekstu:
[{"key":"...","value":"...","confidence":0.8}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
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
    const { route_id } = await req.json();
    if (!route_id) {
      return new Response(
        JSON.stringify({ error: "route_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: route } = await supabase
      .from("routes")
      .select("id, city, day_number, ai_summary, ai_highlight, ai_tip")
      .eq("id", route_id)
      .single();

    if (!route?.ai_summary) {
      return new Response(
        JSON.stringify({ error: "No AAR data found for route" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts = [route.ai_summary];
    if (route.ai_highlight) parts.push(`Najlepszy moment: ${route.ai_highlight}`);
    if (route.ai_tip) parts.push(`Wniosek: ${route.ai_tip}`);
    const content = parts.join(". ");

    const embedding = await getEmbedding(content, LOVABLE_API_KEY);

    await supabase.from("user_memory").upsert({
      user_id: user.id,
      route_id: route_id,
      day_number: route.day_number,
      city: route.city,
      content,
      embedding: embedding ? JSON.stringify(embedding) : null,
      metadata: {
        ai_summary: route.ai_summary,
        ai_highlight: route.ai_highlight,
        ai_tip: route.ai_tip,
      },
    }, { onConflict: "user_id,route_id" });

    const preferences = await extractPreferences(content, LOVABLE_API_KEY);
    for (const pref of preferences) {
      if (!pref.key || !pref.value) continue;
      await supabase.from("user_preference_graph").upsert({
        user_id: user.id,
        preference_key: pref.key,
        preference_value: pref.value,
        confidence: pref.confidence ?? 0.5,
        evidence_count: 1,
        last_updated: new Date().toISOString(),
      }, { onConflict: "user_id,preference_key" });
    }

    return new Response(
      JSON.stringify({ ok: true, preferences_saved: preferences.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("embed-memory error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
