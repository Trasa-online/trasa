import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://trasa.travel", "https://trasa.lovable.app", "http://localhost:8080", "http://localhost:5173"];

function buildSystemPrompt(pinsContext: string, city: string): string {
  return `Jesteś TRASA — asystentką podróżniczą. Użytkowniczka chce zmodyfikować swój plan dnia w mieście ${city || "Kraków"}.

## AKTUALNY PLAN
${pinsContext}

## TWOJE ZADANIE
Zrozum co chce zmienić i wyślij NOWY kompletny plan w bloku <plan_edit>.

## ZASADY
- Możesz dodać, usunąć lub przestawić miejsca
- Przy dodawaniu nowych miejsc w Krakowie podaj realistyczne współrzędne GPS
- Zachowaj "pin_id" dla miejsc które mają pozostać
- Gdy zrozumiesz prośbę, wyślij od razu <plan_edit> — nie pytaj o potwierdzenie
- Jeśli prośba jest niejasna, zadaj JEDNO krótkie pytanie doprecyzowujące

## FORMAT ODPOWIEDZI
Napisz 1–2 zdania komentarza, a po nich (gdy masz pewność):

<plan_edit>
{
  "pins": [
    { "pin_id": "id-istniejącego-pinu", "place_name": "...", "address": "...", "latitude": 50.06, "longitude": 19.94 },
    { "pin_id": null, "place_name": "nowe miejsce", "address": "...", "latitude": 50.06, "longitude": 19.94 }
  ]
}
</plan_edit>

Pomiń "pin_id" (lub ustaw null) dla NOWYCH miejsc.
Nie umieszczaj pinu w liście jeśli ma być USUNIĘTY.`;
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
      return new Response(JSON.stringify({ error: "route_id and messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load route + pins
    const { data: route } = await supabase
      .from("routes")
      .select("id, title, city, day_number")
      .eq("id", route_id)
      .single();

    const { data: pins } = await supabase
      .from("pins")
      .select("id, place_name, address, latitude, longitude, pin_order, suggested_time")
      .eq("route_id", route_id)
      .order("pin_order");

    if (!pins?.length) {
      return new Response(JSON.stringify({ error: "No pins found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pinsContext = pins.map((p: any, i: number) => {
      let line = `${i + 1}. ${p.place_name} [pin_id: ${p.id}]`;
      if (p.address) line += ` — ${p.address}`;
      if (p.suggested_time) line += ` (${p.suggested_time})`;
      return line;
    }).join("\n");

    const systemPrompt = buildSystemPrompt(pinsContext, route?.city ?? "");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        max_tokens: 2000,
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const assistantText = aiData.choices?.[0]?.message?.content ?? "";

    if (!assistantText) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for plan_edit block
    const editMatch = assistantText.match(/<plan_edit>([\s\S]*?)<\/plan_edit>/);
    if (editMatch) {
      try {
        const editData = JSON.parse(editMatch[1]);
        const newPins: any[] = editData.pins ?? [];

        // Apply changes
        const currentPinIds = new Set(pins.map((p: any) => p.id));
        const keptPinIds = new Set(newPins.map((p: any) => p.pin_id).filter(Boolean));

        // Delete removed pins
        const toDelete = [...currentPinIds].filter(id => !keptPinIds.has(id));
        if (toDelete.length > 0) {
          await supabase.from("pins").delete().in("id", toDelete);
        }

        // Upsert pins in new order
        for (let i = 0; i < newPins.length; i++) {
          const np = newPins[i];
          const newOrder = i + 1;
          if (np.pin_id && currentPinIds.has(np.pin_id)) {
            // Update existing pin order
            await supabase.from("pins").update({ pin_order: newOrder }).eq("id", np.pin_id);
          } else {
            // Insert new pin
            await supabase.from("pins").insert({
              route_id,
              place_name: np.place_name,
              address: np.address ?? null,
              latitude: np.latitude ?? null,
              longitude: np.longitude ?? null,
              pin_order: newOrder,
              was_spontaneous: false,
            });
          }
        }

        const cleanMessage = assistantText
          .replace(/<plan_edit>[\s\S]*?<\/plan_edit>/, "")
          .trim();

        return new Response(JSON.stringify({ done: true, message: cleanMessage, applied: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (parseErr) {
        console.error("Failed to parse plan_edit:", parseErr);
      }
    }

    // Conversation continues
    return new Response(JSON.stringify({ done: false, message: assistantText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("edit-plan error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
