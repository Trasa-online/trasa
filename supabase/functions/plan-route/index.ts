import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];

interface TripPreferences {
  numDays: number;
  pace: string;
  priorities: string[];
  startDate: string | null;
  planningMode: string;
  city?: string;
}

interface UserProfile {
  dietary_prefs?: string[];
  travel_interests?: string[];
}

const DIETARY_LABEL: Record<string, string> = {
  vege: "wegetarianin",
  vegan: "vegan",
  coffee: "coffee snob (zależy mu na jakości kawy)",
  local_food: "preferuje kuchnię lokalną",
  street_food: "lubi street food",
  fine_dining: "ceni fine dining",
  lactose_free: "bez laktozy",
  gluten_free: "bezglutenowo",
};

const INTERESTS_LABEL: Record<string, string> = {
  history: "historia i zabytki",
  art: "sztuka i kultura",
  nature: "natura i parki",
  shopping: "zakupy",
  nightlife: "nocne życie",
  photography: "fotografia",
  architecture: "architektura",
  music: "muzyka",
  intensive: "styl intensywny (chce zobaczyć jak najwięcej)",
  relaxed: "styl spokojny (woli nie spieszyć się)",
  family: "podróżuje z rodziną",
  romantic: "wycieczka romantyczna",
  budget: "ograniczony budżet",
  luxury: "lubi luksusowe miejsca",
};

