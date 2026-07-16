# Analiza wywiadów - runda pilotażowa

**Rozmówcy:** Janek + Marysia (para, ten sam wyjazd do Gdańska)
**Cel badania:** walidacja wartości aplikacji
**Data analizy:** 2026-07-05
**Materiał:** Janek (1 nagranie), Marysia (3 części tej samej sesji)

---

## ⚠️ Zastrzeżenia metodologiczne (przeczytaj PRZED wnioskami)

To jest **runda pilotażowa**, nie walidacja. Cztery poważne ograniczenia, które zmieniają jak czytać wyniki:

1. **N=2 i to para na tym samym wyjeździe** → obserwacje są skorelowane, nie niezależne. To praktycznie jeden przypadek widziany z dwóch stron, nie dwa.
2. **🔴 OBOJE to lokalsi Gdańska** (mieszkania rodzinne, znają miasto od lat). To krytyczny bias: **rdzenna wartość aplikacji = odkrywanie nieznanych miejsc, a tu nie miała jak się odpalić.** Oboje sami to nazwali (patrz `value/discovery` niżej). To nie znaczy że wartości nie ma - znaczy że ten test jej nie mierzył.
3. **Zła pogoda** → dużo czasu w domu, mało realnego używania w terenie. Używali głównie do planowania/przeglądania, nie do nawigacji w trakcie.
4. **🔴 Tryb grupowy padł technicznie** → flagowy use case (wspólne planowanie) NIE został przetestowany end-to-end u żadnego z nich.

**Wniosek nadrzędny:** te wywiady są cenne **diagnostycznie** (co poprawić w produkcie + jak rekrutować w następnej rundzie), ale **nie rozstrzygają o wartości**. Największy insight jest metodologiczny: następnym razem rekrutuj ludzi jadących w miejsce, którego NIE znają.

---

## Metryki (per user) + interpretacja wg progów z planu

| Sygnał | Janek | Marysia | Próg | Wynik |
|---|---|---|---|---|
| **Discovery hit** (odkrył miejsce + tam był) | ❌ (mieszka tam) | ❌ (zna Gdańsk) | ≥1 z 2 | **Poniżej - ale zaburzony** (oboje lokalsi) |
| **Trasa > zwykły sposób** (konkret) | ✅ oszczędność czasu | ✅ wszystko w jednym | ≥1 z 2 | **Spełniony** |
| **PMF - zniknięcie apki** | "czas" / strata czasu | "na pewno zawód" | brak "obojętnie" | **Kierunkowo pozytywny** (nikt obojętny, nikt "bardzo") |
| **Powrót dobrowolny** (w trakcie) | ✅ "byliśmy zaangażowani" | ✅ siadała gdy tylko mogła | ≥1 z 2 | **Spełniony** (po wyjeździe: 0/2) |
| **Jak nazywa apkę** | "to jest od Tindera" | "działa jak Tinder, swipe swipe" | - | **Tinder (oboje!)** |
| **Segment** | próba grupowo → wyszło solo | próba grupowo → FAIL → solo | - | Chcieli grupowo, nie zadziałało |

