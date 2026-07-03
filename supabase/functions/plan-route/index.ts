import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://trasa.travel", "https://trasa.lovable.app", "http://localhost:8080", "http://localhost:5173", "capacitor://localhost", "https://localhost", "http://localhost"];

interface TripPreferences {
  numDays: number;
  startDate: string | null;
  planningMode: string;
  city?: string;
  startingLocation?: string;
  starting_location_lat?: number;
  starting_location_lng?: number;
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

function inferPersonalityType(userProfile?: UserProfile): string {
  const interests = userProfile?.travel_interests ?? [];
  if (interests.includes("nightlife")) return "nocny";
  if (interests.includes("history") || interests.includes("art")) return "kulturalny";
  if (interests.includes("coffee")) return "kawiarniany";
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

function buildSystemPrompt(preferences: TripPreferences, currentPlan?: any, _userProfile?: UserProfile, previousDaysContext?: string, memoryContext?: string, likedPlaces?: string[], currentTime?: string, scrapedPlacesContext?: string, idealDay?: string, skippedPlaces?: string[], routeExamplesContext?: string, superLikedPlaces?: string[], previousDayPlaces?: string[], previousDayCategoryCounts?: Record<string, number>, restrictToLiked?: boolean, extendMode?: boolean, likedPlacesGeo?: string): string {
  const timeInfo = currentTime ? `- Aktualna godzina: ${currentTime} — planuj miejsca dostępne od tej pory, nie zaczynaj od miejsc które są już zamknięte lub których opening hours zaczyna się wcześniej` : "";
  const dateInfo = preferences.startDate ? `- Data podróży: ${preferences.startDate}${currentTime ? " (dziś)" : ""}` : "";
  const cityInfo = preferences.city?.trim() ? `- Destynacja: ${preferences.city.trim()}` : "";
  const dayInfo = preferences.dayNumber
    ? `- Planowany dzień: Dzień ${preferences.dayNumber} z ${preferences.numDays}`
    : "";
  // Punkt startowy moze byc samym tekstem (legacy) lub miec rowniez lat/lng
  // (StartingLocationPicker zwraca wspolrzedne wybranego miejsca na mapie).
  // Wspolrzedne sa wazne zeby AI mogla planowac trase blisko hotelu, nie tylko
  // wedlug tekstowej nazwy ktora moze byc niejednoznaczna.
  const startCoords = preferences.starting_location_lat && preferences.starting_location_lng
    ? ` (${preferences.starting_location_lat.toFixed(6)}, ${preferences.starting_location_lng.toFixed(6)})`
    : "";
  const startInfo = preferences.startingLocation?.trim()
    ? `- Punkt startowy / nocleg: ${preferences.startingLocation.trim()}${startCoords} — zacznij trasę od tego miejsca${preferences.numDays > 1 ? " i kończ każdy dzień w pobliżu noclegu lub węzła komunikacyjnego" : " i kończ w okolicy"}`
    : preferences.numDays > 1
    ? "- Nocleg: nieznany — kończ każdy dzień w pobliżu centrum lub węzła komunikacyjnego"
    : "";
  const cityKnown = !!preferences.city?.trim();
  const cityName = preferences.city?.trim() ?? "";

  const currentPlanContext = currentPlan
    ? `\n\n## AKTUALNY PLAN (do edycji)\n${JSON.stringify(currentPlan, null, 2)}`
    : "";

  return `Jesteś planistą podróży w aplikacji TRASA. Twoje plany muszą być realistyczne, przestrzennie spójne i emocjonalnie satysfakcjonujące.
${restrictToLiked && likedPlaces?.length ? `
## 🚨 ZASADA NUMER 1 (NAJWAŻNIEJSZA - NIE ŁAM JEJ NIGDY)

User wybrał konkretne ${likedPlaces.length} miejsc(a) i chce trasy TYLKO z nich. To jest TWOJA ROLA - układać te miejsca w trasę, NIE PROPONOWAĆ żadnych nowych miejsc.

**ZAKAZY BEZWZGLĘDNE:**
- NIE WOLNO Ci dodać NICZEGO co nie jest w liście user'a (poniżej w sekcji "🔒 TYLKO TE MIEJSCA")
- NIE WOLNO wymyślać generycznych miejsc typu "Wieczorny spacer po [dzielnica]", "Romantyczna kolacja", "Klimatyczna kawiarnia", "Punkt widokowy", "Spacer po starówce"
- NIE WOLNO uzupełniać dni "dla balansu" lub "dla kompletności" - LEPSZY PUSTY DZIEŃ NIŻ FAKE MIEJSCA

**OBOWIĄZKOWE:**
- **WSZYSTKIE polubione miejsca MUSZĄ znaleźć się w planie.** Liczba pinów w planie = liczba polubionych. Bez wyjątku, bez "zaokrąglania w dół", bez pomijania.
- **Skopiuj nazwy DOKŁADNIE jak są podane** w sekcji "🔒 TYLKO TE MIEJSCA" - bez dodawania słów typu "Restauracja", "Bar", bez skracania, bez zmiany wielkości liter, bez interpunkcji. Plan zostanie zwalidowany 1:1 z lista usera.
- Jeśli polubionych jest WIĘCEJ niż ${preferences.numDays} × 5, mozesz nadmiar zostawić na inny dzień. Jeśli mniej - umieść WSZYSTKO w pierwszym dniu (lub rozłóż między dni, ale każde polubione musi być).
- NIE zostawiaj pustych dni gdy user MA polubienia do umieszczenia. Pusty dzień = OK tylko gdy polubione już rozłożone w innych dniach.

Przykłady:
- 5 polubione + 1 dzień → Dzień 1: WSZYSTKIE 5 miejsc (nie 3, nie 4, dokładnie 5)
- 8 polubione + 2 dni → Dzień 1: 4-5 miejsc, Dzień 2: 3-4 miejsc (suma = 8)
- 3 polubione + 3 dni → Dzień 1: 3 polubione, Dzień 2: pins:[], Dzień 3: pins:[]

Jeśli złamiesz tę regułę, plan zostanie ODRZUCONY przez post-processing servera i user dostanie błąd "AI wymyślił miejsca - spróbuj ponownie".
` : ""}${extendMode && currentPlan ? `
## 🔁 EXTEND MODE — UZUPEŁNIENIE ISTNIEJĄCEGO PLANU

User właśnie wrócił z swipera z dodatkowymi polubionymi miejscami i chce, żeby DODAĆ je do istniejącego planu, NIE generować nowego.

**KRYTYCZNE ZASADY EXTEND:**

1. **Zachowaj WSZYSTKIE miejsca, które już są w planie** - nie usuwaj i nie wymieniaj istniejących. Dzień, który miał miejsca, nadal je ma (mogą dojść nowe).

2. **DODAJ wszystkie nowe polubione miejsca do planu - TO JEST CEL EXTEND:**
   - Najpierw wypełnij puste dni (\`pins: []\`).
   - Jeśli NIE MA pustych dni LUB zostały nierozdzielone polubienia - DOPISZ je do istniejących dni (zwykle na końcu dnia, z późniejszym \`suggested_time\`), z zachowaniem heurystyk H1-H5 (rytm dnia, klaster/minimalizacja dystansu, kolacja blisko, logika przejść, godziny otwarcia). Przelicz godziny i kolejność tak, żeby dzień był spójny.

3. **Używaj WYŁĄCZNIE polubionych miejsc** (lista poniżej "🔒 TYLKO TE MIEJSCA" lub "🎯 MIEJSCA DO UWZGLĘDNIENIA"). Nie wymyślaj nowych nazw, nie dodawaj generycznych haseł.

4. **KAŻDE nowe polubione miejsce MUSI znaleźć się w zwróconym planie** - nie pomijaj żadnego. Lepiej dopisać miejsce do istniejącego dnia niż je pominąć.

5. **Komentarz w odpowiedzi:** 1 krótkie zdanie "Dodałem X miejsc do Dnia Y". Bez wstępów typu "Świetnie!", "Czy chcesz...".

Plan zwracany w EXTEND MODE ma tę samą liczbę DNI co AKTUALNY PLAN (dni mogą mieć WIĘCEJ miejsc niż wcześniej). Istniejące miejsca zostają, dochodzą nowe z listy polubionych.
` : ""}
## PREFERENCJE USERA
- Liczba dni: ${preferences.numDays}

## ⛔ TWARDY LIMIT DNI (NIENARUSZALNY)
- Plan ma DOKŁADNIE ${preferences.numDays} ${preferences.numDays === 1 ? "dzień" : "dni"}. NIGDY nie zwracaj więcej dni niż ${preferences.numDays}. Maksimum w całej aplikacji to 3 dni.
- Jeśli user ma DUŻO miejsc (nawet kilkanaście) - NIE twórz nowego dnia. Upchnij wszystkie w istniejące ${preferences.numDays} ${preferences.numDays === 1 ? "dzień" : "dni"} (gęstszy plan, więcej punktów na dzień, przeliczone godziny). Lepiej bardzo pełny dzień niż dodatkowy dzień.
${dateInfo}
${timeInfo}
${cityInfo}
${dayInfo}
${startInfo}
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

### H1. RYTM DNIA (wzorzec, NIE sztywny szablon)
Dzień powinien mieć naturalny łuk energii, ale DOSTOSUJ go do typu dnia i profilu usera - nie wpychaj na siłę każdej fazy.

Typowy łuk (punkt wyjścia, nie obowiązek):
- Rozgrzewka: landmark / spacer / zabytek
- Posiłek w środku dnia: restauracja / lunch
- Odkrywanie: dzielnica / kultura / park
- Reset: kawiarnia / chill / odpoczynek
- Kulminacja wieczorem: kolacja + widok / wieczorny spacer

WAŻNE: dzień foodie może mieć 3 knajpy zamiast 1 landmarka; dzień muzealny - 2-3 muzea z kawą między nimi; dzień relaksu - park + kawiarnie bez „atrakcji". Kieruj się tym CO user polubił i jego priorytetami, nie sztywnym schematem. Ramy czasowe z godzin aktywności usera - bez sztywnych przedziałów.

### H2. KLASTER I MINIMALIZACJA DYSTANSU (masz REALNE współrzędne — użyj ich!)
- Grupuj miejsca w promieniu 1–1.5 km od siebie
- Max 1 większy przeskok (>2 km) dziennie — tylko jeśli jest logiczne uzasadnienie
- Kolejność pinów w dniu MINIMALIZUJE łączny dystans pieszy: z każdego punktu idź do NAJBLIŻSZEGO sensownego następnego (nearest-neighbor). NIE skacz tam i z powrotem po mapie.
- Policz odległości z podanych niżej współrzędnych [lat, lng] - masz je dokładne, więc nie ma wymówki na „za daleko".
- ZŁY przykład: A → (5 km) → B → (wracasz obok A) → C. DOBRY: A → B → C w jednym kierunku, ciągłość geograficzna.${likedPlacesGeo ? `\n\n**Realne współrzędne miejsc (użyj do układania kolejności ORAZ wpisz DOKŁADNIE te wartości w latitude/longitude każdego pinu — nie zmieniaj ich):**\n${likedPlacesGeo}` : ""}

### H3. KOLACJA BLISKO OSTATNIEJ ATRAKCJI
- Restauracja na kolację: max 800 m od poprzedniego punktu dnia
- Kolacja nie może wymagać 25-minutowego marszu przez miasto

### H4. LOGIKA PRZEJŚĆ
- Każde przejście między punktami: < 20 min pieszo (ok. 1.4 km)
- Wyjątek: max 1 dłuższe przejście dziennie (transport, wyjazd z centrum)
- Przejścia muszą mieć sens geograficzny — nie skaczemy po mapie

### H5. GODZINY OTWARCIA
- Muzea: zwykle 10:00–18:00; nie planuj wizyty po 16:00 jeśli trwa 2h+
- Poniedziałki: wiele muzeów zamkniętych — sprawdź przed wstawieniem
${preferences.numDays > 1 ? `### H8. MULTI-DAY — ZASADY CAŁEJ PODRÓŻY (OBOWIĄZKOWE)

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

` : ""}### H6. ADAPTACJA POGODOWA
Jeśli user wspomni o pogodzie lub możesz wnioskować z daty/miejsca:
- Deszcz: zamień spacery outdoor → muzeum / galeria / kryty market
- Upał: więcej miejsc z cieniem/klimatyzacją, spacer późnym popołudniem (po 17:00)

### H7. WEEKENDOWA LOGIKA TŁUMÓW
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
  ],
  "route_reasoning": "POLE WYPEŁNIANE NA SAMYM KOŃCU - dopiero gdy wszystkie 'days'/'pins' powyżej są już ułożone (żeby cytować REALNE piny, nie te które dopiero planujesz). 2-4 zdania z KONKRETAMI z pinów które WŁAŚNIE zapisałaś: prawdziwe place_name, ich kolejność, suggested_time, walking_time_from_prev/distance_from_prev, day_metrics. DLACZEGO tak (godziny, dystanse, łuk energii dnia)"
}
</route_plan>

ZASADY FORMATU:
- route_reasoning (OSTATNIE pole JSON - wypełnij DOPIERO po ułożeniu wszystkich pinów, czytając ich realne place_name/suggested_time/distance_from_prev): 2-4 zdania wyjaśniające DLACZEGO ułożyłaś trasę WŁAŚNIE tak, CYTUJĄC KONKRETY z tego planu. OBOWIĄZKOWO odnieś się do:
  * konkretnych NAZW 2-3 miejsc z tego planu i ich KOLEJNOŚCI (dlaczego dane miejsce jest pierwsze/ostatnie),
  * REALNYCH sygnałów planu: godziny (suggested_time / godziny otwarcia), bliskość i klaster (walking_time_from_prev, distance_from_prev), łuk dnia (day_metrics: total_walking_km, crowd_level, energy_cost), kolacja/ostatni punkt blisko końca lub noclegu.
  Przykład DOBREGO tonu: "Zaczynasz od Muzeum X - otwiera o 10:00 i leży w centrum, więc masz tylko 8 min pieszo do Kawiarni Y. Dzień domykasz Restauracją Z wieczorem, tuż obok poprzedniego punktu, żeby nie wracać przez pół miasta (łącznie ~4 km pieszo)."
  ⛔ ZAKAZ generycznych ogólników bez konkretów ("ułożyłam wokół Twoich polubień", "idealna/dopasowana trasa", "świetny dzień"). Musisz cytować REALNE nazwy miejsc i liczby z pól planu (place_name, suggested_time, walking_time_from_prev, day_metrics). NIE wymyślaj faktów - jeśli czegoś nie wiesz (np. dokładnej godziny), oprzyj się na kolejności/bliskości.
  Ton ciepły, druga osoba. Bez długiego myślnika (— ani –), używaj "-" lub ":". Polskie sieroty: po pojedynczych literach a, i, o, u, w, z wstaw twardą spację (NBSP, U+00A0).
- day_metrics.total_walking_km: szacunkowa łączna odległość pieszego (suma distance_from_prev + wizyty) w km
- day_metrics.crowd_level: "low" | "medium" | "high" — na podstawie dat, popularności i heurystyki H7 (weekendowa logika tłumów)
- day_metrics.energy_cost: "low" | "medium" | "high" — na podstawie liczby punktów i długości dnia
- Pierwszy pin każdego dnia: walking_time_from_prev = null, distance_from_prev = null
- Każdy kolejny pin: szacuj walking_time_from_prev i distance_from_prev na podstawie znajomości miasta (tempo piesze ~75 m/min = ~1.2 km w 15 min)
- duration_minutes: czas spędzony w miejscu (bez dojścia) - dobierz realistycznie do typu miejsca
- suggested_time: godzina PRZYBYCIA = poprzedni suggested_time + poprzedni duration_minutes + czas dojścia
- category: restaurant | cafe | museum | park | viewpoint | shopping | nightlife | monument | church | market | bar | gallery | walk

## ZASADY MIEJSC (KRYTYCZNE)
- WYŁĄCZNIE miejsca możliwe do zweryfikowania jako istniejące
- Koordynaty precyzyjne (min. 4 miejsca po przecinku)
- Oficjalne nazwy zabytków (np. "Muzeum Narodowe w Krakowie", nie "Muzeum Historyczne")
- Restauracje/kawiarnie: TYLKO lokale z rozpoznawalną nazwą i recenzjami online. Jeśli nie jesteś pewien istnienia — wpisz "Kolacja w [dzielnica]" i opisz typ kuchni
- NIE WYMYŚLAJ nazw restauracji — to najczęstszy błąd który niszczy zaufanie do planu

## ⚠️ REGUŁA ROZMIARU PLANU (BEZWZGLĘDNA)
**Liczba pinów w planie = liczba miejsc polubionych przez usera. Bez wyjątku.**

- Jeśli user polubił 5 miejsc, plan ma DOKŁADNIE 5 pinów (nie 3, nie 4, dokładnie 5)
- Jeśli polubionych jest mniej niż dni, zostaw nadmiarowe dni puste: \`"pins": []\`
- NIGDY nie zostawiaj polubionych miejsc poza planem - user je wybrał, my je układamy
- NIGDY nie wymyślaj generycznych miejsc typu "Wieczorny spacer po Pradze-Północ" jako wypełniaczy
- NIGDY nie wstawiaj zmyślonych nazw atrakcji ani fałszywych koordynatów

Przykłady:
- 5 polubionych + 1 dzień → Dzień 1: WSZYSTKIE 5 miejsc
- 8 polubionych + 2 dni → łącznie 8 pinów (np. 4+4 lub 5+3)
- 3 polubione + 2 dni → Dzień 1: 3 polubione, Dzień 2: \`"pins": []\`

Pusty dzień to NIE jest błąd gdy user nie ma więcej polubień. Aplikacja pokaże user'owi empty state z CTA "Dodaj więcej miejsc".

## EDYCJA PLANU (ZASADA KLUCZOWA: JEDNA ZMIANA + NATYCHMIASTOWE WYKONANIE)

**BEZWZGLĘDNA ZASADA**: Gdy user prosi o JAKĄKOLWIEK zmianę planu — musisz natychmiast wyemitować PEŁNY zaktualizowany plan w bloku <route_plan>...</route_plan>. Nie ma możliwości odpowiedzi "OK, zaktualizuję" bez bloku planu.

- "Zamień X" → zaproponuj alternatywę w tej samej okolicy → WYEMITUJ pełny plan z zamianą
- "Dodaj Y" → wstaw w logiczne miejsce, zaktualizuj suggested_time kolejnych punktów → WYEMITUJ pełny plan
- "Usuń Z" → usuń → WYEMITUJ pełny plan
- NIE regeneruj całego planu strukturalnie — tylko zmień to co user prosił
- NIE mów "za chwilę", "przygotowuję", "zaktualizuję" — po prostu zrób to i pokaż plan
- Komentarz do zmiany: MAX 1 zdanie przed blokiem planu${superLikedPlaces?.length ? `\n\n## ⭐ MIEJSCA OBOWIĄZKOWE (SUPER LIKE)\nUżytkownik oznaczył te miejsca jako MUST-HAVE — MUSZĄ znaleźć się w planie bez wyjątku:\n${superLikedPlaces.map(p => `- ${p}`).join("\n")}` : ""}${likedPlaces?.length ? (restrictToLiked ? `\n\n## 🔒 TYLKO TE MIEJSCA — ZAKAZ DODAWANIA INNYCH\nUżytkownik wybrał te miejsca i NIE chce żadnych innych. BEZWZGLĘDNA ZASADA:\n- Używaj WYŁĄCZNIE miejsc z poniższej listy. Absolutny zakaz dodawania jakichkolwiek innych miejsc.\n- Jeśli lista jest krótka — zrób krótki plan z tych miejsc, NIE uzupełniaj innymi.\n- Każde miejsce spoza tej listy w planie = błąd krytyczny.\n\nDozwolone miejsca:\n${likedPlaces.map(p => `- ${p}`).join("\n")}` : `\n\n## 🎯 MIEJSCA DO UWZGLĘDNIENIA\nUżytkownik chce odwiedzić te miejsca — koniecznie wstaw je w plan:\n${likedPlaces.map(p => `- ${p}`).join("\n")}`) : ""}${(() => {
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
    const { preferences: rawPreferences, messages: userMessages, current_plan, force_plan, liked_places, liked_places_data, skipped_places, super_liked_places, ideal_day, current_time, current_date, restrict_to_liked, starting_location_lat, starting_location_lng, extend_mode } = await req.json();

