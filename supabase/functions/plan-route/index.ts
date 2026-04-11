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
  startingLocation?: string;
  folderId?: string;
  dayNumber?: number;
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

function buildPreviousDaysBlock(routes: { day_number: number; ai_summary: string | null; ai_highlight: string | null; ai_tip: string | null }[]): string {
  if (!routes.length) return "";
  const lines = routes.map(r => {
    const parts = [`Dzień ${r.day_number}:`];
    if (r.ai_summary) parts.push(r.ai_summary);
    if (r.ai_highlight) parts.push(`Najlepszy moment: ${r.ai_highlight}`);
    if (r.ai_tip) parts.push(`Wniosek AI: ${r.ai_tip}`);
    return parts.join("\n");
  });
  return lines.join("\n\n");
}

function inferPersonalityType(preferences: TripPreferences, userProfile?: UserProfile): string {
  const priorities = preferences.priorities ?? [];
  const interests = userProfile?.travel_interests ?? [];
  if (priorities.includes("nightlife") || interests.includes("nightlife")) return "nocny";
  if (priorities.includes("museums") || interests.includes("history") || interests.includes("art")) return "kulturalny";
  if (priorities.includes("good_food") || interests.includes("coffee")) return "kawiarniany";
  if (priorities.includes("shopping")) return "zakupowy";
  if (preferences.pace === "active") return "aktywny";
  if (priorities.includes("long_walks") || priorities.includes("nice_views")) return "aktywny";
  return "mix";
}

function buildRouteExamplesContext(examples: any[]): string {
  if (!examples.length) return "";
  const lines = examples.map((ex: any) => {
    const pins = (ex.pins as any[]).map((p: any) =>
      `    ${p.suggested_time} · ${p.place_name} (${p.category}, ${p.duration_minutes} min)${p.walking_time_from_prev ? ` — ${p.walking_time_from_prev} pieszo` : ""}`
    ).join("\n");
    return `### "${ex.title}" (${ex.personality_type})\n${ex.description ? `${ex.description}\n` : ""}Piny:\n${pins}`;
  });
  return `## 🏆 WZORCOWE TRASY (zatwierdzone przez redakcję TRASA)\nPoniższe trasy zostały ocenione jako idealne dla Krakowa. Planuj w podobnym rytmie, logice geograficznej i strukturze dnia:\n\n${lines.join("\n\n")}`;
}

