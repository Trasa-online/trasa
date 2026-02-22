import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TripPreferences {
  numDays: number;
  pace: string;
  priorities: string[];
  startDate: string | null;
  planningMode: string;
}

function buildSystemPrompt(preferences: TripPreferences, currentPlan?: any): string {
  const dateInfo = preferences.startDate
    ? `- Data podróży: ${preferences.startDate}`
    : "";

  const currentPlanContext = currentPlan
    ? `\n\n## AKTUALNY PLAN (do edycji)\n${JSON.stringify(currentPlan, null, 2)}`
    : "";

  return `Jesteś planistą podróży w aplikacji TRASA.
User chce zaplanować podróż. Oto jego preferencje:
- Liczba dni: ${preferences.numDays}
- Tempo: ${preferences.pace === "active" ? "aktywne (dużo zwiedzania)" : preferences.pace === "calm" ? "spokojne (mniej miejsc, więcej czasu)" : "mieszane"}
- Priorytety: ${preferences.priorities.length > 0 ? preferences.priorities.join(", ") : "brak konkretnych"}
${dateInfo}
${currentPlanContext}

## FAZY ROZMOWY (max 3 wymiany przed generowaniem planu)

### Faza 1 — DESTYNACJA + KONTEKST
Zapytaj dokąd jedzie i czy ma już jakieś plany (nocleg, konkretne miejsca do odwiedzenia).
Bądź ciepły i przyjazny. Jedno pytanie.

### Faza 2 — DOPRECYZOWANIE
Na podstawie priorytetów i odpowiedzi dopytaj o szczegóły.
Np. jaki typ kuchni preferuje, czy chce muzea, jak daleko od centrum.
Jeśli user dał wystarczająco info w fazie 1, przeskocz do generowania.

### Faza 3 — GENEROWANIE PLANU
Wygeneruj plan dnia/dni z prawdziwymi miejscami.
Każde miejsce MUSI zawierać prawdziwą nazwę i adres.

## EDYCJA PLANU
Gdy user prosi o zmianę:
- "Zamień X na coś innego" → zaproponuj alternatywę
- "Dodaj Y" → wstaw w optymalne miejsce
- "Usuń Z" → usuń i zaproponuj zamiennik
- Max 3 edycje per dzień

## FORMAT ODPOWIEDZI Z PLANEM
Gdy generujesz lub aktualizujesz plan, napisz KRÓTKI komentarz (1-2 zdania), a PO NIM dodaj blok:

<route_plan>
{
  "city": "Nazwa miasta",
  "days": [
    {
      "day_number": 1,
      "pins": [
        {
          "place_name": "Prawdziwa nazwa miejsca",
          "address": "Pełny adres",
          "description": "1 zdanie dlaczego warto",
          "suggested_time": "10:00",
          "category": "museum",
          "latitude": 52.2479,
          "longitude": 21.0147
        }
      ]
    }
  ]
}
</route_plan>

## ZASADY
- Po polsku, naturalnie, krótko (2-3 zdania max na wiadomość przed planem)
- Używaj PRAWDZIWYCH miejsc z prawdziwymi adresami i koordynatami
- category może być: restaurant, cafe, museum, park, viewpoint, shopping, nightlife, monument, church, market, bar, gallery
- Dla tempo "active": 6-8 miejsc/dzień
- Dla tempo "calm": 3-5 miejsc/dzień  
- Dla tempo "mixed": 5-6 miejsc/dzień
- Uwzględniaj logiczną kolejność (bliskość geograficzna, pory posiłków)
- suggested_time powinien być realistyczny (nie 2 muzea pod rząd)
- PIERWSZĄ wiadomość zacznij od ciepłego powitania i od razu pytanie o destynację`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { preferences, messages: userMessages, current_plan } = await req.json();

    if (!preferences || !userMessages) {
      return new Response(
        JSON.stringify({ error: "preferences and messages required" }),
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

    const systemPrompt = buildSystemPrompt(preferences, current_plan);

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...userMessages,
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
        max_tokens: 4096,
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
    const assistantText = aiData.choices?.[0]?.message?.content ?? "";

    if (!assistantText) {
      return new Response(
        JSON.stringify({ error: "Empty AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for route plan
    const planMatch = assistantText.match(
      /<route_plan>([\s\S]*?)<\/route_plan>/
    );

    let plan = null;
    let cleanMessage = assistantText;

    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1]);
        cleanMessage = assistantText
          .replace(/<route_plan>[\s\S]*?<\/route_plan>/, "")
          .trim();
      } catch (parseErr) {
        console.error("Failed to parse route_plan:", parseErr);
        // Remove the broken plan block from the message anyway
        cleanMessage = assistantText
          .replace(/<route_plan>[\s\S]*?<\/route_plan>/, "")
          .trim();
      }
    } else if (assistantText.includes("<route_plan>")) {
      // Truncated response - plan started but closing tag missing
      console.warn("Truncated route_plan detected, attempting to fix...");
      const startIdx = assistantText.indexOf("<route_plan>");
      const jsonPart = assistantText.slice(startIdx + "<route_plan>".length).trim();
      cleanMessage = assistantText.slice(0, startIdx).trim();

      // Try to fix truncated JSON by closing open brackets
      try {
        let fixedJson = jsonPart
          .replace(/<\/route_plan>.*$/, "")
          .trim();
        // Count unclosed brackets and close them
        const openBraces = (fixedJson.match(/{/g) || []).length;
        const closeBraces = (fixedJson.match(/}/g) || []).length;
        const openBrackets = (fixedJson.match(/\[/g) || []).length;
        const closeBrackets = (fixedJson.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets - closeBrackets; i++) fixedJson += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) fixedJson += "}";
        plan = JSON.parse(fixedJson);
      } catch (fixErr) {
        console.error("Could not fix truncated plan:", fixErr);
        cleanMessage = cleanMessage || "Przepraszam, plan był zbyt długi. Spróbuję ponownie z krótszym planem.";
      }
    }

    return new Response(
      JSON.stringify({ message: cleanMessage, plan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("plan-route error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