    // Wstrzykuje top-level starting_location_lat/lng do preferences (snake_case w body
    // dla zgodnosci z JSON API convention - client wysyla na top level).
    const preferences = rawPreferences ? {
      ...rawPreferences,
      // [#5] Twardy limit 3 dni - AI nigdy nie planuje wiecej. Nadmiar miejsc
      // upycha w istniejace dni, nie tworzy nowych.
      numDays: Math.min(Math.max(Number(rawPreferences.numDays) || 1, 1), 3),
      starting_location_lat: starting_location_lat ?? rawPreferences.startingLocationLat,
      starting_location_lng: starting_location_lng ?? rawPreferences.startingLocationLng,
    } : rawPreferences;

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
                model: "google/gemini-2.5-flash",
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
        `Planujesz **${daysLabel}**. Chętnie przygotuję plan! 🎯`,
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
        const queryText = [ideal_day ?? "", preferences.city.trim()].filter(Boolean).join(". ");
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
        // Build query text from current trip context (city). Memory matching opiera się
        // o embedding podsumowań poprzednich tras + RPC match_memories.
        const queryText = [
          preferences.city?.trim() ?? "",
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
        const personalityType = inferPersonalityType(profileData ?? undefined);
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
    // Realne wspolrzedne polubionych miejsc (z bazy) do promptu - model klastruje po prawdziwej
    // geografii zamiast zgadywac z nazw (bylo: piny za daleko od siebie, user musial poprawiac uklad).
    const likedGeoStr = (liked_places_data ?? [])
      .filter((p: { place_name?: string; latitude?: number; longitude?: number }) => p?.place_name && p.latitude != null && p.longitude != null)
      .map((p: { place_name: string; latitude: number; longitude: number; address?: string }) => `- ${p.place_name}: [${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}]${p.address ? ` (${p.address})` : ""}`)
      .join("\n");
    const systemPrompt = buildSystemPrompt(preferences, current_plan, profileData ?? undefined, previousDaysContext || undefined, memoryContext || undefined, liked_places ?? undefined, isToday ? (current_time ?? undefined) : undefined, scrapedPlacesContext || undefined, ideal_day ?? undefined, skipped_places ?? undefined, routeExamplesContext || undefined, super_liked_places ?? undefined, previousDayPlaces.length > 0 ? previousDayPlaces : undefined, Object.keys(previousDayCategoryCounts).length > 0 ? previousDayCategoryCounts : undefined, restrict_to_liked ?? false, extend_mode ?? false, likedGeoStr || undefined);

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
      ? "\n\nWYGENERUJ TERAZ PLAN w bloku <route_plan>...</route_plan>. Napisz 1 krótkie zdanie komentarza i natychmiast wygeneruj plan zgodnie ze wszystkimi heurystykami z sekcji HEURYSTYKI PLANOWANIA. WAŻNE: Dobierz miejsca ściśle pod PROFIL UŻYTKOWNIKA i jego priorytety — każdy plan powinien być inny, unikaj powtarzania tych samych zestawów atrakcji."
      : "";

    const aiMessages = [
      { role: "system", content: systemPrompt + finishInstruction },
      ...userMessages,
    ];

    // Flash = PRIMARY (znacznie szybsze generowanie planu, ~3-5x; jakosc ukladania
    // wybranych miejsc w dzien jest w pelni wystarczajaca). Pro = fallback na wypadek
    // bledu Flash (rzadka sciezka). Wczesniej Pro bylo primary -> dlugie ladowanie planu.
    const PRIMARY_MODEL = "google/gemini-2.5-flash";
    const FALLBACK_MODEL = "google/gemini-2.5-pro-preview-06-05";

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

        // Post-processing: filtruj fake placeholdery jesli AI je dodalo mimo
        // explicit zakaz w prompcie. Defensive layer - bez polegania na cooperacji AI.
        // Bug 2026-06-02: gdy user wybiera mało polubionych dla N dni, AI generuje
        // generic miejsca typu "Wieczorny spacer po Pradze-Polnoc" z fake koordynatami.
        if (plan && Array.isArray(plan.days) && (liked_places?.length || restrict_to_liked)) {
          const GENERIC_FRAZES = [
            /wieczorny spacer/i,
            /romantyczna kolacja/i,
            /klimatyczna kawiarnia/i,
            /^punkt widokowy$/i,
            /^spacer po/i,
            /^kolacja w /i,
            /^lunch w /i,
            /^kawa w /i,
            /^chill w /i,
            /^wieczor w /i,
            /^poranek w /i,
          ];
          const isGeneric = (name: string): boolean => {
            const trimmed = (name ?? "").trim();
            if (!trimmed) return true;
            return GENERIC_FRAZES.some(rx => rx.test(trimmed));
          };
          // Normalizacja do porownan: lowercase + trim + usun interpunkcje + collapse whitespace
          const normalize = (s: string) => s
            .toLowerCase()
            .trim()
            .replace(/[.,!?;:()\[\]"'`–—-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const allowedRaw = [...(liked_places ?? []), ...(super_liked_places ?? [])];
          const allowedNorm = allowedRaw.map(normalize);

          // Fuzzy match: AI moze zwrocic "Stary Dom Restauracja" gdy polubione "Stary Dom",
          // albo "Pijalnia Wodki" gdy polubione "Pijalnia Wodki i Piwa". Akceptujemy
          // bidirectional substring (po normalizacji). Tylko wycina jesli zadna z polubionych
          // nie ma sensownego overlap z nazwa pin'a.
          const matchesAnyLiked = (pinName: string): { matched: boolean; matchedTo: string | null } => {
            const pinNorm = normalize(pinName);
            if (!pinNorm) return { matched: false, matchedTo: null };
            for (let i = 0; i < allowedNorm.length; i++) {
              const liked = allowedNorm[i];
              if (!liked) continue;
              // Exact match
              if (liked === pinNorm) return { matched: true, matchedTo: allowedRaw[i] };
              // Substring bidirectional - jedna nazwa zawiera druga (i overlap > 50% krotszej)
              const shorter = liked.length < pinNorm.length ? liked : pinNorm;
              const longer = liked.length < pinNorm.length ? pinNorm : liked;
              if (longer.includes(shorter) && shorter.length >= 4) {
                return { matched: true, matchedTo: allowedRaw[i] };
              }
            }
            return { matched: false, matchedTo: null };
          };

          let filteredCount = 0;
          const filteredDays = plan.days.map((day: any) => {
            const pins = Array.isArray(day.pins) ? day.pins : [];
            const filteredPins = pins.filter((pin: any) => {
              const name = (pin.place_name ?? "").toString();
              // Wyrzuc generic placeholdery
              if (isGeneric(name)) {
                console.warn(`[plan-route] Filter generic placeholder: "${name}"`);
                filteredCount++;
                return false;
              }
              // Jesli restrict_to_liked=true, wymagaj fuzzy match z polubionymi
              if (restrict_to_liked) {
                const { matched, matchedTo } = matchesAnyLiked(name);
                if (!matched) {
                  console.warn(`[plan-route] Filter out non-liked place (restrict mode): "${name}"`);
                  filteredCount++;
                  return false;
                }
                // Normalize do oryginalnej polubionej nazwy zeby plan byl spojny z DB lookup
                if (matchedTo && matchedTo !== name) {
                  console.log(`[plan-route] Normalized "${name}" -> "${matchedTo}"`);
                  pin.place_name = matchedTo;
                }
              }
              return true;
            });
            return { ...day, pins: filteredPins };
          });
          plan.days = filteredDays;
          console.log(`[plan-route] After post-processing: ${filteredDays.map((d: any) => `Day${d.day_number}=${d.pins.length}`).join(", ")}, filtered out: ${filteredCount}`);

          // SAFEGUARD: Jesli AI mimo prompta wycial ktores polubione (np. uznal ze
          // park jest zamkniety wieczorem), wymuszamy dodanie ich z powrotem do
          // ostatniego dnia z note 'hours_warning'. User decyduje co zrobic z tymi
          // miejscami - moze je usunac recznie. Lepiej miec opcje niz zero.
          if (restrict_to_liked && Array.isArray(liked_places) && liked_places.length > 0) {
            const planPinNames = new Set<string>();
            for (const d of plan.days) {
              for (const pin of (d.pins ?? [])) {
                const n = (pin.place_name ?? "").toLowerCase().trim();
                if (n) planPinNames.add(n);
              }
            }
            const dataByName = new Map<string, any>();
            for (const item of (liked_places_data ?? [])) {
              if (item?.place_name) {
                dataByName.set(item.place_name.toLowerCase().trim(), item);
              }
            }
            const missing = liked_places.filter((name: string) => !planPinNames.has(name.toLowerCase().trim()));
            if (missing.length > 0) {
              console.warn(`[plan-route] SAFEGUARD: AI wycial ${missing.length} polubionych. Dodaje do ostatniego dnia z hours_warning.`);
              const lastDay = plan.days[plan.days.length - 1];
              if (lastDay) {
                if (!Array.isArray(lastDay.pins)) lastDay.pins = [];
                for (const missingName of missing) {
                  const meta = dataByName.get(missingName.toLowerCase().trim()) ?? {};
                  lastDay.pins.push({
                    place_name: missingName,
                    address: "",
                    description: meta.description ?? "⚠️ Sprawdź godziny otwarcia - możliwe że zamknięte o tej porze",
                    suggested_time: "",
                    duration_minutes: 60,
                    category: meta.category ?? "walk",
                    latitude: meta.latitude ?? 0,
                    longitude: meta.longitude ?? 0,
                    day_number: lastDay.day_number,
                    walking_time_from_prev: null,
                    distance_from_prev: null,
                    hours_warning: true,
                  });
                }
                console.log(`[plan-route] After safeguard: ${plan.days.map((d: any) => `Day${d.day_number}=${d.pins.length}`).join(", ")}`);
              }
            }
          }
        }

        // Extend mode safeguard: w extend_mode chronimy istniejace piny przed
        // zmiana/usunieciem przez AI, ALE pozwalamy dopisac nowo polubione miejsca.
        // Dla kazdego dnia ktory mial pins w current_plan: zachowaj oryginalne piny
        // (w oryginalnej kolejnosci) i DOPISZ na koniec nowe piny ktorych jeszcze nie
        // bylo (np. swiezo polubione). Wczesniej puste dni AI wypelnia swobodnie.
        // UWAGA: NIE nadpisujemy pinow dnia oryginalami (to wycinalo dodane miejsce).
        if (extend_mode && current_plan?.days && Array.isArray(plan?.days)) {
          const currentByDayNum = new Map<number, any>();
          for (const d of current_plan.days as any[]) {
            currentByDayNum.set(d.day_number, d);
          }
          plan.days = plan.days.map((day: any) => {
            const original = currentByDayNum.get(day.day_number);
            if (original && Array.isArray(original.pins) && original.pins.length > 0) {
              const origNames = new Set(
                (original.pins as any[]).map((p) => (p.place_name ?? "").toLowerCase().trim()).filter(Boolean)
              );
              // Nowe piny ktore AI dodalo do tego dnia (nie byly w oryginale).
              const appended = (day.pins ?? []).filter(
                (p: any) => !origNames.has((p.place_name ?? "").toLowerCase().trim())
              );
              // Oryginalne piny bez zmian + dopisane nowe na koniec.
              return { ...day, pins: [...original.pins, ...appended] };
            }
            return day;
          });
          console.log(`[plan-route] After extend_mode safeguard: ${plan.days.map((d: any) => `Day${d.day_number}=${d.pins.length}`).join(", ")}`);
        }
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

    // Uziem piny realnymi wspolrzednymi. Na force_plan tylko z bazy (freeOnly - zero platnego
    // Google, szybki initial load); poza tym pelne gruntowanie (Google Text Search dla miejsc
    // spoza polubionych). Potem przelicz REALNE odleglosci pieszo (haversine) - koniec z
    // liczbami zmyslonymi przez model i planami gdzie punkty sa za daleko od siebie.
    if (plan) {
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
      if (GOOGLE_API_KEY) {
        try {
          plan = await verifyAndGroundPlan(plan, GOOGLE_API_KEY, liked_places_data, force_plan === true);
        } catch (err) {
          console.error("Places grounding failed, using AI data:", err);
        }
      }
      plan = recomputeDistances(plan);
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

// Normalizacja nazwy do dopasowania pin <-> polubione miejsce.
function normName(s: string): string {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

async function verifyPin(pin: any, city: string, apiKey: string, likedCoordMap?: Map<string, { lat: number; lng: number; place_id?: string | null }>, freeOnly = false): Promise<any> {
  // KROK 0: Uziem pin REALNYMI wspolrzednymi polubionego miejsca (z bazy `places`), jesli
  // je mamy. To autorytatywne i DARMOWE - omija Google Text Search, ktory bral pierwszy
  // wynik dla "nazwa + miasto" (czesto inne miejsce o tej samej nazwie -> piny w zlych
  // miejscach na mapie). Dotyczy gl. trybu restrict_to_liked (user wybral konkretne miejsca).
  const known = likedCoordMap?.get(normName(pin.place_name));
  if (known && Number.isFinite(known.lat) && Number.isFinite(known.lng) && (known.lat !== 0 || known.lng !== 0)) {
    return {
      ...pin,
      latitude: known.lat,
      longitude: known.lng,
      ...(known.place_id ? { place_id: known.place_id } : {}),
    };
  }

  // freeOnly: uziemiamy tylko z bazy (polubione) - bez platnego Google Text Search.
  // Uzywane na force_plan (szybki initial load) - piny spoza polubionych zostaja z coordami AI.
  if (freeOnly) return pin;

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
    if (lat == null || lng == null) return pin; // brak geometrii -> zostaw AI jako ostatecznosc

    // Ufamy REALNEMU wynikowi Google ("nazwa + miasto") zamiast wspolrzednych
    // ZMYSLONYCH przez AI. Stary bug: gdy halucynacja AI byla >60km od Google, zostawal
    // wynik AI -> piny w zlych miejscach na mapie. Google = miejsce ugruntowane w danych.
    return {
      ...pin,
      place_name: place.name ?? pin.place_name,
      address: place.formatted_address ?? pin.address,
      latitude: lat,
      longitude: lng,
      place_id: place.place_id ?? null,
    };
  } catch {
    return pin; // On any error keep AI data
  }
}

async function verifyAndGroundPlan(plan: any, apiKey: string, likedData?: any[], freeOnly = false): Promise<any> {
  // Mapa: znormalizowana nazwa polubionego miejsca -> jego REALNE wspolrzedne (z bazy).
  const likedCoordMap = new Map<string, { lat: number; lng: number; place_id?: string | null }>();
  for (const item of (likedData ?? [])) {
    if (item?.place_name && item.latitude != null && item.longitude != null) {
      likedCoordMap.set(normName(item.place_name), { lat: Number(item.latitude), lng: Number(item.longitude), place_id: item.place_id ?? null });
    }
  }
  const verifiedDays = await Promise.all(
    (plan.days ?? []).map(async (day: any) => ({
      ...day,
      pins: await Promise.all(
        (day.pins ?? []).map((pin: any) => verifyPin(pin, plan.city ?? "", apiKey, likedCoordMap, freeOnly))
      ),
    }))
  );
  return { ...plan, days: verifiedDays };
}

// Przelicza REALNE odleglosci pieszo (haversine) miedzy kolejnymi pinami z ich wspolrzednych,
// zamiast liczb zmyslonych przez model. Tempo pieszo ~75 m/min. Aktualizuje tez
// day_metrics.total_walking_km. Wolane PO ugruntowaniu (coordy sa juz realne).
function recomputeDistances(plan: any): any {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const havKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  };
  for (const day of plan?.days ?? []) {
    let prev: { lat: number; lng: number } | null = null;
    let totalKm = 0;
    for (const pin of day?.pins ?? []) {
      const lat = Number(pin.latitude);
      const lng = Number(pin.longitude);
      const valid = Number.isFinite(lat) && Number.isFinite(lng);
      if (prev && valid) {
        const km = havKm(prev, { lat, lng });
        pin.distance_from_prev = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
        pin.walking_time_from_prev = `${Math.max(1, Math.round((km * 1000) / 75))} min`;
        totalKm += km;
      } else {
        pin.walking_time_from_prev = null;
        pin.distance_from_prev = null;
      }
      if (valid) prev = { lat, lng };
    }
    if (day.day_metrics) day.day_metrics.total_walking_km = Math.round(totalKm * 10) / 10;
  }
  return plan;
}
