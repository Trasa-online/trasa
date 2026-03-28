import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];

const PERSONALITY_TYPES = [
  { type: "kulturalny",   label: "Kulturalny",     count: 5, focus: "muzea, galerie, MOCAK, zabytki — dla kogoś kto chce zrozumieć Kraków przez sztukę i historię" },
  { type: "historyczny",  label: "Historyczny",    count: 5, focus: "Wawel, kościoły, synagogi, Rynek Podziemny, Fabryka Schindlera — głęboka historia miasta" },
  { type: "kawiarniany",  label: "Kawiarniany",    count: 5, focus: "specialty coffee, cukiernie, powolny rytm, parki, chwile relaksu — dla kogoś kto chce się zrelaksować" },
  { type: "nocny",        label: "Nocny",          count: 4, focus: "dzień skrócony, wieczór w barach na Kazimierzu — RUMOUR, Forum, HEVRE, Pełnia Social Club" },
  { type: "aktywny",      label: "Aktywny",        count: 4, focus: "maksymalnie dużo miejsc, szybkie tempo, parki, kopce, muzea interaktywne" },
  { type: "zakupowy",     label: "Zakupowy",       count: 3, focus: "butiki Kazimierza, Balagan, ceramika, targi, rękodzieło — dla miłośników lokalnych sklepów" },
  { type: "mix",          label: "Zrównoważony",   count: 4, focus: "idealne połączenie: zabytek + lunch + muzeum + kawiarnia + kolacja — klasyczna dobra trasa" },
];

function buildPrompt(places: any[]): string {
  const byCategory: Record<string, string[]> = {};
  for (const p of places) {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p.place_name);
  }

  const placesList = Object.entries(byCategory)
    .map(([cat, names]) => `**${cat.toUpperCase()}** (${names.length}):\n${names.map(n => `  - ${n}`).join("\n")}`)
    .join("\n\n");

  const routeSpecs = PERSONALITY_TYPES.map((p, i) =>
    `${i + 1}. **${p.label}** (${p.count} tras): ${p.focus}`
  ).join("\n");

  return `Jesteś ekspertem od planowania tras turystycznych w Krakowie.

## DOSTĘPNE MIEJSCA W BAZIE
Używaj WYŁĄCZNIE miejsc z poniższej listy. Nie dodawaj innych nazw.
Dla restauracji/barów których brakuje — użyj placeholdera w formacie:
"[PLACEHOLDER] Kolacja w Kazimierzu — restauracja z kuchnią polską"
"[PLACEHOLDER] Lunch w okolicy Rynku — bistro z zupami i kanapkami"
"[PLACEHOLDER] Wieczorny drink — cocktail bar w Starym Mieście"

${placesList}

## ZADANIE
Wygeneruj dokładnie 30 różnych jednodniowych tras według tych specyfikacji:

${routeSpecs}

## ZASADY PLANOWANIA
- Każda trasa: 5–7 punktów, realistyczne godziny (start 9:00–10:00)
- Klastry geograficzne: nie skacz po mapie bez sensu
- Każda trasa kończy się kulminacją (kolacja / widok / bar)
- Czas wizyt: muzeum 90-120min, kawiarnia 45min, zabytek 60min, park 45min, restauracja 75min
- Trasy tego samego typu muszą być RÓŻNE — inne miejsca, inne dzielnice
- Restauracje/bary z listy używaj gdy pasują; dla brakujących → [PLACEHOLDER]

## FORMAT ODPOWIEDZI
Zwróć TYLKO czysty JSON (bez markdown, bez komentarzy):

[
  {
    "title": "Tytuł trasy",
    "personality_type": "kulturalny",
    "description": "1 zdanie co wyróżnia tę trasę",
    "day_metrics": {"walking_km": 7, "crowd_level": "medium", "energy_cost": "medium"},
    "pins": [
      {
        "place_name": "Nazwa miejsca",
        "suggested_time": "10:00",
        "duration_minutes": 90,
        "category": "museum",
        "walking_time_from_prev": null,
        "note": "dlaczego to miejsce jest tu"
      }
    ]
  }
]`;
}

serve(async (req) => {
  const reqOrigin = req.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check — only allow authenticated users
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const city = body.city ?? "Kraków";

    // Fetch all active places for this city
    const { data: places, error: placesError } = await supabase
      .from("places")
      .select("place_name, category, address, latitude, longitude")
      .ilike("city", city)
      .eq("is_active", true);

    if (placesError || !places?.length) {
      return new Response(JSON.stringify({ error: "No places found for city", details: placesError }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(places);

    // Generate in 2 batches of 15 to avoid timeout
    const generateBatch = async (batchPrompt: string): Promise<any[]> => {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: batchPrompt }],
          max_tokens: 16000,
          temperature: 0.8,
        }),
      });
      if (!res.ok) throw new Error(`AI error: ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";

      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array in response");
      return JSON.parse(jsonMatch[0]);
    };

    // Batch 1: kulturalny (5) + historyczny (5) + kawiarniany (5) = 15
    const batch1Spec = PERSONALITY_TYPES.slice(0, 3);
    const batch1Count = batch1Spec.reduce((s, p) => s + p.count, 0);
    const batch1Specs = batch1Spec.map((p, i) =>
      `${i + 1}. **${p.label}** (${p.count} tras): ${p.focus}`
    ).join("\n");

    // Batch 2: nocny (4) + aktywny (4) + zakupowy (3) + mix (4) = 15
    const batch2Spec = PERSONALITY_TYPES.slice(3);
    const batch2Count = batch2Spec.reduce((s, p) => s + p.count, 0);
    const batch2Specs = batch2Spec.map((p, i) =>
      `${i + 1}. **${p.label}** (${p.count} tras): ${p.focus}`
    ).join("\n");

    const makeBatchPrompt = (specs: string, count: number) =>
      prompt.replace(
        `Wygeneruj dokładnie 30 różnych jednodniowych tras według tych specyfikacji:\n\n${PERSONALITY_TYPES.map((p, i) => `${i + 1}. **${p.label}** (${p.count} tras): ${p.focus}`).join("\n")}`,
        `Wygeneruj dokładnie ${count} różnych jednodniowych tras według tych specyfikacji:\n\n${specs}`
      );

    console.log("Starting batch 1 (15 routes)...");
    const routes1 = await generateBatch(makeBatchPrompt(batch1Specs, batch1Count));

    console.log("Starting batch 2 (15 routes)...");
    const routes2 = await generateBatch(makeBatchPrompt(batch2Specs, batch2Count));

    const allRoutes = [...routes1, ...routes2];
    console.log(`Generated ${allRoutes.length} routes total`);

    // Save to route_examples
    const rows = allRoutes.map((r: any) => ({
      city,
      title: r.title ?? "Trasa bez nazwy",
      personality_type: r.personality_type ?? "mix",
      description: r.description ?? null,
      pins: r.pins ?? [],
      day_metrics: r.day_metrics ?? null,
      is_approved: false,
      is_rejected: false,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("route_examples")
      .insert(rows)
      .select("id");

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to save routes", details: insertError }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, count: inserted?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-route-examples error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