**Odczyt wg reguł z planu:**
- Wartość **oszczędności czasu / agregacji** = potwierdzona (2/2, konkretnie).
- Wartość **odkrywania** = niepotwierdzona, bo test był pod nią za słaby (oboje lokalsi). To „cannot conclude", nie „failed".
- PMF: brak czerwonej flagi (nikt „obojętnie"), ale też brak mocnego „bardzo by mi było szkoda". Spójne z tym, że discovery się nie odpaliło.

---

## Kodowanie tematyczne

### `value/` - wartość

**`value/time-saving` (mocny, 2/2)** - najsilniej wybrzmiała wartość
- Janek: *„to by zajęło mi pewnie godzinę, a tutaj bym to zrobił w 15 minut"* (o planowaniu Rzymu)
- Janek: *„taka aplikacja bardzo dużo ułatwia"*
- PMF Janka = dokładnie to: na pytanie co traci gdyby apka zniknęła → *„Czas"*

**`value/all-in-one` (mocny, Janek)** - agregacja zabytki+jedzenie w jednym
- Janek: *„to jest wszystko w jednym... nie musimy dzielić tego, że tutaj są zabytki, tutaj są restauracje"*
- Kontrast z jego obecnym flow: TripAdvisor + przewodnik + TikTok = *„zawsze to i tak zajmuje czas"*

**`value/agency` (Janek)** - user sam wybiera, nie idzie ślepo za autorytetem
- Janek: *„człowiek chce też coś wybrać jakby od siebie, a nie, że po prostu na TikToku będzie zapisywał"*
- Kontra do „autorytetu kulinarnego" (Maciej Je), który bywa drogi/oderwany

**`value/aggregated-content` (Marysia)** - zdjęcia + opinie już w apce
- Marysia: *„już było więcej zdjęć dodanych, widziałam że były pierwsze opinie... nie mam takiej potrzeby, żeby wchodzić gdzieś dalej, z zewnątrz"*
- ⚠️ ALE z wyjątkiem menu (patrz `req/menu`)

**`value/discovery` (NIE zadziałał - ale oboje rozumieją prop) 🔴**
- Janek: przeglądając widział nieznane miejsca (*„dużo było takich miejsc, których nie znałem"*), ale ich nie odwiedził (*„nie stosowały nam"*)
- Marysia: *„większość już znałam"* → dla niej apka = *„przypomnienie, danie ulubionych rzeczy"*
- Marysia formułuje prop wprost: *„to jest super dla osób, które pierwszy raz jeżdżą... gdybym jechała do Wrocławia, w którym nigdy nie byłam, byłabym osobą, dla której jest ta aplikacja stworzona"*
- **To jest złoto:** userzy sami mówią KIEDY apka ma wartość (nieznane miasto) i przyznają, że oni nie byli w tym scenariuszu

### `friction/` - tarcia i bugi

**`friction/group-mode-broken` (KRYTYCZNY, 2/2) 🔴**
- Sesja grupowa zawiesza się: host wybiera, drugi uczestnik utknął na „w toku"
- Marysia: *„Jasiek cały czas miał, że jest w toku... a ja już miałam to zrobione"*, przeszli tylko 1 kategorię
- Chcieli tego use case'u (Janek: *„celem było, żeby razem korzystać"*), ale się nie udało
- Podobno naprawione aktualizacją, ale **nie przetestowane ponownie**

**`friction/click-into-place` (Janek, naprawione w trakcie)**
- Na początku klikanie w kartę miejsca nie działało (brak przycisków / nie wchodziło do wizytówki)
- Naprawione aktualizacją podczas wyjazdu

**`friction/filters-scroll` (Marysia, naprawione w trakcie)**
- Przy włączonych filtrach nie dało się scrollować w dół; zrobiła screena
- Naprawione aktualizacją; odebrała to nawet pozytywnie (*„o, naprawili, fajnie"*)

**`friction/onboarding-discoverability` (oboje, drobne)**
- Marysia nie zauważyła od razu nawigacji punkt-punkt ani filtrów
- Janek nie wiedział co to dziennik

### `lang/` - język i pozycjonowanie

**`lang/tinder-model` (EMERGENTNY, 2/2, mocny) 🔴🎯**
- Janek (moment „o, fajne"!): *„To jest chyba od Tindera"* → nostalgia (poznał partnerkę na Tinderze)
- Marysia (jak by opisała): *„działa trochę jak Tinder... dajesz w prawo, dajesz w lewo, a potem ci to tworzy trasę"*, *„porównałabym to do Tindera, bo dla mnie to jest takie swipe, swipe"*
- **Tenskja z brandem:** „swipe"/„match" to zakazane słowa w produkcie, a natywny model mentalny obojga userów to DOKŁADNIE Tinder. To nie przypadek - to jak oni to rozumieją i sprzedają dalej.

**`lang/target-parents` (EMERGENTNY, 2/2)**
- Oboje niezależnie wskazali **starszych / rodziców** jako idealnego usera, NIE siebie
- Marysia: *„pomyślałam o mojej mamie albo o moich rodzicach... oni nie ogarniają aż tak tych wszystkich rzeczy"*
- Janek: *„bym polecił osobom starszym i osobom jak ja, którym nie chce się wchodzić w planowanie"*
- **Insight pozycjonujący:** Gen Z widzi siebie jako zbyt zaradnych; wartość = dla mniej cyfrowo biegłych LUB dla siebie w nieznanym mieście

### `req/` - prośby o funkcje (pamiętaj: to rozwiązania, pod spodem szukaj problemu)

**`req/menu` (Marysia, mocny) - problem: musi wychodzić z apki**
- *„te menu, bo to by spowodowało, że ja na pewno bym już nie wychodziła w tej aplikacji"*
- Oboje z Jaśkiem zawsze sprawdzają menu/kartę restauracji przed wyborem
- **To dźwignia retencji:** menu = powód, by nie opuszczać apki

**`req/guide-badge` (Janek) - problem: rozpoznanie jakości bez „drogo"**
- Prosi o oznaczenie typu przewodnik/Michelin przy lokalach gastro
- Problem pod spodem: gwiazdka = „zapłacę fortunę"; przewodnik = „wyróżnia się, ale podobna cena"

**`req/more-places` (oboje) - rozumieją, że w toku**
- Baza za mała, dużo znanych miejsc; oboje zakładają, że przybędzie

**`req/filters` (Marysia, pozytyw)** - filtry (wegańskie/bezglutenowe/bez laktozy) = *„mega fajne"*, bardzo jej się podobają

### Nieużywane funkcje
- **Dziennik:** 0/2 (nikt nie użył, Janek nie wiedział co to)
- **Nawigacja punkt-punkt:** Marysia zauważyła późno
- **Powrót po wyjeździe:** 0/2 (używali w trakcie planowania, nie wracali po)

---

## Top wnioski (uszeregowane)

1. **🔴 Test nie zmierzył rdzennej wartości - bo dobór rozmówców.** Oboje lokalsi Gdańska → „odkrywanie nieznanego" nie miało jak zadziałać. Sami to nazwali. **Najważniejsza lekcja: rekrutuj ludzi jadących w nieznane miejsce.**
2. **🔴 Tryb grupowy padł u obojga.** Flagowy use case, chcieli go, nie zadziałał (zawieszenie „w toku"). Wymaga potwierdzenia że fix działa + retestu.
3. **🎯 Natywny model = Tinder (oboje).** Kolizja z zakazem „swipe/match". Userzy i tak tak myślą i tak polecają dalej. Do przemyślenia strategicznie (nie zmiana copy w apce, ale świadomość jak to żyje w głowach).
4. **✅ Wartość oszczędności czasu + agregacji = potwierdzona.** Konkretnie, przez oboje. To najbezpieczniejszy filar wartości na dziś.
5. **Menu w apce = dźwignia retencji.** Marysia: to jedyny powód, dla którego jeszcze wychodzi z aplikacji.
6. **Gen Z widzi target w rodzicach, nie w sobie** (chyba że nieznane miasto). Sygnał do pozycjonowania.
7. **Bugi łapane i naprawiane na żywo** (klik w kartę, scroll filtrów) - nie były dealbreakerami, jeden odebrany wręcz pozytywnie.

---

## Rekomendacje

### Produkt
- [ ] **Potwierdzić fix trybu grupowego** i przejść go end-to-end na 2 urządzeniach (host + gość, >1 kategoria)
- [ ] Rozważyć **menu restauracji w wizytówce** (retencja - trzyma w apce)
- [ ] Zwiększać **bazę miejsc**, priorytet mniej oczywiste/lokalne (to odblokowuje „discovery")
- [ ] Onboarding: wyeksponować **dziennik, filtry, nawigację** (przeoczone)
- [ ] Rozważyć **oznaczenie „przewodnik"** przy gastro (sygnał jakości ≠ cena)

### Następna runda badań (ważniejsze niż produktowe!)
- [ ] **Rekrutuj osoby jadące w NIEZNANE miasto** - inaczej znów nie zmierzysz core value
- [ ] **Segmentuj:** min. kilka osób realnie testujących **tryb grupowy** (gdy już działa)
- [ ] Docelowo 6-7 osób (próg z planu), świadomie dobranych pod scenariusz „nie znam miasta"
- [ ] Rozważ 1-2 rozmówców z profilu „rodzic / mniej cyfrowy" - userzy sami ich wskazali jako target

---

## Surowe cytaty-kotwice (do przytoczenia mentorce)

- **Discovery prop (Marysia):** „gdybym jechała do Wrocławia, w którym nigdy nie byłam... byłabym osobą, dla której jest ta aplikacja stworzona"
- **Time-saving (Janek):** „to by zajęło mi godzinę, a tutaj bym to zrobił w 15 minut"
- **Tinder (Marysia):** „porównałabym to do Tindera, bo dla mnie to jest takie swipe, swipe"
- **Target (Marysia):** „pomyślałam o mojej mamie albo o moich rodzicach"
- **Retencja/menu (Marysia):** „te menu... to by spowodowało, że ja na pewno bym już nie wychodziła w tej aplikacji"
