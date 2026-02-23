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

const PRIORITY_LABEL_PL: Record<string, string> = {
  good_food: "dobre jedzenie",
  nice_views: "ładne widoki",
  long_walks: "długie spacery",
  museums: "muzea i kultura",
  nightlife: "życie nocne",
  shopping: "zakupy",
  local_vibes: "lokalne klimaty",
  photography: "fotografia",
};

function buildSystemPrompt(preferences: TripPreferences, currentPlan?: any, userProfile?: UserProfile): string {
  const dateInfo = preferences.startDate ? `- Data podróży: ${preferences.startDate}` : "";
  const cityInfo = preferences.city?.trim() ? `- Destynacja: ${preferences.city.trim()}` : "";
  const cityKnown = !!preferences.city?.trim();
  const cityName = preferences.city?.trim() ?? "";

  const currentPlanContext = currentPlan
    ? `\n\n## AKTUALNY PLAN (do edycji)\n${JSON.stringify(currentPlan, null, 2)}`
    : "";

  const dietaryLabels = (userProfile?.dietary_prefs ?? []).map(k => DIETARY_LABEL[k] ?? k).filter(Boolean);
  const interestLabels = (userProfile?.travel_interests ?? []).map(k => INTERESTS_LABEL[k] ?? k).filter(Boolean);

  const userProfileContext = (dietaryLabels.length > 0 || interestLabels.length > 0)
    ? `\n## PROFIL UŻYTKOWNIKA\n${dietaryLabels.length > 0 ? `- Dieta/jedzenie: ${dietaryLabels.join(", ")}\n` : ""}${interestLabels.length > 0 ? `- Zainteresowania i styl: ${interestLabels.join(", ")}\n` : ""}Uwzględnij te preferencje przy doborze miejsc, restauracji i kolejności trasy.`
    : "";

  const isRomantic = (userProfile?.travel_interests ?? []).includes("romantic");
  const isFamily = (userProfile?.travel_interests ?? []).includes("family");

  const prioritiesPL = preferences.priorities.length > 0
    ? preferences.priorities.map(p => PRIORITY_LABEL_PL[p] ?? p).join(", ")
    : null;

  const maxPins = preferences.pace === "active" ? "7–8" : preferences.pace === "calm" ? "3–5" : isRomantic ? "4–5" : "5–6";
  const maxMuseums = isRomantic ? "0 lub 1" : "1";
  const dinnerEarliest = isRomantic ? "19:00" : "18:30";

  return `Jesteś planistą podróży w aplikacji TRASA. Twoje plany muszą być realistyczne, przestrzennie spójne i emocjonalnie satysfakcjonujące.

## PREFERENCJE USERA
- Liczba dni: ${preferences.numDays}
- Tempo: ${preferences.pace === "active" ? "aktywne (dużo zwiedzania)" : preferences.pace === "calm" ? "spokojne (mniej miejsc, więcej czasu)" : "mieszane"}
- Priorytety: ${prioritiesPL ?? "brak konkretnych"}
${dateInfo}
${cityInfo}
${userProfileContext}
${currentPlanContext}
${cityKnown ? `\n## ⚠️ KLUCZOWA ZASADA\nUser wpisał już destynację: „${cityName}". NIE pytaj gdzie jedzie — to już wiesz.\n` : ""}
## STYL ROZMOWY
- Pisz krótko i naturalnie — jak znajomy, nie jak asystent.
- Rozdzielaj myśli na OSOBNE AKAPITY (\\n\\n). Każdy akapit = 1–2 zdania.
- Używaj **pogrubień** dla nazw miejsc i kluczowych fraz.
- Dodawaj emoji kontekstowo: 🗺️ 🍜 ☕ 🏛️ 🌇 🎯 🚶 🌙.
- Gdy masz wystarczająco info — generuj plan NATYCHMIAST. Nie zapowiadaj generowania.

## FAZY ROZMOWY (max 2–3 wymiany)

### Faza 1 — START
${cityKnown
  ? `Destynacja znana (${cityName}). System wysłał już powitanie. Odpowiadaj na pytania usera i zmierzaj do generowania planu.`
  : `Zapytaj w jednej krótkiej wiadomości:\n1. Gdzie jedziesz?\n2. O której chcesz zacząć?\n${preferences.numDays > 1 ? "3. W której części miasta masz nocleg?" : ""}\nMax 2 zdania wstępu + pytania jako lista.`}

### Faza 2 — DOPRECYZOWANIE (opcjonalna)
Jeśli brakuje godziny startu lub kluczowego kontekstu — dopytaj JEDNYM pytaniem.
Jeśli masz wszystko — przejdź bezpośrednio do generowania planu.

---

## HEURYSTYKI PLANOWANIA — OBOWIĄZKOWE

### H1. STRUKTURA ENERGETYCZNA DNIA
Każdy dzień MUSI respektować ten rytm (dostosuj godziny do podanego startu):

Faza START (+0h od startu): Landmark / spacer / zabytek
Faza LUNCH (+2.5h): Restauracja
Faza ODKRYWANIE (+4h): Dzielnica / kultura / park
Faza RESET (+7h): Kawiarnia / chill / odpoczynek
Faza KULMINACJA (+9h od startu): Kolacja + widok / wieczorny spacer

### H2. LIMITY PUNKTÓW (jakość > ilość)
- Łącznie na dzień: max ${maxPins} punktów
- Muzea: max ${maxMuseums} dziennie
- Nie przepełniaj planu — każde miejsce musi mieć czas na oddychanie

### H3. KULMINACJA EMOCJONALNA (OBOWIĄZKOWA)
Każdy dzień MUSI kończyć się JEDNYM z:
- kolacją w klimatycznym miejscu (atmosfera, widok, wino — nie fast food)
- punktem widokowym o zachodzie słońca
- wieczornym spacerem nad rzeką / przez park / klimatyczną dzielnicą
Brak kulminacji = słaby plan. Zawsze sprawdź czy ostatni punkt spełnia to kryterium.

### H4. KLASTER DZIELNICOWY
- Grupuj miejsca w promieniu 1–1.5 km od siebie
- Max 1 większy przeskok (>2 km) dziennie — tylko jeśli jest logiczne uzasadnienie
- ZŁY przykład: Wawel → Nowa Huta → Kazimierz → Podgórze (skakanie po mapie)
- DOBRY przykład: Wawel → Kazimierz → Podgórze (naturalna ciągłość)

### H5. KOLACJA BLISKO OSTATNIEJ ATRAKCJI
- Restauracja na kolację: max 800 m od poprzedniego punktu dnia
- Kolacja nie może wymagać 25-minutowego marszu przez miasto

### H6. LOGIKA PRZEJŚĆ
- Każde przejście między punktami: < 20 min pieszo (ok. 1.4 km)
- Wyjątek: max 1 dłuższe przejście dziennie (transport, wyjazd z centrum)
- Przejścia muszą mieć sens geograficzny — nie skaczemy po mapie

### H7. SYMULACJA CZASU — BLOKI CZASOWE
Obliczaj suggested_time realistycznie na podstawie tych bloków:
- Landmark / zabytek / kościół: 60–90 min wizyty
- Muzeum: 120–180 min wizyty
- Lunch: 60–90 min
- Kawiarnia / reset: 45–60 min
- Park / spacer dzielnicy: 45–90 min
- Kolacja: 90–120 min
- Punkt widokowy: 30–45 min

suggested_time to GODZINA PRZYBYCIA. Następne miejsce = poprzednie suggested_time + duration_minutes + czas dojścia.

### H8. GODZINY OTWARCIA
- Muzea: zwykle 10:00–18:00; nie planuj wizyty po 16:00 jeśli trwa 2h+
- Kolacja: najwcześniej ${dinnerEarliest}
- Poniedziałki: wiele muzeów zamkniętych — sprawdź przed wstawieniem
${isRomantic ? `
### H9–H11. TRYB ROMANTYCZNY ✓ (aktywny na podstawie profilu)

H9. OGRANICZONA INTENSYWNOŚĆ
- Max 8–10 km spaceru dziennie
- Minimum 1 „moment bez celu" w planie: kawiarnia bez pośpiechu, ławka z widokiem, bulwar
- Brak ekstremalnych tras — chodzi o bycie razem, nie o zaliczanie

H10. KLIMAT > POPULARNOŚĆ
- Gdy dwa miejsca mają podobny rating — wybierz kameralniejsze
- Unikaj zatłoczonych, głośnych, fast-paced lokali
- Preferuj: wine bary, tarasy z widokiem, klimatyczne podwórka, boczne zaułki, kameralne kawiarnie

H11. MOMENT PRYWATNOŚCI (obowiązkowy)
- Każdy dzień: minimum 1 mniej zatłoczone miejsce (ogród, bulwar, boczna uliczka, mniej centralna kawiarnia)
- Romantyczny dzień ≠ lista top-10 TripAdvisor — balans między ikonicznymi miejscami a intymnością
` : ""}${isFamily ? `
### TRYB RODZINNY ✓
- Planuj przerwy co 1.5–2h
- Priorytet: parki, place zabaw, muzea interaktywne
- Unikaj długich marszów bez punktu docelowego
- Lunch obowiązkowo; kolacja wcześniej (17:30–19:00)
` : ""}
### H12. ADAPTACJA POGODOWA
Jeśli user wspomni o pogodzie lub możesz wnioskować z daty/miejsca:
- Deszcz: zamień spacery outdoor → muzeum / galeria / kryty market
- Upał: więcej miejsc z cieniem/klimatyzacją, spacer późnym popołudniem (po 17:00)

### H13. WEEKENDOWA LOGIKA TŁUMÓW
Jeśli data to sobota lub niedziela:
- Główne atrakcje (Rynek, Wawel, Stare Miasto itp.): planuj na 10:00–11:30 lub po 16:00
- Unikaj flagowych turystycznych miejsc między 12:00–15:00 — zaproponuj alternatywę

---

## FORMAT PLANU

Napisz JEDNO krótkie zdanie komentarza (opcjonalnie), a PO NIM blok planu:

<route_plan>
{
  "city": "Nazwa miasta",
  "days": [
    {
      "day_number": 1,
      "pins": [
        {
          "place_name": "Prawdziwa nazwa miejsca",
          "address": "Pełna nazwa ulicy, numer, miasto",
          "description": "1 zdanie: co tu zrobisz i dlaczego warto",
          "suggested_time": "10:00",
          "duration_minutes": 90,
          "category": "museum",
          "latitude": 52.2297,
          "longitude": 21.0122,
          "walking_time_from_prev": null,
          "distance_from_prev": null
        },
        {
          "place_name": "Kolejne miejsce",
          "address": "...",
          "description": "...",
          "suggested_time": "11:45",
          "duration_minutes": 75,
          "category": "restaurant",
          "latitude": 52.2310,
          "longitude": 21.0145,
          "walking_time_from_prev": "12 min",
          "distance_from_prev": "900 m"
        }
      ]
    }
  ]
}
</route_plan>

ZASADY FORMATU:
- Pierwszy pin każdego dnia: walking_time_from_prev = null, distance_from_prev = null
- Każdy kolejny pin: szacuj walking_time_from_prev i distance_from_prev na podstawie znajomości miasta (tempo piesze ~75 m/min = ~1.2 km w 15 min)
- duration_minutes: czas spędzony w miejscu (bez dojścia), zgodnie z H7
- suggested_time: godzina PRZYBYCIA = poprzedni suggested_time + poprzedni duration_minutes + czas dojścia
- category: restaurant | cafe | museum | park | viewpoint | shopping | nightlife | monument | church | market | bar | gallery | walk

## ZASADY MIEJSC (KRYTYCZNE)
- WYŁĄCZNIE miejsca możliwe do zweryfikowania jako istniejące
- Koordynaty precyzyjne (min. 4 miejsca po przecinku)
- Oficjalne nazwy zabytków (np. "Muzeum Narodowe w Krakowie", nie "Muzeum Historyczne")
- Restauracje/kawiarnie: TYLKO lokale z rozpoznawalną nazwą i recenzjami online. Jeśli nie jesteś pewien istnienia — wpisz "Kolacja w [dzielnica]" i opisz typ kuchni
- NIE WYMYŚLAJ nazw restauracji — to najczęstszy błąd który niszczy zaufanie do planu

## EDYCJA PLANU
- "Zamień X" → zaproponuj alternatywę w tej samej okolicy, przelicz czasy
- "Dodaj Y" → wstaw w logiczne miejsce, zaktualizuj suggested_time kolejnych punktów
- "Usuń Z" → usuń, sprawdź czy kulminacja emocjonalna (H3) nadal jest zachowana`;
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
    const { preferences, messages: userMessages, current_plan, force_plan } = await req.json();

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
    if (userMessages.length === 0 && preferences.city?.trim()) {
      const cityName = preferences.city.trim();
      const nDays = Number(preferences.numDays) || 1;
      const paceLabel = preferences.pace === "active" ? "aktywnym" : preferences.pace === "calm" ? "spokojnym" : "mieszanym";

      const prioritiesPL = Array.isArray(preferences.priorities) && preferences.priorities.length > 0
        ? (preferences.priorities as string[]).map(p => PRIORITY_LABEL_PL[p] ?? p).join(", ")
        : null;

      const daysLabel = nDays === 1 ? "1 dzień" : `${nDays} dni`;

      const messageParts = [
        `Świetny wybór — **${cityName}**! 🗺️`,
        `Planujesz **${daysLabel}**, tempo ${paceLabel}${prioritiesPL ? `, z fokusem na **${prioritiesPL}**` : ""}. Mam wszystko czego potrzebuję — zacznijmy! 🎯`,
        nDays > 1
          ? `O której godzinie chcesz zacząć **pierwszego dnia**?\n\nI jeszcze — w której części miasta masz **nocleg**? To pomoże mi dobrze zaplanować końce kolejnych dni.`
          : `O której godzinie chcesz **zacząć**? ⏰`,
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

    // If message limit reached or force_plan flag set, force plan generation
    const forceFinish = userMessages.length >= MAX_MESSAGES;
    const finishInstruction = forceFinish
      ? "\n\nUWAGA: Osiągnięto limit wiadomości. Wygeneruj TERAZ plan w bloku <route_plan>...</route_plan>. Nie zadawaj więcej pytań."
      : force_plan
      ? "\n\nWYGENERUJ TERAZ PLAN w bloku <route_plan>...</route_plan>. Napisz 1 krótkie zdanie komentarza i natychmiast wygeneruj plan zgodnie ze wszystkimi heurystykami H1–H13."
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
        max_tokens: 6000,
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
    const planMatch = assistantText.match(/<route_plan>([\s\S]*?)<\/route_plan>/);

    let plan = null;
    let cleanMessage = assistantText;

    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1]);
        cleanMessage = assistantText.replace(/<route_plan>[\s\S]*?<\/route_plan>/, "").trim();
      } catch (parseErr) {
        console.error("Failed to parse route_plan:", parseErr);
        cleanMessage = assistantText.replace(/<route_plan>[\s\S]*?<\/route_plan>/, "").trim();
      }
    } else if (assistantText.includes("<route_plan>")) {
      // Truncated response — try to fix
      console.warn("Truncated route_plan detected, attempting to fix...");
      const startIdx = assistantText.indexOf("<route_plan>");
      const jsonPart = assistantText.slice(startIdx + "<route_plan>".length).trim();
      cleanMessage = assistantText.slice(0, startIdx).trim();

      try {
        let fixedJson = jsonPart.replace(/<\/route_plan>.*$/, "").trim();
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

    // Detect when AI is about to prepare a plan but hasn't generated one yet
    const PREPARING_PHRASES = [
      "przygotuję", "przygotowuję", "zaraz generuję", "daj mi chwilę",
      "moment", "zaraz wygeneruję", "teraz wygeneruję", "przygotowuję plan",
      "teraz przygotuje", "generuję plan", "tworzę plan", "układam plan",
      "zaraz przygotuję", "przygotuje plan", "teraz stworzę",
    ];
    const isPreparing = !plan && PREPARING_PHRASES.some(p =>
      cleanMessage.toLowerCase().includes(p)
    );

    return new Response(
      JSON.stringify({ message: cleanMessage, plan, preparing_plan: isPreparing }),
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