function buildSystemPrompt(preferences: TripPreferences, currentPlan?: any, userProfile?: UserProfile, previousDaysContext?: string, memoryContext?: string, likedPlaces?: string[], currentTime?: string, scrapedPlacesContext?: string, idealDay?: string, skippedPlaces?: string[], routeExamplesContext?: string, superLikedPlaces?: string[], previousDayPlaces?: string[], previousDayCategoryCounts?: Record<string, number>, restrictToLiked?: boolean): string {
  const isNightlife = preferences.priorities.includes("nightlife") || (userProfile?.travel_interests ?? []).includes("nightlife");
  const timeInfo = currentTime ? `- Aktualna godzina: ${currentTime} — planuj miejsca dostępne od tej pory, nie zaczynaj od miejsc które są już zamknięte lub których opening hours zaczyna się wcześniej` : "";
  const dateInfo = preferences.startDate ? `- Data podróży: ${preferences.startDate}${currentTime ? " (dziś)" : ""}` : "";
  const cityInfo = preferences.city?.trim() ? `- Destynacja: ${preferences.city.trim()}` : "";
  const dayInfo = preferences.dayNumber
    ? `- Planowany dzień: Dzień ${preferences.dayNumber} z ${preferences.numDays}`
    : "";
  const startInfo = preferences.startingLocation?.trim()
    ? `- Punkt startowy / nocleg: ${preferences.startingLocation.trim()} — zacznij trasę od tego miejsca${preferences.numDays > 1 ? " i kończ każdy dzień w pobliżu noclegu lub węzła komunikacyjnego" : " i kończ w okolicy"}`
    : preferences.numDays > 1
    ? "- Nocleg: nieznany — kończ każdy dzień w pobliżu centrum lub węzła komunikacyjnego"
    : "";
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

  const maxPins = preferences.pace === "active" ? "7–8" : preferences.pace === "calm" ? "3–5" : isRomantic ? "4–5" : isNightlife ? "5–6 + 1–2 bary/kluby" : "5–6";
  const maxMuseums = isRomantic ? "0 lub 1" : "1";
  const dinnerEarliest = isRomantic ? "19:00" : isNightlife ? "18:00" : "18:30";

  return `Jesteś planistą podróży w aplikacji TRASA. Twoje plany muszą być realistyczne, przestrzennie spójne i emocjonalnie satysfakcjonujące.

## PREFERENCJE USERA
- Liczba dni: ${preferences.numDays}
- Tempo: ${preferences.pace === "active" ? "aktywne (dużo zwiedzania)" : preferences.pace === "calm" ? "spokojne (mniej miejsc, więcej czasu)" : "mieszane"}
- Priorytety: ${prioritiesPL ?? "brak konkretnych"}
${dateInfo}
${timeInfo}
${cityInfo}
${dayInfo}
${startInfo}
${userProfileContext}
${currentPlanContext}
${previousDaysContext ? `\n## 🧠 PAMIĘĆ — POPRZEDNIE DNI TEJ PODRÓŻY\nPoniżej feedback z poprzednich dni tej samej podróży.\n\n${previousDaysContext}\n\nJAK UŻYWAĆ:\n- NIE modyfikuj planu automatycznie bez zgody usera.\n- Gdy user potwierdzi zmiany — uwzględnij feedback przy generowaniu planu.\n- Gdy generujesz plan, dodaj 1 zdanie co uwzględniłeś (np. "Unikam zatłoczonych miejsc przed 12").\n` : ""}${memoryContext ? `\n## 💡 DŁUGOTERMINOWE PREFERENCJE UŻYTKOWNIKA\nZ poprzednich podróży wiem o tym userze:\n\n${memoryContext}\n\nUwzględnij te preferencje przy wyborze miejsc i stylu planu. Nie wspominaj wprost że "pamiętasz" — po prostu planuj zgodnie z nimi.\n` : ""}
${cityKnown ? `\n## ⚠️ KLUCZOWA ZASADA\nUser wpisał już destynację: „${cityName}". NIE pytaj gdzie jedzie — to już wiesz.\n` : ""}

## ⛔ ZAKAZY BEZWZGLĘDNE
- NIE nazywaj wycieczki "romantyczną", "rodzinną", "luksusową" itp. chyba że user to wprost powiedział lub ma to w profilu.
- NIE używaj zwrotów: "romantyczny wyjazd", "romantyczna trasa", "wyjazd dla dwojga" jeśli user tego nie deklarował.
- NIE mów "zaraz to zrobię", "przygotowuję plan", "zaktualizuję" bez natychmiastowego wykonania zmiany.

## STYL ROZMOWY
- Pisz krótko i naturalnie — jak znajomy planista, nie jak korporacyjny asystent.
- Rozdzielaj myśli na OSOBNE AKAPITY (\\n\\n). Każdy akapit = 1–2 zdania.
- Używaj **pogrubień** dla nazw miejsc i kluczowych fraz.
- Dodawaj emoji kontekstowo: 🗺️ 🍜 ☕ 🏛️ 🌇 🎯 🚶 🌙.
- Gdy masz wystarczająco info — generuj plan NATYCHMIAST. Nie zapowiadaj generowania.

## FAZY ROZMOWY (max 2–3 wymiany)

### Faza 1 — START
${cityKnown
  ? `Destynacja znana (${cityName}). System wysłał już powitanie. Odpowiadaj na pytania usera i zmierzaj do generowania planu.`
  : preferences.numDays > 1
  ? `Zapytaj w jednej krótkiej wiadomości:\n1. Gdzie jedziesz?\n2. W której części miasta / dzielnicy masz nocleg? (kluczowe do układania dni)\n3. Czy masz już zaplanowane jakieś miejsca lub rzeczy które koniecznie chcesz zobaczyć?\n4. Od której do której godziny planujesz aktywność każdego dnia?\nMax 2 zdania wstępu + pytania jako lista.`
  : `Zapytaj w jednej krótkiej wiadomości:\n1. Gdzie jedziesz?\n2. Czy masz już jakieś plany lub są miejsca, które koniecznie chcesz odwiedzić?\n3. Od której do której godziny mam zaplanować Twój dzień?\nMax 2 zdania wstępu + pytania jako lista.`}

### Faza 2 — DOPRECYZOWANIE (opcjonalna)
Jeśli brakuje przedziału godzinowego dnia lub kluczowego kontekstu — dopytaj JEDNYM pytaniem.
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
${isNightlife ? "- barem / pubem / klubem jako ostatni punkt (PREFEROWANE przy priorytecie nocnym)" : ""}
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
${isNightlife ? `### TRYB NOCNY ✓ (aktywny — priorytet: życie nocne)

H_NL1. STRUKTURA DNIA NOCNEGO
- Plan dzieli się na 2 fazy: DZIENNA (atrakcje, jedzenie) + NOCNA (bary, klimatyczne miejsca, klub)
- Kolacja WCZEŚNIE: 18:00–19:00 — żeby mieć energię na noc
- Po kolacji: minimum 2 nocne punkty (bar → klub LUB bar → bar → klub)
- Ostatni punkt planu: klimatyczny bar lub klub — to jest kulminacja dnia

H_NL2. DOBÓR MIEJSC NOCNYCH
- Nie planuj standardowych restauracji na wieczór — szukaj: cocktail barów, pubów, wine barów, klubów muzycznych, jazz barów
- Preferuj miejsca otwarte do 2:00+ (nie lokale zamykające się o 22:00)
- W Krakowie: Kazimierz (klimatyczne bary), Stare Miasto okolice Floriańskiej / Szewskiej
- Podaj KONKRETNE nazwy barów/klubów z rozpoznawalną marką online

H_NL3. OGRANICZONE MUZEA
- Max 1 muzeum w planie nocnym — dzień jest krótszy bo noc jest długa
- Priorytet: spacery po mieście, kawiarnie, widoki, zabytkowe dzielnice — szybkie, wizualne, energetyczne

` : ""}${preferences.numDays > 1 ? `### H14. MULTI-DAY — ZASADY CAŁEJ PODRÓŻY (OBOWIĄZKOWE)

**Koniec dnia blisko noclegu/transportu:**
- Ostatnie 1-2 miejsca każdego dnia (oprócz ostatniego dnia) powinny być geograficznie blisko noclegu lub dworca/przystanku
- Nie kończ dnia 2 km od noclegu — user musi jeszcze dotrzeć na miejsce

**Różnorodność dni:**
- Każdy dzień musi mieć inną "energię": np. Dzień 1 = historyczne centrum, Dzień 2 = dzielnica lokalna + outdoor, Dzień 3 = muzea + zakupy
- NIE kopiuj struktury dziennej z poprzedniego dnia
- Dzielnice: staraj się aby każdy dzień skupiał się w innej części miasta

**Logika pierwszego dnia:**
- Dzień 1: miejsca bliżej centrum / przystępne dla zmęczonego przyjazdem turysty, unikaj dalekich wycieczek
- Ostatni dzień: plan elastyczny — uwzględnij możliwość wcześniejszego wyjazdu, nie planuj muzeum na 16:00

**Poinformuj usera o strukturze:**
Gdy generujesz pierwszy plan dla całej podróży, dodaj PRZED blokiem planu JEDEN krótki akapit (2-3 zdania) jak rozłożyłeś poszczególne dni (np. "Dzień 1 — Stare Miasto, Dzień 2 — Kazimierz i Podgórze, Dzień 3 — Nowa Huta").

` : ""}### H12. ADAPTACJA POGODOWA
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
      "day_metrics": {
        "total_walking_km": 8.5,
        "crowd_level": "medium",
        "energy_cost": "high"
      },
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
- day_metrics.total_walking_km: szacunkowa łączna odległość pieszego (suma distance_from_prev + wizyty) w km
- day_metrics.crowd_level: "low" | "medium" | "high" — na podstawie dat, popularności i heurystyk H13
- day_metrics.energy_cost: "low" | "medium" | "high" — na podstawie liczby punktów, tempa i długości dnia
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

## EDYCJA PLANU (ZASADA KLUCZOWA: JEDNA ZMIANA + NATYCHMIASTOWE WYKONANIE)

**BEZWZGLĘDNA ZASADA**: Gdy user prosi o JAKĄKOLWIEK zmianę planu — musisz natychmiast wyemitować PEŁNY zaktualizowany plan w bloku <route_plan>...</route_plan>. Nie ma możliwości odpowiedzi "OK, zaktualizuję" bez bloku planu.

- "Zamień X" → zaproponuj alternatywę w tej samej okolicy → WYEMITUJ pełny plan z zamianą
- "Dodaj Y" → wstaw w logiczne miejsce, zaktualizuj suggested_time kolejnych punktów → WYEMITUJ pełny plan
- "Usuń Z" → usuń, sprawdź kulminację (H3) → WYEMITUJ pełny plan
- NIE regeneruj całego planu strukturalnie — tylko zmień to co user prosił
- NIE mów "za chwilę", "przygotowuję", "zaktualizuję" — po prostu zrób to i pokaż plan
- Komentarz do zmiany: MAX 1 zdanie przed blokiem planu${superLikedPlaces?.length ? `\n\n## ⭐ MIEJSCA OBOWIĄZKOWE (SUPER LIKE)\nUżytkownik oznaczył te miejsca jako MUST-HAVE — MUSZĄ znaleźć się w planie bez wyjątku:\n${superLikedPlaces.map(p => `- ${p}`).join("\n")}` : ""}${likedPlaces?.length ? (restrictToLiked ? `\n\n## 🔒 TRYB GRUPOWY — TYLKO TE MIEJSCA\nTo jest plan grupowy stworzony na podstawie wspólnych wyborów. BEZWZGLĘDNA ZASADA:\n- Używaj WYŁĄCZNIE miejsc z poniższej listy. Nie dodawaj żadnych innych miejsc.\n- Jeśli lista jest za krótka na pełny dzień — wybierz najlepszy podzbiór, NIE wymyślaj nowych.\n- Każde miejsce spoza tej listy w planie = błąd krytyczny.\n\nDozwolone miejsca:\n${likedPlaces.map(p => `- ${p}`).join("\n")}` : `\n\n## 🎯 MIEJSCA DO UWZGLĘDNIENIA\nUżytkownik chce odwiedzić te miejsca — koniecznie wstaw je w plan:\n${likedPlaces.map(p => `- ${p}`).join("\n")}`) : ""}${(() => {
  const allExcluded = [...(skippedPlaces ?? []), ...(previousDayPlaces ?? [])];
  if (!allExcluded.length) return "";
  const skippedSection = (skippedPlaces?.length ?? 0) > 0
    ? `Odrzucone przez usera (nie wstawiaj ani podobnych):\n${skippedPlaces!.map(p => `- ${p}`).join("\n")}`
    : "";
  const prevSection = (previousDayPlaces?.length ?? 0) > 0
    ? `Już odwiedzone w poprzednich dniach tej podróży (NIE powtarzaj):\n${previousDayPlaces!.map(p => `- ${p}`).join("\n")}`
    : "";
  return `\n\n## ❌ MIEJSCA DO POMINIĘCIA\n${[skippedSection, prevSection].filter(Boolean).join("\n\n")}`;
})()}${previousDayCategoryCounts && Object.keys(previousDayCategoryCounts).length > 0 ? `\n\n## ⚖️ BALANS KATEGORII (MULTI-DAY)\nW poprzednich dniach użytkownik odwiedził już:\n${Object.entries(previousDayCategoryCounts).map(([cat, count]) => `- ${cat}: ${count}x`).join("\n")}\n\nZASADY:\n- Unikaj kategorii z liczbą ≥2 chyba że user tego wymaga\n- Max 1 muzeum na całą podróż (już odwiedzone = 0 dziś)\n- Urozmaicaj: jeśli poprzedni dzień był intensywny kulturalnie → dziś więcej outdoor/jedzenia\n- Nie rób identycznej struktury dnia (landmark → lunch → muzeum → kawiarnia → kolacja) każdego dnia` : ""}${idealDay ? `\n\n## 💭 JAK WYGLĄDA IDEALNY DZIEŃ UŻYTKOWNIKA\n${idealDay}\n\nDopasuj styl, tempo i dobór miejsc do tej wizji.` : ""}
${scrapedPlacesContext ? `\n\n${scrapedPlacesContext}` : ""}${routeExamplesContext ? `\n\n${routeExamplesContext}` : ""}
## SZYBKIE ODPOWIEDZI (OBOWIĄZKOWE)
Na końcu KAŻDEJ wiadomości dodaj dokładnie ten blok:
<suggestions>["podpowiedź 1", "podpowiedź 2", "podpowiedź 3", "podpowiedź 4"]</suggestions>

Zasady podpowiedzi:
- Max 5 słów każda, po polsku, naturalne
- Gdy plan jest gotowy: np. "Wygląda świetnie! ✓", "Zmień restaurację", "Za dużo chodzenia", "Dodaj nocne życie"
- Gdy jeszcze rozmowa (brak planu): np. "9:00 - 22:00", "Centrum miasta", "Chcę zobaczyć Wawel", "Mam już restaurację"
- Ostatnia podpowiedź zawsze: potwierdzenie lub zakończenie`;
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
    const { preferences, messages: userMessages, current_plan, force_plan, liked_places, skipped_places, super_liked_places, ideal_day, current_time, current_date, restrict_to_liked } = await req.json();

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

    // ── Rate limiting: 15 calls/hour per user ──
    {
      const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: rl } = await supabase
        .from("rate_limits")
        .select("count, window_start")
        .eq("user_id", user.id)
        .eq("endpoint", "plan-route")
        .single();

      if (rl && rl.window_start > windowStart && rl.count >= 15) {
        return new Response(
          JSON.stringify({ error: "Przekroczyłeś limit 15 planowań na godzinę. Spróbuj za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newCount = (!rl || rl.window_start <= windowStart) ? 1 : rl.count + 1;
      await supabase.from("rate_limits").upsert({
        user_id: user.id,
        endpoint: "plan-route",
        count: newCount,
        window_start: (!rl || rl.window_start <= windowStart) ? new Date().toISOString() : rl.window_start,
      });
    }

    const MAX_MESSAGES = 10;

    // ── Fetch AAR + pins from previous days ──
    let previousDaysContext = "";
    let previousDayPlaces: string[] = [];
    let previousDayCategoryCounts: Record<string, number> = {};

    if (preferences.folderId && preferences.dayNumber && preferences.dayNumber > 1) {
      try {
        const { data: prevRoutes } = await supabase
          .from("routes")
          .select("id, day_number, ai_summary, ai_highlight, ai_tip")
          .eq("folder_id", preferences.folderId)
          .lt("day_number", preferences.dayNumber)
          .order("day_number", { ascending: true });

        if (prevRoutes?.length) {
          const withAAR = prevRoutes.filter((r: any) => r.ai_summary);
          if (withAAR.length) previousDaysContext = buildPreviousDaysBlock(withAAR as any);

          // Fetch pins from all previous day routes
          const prevRouteIds = prevRoutes.map((r: any) => r.id);
          const { data: prevPins } = await supabase
            .from("pins")
            .select("place_name, category")
            .in("route_id", prevRouteIds);

          if (prevPins?.length) {
            previousDayPlaces = (prevPins as any[]).map((p: any) => p.place_name).filter(Boolean);
            for (const pin of prevPins as any[]) {
              if (pin.category) {
                previousDayCategoryCounts[pin.category] = (previousDayCategoryCounts[pin.category] ?? 0) + 1;
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch previous days context:", err);
      }
    }

    // ── First message ──
    if (userMessages.length === 0 && preferences.city?.trim()) {
      const cityName = preferences.city.trim();
      const nDays = Number(preferences.numDays) || 1;
      const paceLabel = preferences.pace === "active" ? "aktywnym" : preferences.pace === "calm" ? "spokojnym" : "mieszanym";
      const prioritiesPL = Array.isArray(preferences.priorities) && preferences.priorities.length > 0
        ? (preferences.priorities as string[]).map(p => PRIORITY_LABEL_PL[p] ?? p).join(", ")
        : null;

      // Day 2+ with AAR: AI generates a personalized opening with suggestions
      if (previousDaysContext) {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const openingPrompt = `Jesteś przyjaznym przewodnikiem podróży w aplikacji TRASA. Użytkownik planuje teraz Dzień ${preferences.dayNumber} podróży do ${cityName}.

Masz do dyspozycji podsumowanie poprzednich dni:
${previousDaysContext}

Napisz krótką, naturalną wiadomość powitalną (max 3 zdania) w której:
1. Nawiążesz do 1-2 konkretnych spostrzeżeń z poprzedniego dnia (np. że ominął jakieś miejsce bo było tłoczno, albo że coś mu się szczególnie podobało)
2. Zaproponujesz konkretną zmianę podejścia na dzisiejszy dzień wynikającą z tych wniosków
3. Zapytasz czy user chce tę zmianę albo czy ma inne życzenia na dziś

Pisz naturalnie i konkretnie — nie ogólnikowo. Max 1 emoji. NIE generuj planu.`;

          try {
            const openingRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
              body: JSON.stringify({
                model: "google/gemini-2.5-pro-preview-06-05",
                messages: [{ role: "user", content: openingPrompt }],
                max_tokens: 300,
                temperature: 0.7,
              }),
            });
            if (openingRes.ok) {
              const openingData = await openingRes.json();
              const openingMessage = openingData.choices?.[0]?.message?.content ?? "";
              if (openingMessage) {
                return new Response(
                  JSON.stringify({ message: openingMessage, plan: null }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          } catch (err) {
            console.error("Opening message AI error:", err);
          }
        }
        // Fallback if AI call fails
        return new Response(
          JSON.stringify({ message: `Cześć! Czas na Dzień ${preferences.dayNumber} w **${cityName}**! 🗺️\n\nNa podstawie wczoraj — mam kilka sugestii co poprawić. Chcesz żebym uwzględniła wnioski z poprzedniego dnia, czy wolisz świeży start?`, plan: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Standard first message (Day 1 or no AAR available)
      const daysLabel = nDays === 1 ? "1 dzień" : `${nDays} dni`;
      const messageParts = [
        `Świetny wybór — **${cityName}**! 🗺️`,
        `Planujesz **${daysLabel}**, tempo ${paceLabel}${prioritiesPL ? `, z fokusem na **${prioritiesPL}**` : ""}. Chętnie przygotuję plan! 🎯`,
        nDays > 1
          ? `Czy masz już jakieś plany lub są miejsca, które koniecznie chcesz odwiedzić? 📍\n\nOd której do której godziny mam zaplanować **pierwszy dzień**?\n\nI jeszcze — w której części miasta masz **nocleg**? To pomoże mi dobrze zaplanować końce kolejnych dni.`
          : `Czy masz już jakieś plany lub są miejsca, które koniecznie chcesz odwiedzić? 📍\n\nOd której do której godziny mam zaplanować Twój dzień? ⏰`,
      ];
      return new Response(
        JSON.stringify({ message: messageParts.join("\n\n"), plan: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile preferences (non-blocking)
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

    // ── Scraped places retrieval ──
    let scrapedPlacesContext = "";
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_KEY && preferences.city?.trim()) {
      try {
        const queryText = [ideal_day ?? "", preferences.city.trim(), (preferences.priorities ?? []).join(" ")].filter(Boolean).join(". ");
        const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: queryText }),
        });
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const queryEmbedding = embedData.data?.[0]?.embedding;
          if (queryEmbedding) {
            const { data: places } = await supabase.rpc("match_scraped_places", {
              query_embedding: queryEmbedding,
              filter_city: preferences.city.trim(),
              match_count: 15,
              exclude_names: [],
            });
            if (places?.length) {
              const placeLines = (places as any[]).map((p: any) =>
                `- **${p.place_name}**${p.category ? ` (${p.category})` : ""}: ${p.description ?? ""}`
              );
              scrapedPlacesContext = `## 📍 MIEJSCA POLECANE PRZEZ LOKALNYCH (Instagram)\nPoniższe miejsca zostały wyłowione z Instagrama — rozważ ich uwzględnienie w planie, jeśli pasują do preferencji usera:\n\n${placeLines.join("\n")}`;
            }
          }
        }
      } catch (err) {
        console.error("Scraped places retrieval error:", err);
      }
    }

    // ── Vector memory search + preference graph ──
    let memoryContext = "";
    let memoryUsed = false;
    const LOVABLE_API_KEY_FOR_EMBED = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY_FOR_EMBED) {
      try {
        // Build query text from current trip preferences
        const queryText = [
          preferences.city?.trim() ?? "",
          preferences.priorities?.join(" ") ?? "",
          preferences.pace ?? "",
        ].filter(Boolean).join(" ");

        // Get embedding for the query
        const embedRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY_FOR_EMBED}`,
          },
          body: JSON.stringify({ model: "text-embedding-ada-002", input: queryText }),
        });

        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const queryEmbedding = embedData.data?.[0]?.embedding;

          if (queryEmbedding) {
            const { data: memories } = await supabase.rpc("match_memories", {
              query_embedding: queryEmbedding,
              match_user_id: user.id,
              match_threshold: 0.6,
              match_count: 3,
            });

            if (memories?.length) {
              const memoryLines = (memories as any[]).map((m) => {
                const city = m.city ? ` (${m.city})` : "";
                return `- ${m.content}${city}`;
              });
              memoryContext += `Wspomnienia z podobnych podróży:\n${memoryLines.join("\n")}`;
              memoryUsed = true;
            }
          }
        }
      } catch {
        // Non-blocking — proceed without memory
      }

      // Fetch top preference signals
      try {
        const { data: prefGraph } = await supabase
          .from("user_preference_graph")
          .select("preference_key, preference_value, confidence")
          .eq("user_id", user.id)
          .gte("confidence", 0.5)
          .order("evidence_count", { ascending: false })
          .limit(8);

        if (prefGraph?.length) {
          const prefLines = (prefGraph as any[]).map(
            (p) => `- ${p.preference_key}: ${p.preference_value}`
          );
          const prefSection = `Stałe preferencje podróżnicze:\n${prefLines.join("\n")}`;
          memoryContext = memoryContext
            ? `${memoryContext}\n\n${prefSection}`
            : prefSection;
          memoryUsed = true;
        }
      } catch {
        // Non-blocking
      }
    }

    // ── Route examples (approved curated routes as few-shot style guide) ──
    let routeExamplesContext = "";
    if (preferences.city?.trim()) {
      try {
        const personalityType = inferPersonalityType(preferences, profileData ?? undefined);
        // Fetch up to 3 approved examples: prefer matching personality, fallback to any
        const { data: exactMatch } = await supabase
          .from("route_examples")
          .select("title, personality_type, description, pins")
          .ilike("city", preferences.city.trim())
          .eq("is_approved", true)
          .eq("personality_type", personalityType)
          .limit(2);

        const exactIds = (exactMatch ?? []).map((_: any, i: number) => i);
        const { data: fallback } = await supabase
          .from("route_examples")
          .select("title, personality_type, description, pins")
          .ilike("city", preferences.city.trim())
          .eq("is_approved", true)
          .neq("personality_type", personalityType)
          .limit(exactIds.length < 2 ? 3 - (exactMatch?.length ?? 0) : 1);

        const examples = [...(exactMatch ?? []), ...(fallback ?? [])].slice(0, 3);
        if (examples.length > 0) {
          routeExamplesContext = buildRouteExamplesContext(examples);
        }
      } catch {
        // Non-blocking
      }
    }

    const isToday = current_date && preferences.startDate && preferences.startDate === current_date;
    const systemPrompt = buildSystemPrompt(preferences, current_plan, profileData ?? undefined, previousDaysContext || undefined, memoryContext || undefined, liked_places ?? undefined, isToday ? (current_time ?? undefined) : undefined, scrapedPlacesContext || undefined, ideal_day ?? undefined, skipped_places ?? undefined, routeExamplesContext || undefined, super_liked_places ?? undefined, previousDayPlaces.length > 0 ? previousDayPlaces : undefined, Object.keys(previousDayCategoryCounts).length > 0 ? previousDayCategoryCounts : undefined, restrict_to_liked ?? false);

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
      ? "\n\nWYGENERUJ TERAZ PLAN w bloku <route_plan>...</route_plan>. Napisz 1 krótkie zdanie komentarza i natychmiast wygeneruj plan zgodnie ze wszystkimi heurystykami H1–H13. WAŻNE: Dobierz miejsca ściśle pod PROFIL UŻYTKOWNIKA i jego priorytety — każdy plan powinien być inny, unikaj powtarzania tych samych zestawów atrakcji."
      : "";

    const aiMessages = [
      { role: "system", content: systemPrompt + finishInstruction },
      ...userMessages,
    ];

    // Try Gemini 2.5 Pro first, fall back to Flash if unavailable
    const PRIMARY_MODEL = "google/gemini-2.5-pro-preview-06-05";
    const FALLBACK_MODEL = "google/gemini-2.5-flash";

    const callAI = async (model: string) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({ model, messages: aiMessages, max_tokens: 8000, temperature: 0.7 }),
      });

    let aiResponse = await callAI(PRIMARY_MODEL);
    if (!aiResponse.ok) {
      console.warn(`Primary model ${PRIMARY_MODEL} failed (${aiResponse.status}), falling back to ${FALLBACK_MODEL}`);
      aiResponse = await callAI(FALLBACK_MODEL);
    }

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

    // Extract suggestions
    let suggestions: string[] = [];
    const suggestionsMatch = assistantText.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
    if (suggestionsMatch) {
      try { suggestions = JSON.parse(suggestionsMatch[1]); } catch { /* ignore */ }
    }
    const textWithoutSuggestions = assistantText.replace(/<suggestions>[\s\S]*?<\/suggestions>/, "").trim();

    // Check for route plan
    const planMatch = textWithoutSuggestions.match(/<route_plan>([\s\S]*?)<\/route_plan>/);

    let plan = null;
    let cleanMessage = textWithoutSuggestions;

    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1]);
        cleanMessage = textWithoutSuggestions.replace(/<route_plan>[\s\S]*?<\/route_plan>/, "").trim();
      } catch (parseErr) {
        console.error("Failed to parse route_plan:", parseErr);
        cleanMessage = textWithoutSuggestions.replace(/<route_plan>[\s\S]*?<\/route_plan>/, "").trim();
      }
    } else if (textWithoutSuggestions.includes("<route_plan>")) {
      // Truncated response — try to fix
      console.warn("Truncated route_plan detected, attempting to fix...");
      const startIdx = textWithoutSuggestions.indexOf("<route_plan>");
      const jsonPart = textWithoutSuggestions.slice(startIdx + "<route_plan>".length).trim();
      cleanMessage = textWithoutSuggestions.slice(0, startIdx).trim();

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

    // Ground plan with real Google Places data (skip on force_plan for faster initial load)
    if (plan && !force_plan) {
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
      if (GOOGLE_API_KEY) {
        try {
          plan = await verifyAndGroundPlan(plan, GOOGLE_API_KEY);
        } catch (err) {
          console.error("Places grounding failed, using AI data:", err);
        }
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
      JSON.stringify({ message: cleanMessage, plan, preparing_plan: isPreparing, memory_used: memoryUsed, suggestions }),
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

// ── Google Places grounding ────────────────────────────────────────────────────

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function verifyPin(pin: any, city: string, apiKey: string): Promise<any> {
  try {
    // Search by AI-suggested name + city
    const query = `${pin.place_name} ${city}`;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=pl&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) return pin;

    const data = await response.json();
    if (data.status !== "OK" || !data.results?.length) return pin;

    const place = data.results[0];
    const lat = place.geometry?.location?.lat;
    const lng = place.geometry?.location?.lng;

    // Sanity check: result must be within 60 km of AI-suggested location
    if (pin.latitude && pin.longitude && lat && lng) {
      if (getDistanceKm(pin.latitude, pin.longitude, lat, lng) > 60) {
        return pin; // Wrong location — keep AI data
      }
    }

    return {
      ...pin,
      place_name: place.name ?? pin.place_name,
      address: place.formatted_address ?? pin.address,
      latitude: lat ?? pin.latitude,
      longitude: lng ?? pin.longitude,
      place_id: place.place_id ?? null,
    };
  } catch {
    return pin; // On any error keep AI data
  }
}

async function verifyAndGroundPlan(plan: any, apiKey: string): Promise<any> {
  const verifiedDays = await Promise.all(
    (plan.days ?? []).map(async (day: any) => ({
      ...day,
      pins: await Promise.all(
        (day.pins ?? []).map((pin: any) => verifyPin(pin, plan.city ?? "", apiKey))
      ),
    }))
  );
  return { ...plan, days: verifiedDays };
}
