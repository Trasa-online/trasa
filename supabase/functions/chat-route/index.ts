import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];

function buildSystemPrompt(pinsContext: string, pinCount: number, hasNextDay: boolean): string {
  return `Jesteś TRASA — ciepłą asystentką podróżniczą, która po dniu w mieście przeprowadza krótki debrief.
Twój cel: zadać DOKŁADNIE 3 pytania (po kolei), zebrać odpowiedzi i wygenerować podsumowanie.

## ZAPLANOWANE MIEJSCA (${pinCount} miejsc)
${pinsContext}

## TRZY PYTANIA — zadawaj je PO KOLEI, jedno na wiadomość

### PYTANIE 1 (pierwsze — zacznij od niego)
Zapytaj: "Czy Twój dzień przebiegł zgodnie z planem?"
- Jeśli user odpowie NIE lub częściowo → dopytaj: "Co się zmieniło?"
- Jeśli user odpowie TAK → przejdź do pytania 2.

### PYTANIE 2 (po odpowiedzi na pytanie 1)
Zapytaj: "Czy taki plan dnia miał według Ciebie sens?"
- Jeśli user odpowie NIE lub wyraża wątpliwości → dopytaj: "Dlaczego? Co było nie tak?"
- Jeśli user odpowie TAK → przejdź do pytania 3.

### PYTANIE 3 (po odpowiedzi na pytanie 2)
Zapytaj: "Czy jest coś, czego mam unikać przy planowaniu Twoich podróży w przyszłości?"
- Po otrzymaniu odpowiedzi → zakończ rozmowę i wygeneruj podsumowanie.

## ZASADY PROWADZENIA

1. **Jedno pytanie na raz.** Nigdy nie zadawaj dwóch pytań w jednej wiadomości.
2. **Krótko.** Max 2–3 zdania na wiadomość. Reaguj naturalnie: "Rozumiem", "Dobra, zapamiętam"...
3. **Po zebraniu odpowiedzi na wszystkie 3 pytania** — zakończ rozmowę i wygeneruj podsumowanie.
4. **Zamykasz** naturalnie: "Dzięki! Zapamiętam to na następny raz."

## ZAKOŃCZENIE
Po 3 wymianach (lub wcześniej) wygeneruj podsumowanie.
Napisz krótką wiadomość zamykającą (1–2 zdania), a PO NIEJ dodaj blok:

<route_summary>
{
  "city": "...",
  "intent": {
    "day_type": "romantic_slow",
    "group": "couple",
    "pace": "slow",
    "mood": "relax"
  },
  "pins": [
    {
      "place_name": "...",
      "planned_order": 1,
      "realized_order": 1,
      "was_spontaneous": false,
      "was_skipped": false,
      "skip_reason": null,
      "sequence_rating": "perfect_after_previous",
      "sequence_note": "...",
      "sentiment": "positive",
      "experience_note": "...",
      "tags": ["tag1", "tag2"],
      "time_spent": "2h"
    }
  ],
  "deviations": [
    { "type": "plan_b", "description": "...", "trigger": "crowd" }
  ],
  "considerations": [
    { "place_name": "...", "rejection_reason": "..." }
  ],
  "weather_impact": null,
  "highlight": "...",
  "tip": "...",
  "summary_text": "Romantyczny dzień: Wawel → kawa → Kazimierz"
}
</route_summary>

WAŻNE: Każdy pin z listy usera MUSI pojawić się w tablicy "pins" w summary.
Jeśli user wspomni nowe miejsca (spontaniczne), dodaj je też z was_spontaneous=true.
sequence_rating może być: "good_start", "perfect_after_previous", "too_early", "too_late", "ideal_ending", "wrong_order", "neutral".
sentiment może być: "positive", "neutral", "negative".
deviation type może być: "order_change", "place_added", "place_skipped", "time_shift", "plan_b".
deviation trigger może być: "crowd", "weather", "fatigue", "mood", "time", "spontaneous".`;
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
    const { route_id, messages: userMessages } = await req.json();

    if (!route_id || !userMessages) {
      return new Response(
        JSON.stringify({ error: "route_id and messages required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth
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

    // Load route + pins
    const { data: route } = await supabase
      .from("routes")
      .select("id, title, day_number, folder_id")
      .eq("id", route_id)
      .single();

    if (!route) {
      return new Response(
        JSON.stringify({ error: "Route not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: pins } = await supabase
      .from("pins")
      .select("id, place_name, address, pin_order, place_type, place_id, was_skipped, skip_reason, category, suggested_time")
      .eq("route_id", route_id)
      .order("pin_order");

    if (!pins?.length) {
      return new Response(
        JSON.stringify({ error: "No pins found for this route" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context
    const pinsContext = pins
      .map((p: any, i: number) => {
        let line = `${i + 1}. ${p.place_name} (${p.address || "brak adresu"})`;
        if (p.suggested_time) line += ` [${p.suggested_time}]`;
        if (p.category) line += ` [${p.category}]`;
        if (p.was_skipped) line += ` [POMINIĘTY]`;
        return line;
      })
      .join("\n");

    // Check if user has a next day planned in the same trip folder
    let hasNextDay = false;
    if (route.folder_id && route.day_number) {
      const { data: nextRoutes } = await supabase
        .from("routes")
        .select("id")
        .eq("folder_id", route.folder_id)
        .gt("day_number", route.day_number)
        .limit(1);
      hasNextDay = (nextRoutes?.length ?? 0) > 0;
    }

    const MAX_MESSAGES = 9; // 3 questions + potential follow-ups + AI responses + initial greeting

    const systemPrompt = buildSystemPrompt(pinsContext, pins.length, hasNextDay);

    // Call AI via Google Gemini API
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If message limit reached, force summary generation
    const forceFinish = userMessages.length >= MAX_MESSAGES;
    const finishInstruction = forceFinish
      ? "\n\nUWAGA: Osiągnięto limit wiadomości. Wygeneruj TERAZ podsumowanie w bloku <route_summary>...</route_summary> na podstawie zebranych informacji."
      : "";

    // Convert to native Gemini format
    const geminiContents = userMessages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const geminiRequestBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt + finishInstruction }] },
      contents: geminiContents,
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    });

    const callGemini = async (model: string) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: geminiRequestBody,
      });

    let aiResponse = await callGemini("gemini-2.5-flash");
    if (!aiResponse.ok) {
      console.warn("gemini-2.5-flash failed, falling back to gemini-2.5-pro");
      aiResponse = await callGemini("gemini-2.5-pro");
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(
        JSON.stringify({ error: `AI error ${aiResponse.status}: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const assistantText = aiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Fallback for empty response (safety filter, token limit, etc.)
    const safeText = assistantText || "Dziękuję za rozmowę! Zapisuję podsumowanie Twojego dnia.";

    // Strip <route_summary> block — handles both closed and unclosed tags (truncated responses)
    const cleanMessage = safeText
      .replace(/<route_summary>[\s\S]*?<\/route_summary>/g, "")
      .replace(/<route_summary>[\s\S]*/g, "")
      .trim() || "Dziękuję! Zapisuję podsumowanie Twojego dnia.";

    // Check if conversation complete — try closed tag first, then extract partial JSON
    const closedMatch = safeText.match(/<route_summary>([\s\S]*?)<\/route_summary>/);
    const openMatch = !closedMatch ? safeText.match(/<route_summary>([\s\S]*)$/) : null;
    const summaryMatch = closedMatch || openMatch;

    if (summaryMatch) {
      try {
        // Clean JSON: remove markdown code blocks if present
        const rawJson = summaryMatch[1]
          .replace(/```(?:json)?\s*/gi, "")
          .replace(/```/g, "")
          .trim();
        const summary = JSON.parse(rawJson);

        // Save to DB
        await saveToDatabase(supabase, route_id, user.id, summary, pins, userMessages, safeText);

        return new Response(
          JSON.stringify({ done: true, message: cleanMessage, summary }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (parseErr) {
        console.error("Failed to parse route_summary:", parseErr);
        // Fall through with clean message (no raw JSON shown to user)
      }
    }

    // Conversation continues — save progress
    const allMessages = [
      ...userMessages,
      { role: "assistant", content: safeText },
    ];

    await supabase.from("chat_sessions").upsert(
      {
        route_id,
        user_id: user.id,
        messages: allMessages,
        current_phase: Math.min(userMessages.filter((m: any) => m.role === "user").length + 1, 7),
      },
      { onConflict: "route_id" }
    );

    // Update route status
    await supabase
      .from("routes")
      .update({ chat_status: "started" })
      .eq("id", route_id)
      .eq("chat_status", "none");

    return new Response(
      JSON.stringify({ done: false, message: cleanMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("chat-route error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function saveToDatabase(
  supabase: any,
  routeId: string,
  userId: string,
  summary: any,
  pins: any[],
  messages: any[],
  lastAssistant: string
) {
  // 1. Update route
  await supabase.from("routes").update({
    chat_status: "completed",
    status: "completed",
    city: summary.city ?? null,
    intent: summary.intent ?? null,
    ai_summary: summary.summary_text ?? null,
    ai_highlight: summary.highlight ?? null,
    ai_tip: summary.tip ?? null,
    weather_impact: summary.weather_impact ?? null,
  }).eq("id", routeId);

  // 2. Update pins with behavioral data
  if (summary.pins?.length) {
    for (const sp of summary.pins) {
      const matchedPin = pins.find(
        (p: any) => p.place_name.toLowerCase().trim() === sp.place_name.toLowerCase().trim()
      );
      if (!matchedPin) continue;

      await supabase.from("pins").update({
        planned_order: sp.planned_order ?? null,
        realized_order: sp.realized_order ?? null,
        was_spontaneous: sp.was_spontaneous ?? false,
        was_skipped: sp.was_skipped ?? false,
        skip_reason: sp.skip_reason ?? null,
        sequence_rating: sp.sequence_rating ?? null,
        sequence_note: sp.sequence_note ?? null,
        sentiment: sp.sentiment ?? null,
        experience_note: sp.experience_note ?? null,
        time_spent: sp.time_spent ?? null,
        selected_tags: sp.tags ?? [],
      }).eq("id", matchedPin.id);
    }
  }

  // 3. Insert deviations (delete first to avoid duplicates on retry)
  await supabase.from("day_deviations").delete().eq("route_id", routeId);
  if (summary.deviations?.length) {
    await supabase.from("day_deviations").insert(
      summary.deviations.map((d: any) => ({
        route_id: routeId,
        deviation_type: d.type,
        description: d.description ?? null,
        trigger: d.trigger ?? null,
      }))
    );
  }

  // 4. Insert considerations (delete first to avoid duplicates on retry)
  await supabase.from("day_considerations").delete().eq("route_id", routeId);
  if (summary.considerations?.length) {
    await supabase.from("day_considerations").insert(
      summary.considerations.map((c: any) => ({
        route_id: routeId,
        place_name: c.place_name,
        rejection_reason: c.rejection_reason ?? null,
      }))
    );
  }

  // 5. Save chat log
  await supabase.from("chat_sessions").upsert(
    {
      route_id: routeId,
      user_id: userId,
      messages: [...messages, { role: "assistant", content: lastAssistant }],
      current_phase: 7,
      ai_extracted: summary,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "route_id" }
  );

  // 6. Extract user insights for personalization
  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (GEMINI_API_KEY) {
      const insightsPrompt = `Na podstawie poniższego podsumowania dnia podróży wyekstrahuj 3-5 wniosków o preferencjach i stylu podróżowania usera.
Zwróć TYLKO valid JSON array, bez markdown, bez opisu. Każdy element: {"category": "...", "insight": "..."}.
Kategorie (użyj jednej): pace, food, interests, avoid, preferences.
Przykłady: {"category":"pace","insight":"Preferuje spokojne tempo, max 4 miejsca dziennie"}, {"category":"avoid","insight":"Unika zatłoczonych turystycznych restauracji"}.

Dane wejściowe:
${JSON.stringify({ city: summary.city, intent: summary.intent, highlight: summary.highlight, tip: summary.tip, deviations: summary.deviations, pins: summary.pins?.map((p: any) => ({ name: p.place_name, sentiment: p.sentiment, was_skipped: p.was_skipped, skip_reason: p.skip_reason })) })}`;

      const insightsResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: insightsPrompt }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
          }),
        }
      );

      if (insightsResp.ok) {
        const insightsData = await insightsResp.json();
        const raw = insightsData.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
        const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
        const insights = JSON.parse(cleaned);
        if (Array.isArray(insights) && insights.length) {
          await supabase.from("user_insights").delete().eq("source_route_id", routeId);
          await supabase.from("user_insights").insert(
            insights.map((ins: any) => ({
              user_id: userId,
              category: ins.category ?? "preferences",
              insight: ins.insight,
              source_route_id: routeId,
            }))
          );
        }
      }
    }
  } catch (err) {
    console.error("user_insights extraction failed (non-critical):", err);
  }
}
