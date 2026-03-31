import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];

const SYSTEM_PROMPT = `Jesteś TRASA — ciepła asystentka podróżnicza wbudowana w aplikację do planowania podróży.

Gdy użytkownik pyta o konkretne miejsca (bar, restauracja, muzeum, klub, kawiarnia itp.):
- Zaproponuj 1–2 konkretne, dopasowane miejsca
- Napisz krótką (1–2 zdania) odpowiedź tekstową
- Na końcu dodaj blok JSON z miejscami:

<places>
[
  {
    "name": "Nazwa miejsca",
    "address": "Ulica, Miasto",
    "description": "Krótki opis (1 zdanie)",
    "category": "bar"
  }
]
</places>

Kategorie (użyj jednej): restaurant, cafe, museum, bar, nightlife, monument, walk, park, shopping, church, gallery, market

Gdy użytkownik pyta o stworzenie pełnego planu podróży (np. "zaplanuj mi 3 dni") → odpowiedz krótko i zasugeruj kliknięcie "Dodaj plan podróży".

Odpowiadaj po polsku (chyba że user pisze po angielsku). Bądź ciepła, konkretna, max 3 zdania.`;

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
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Rate limiting: 30 calls/hour per user ──
    {
      const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: rl } = await supabase
        .from("rate_limits")
        .select("count, window_start")
        .eq("user_id", user.id)
        .eq("endpoint", "orb-chat")
        .single();

      if (rl && rl.window_start > windowStart && rl.count >= 30) {
        return new Response(
          JSON.stringify({ error: "Przekroczyłeś limit 30 wiadomości na godzinę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newCount = (!rl || rl.window_start <= windowStart) ? 1 : rl.count + 1;
      await supabase.from("rate_limits").upsert({
        user_id: user.id,
        endpoint: "orb-chat",
        count: newCount,
        window_start: (!rl || rl.window_start <= windowStart) ? new Date().toISOString() : rl.window_start,
      });
    }

    const { message, messages = [], city } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message required" }),
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

    const cityContext = city ? `\nAktywna trasa: ${city}.` : "";
    const systemWithCity = SYSTEM_PROMPT + cityContext;

    const aiMessages = [
      { role: "system", content: systemWithCity },
      ...messages,
      { role: "user", content: message },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", errText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "";

    // Parse places block
    let places = null;
    const placesMatch = raw.match(/<places>([\s\S]*?)<\/places>/);
    if (placesMatch) {
      try {
        const cleaned = placesMatch[1].replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
        places = JSON.parse(cleaned);
      } catch {
        // ignore parse errors
      }
    }

    const cleanMessage = raw.replace(/<places>[\s\S]*?<\/places>/, "").trim();

    return new Response(
      JSON.stringify({ message: cleanMessage, places }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("orb-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