function buildSystemPrompt(preferences: TripPreferences, currentPlan?: any, userProfile?: UserProfile): string {
  const dateInfo = preferences.startDate
    ? `- Data podróży: ${preferences.startDate}`
    : "";

  const cityInfo = preferences.city?.trim()
    ? `- Destynacja: ${preferences.city.trim()}`
    : "";

  const currentPlanContext = currentPlan
    ? `\n\n## AKTUALNY PLAN (do edycji)\n${JSON.stringify(currentPlan, null, 2)}`
    : "";

  const dietaryLabels = (userProfile?.dietary_prefs ?? [])
    .map(k => DIETARY_LABEL[k] ?? k).filter(Boolean);
  const interestLabels = (userProfile?.travel_interests ?? [])
    .map(k => INTERESTS_LABEL[k] ?? k).filter(Boolean);

  const userProfileContext = (dietaryLabels.length > 0 || interestLabels.length > 0)
    ? `\n## PROFIL UŻYTKOWNIKA\n${dietaryLabels.length > 0 ? `- Dieta/jedzenie: ${dietaryLabels.join(", ")}\n` : ""}${interestLabels.length > 0 ? `- Zainteresowania i styl: ${interestLabels.join(", ")}\n` : ""}Uwzględnij te preferencje przy doborze miejsc, restauracji i kolejności trasy.`
    : "";

  const cityKnown = !!preferences.city?.trim();
  const cityName = preferences.city?.trim() ?? "";

  // Build a human-readable summary of what the user already filled in
  const paceLabel = preferences.pace === "active" ? "aktywne" : preferences.pace === "calm" ? "spokojne" : "mieszane";

  const PRIORITY_LABEL_PL: Record<string, string> = {
    good_food: "dobre jedzenie", nice_views: "ładne widoki", long_walks: "długie spacery",
    museums: "muzea i kultura", nightlife: "życie nocne", shopping: "zakupy",
    local_vibes: "lokalne klimaty", photography: "fotografia",
  };
  const prioritiesPL = preferences.priorities.length > 0
    ? preferences.priorities.map(p => PRIORITY_LABEL_PL[p] ?? p).join(", ")
    : null;

  const summaryParts = [
    `${preferences.numDays} ${preferences.numDays === 1 ? "dzień" : "dni"}`,
    `tempo: ${paceLabel}`,
    ...(prioritiesPL ? [`priorytety: ${prioritiesPL}`] : []),
    ...(preferences.startDate ? [`data: ${preferences.startDate}`] : []),
  ];
  const preferenceSummary = summaryParts.join(", ");

  return `Jesteś planistą podróży w aplikacji TRASA.

## PREFERENCJE USERA (wypełnione przed rozmową)
- Liczba dni: ${preferences.numDays}
- Tempo: ${preferences.pace === "active" ? "aktywne (dużo zwiedzania)" : preferences.pace === "calm" ? "spokojne (mniej miejsc, więcej czasu)" : "mieszane"}
- Priorytety: ${prioritiesPL ?? "brak konkretnych"}
${dateInfo}
${cityInfo}
${userProfileContext}
${currentPlanContext}
${cityKnown ? `\n## ⚠️ KLUCZOWA ZASADA\nUser WPISAŁ już destynację: „${cityName}". ABSOLUTNIE NIE pytaj o to gdzie jedzie — już to wiesz. Zacznij od potwierdzenia tej destynacji.\n` : ""}
## STYL ODPOWIEDZI
- Pisz krótko i naturalnie — jak znajomy, nie jak asystent.
- Rozdzielaj myśli na OSOBNE AKAPITY (oddzielone pustą linią \\n\\n). Każdy akapit = 1-2 zdania.
- Nigdy nie pisz długich bloków tekstu bez przerw.

## FAZY ROZMOWY (max 3 wymiany przed generowaniem planu)

### Faza 1 — START
${cityKnown
  ? `Miasto jest już znane (${cityName}) — pierwsze powitanie zostało już wysłane przez system. Jesteś teraz w trakcie rozmowy. Odpowiadaj na pytania usera i zmierzaj do generowania planu.`
  : `Zadaj TYLKO te pytania w jednej krótkiej, przyjaznej wiadomości:
1. Gdzie jedziesz? (miasto / miejsce)
2. O której chcesz zacząć swoją podróż?
${preferences.numDays > 1 ? "3. W której części miasta masz nocleg? (wpłynie na planowanie końca każdego dnia)" : "NIE pytaj o nocleg — to jednodniowa wycieczka."}
Wiadomość ma być krótka i przyjazna — max 2 zdania + pytania jako lista.`}
Nie pytaj o godzinę powrotu w tej fazie.

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

## ZASADY OGÓLNE
- Po polsku, naturalnie, krótko (2-3 zdania max na wiadomość przed planem)
- category może być: restaurant, cafe, museum, park, viewpoint, shopping, nightlife, monument, church, market, bar, gallery
- Dla tempo "active": 6-8 miejsc/dzień
- Dla tempo "calm": 3-5 miejsc/dzień
- Dla tempo "mixed": 5-6 miejsc/dzień
- Uwzględniaj logiczną kolejność (bliskość geograficzna, pory posiłków)
- Jeśli znasz godzinę przyjazdu i punkt wysiadania — zacznij trasę od tej okolicy o tej godzinie
- Jeśli znasz nocleg — uwzględnij jego lokalizację przy planowaniu końca dnia
- Jeśli znasz godzinę odjazdu — zakończ trasę w pobliżu punktu odjazdu z odpowiednim buforem
- suggested_time powinien być realistyczny (nie 2 muzea pod rząd)
- PIERWSZĄ wiadomość zacznij od krótkiego, ciepłego powitania (1 zdanie), a potem od razu lista pytań z Fazy 1 — ŻADNYCH długich wstępów

## ZASADY DOTYCZĄCE MIEJSC (KRYTYCZNE)
- Używaj WYŁĄCZNIE miejsc które możesz zweryfikować jako istniejące w Google Maps
- Koordynaty MUSZĄ być precyzyjne (min. 4 miejsca po przecinku) dla konkretnej lokalizacji
- Dla zabytków, muzeów, kościołów, parków, pomników: podaj dokładną oficjalną nazwę (np. "Muzeum Narodowe w Krakowie", nie "Muzeum Historyczne")
- Dla restauracji i kawiarni: używaj TYLKO lokali z rozpoznawalną, weryfikowalną nazwą (znana marka, wieloletni lokal z recenzjami). Jeśli nie jesteś w 100% pewien że lokal istnieje pod tą nazwą — NIE umieszczaj go w planie. Zamiast tego wpisz kategorię miejsca np. "Restauracja w Kazimierzu" i powiedz userowi że może sam wybrać
- NIE WYMYŚLAJ nazw restauracji, kawiarni ani sklepów — to jest najczęstszy błąd który psuje plan
- Jeśli nie znasz konkretnej restauracji w danej okolicy, napisz w polu place_name "Kolacja w [dzielnica]" lub "Lunch w pobliżu [landmark]" i w description zaproponuj typ kuchni`;
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

    const MAX_MESSAGES = 10;

    // ── Deterministic first message when city is already known ──
    // Skip AI entirely to guarantee no "where are you going?" question.
    if (userMessages.length === 0 && preferences.city?.trim()) {
      const cityName = preferences.city.trim();
      const nDays = Number(preferences.numDays) || 1;
      const paceLabel = preferences.pace === "active" ? "aktywnym" : preferences.pace === "calm" ? "spokojnym" : "mieszanym";

      const PRIORITY_LABEL_PL: Record<string, string> = {
        good_food: "dobre jedzenie", nice_views: "ładne widoki", long_walks: "długie spacery",
        museums: "muzea i kultura", nightlife: "życie nocne", shopping: "zakupy",
        local_vibes: "lokalne klimaty", photography: "fotografia",
      };
      const prioritiesPL = Array.isArray(preferences.priorities) && preferences.priorities.length > 0
        ? (preferences.priorities as string[]).map(p => PRIORITY_LABEL_PL[p] ?? p).join(", ")
        : null;

      const daysLabel = nDays === 1 ? "1 dzień" : `${nDays} dni`;
      const prefsLine = [
        `tempo: ${paceLabel}`,
        ...(prioritiesPL ? [`priorytety: ${prioritiesPL}`] : []),
      ].join(", ");

      const messageParts = [
        `Świetny wybór — ${cityName}!`,
        `Planujesz ${daysLabel}, ${prefsLine}. Wszystko mam — zacznijmy!`,
        nDays > 1
          ? `O której godzinie chcesz zacząć pierwszego dnia?\n\nI jeszcze — w której części miasta masz nocleg? To pomoże mi dobrze zaplanować końce kolejnych dni.`
          : `O której godzinie chcesz zacząć?`,
      ];

      return new Response(
        JSON.stringify({ message: messageParts.join("\n\n"), plan: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile preferences (non-blocking — columns may not exist in older DBs)
    let profileData: UserProfile | null = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("dietary_prefs, travel_interests")
        .eq("id", user.id)
        .single();
      profileData = data as UserProfile | null;
    } catch {
      // ignore — columns may not be migrated yet
    }

    const systemPrompt = buildSystemPrompt(preferences, current_plan, profileData ?? undefined);

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If message limit reached, force plan generation
    const forceFinish = userMessages.length >= MAX_MESSAGES;
    const finishInstruction = forceFinish
      ? "\n\nUWAGA: Osiągnięto limit wiadomości. Wygeneruj TERAZ plan w bloku <route_plan>...</route_plan> na podstawie zebranych informacji. Nie zadawaj więcej pytań."
      : "";

    const aiMessages = [
      { role: "system", content: systemPrompt + finishInstruction },
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
