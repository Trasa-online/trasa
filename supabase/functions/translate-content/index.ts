import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tlumaczenie krotkich tresci biznesowych (tytul wydarzenia, opis) PL->EN dla wizytowki
// widzianej przez zagranicznych podroznikow. CZYSTA funkcja: zwraca tlumaczenie, NIE pisze
// do DB - klient zapisuje wynik przez normalny update (RLS). Dzieki temu reuzywalna dla
// dowolnego pola i przyszlej kolejki wydarzen. Silnik: Claude Haiku przez Lovable AI Gateway
// (ta sama infra co translate-place, LOVABLE_API_KEY juz skonfigurowany).

const ALLOWED_ORIGINS = ["https://spontaway.com", "https://spontaway.com", "https://trasa.lovable.app", "http://localhost:8080", "http://localhost:5173", "capacitor://localhost", "https://localhost", "http://localhost"];

// Model przez Lovable AI Gateway. google/gemini-2.5-flash jest sprawdzony (uzywa go
// translate-place). Claude przez gateway bywa niedostepny -> "nie udalo sie przetlumaczyc".
const MODEL = "google/gemini-2.5-flash";
const MAX_INPUT_CHARS = 2000;

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
    const { text, target_lang = "en", context } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Missing 'text'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (text.length > MAX_INPUT_CHARS) {
      return new Response(JSON.stringify({ error: "Text too long" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auth: wymagamy zalogowanego usera (dowolnego) - zeby funkcja nie byla otwartym
    // proxy do AI (koszt). Bez zapisu do DB, wiec bez sprawdzania ownership.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const langName = target_lang === "en" ? "English" : target_lang;
    const contextHint = context === "event_title"
      ? " This is a short promo/event title for a venue (max ~40 chars). Keep it punchy and short."
      : context === "description"
      ? " This is a venue description shown to travelers. Keep the tone and marketing feel."
      : "";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: `You are a professional translator for a travel app. Translate the user's text to natural, fluent ${langName}. Do not transliterate proper nouns/venue names - keep them as-is. Return ONLY the translation via the tool, no notes.` },
          { role: "user", content: `Translate to ${langName}.${contextHint}\n\nText:\n${text}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_translation",
            description: "Save the translated text",
            parameters: { type: "object", properties: { translation: { type: "string", description: `The ${langName} translation` } }, required: ["translation"] },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_translation" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[translate-content] AI Gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI translation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    let translation = "";
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const args = toolCalls[0].function?.arguments;
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      translation = parsed?.translation ?? "";
    }
    if (!translation) {
      // Fallback: plain content
      translation = (aiData.choices?.[0]?.message?.content ?? "").trim();
    }
    if (!translation) {
      return new Response(JSON.stringify({ error: "Empty translation" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, translation }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[translate-content] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
