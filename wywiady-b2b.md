# Analiza wywiadów - B2B (lokale / gastronomia)

**Cel badania:** walidacja propozycji wartości Trasy dla firm (wizytówki, feed/eventy Premium, analityka) oraz modelu monetyzacji. Wywiady z właścicielami / menadżerami lokalnych biznesów.
**Data analizy:** 2026-07-07 (żywy dokument, dopisujemy kolejne wywiady)
**Materiał:** 1 wywiad (Willa Brzegi), kolejne w drodze.

> Konsultowane z: strateg biznesowy + product manager. Zestawienie z rundą B2C: [wywiady-analiza.md](wywiady-analiza.md).

---

## ⚠️ Zastrzeżenia metodologiczne (przeczytaj PRZED wnioskami)

1. **N=1 na razie** → to sygnały jakościowe, nie dowód. Nie wyciągaj wniosków ilościowych.
2. **Rozmówca B2B, ale odpowiadał też jako B2C planista.** Jego najcenniejsze wypowiedzi dotyczą tego, jak SAM szuka miejsc, gdy podróżuje - to walidacja B2C ustami klienta B2B, nie niezależny głos B2C.
3. **Bias segmentu:** Willa Brzegi to lokal **wysycony** (zabookowany eventami 1-2 lata do przodu). Mówi nam kto NIE zapłaci za leady, nie kto zapłaci. Potrzebna "anty-Willa" (nowa, głodna ruchu knajpa) do zbalansowania.
4. **Transkrypcja auto (mojibake + potoczny język)** → część cytatów parafrazowana, nie dosłowna.

**Wniosek nadrzędny:** ten wywiad jest mocny **diagnostycznie** (rdzeń wizytówki + persona leniwego planisty + napięcie monetyzacyjne), ale segmentowo jednostronny. Kolejne wywiady muszą trafić w lokale z realną potrzebą ruchu.

---

## Wywiad 1 - Willa Brzegi (właściciel / menadżer)

**Profil lokalu:** restauracja + sala eventowa, południe Warszawy (daleko od centrum, "pół drogi do Olsztyna" od Woli/Pragi). Parter + piętro z salą zabaw dla dzieci. ~4.7/1700 opinii Google. Zabookowany eventami (komunie 1-2 lata do przodu, wesela co weekend latem, stypy). Zero czasu na marketing ("mamy w kurwa roboty").

### Metryki / sygnały

| Sygnał | Odczyt | Komentarz |
|---|---|---|
| **Rozpoznaje lukę Trasy** (jako planista) | ✅ mocny | "brakuje jednego miejsca gdzie to zebrane" |
| **Willingness-to-pay (ten lokal)** | ❌ bliskie zeru | Wysycony, nie chce więcej ruchu, chce go obsłużyć |
| **Nazywa wizytówkę** | menu + zdjęcia | Reszta = szum dla niego |
| **Nieufność do Google reviews** | ✅ mocny | Kupowane opinie, "100 zł za opinię" |
| **Gotowość testu (TestFlight)** | ✅ tak | Otwarty na przedpremierowe testy |
| **Segment** | event venue, wysycony | Zły ICP na Premium-za-leady, dobry świadek value B2C |

---

### Kodowanie tematyczne

#### `value/` - wartość produktu (mówi jako PLANISTA B2C)

**`value/all-in-one` (mocny)** - dokładnie nasza teza, powiedziana przez klienta
- *"Brakuje mi jednego miejsca, w którym byłoby to zebrane i żebym wiedział, że takie coś istnieje. Czyli mniej więcej to, co robicie."*
- *"Google tak nawalone, że ciężko się poruszać"* → mapka knajp w jednym miejscu
- Zbieżne z `value/all-in-one` Janka w rundzie B2C. **Trzeci niezależny głos na tę samą lukę.**

**`value/low-effort` (mocny)** - persona leniwego planisty
- *"Jakby coś zrobiło to za mnie, no to już bym się zastanowił."*
- All-inclusive mindset: nie chce sam szukać noclegów, dojazdów, układać planu. *"Nie jest dla nas odpoczynkiem organizacja."*
- Potwierdza "speed dating z miastem" (niski wysiłek), ALE ujawnia lukę: dopasowania → trasa wciąż wymaga pracy usera. → sygnał do "Zrób plan za mnie" (auto-plan 1-tap).

**`value/anti-fake` (mocny, NOWY)** - nieufność do kupowanych opinii = nasza przewaga
- Znajomy w marketingu płacił *"100 zł za opinię"* → sceptycyzm wobec wiarygodności Google reviews.
- Nasz model bez ocen gwiazdkowych (notki userów + polecajki influencerów) da się spozycjonować jako "nieprzekupny". Haczyk sprzedażowy, nie tylko ograniczenie MVP.

#### `req/` - wymagania wobec wizytówki

**`req/menu` (mocny)** - menu = pole #1 do decyzji
- *"Chyba menu jest najważniejsze przynajmniej dla mnie."*
- ⚠️ Mamy `menuImageUrls` (zdjęcia/PDF), ale **gated za Premium**. Skoro to pole #1 dla decyzji USERA końcowego, gatowanie obniża wartość całej appki B2C. Do decyzji: podstawowe menu (1-2 zdjęcia) w darmowej wizytówce?
- ⚠️ PDF/miniatury w drawerze 4:3 = słabe UX. Rozważyć osobny czytelny widok menu.

**`req/photos` (mocny)** - decyzja idzie po zdjęciach
- *"Zobaczysz zdjęcia i po samych zdjęciach tam pójdzie."*
- Potwierdza hero + galeria 4:3 + blokadę Google Photos gdy lokal ma własne. Rdzeń dobry.

**`req/attributes` (NOWY, brak w produkcie)** - atrybuty lokalu nie mają reprezentacji
- Sala zabaw dla dzieci = jego killer-differentiator, ale *"kto ma to wiedzieć, to nie wie."*
- Brak tagów/atrybutów w modelu danych ("przyjazne dzieciom", "muzyka na żywo", "animacje", "parking").
- MVP-hack: tagi jako **badge na wizytówce** (biznes wpisuje / team seeduje). Filtrowanie = v2, gdy jest masa danych.

**`req/updates` (potwierdza feed)** - treść eventowa istnieje
- Nowe menu (fotografka cyklicznie), weekendowe animacje (malowanie buziek, balony, żywa muzyka w piątki), grille.
- Idealny use-case pod Premium feed/eventy. To treść eventowa, nie evergreen.

#### `biz/` - jak promują dziś (kontekst konkurencyjny)

**`biz/channels`** - kanały obecne
- Banery fizyczne w promieniu okolicy; Facebook Ads przez agencje ("Accy"); Instagram (działa lepiej niż FB); word of mouth / renoma.
- NIE robią: konkursów, viralowych filmików z hashtagami/trendami, TikToka.

**`biz/pain`** - bóle biznesu
- Sezonowość: gdy cała gastro "martwa" (zła pogoda), narzekają → wartość w **zapełnianiu dołków**, nie leadach na komunie.
- Zero czasu na self-marketing → onboarding musi być "done-for-you".
- Lokalizacja daleko od centrum → obawa czy ludzie dojadą z drugiego końca miasta.

#### `risk/` - napięcia i ryzyka

**`risk/pay-to-win` (KRYTYCZNY)** - rozmówca sam nazwał sprzeczność naszego modelu
- *"Gdzieś to pewnie będzie wiązało się z pieniędzmi, więc mają przewagę ci, co mają na marketing."*
- Prowadząca zadeklarowała na nagraniu: *"chcemy wyrównywać szanse, nie kto ma budżet ten wygrywa."*
- **To sprzeczność z monetyzacją przez featured placement.** Sprzedaż pozycji w rankingu łamie obietnicę i podważa rdzeń (kuracja jakości > kto zapłacił).

**`risk/saturated-icp`** - wysyceni właściciele = zimny lead
- WTP na leady ≈ 0. Nie sprzedawaj Willi Premium 149 zł za leady - spali pitch.
- Ryzyko pustej podaży: jeśli tacy nie założą wizytówki sami, baza zapełni się lokalami "z budżetem" = odwrotnie do obietnicy jakości.

---

### Rekomendacje z Wywiadu 1

**Produktowo (kolejka po iOS submit):**
1. Domknij `photo_url` (znany blocker) - bez zdjęć teza wywiadu upada.
2. Tagi/atrybuty jako badge (S/M, bez filtrów) - biznes wpisuje / team seeduje.
3. Decyzja: menu (1-2 zdjęcia) poza Premium - wysoki wpływ na B2C value.
4. Spike "Zrób plan za mnie" - 1-tap auto-plan (bazowo na `PlanChatExperience`).

**Strategicznie (przed spotkaniem z mentorką - [project_monetization_open_mentor]):**
5. Rozdziel B2B: darmowa wizytówka = higiena widoczności; płatna warstwa = narzędzia/analityka/eventy, NIE ranking.
6. Pitch NIE "damy ci leady", tylko: *"jesteś tam, gdzie ludzie planują trasę, zanim wpiszą cię w Google - i pokazujemy cię za jakość, nie za budżet."*
7. Onboarding done-for-you (auto-zaciągnięcie menu/zdjęć z Google/IG, właściciel zatwierdza).

**Walidacyjnie (kolejne wywiady):**
8. Zrób "anty-Willę": nowa/kameralna knajpa, głodna ruchu, poza sezonem - tam WTP za leady żyje.
9. Przetestuj napięcie wprost: "czy zapłacilibyście za wyższą pozycję?" vs "czy przeszkadza wam, że konkurent może ją kupić?".

---

## Wywiad 2 - Butik odzieżowy (kierowniczka)

**Profil lokalu:** butik z odzieżą + sklep internetowy, lokalizacja w centrum (turystyczna). Sprzedaż "budynkowa" (stacjonarna) mocno zależna od pogody. Prowadzą "profesjonalnie" od stycznia tego roku. Zapisują wejścia codziennie (dziś ~5-6).

### Sygnały / metryki

| Sygnał | Odczyt | Komentarz |
|---|---|---|
| **Wartość ruchu bez zakupu** | ✅ mocny | "90% nic nie kupuje", ale chcą więcej ludzi (poznanie marki, showroom) |
| **Kanał #1** | Instagram | FB i strona dużo słabsze; dedykowane dziewczyny do postów/relacji |
| **Influencer barter** | ✅ regularny | Produkt za rolkę/relację, "widać to w obserwujących i wiadomościach" |
| **Zależność od pogody** | ✅ mocny | Zła pogoda = brak wejść, liczą je codziennie |
| **Ból operacyjny (CRM)** | ✅ mocny, NOWY | Ręczne SMS-y do bazy stałych klientek, "300 razy przetłukać" |

### Kodowanie tematyczne

**`biz/foot-traffic-value` (mocny, NOWY - kluczowy dla Trasy)** - ruch ma wartość NAWET bez zakupu
- *"90% nic nie kupuje... to jest bardziej zabicie czasu dla turystów, wejdą, pooglądają"*, ale *"zależy nam, żeby ludzie też nas poznali"*.
- Fizyczne wejście > online: *"inaczej wypada na zdjęciach, a inaczej jak się przymierzy, dotknie"*.
- **To odwrotność Willi Brzegi.** Ten segment (retail w centrum turystycznym) AKTYWNIE chce discovery / ruchu. To dużo lepszy ICP dla Trasy.

**`biz/instagram-first` (mocny, 3/4 lokali)** - Instagram to fundament, nie FB
- *"najwięcej odzewu przez Instagrama, nie Facebooka... bez tego Instagrama byłoby ciężko"*.
- Zasięg organiczny + barter z influencerkami. Waliduje nasz kierunek social proof / polecajki influencerów ([project_pin_detail_instagram]).

**`biz/pain-crm` (mocny, NOWY - adjacentna szansa)** - komunikacja z bazą klientek jest ręczna i boli
- Baza stałych klientek (konta zakładane przy zakupie) → SMS o nowej kolekcji / wyprzedaży. *"Nie ma na to patentu, wszystko ręcznie, 300 razy przetłukać"*, próba grupowej wiadomości = telefon się wiesza.
- Działa (klienci "zaopiekowani", dostęp przedpremierowy, rabaty → wracają), ale *"można by to dopracować, będzie dawało większe obroty"*.
- ⚠️ To CRM, nie discovery - poza core Trasy. Ale to konkretny, palący ból = potencjalny hak Premium (narzędzia komunikacji z klientem), spójny z osią monetyzacji "narzędzia/wartość", nie ranking.

**`biz/events` (potwierdza feed)** - robią eventy tematyczne
- Kolekcje nazwane włoskimi miastami, kolaboracja z Mojito (wystrój, drinki, włoskie desery), vouchery, rabaty. Cel: budowa stałej bazy + retencja.
- Idealna treść pod Premium feed/eventy.

---

## Wywiad 3 - Sklep vintage / design PRL (pracowniczka, staż 3 lata)

**Profil lokalu:** sklep z meblami i przedmiotami vintage (design PRL, mid-century), renowacja. Okolica Placu Zbawiciela / Placu Konstytucji ("mikroklimat", ludzie się znają). Mix klientów: stali + bardzo dużo turystów, w tym zagranicznych. Wysyłają meble za granicę (Barcelona, Belgia).

### Sygnały / metryki

| Sygnał | Odczyt | Komentarz |
|---|---|---|
| **Wartość ruchu bez zakupu** | ✅ mocny | "Niech przychodzą", word of mouth, zdjęcia idą dalej |
| **Efekt "muzeum"** | ✅ | Turyści zwiedzają jak muzeum, pokazują dzieciom/rodzicom |
| **Kanał promocji** | Instagram | Sezonowe promocje w relacjach; TikTok/FB/X nie używa |
| **Storytelling / unikatowość** | ✅ mocny | Bogata narracja (polski design eksportowany jako "szwedzki") |
| **Ból info (jako turystka)** | ✅ mocny, NOWY | Nieaktualne godziny na TripAdvisorze, brak info o języku |

### Kodowanie tematyczne

**`biz/foot-traffic-value` (mocny, potwierdza Wywiad 2)** - non-buyer to nie strata
- *"Trzeba się z tym pogodzić, jesteśmy w centrum... zawsze jest szansa, że komuś powiedzą dalej, zrobią zdjęcia i ktoś gdzieś to dalej pójdzie. Niech przychodzą."*
- Efekt "muzeum": turyści zwiedzają, pokazują rodzicom/dzieciom ("zobacz, to z twojej młodości") → wracają z innymi. **To dokładnie mechanika discovery + social, którą Trasa napędza.**

**`biz/storytelling` (NOWY)** - unikatowość i historia jako magnes
- Głębokie opowieści o eksponatach (komody "szwedzki design" = polski eksport, NRD tylko na polski rynek). To lokal-z-duszą, którego Google/TripAdvisor nie oddaje.
- Sygnał produktowy: wizytówka powinna umieć pomieścić NARRACJĘ lokalu, nie tylko menu+godziny. To różnicuje "niemasowe" miejsca (echo Willi: "fajniejsze niemasowe miejsca").

**`value/stale-data` (mocny, NOWY - powtarza się z Willą)** - istniejące źródła są nieaktualne
- Brno: *"dużo rzeczy nieaktualnych na TripAdvisorze... godzina otwarcia, spóźniłam się 10 minut, a pisało że otwarte jeszcze pół godziny"*.
- Łączy się z Willą (*"blogi stare, nieaktualne, impreza zamknięta"*). **Dwa niezależne głosy: rdzenny ból = nieświeże/niewiarygodne dane.** To wedge dla Trasy, ALE wymaga od nas utrzymania świeżości (operacyjnie trudne, echo problemu `photo_url`).

**`req/practical-info` (NOWY)** - praktyczne info PRZED wydaniem pieniędzy
- Chciała wiedzieć zawczasu: język ekspozycji (tylko czeski?), ceny wejściówek, godziny. *"Tę informację bym chciała mieć wcześniej, zanim wydam pieniądze na wejściówkę."*
- Sygnał: wizytówka atrakcji/miejsca = nie tylko zdjęcia, ale twarde, aktualne fakty (godziny, język, cena).

**`persona/spontaniczny-odkrywca` (B2C)** - jak sama szuka
- Sklepy vintage znajduje PRZYPADKIEM (przez okno autobusu w Londynie, znak w Mediolanie) - *"ja jestem turystą, łażę i szukam"*.
- ALE atrakcje/muzea planuje z góry (Google, TripAdvisor), Instagram jako drugi krok (weryfikacja "czy warto"). Nie z ery TikToka, FB "wymarłe medium".

---

## Wywiad 4 - (krótki, przerwany) - planistka, tryb grupowy

**Uwaga:** bardzo krótka, przerwana rozmowa (typ lokalu niejasny). Wartość głównie jako sygnał B2C o personie planującej.

**`persona/planistka` (B2C)** - przeciwieństwo "leniwego planisty" z Willi
- *"Ja lubię planować, chcę mieć cały dzień wykorzystany na 100%, zobaczyć jak najwięcej."*
- Ale otwarta na odciążenie: *"jeżeli aplikacja ma mi pomóc, to czemu nie... ja wybieram, ona przygotuje plan"*.

**`req/ratings` (NOWY - napięcie z modelem bez gwiazdek)** - oceny jako klucz decyzji
- *"Chcę iść w miejsca, które mają dobrą ocenę. To klucz. Patrzę po recenzjach, po ocenach."*
- ⚠️ Sprzeczność z Willą (nieufność do kupowanych opinii). **Sygnał mieszany: część userów polega na ocenach, część im nie ufa.** Do przemyślenia przed decyzją o całkowitym usunięciu ratingów.

**`req/visual-first` (potwierdza)** - decyzja oczami
- *"Ludzie oczami, to pierwsze co robią... ważne jak miejsce wygląda."* Spójne z `req/photos` Willi.

**`segment/tylko-grupa`** - *"ja sama bym zginęła, więc tylko w grupie"*. Potwierdza wagę trybu grupowego.

---

## Wywiad 5 - Stołówka / bar mleczny (współwłaściciel)

**Profil lokalu:** stołówka / bar mleczny, dwie lokalizacje (Olsztyn + Gdańsk). Klient docelowy: pracujący, firmy - szybkie, gotowe, tanie jedzenie. Codziennie inne menu (menu na cały tydzień bez powtórek poza klasykami). Sezonowo w Gdańsku bardzo duży ruch.

### Sygnały / metryki

| Sygnał | Odczyt | Komentarz |
|---|---|---|
| **Reakcja na cenę (100-200 zł/mies.)** | ✅ NOWY, kluczowy | *"Nie, no pewnie że nie dużo"* - ale warunkowo, "jak coś z tego wyjdzie" |
| **Nie zna źródeł ruchu** | ✅ | *"Klienta się nie zapyta, skąd wie że tu jesteśmy"* |
| **Samoświadomość braku marketingu** | ✅ mocny | *"My się kur... nie znamy"* - otwarci na pomoc |
| **Sceptycyzm wobec dotychczasowej reklamy** | ✅ | Ulotki/radio/banery = *"szkoda wydawania kasy"* |
| **Menu dnia = atut** | ✅ | Codziennie inne, świeże - to ich wyróżnik |

### Kodowanie tematyczne

**`biz/willingness-to-pay` (NOWY, kluczowy - pierwsza reakcja cenowa)** - 100-200 zł/mies. to "nie dużo"
- Na wprost zadane pytanie o profil (zdjęcia + codzienne menu, docieranie do szukających gdzie zjeść) za ~100-200 zł/mies.: *"Nie, no pewnie że nie dużo... to jest jakaś reklama, pieniądze, jakby to miało faktycznie coś z tego wyjść pozytywnego."*
- **Pierwszy twardy sygnał, że pułap 100-200 zł/mies. jest akceptowalny** - warunkowo od efektu. Zbieżne z rozważanym Premium ~149 zł ([project_monetization_open_mentor]).
- ⚠️ To reakcja na hipotezę, nie transakcja. "Jak coś z tego wyjdzie" = musimy udowodnić ROI.

**`biz/marketing-illiterate` (NOWY, mocny)** - nie znają się i są tego świadomi
- *"My się nie znamy... nawet nie wiem, czego nie mamy."* Reklama do tej pory ręczna i nieskuteczna (ulotki, radio ES-ka, banery). *"Szkoda wydawania kasy na taką reklamę."*
- **Silny argument za onboardingiem done-for-you** i za pozycjonowaniem "zrobimy to za ciebie". Segment, który nie kupi narzędzia, kupi efekt.

**`req/daily-menu` (potwierdza feed, mocny)** - menu dnia jako treść
- Wyróżnik: *"codziennie inne jedzenie, dowód że świeże... menu na cały tydzień."* Idealny use-case pod codzienne aktualności w wizytówce (feed). Plus filar wartości: szybkość obsługi + jakość + cena.

**`biz/seasonal-saturation` (echo Willi)** - w sezonie ruch sam się napędza
- Gdańsk w sezonie: *"nie musimy mieć żadnej reklamy... stały klient i firmy napędzają."* Olsztyn: turyści *"w ogóle nie działali."* Potrzeba reklamy nierówna w czasie i miejscu → wartość Trasy głównie poza szczytem.

**`biz/viral-social` (NOWY)** - marzy im się efekt sieciowy
- Pomysł od znajomego informatyka: *"jak ktoś to zaaplikuje, to jego znajomi też to widzą na Facebookach."* Sygnał popytu na mechanikę social proof / dzielenia się (spójne z [project_pin_detail_instagram] i [project_friends_model]).

**`biz/international` (kontekst)** - turyści zagraniczni realni
- Olsztyn: Niemcy; ogólnie Ukraińcy napędzają ruch. Wspiera tezę o międzynarodowym charakterze narzędzia (info w obcym języku).

**Uwaga geograficzna:** lokal jest w Olsztynie i Gdańsku, my startujemy Warszawa + Trójmiasto. Gdańską stołówkę można by obsłużyć, ale sam mówi, że w Gdańsku *"taki młyn"* - mała pilność po jego stronie teraz.

---

## Wywiad 6 - Gastro / kebaby + catering (właściciel, kilka lokali)

**Profil rozmówcy:** właściciel kilku lokali gastro (kebaby), prowadzi też catering, wcześniej produkcja lawaszy. Sam przedsiębiorczy i tech-forward (używa AI do ofert cateringowych), ale ma wspólnika "anty-wszystko". Najbogatsza, najbardziej ekspercka rozmowa w serii - dużo konkretów o akwizycji i monetyzacji.

### Sygnały / metryki

| Sygnał | Odczyt | Komentarz |
|---|---|---|
| **Model: user free, lokal płaci** | ✅ mocny, wprost | *"W Polsce zacząłbym od walenia pieniędzy od knajp"* |
| **Cena 100-200 zł/mies.** | ✅ "do przełknięcia" | Porównuje do Embargo (200 zł za pieczątki = "sporo") |
| **ROI = atrybucja przez kupony** | ✅ konkretny | 20 klientów/mies. z apki → *"na 99% weźmie"* |
| **Done-for-you = warunek zakupu** | ✅ bardzo mocny | *"Podpisuję, płacę, mam to w dupie"* |
| **Notatki > oceny** | ✅ | Chwali koncept "notatki dla podróżnych" |
| **Nieufność do ocen Google** | ✅ mocny | Kupowane opinie, ocena ≠ jakość |
| **Filtry dietetyczne** | ✅ NOWY | wege/bezgluten/keto = "mega fajne" |

### Kodowanie tematyczne

**`biz/model-freemium` (mocny, wprost potwierdza nasz model)** - user za darmo, płaci lokal
- *"Dla użytkownika powinno być darmowe, a lokale powinny płacić."* + *"W Polsce zacząłbym od walenia pieniędzy od knajp najpierw."*
- Insight, czemu nie usera: *"ci co wyjeżdżają raz-dwa razy w roku wydadzą pieniądze, a ci co jeżdżą 10 razy - nie"* (oglądają każdą złotówkę). Płacenie usera odcina wolumen, a wolumen jest kluczowy.

**`biz/pricing` (mocny, konkret)** - ~150 zł "do przełknięcia", ale ROI musi być widoczny
- Porównanie do Embargo (pieczątki lojalnościowe): płaci 200 zł/mies., uważa że sporo. Trasa w okolicach 100-200 zł: *"myślę że spoko, jeszcze taka do przełknięcia."*
- **Matematyka ROI (kluczowa):** *"jak przyjdzie 20 klientów z aplikacji w miesiącu, on na 99% weźmie - 20 osób to średni rachunek 1000 zł, zostaje 300-400 zł przy dobrym food coście, aplikacja kosztuje 150."*
- ⚠️ Warunek: lokal MUSI widzieć, że klient przyszedł z apki → **kupony/vouchery jako mechanizm atrybucji** (i weryfikacji).

**`biz/done-for-you` (bardzo mocny - najsilniejszy wątek rozmowy)** - "podpisuję, płacę, zapominam"
- *"Ja bym chciał, żeby to działało tak, że podpisuję, płacę, mam to w dupie."* Nie chce zarządzać kolejnym systemem (ma milion apek lojalnościowych, nie chce POS-a).
- *"Zróbcie tak, żeby AI sam zebrał z Instagrama, Facebooka, uzupełnił profil, on ma to tylko akceptować."* + *"Proszę pana, zrobiliśmy panu profil, tu jest najlepsze zdjęcie - mnie by to kupiło."*
- Akwizycja: bezpośrednia (przyjść do lokalu, zrobić zdjęcia na miejscu albo wziąć z IG) + 3-6 mies. za darmo na start. **Potwierdza wnioski z Willi, Butiku, Stołówki - to teraz temat przewijający się przez 4 rozmowy.**
- ⚠️ Darmowe nie zawsze działa (lawasze: 100 paczek za 2000 zł, większość wróciła nietestowana). Ale apka = darmowa + przypominać się.

**`biz/ratings-paradox` (mocny, pogłębia Willę)** - ocena ≠ jakość, opinie kupowane
- *"Kebab obok, straszne ścierwo, teraz ma 4,9 na 1500 opinii - nie da się tego wykręcić legalnie."* Kontr-przykłady: Pizza Bona 3,9 a rewelacyjna; Efes 4,2-4,3 a jeden z lepszych kebabów.
- Sam weryfikuje (skroluje ostatnie opinie 2-3 min), ale *"większość ludzi zobaczy wysoką ocenę i pójdzie"*. Heurystyka: 4,5+.
- ⚠️ Realizm: *"od ocen nie uciekniecie, stały się standardem"* - Trasa trzyma oceny Google jako baseline, ale różnicuje się notatkami (niżej).

**`req/notatki` (potwierdza kierunek bez gwiazdek)** - notatka dla podróżnych > opinia
- Chwali pomysł: zamiast *"dobre/niedobre"* → *"zjedzcie to i to, przygotujcie się na kolejkę ale warto"*. Przykład: turystyczna pułapka w Barcelonie (sernik 4,6 a kiepski).
- Godzi napięcie z Wywiadu 4: oceny jako baseline (bo standard) + notatki jako nasza wartość dodana.

**`req/filtry-dietetyczne` (NOWY, mocny)** - wege/bezgluten/keto jako filtr
- Własna historia: on wege, żona bezglutenowo - w Łodzi *"nie byliśmy w stanie znaleźć śniadania"*. Google nie pozwala filtrować (trzeba szukać ręcznie).
- "Para" dynamika: jedna osoba wege → cała para idzie tam, gdzie oboje zjedzą → lokal z 1 pozycją wege nie traci mięsożercy. Rynek wege ~2-3%, ale szeroki; keto "mega dużo ludzi".

**`biz/loyalty-addon` (NOWY, przyszła szansa)** - pieczątki/lojalność jako moduł
- *"Jak wam się rozhula, fajną opcją jest dowolenie pieczątek - nie znalazłem firmy, która by mnie satysfakcjonowała."* Luka w Embargo: brak per-pracownik loginu (kradzież/rozdawanie gratisów bez kontroli - notoryczne w gastro).

**`biz/promo-voucher` (model konkurencji - Tastetown)** - promocje raz/mies. działają dla gastro
- Tastetown (czeski): user płaci ~25 zł/mies. subskrypcji, lokal daje 2 promocje (np. -20%), user korzysta raz/mies. per lokal. Kebab: 1+1 się nie spina (food cost do 50%), ale *"20% rabatu z przyjemnością dam raz w miesiącu, bo jak zasmakuje przyjdzie 2 razy albo przyciągnie kolegę"*.
- Ale sam preferuje nasz model (płaci lokal): *"masz lokali mniej, a userów więcej"*; userzy zapominają subskrypcje (jak Multisport).

**`req/feed-zero-maintenance` (potwierdza feed, ważny insight)** - wartość profilu bez ciągłego prowadzenia
- Nasz pitch, który go kupił: raz wrzucasz fotki/filmiki (jak Reels), *"potem hula"* - w przeciwieństwie do Instagrama, gdzie ostatni post sprzed 2 lat = *"nie wiadomo czy otwarte"*. Opcjonalne aktualności (ogródek, nowa karta, letnie menu) dla chętnych.

**`biz/data-freshness`** - godziny z Google, zdjęcia to główny problem
- Sam zawsze aktualizuje godziny na Google (strach przed złą opinią gdy ktoś trafi na zamknięte). Godziny/adres zaciągalne z Google; **zdjęcia to największy temat do zaopiekowania** (zgoda albo on-site).

**Meta:** bardzo pozytywny, oferuje pomoc i polecenie. Ostrzega: są właściciele anty-tech (wspólnik prowadził kebaby na laminowanej kartce zamiast Excela), ale *"społeczeństwo młodsze i mądrzej myślące"*.

---

## Wywiad 7 - Kawiarnia Wanderlust (właścicielka, Port Praski)

**Profil lokalu:** kawiarnia speciality, Port Praski (Warszawa), właścicielka z Ukrainy, mała roczna dziecko (mało czasu). Rynek mocno konkurencyjny (*"parzyć dobrą kawę to już nie dość"*, 5 kawiarni w okolicy). Dużo Airbnb/Booking w pobliżu, eventy na Stadionie Narodowym → sezonowo do 50% gości zagranicznych. Nasz 2. lokal na waitliście / design partner. Zna produkt (widziała demo).

### Sygnały / metryki

| Sygnał | Odczyt | Komentarz |
|---|---|---|
| **ICP: nie umie dotrzeć do przyjezdnych** | ✅ bardzo mocny | *"Nie wiem jak to robić. Może przez Wasze aplikacje?"* |
| **Goście zagraniczni = większe rachunki** | ✅ | Grupy 8 osób, śniadania, nie tylko kawa |
| **Instagram: zasięg ≠ konwersja** | ✅ mocny, NOWY | Viralowe wideo (mln wyświetleń) + kod → ~1 klient |
| **Analityka z rekomendacjami** | ✅ mocny, NOWY | Chce raportu "co poprawić", nie samych liczb |
| **Cena 150 zł OK jeśli spina się rachunek** | ✅ konkret | Liczy na średnim rachunku, nie liczbie gości |
| **Feedback prywatny > publiczne opinie** | ✅ NOWY | Chce ankiety do właściciela, nie złośliwych recenzji |

### Kodowanie tematyczne

**`biz/reach-transient` (bardzo mocny - modelowy ICP)** - nie umie dotrzeć do przyjezdnych, wprost wskazuje Trasę
- *"Robicie coś, żeby do osób, które nie są z Warszawy, nigdy nie będą stałymi klientami, bo przyjezdni, jakoś się komunikować? - Ja nie wiem jak to robić. Może przez Wasze aplikacje?"*
- Goście zagraniczni robią **większe rachunki** (grupy 8 osób, śniadania, jedzenie nie tylko kawa), zawsze zadowoleni. Kawiarnia przy Airbnb/hotelu/stadionie = dokładnie nasz sweet spot.

**`biz/instagram-low-conversion` (NOWY, ważna korekta)** - social media świetne na zasięg, słabe na konwersję
- Płaci 1500 zł/mies. specjalistce SMM (Instagram, FB, content). Ale test: viralowe wideo (mln wyświetleń) + promo-kody (Wander20) → *"chyba jedna osoba przyszła"*. Płatne posty rok temu: 1 osoba podała kod. *"Bardzo drogo teraz, algorytmy skomplikowane - zrezygnowaliśmy."*
- **Koryguje wcześniejszy wniosek:** Instagram to fundament OBECNOŚCI, ale kiepski na realny ruch. Trasa łapie gościa z **intencją zakupową** (planuje wyjazd), nie przypadkowego widza. To nasz mocny argument sprzedażowy.

**`req/analytics-actionable` (NOWY, mocny - hak Premium)** - chce analityki, która radzi, nie tylko liczy
- Tastetown wysyła tygodniowy raport na maila (5-10 gości) - ceni, bo *"nie mam czasu iść na platformy"*. Embargo ma panel, ale *"nie mam czasu"*.
- Chce więcej: *"raport, który by sugerował co można zrobić, poprawić, żeby gości przyszło więcej"*. Zagadka, której nie rozumie: identyczna pogoda/dzień tygodnia, a raz dwa razy więcej gości - chce zrozumieć czemu.
- **To konkretny, wysokowartościowy hak Premium** (analityka + rekomendacje), spójny z osią "narzędzia".

**`req/return-vs-promo` (NOWY)** - luka: nie wie, czy goście wracają, czy przyszli tylko po promo
- *"Nie możemy sprawdzić, czy ci goście się stałymi klientami... czy są zadowoleni dlatego, że dostali darmowe, czy bo się spodobało."* Chce odróżnić ruch organiczny od promo-driven. Atrybucja + retencja = potrzeba.

**`req/feedback-private` (NOWY)** - konstruktywny feedback do właściciela, nie publiczna recenzja
- Woli **ankietę/feedback do właściciela** niż złośliwą publiczną opinię: *"jeśli ktoś przyjdzie i powie, że coś nie tak, znajdziemy rozwiązanie... a nie od razu pisze coś złośliwego"*. Przykład: 3 gwiazdki za *"mała przestrzeń"* (nie do naprawienia).
- Niuansuje notatki: obok publicznych notatek dla podróżnych - **prywatny kanał feedbacku do lokalu**.

**`biz/pricing` (potwierdza, konkret)** - 150 zł OK jeśli spina się rachunek
- *"Skupiam się nie na gościach, a na średnim rachunku. Jeśli zarobię tyle, żeby zapłacić opłaty, aplikację i jeszcze 50 zł, to OK."* Tzn. ~400 zł/mies. przypisanej sprzedaży → 150 zł apka się spina. Płaci na start, bo liczy na rozwój.
- Warunek (znów): musi dać się **sprawdzić, że klient przyszedł z apki** (rozważają QR + geolokalizację).

**`biz/ratings` (potwierdza Willę/Gastro)** - oceny to przymus, nie do końca obiektywny
- *"Walczymy o opinie na Google Maps, bo sądzę po sobie - w innym mieście patrzę na oceny."* Ale *"nie na 100% obiektywne"* - kupowane, premie dla pracowników za zbieranie, kupowanie pozytywnych zamiast poprawy.

**`req/done-for-you` (potwierdza z niuansem)** - gotowe, ALE atrakcyjne
- W przeciwieństwie do gastro (*"podpisuję i zapominam"*): *"z jednej strony tak, z drugiej żeby to było zrobione ciekawie. Mam SMM specjalistkę, mogłabym ją poprosić."* Chce done-for-you jako default, ale z opcją dopieszczenia przez tych, co mają zasoby marketingowe.

**`product/proximity` (feedback do demo, waliduje feature)** - punkt startowy/okolica kluczowy
- Sama zauważyła brak (bug): *"musisz podać okolice, gdzie mieszkasz, bo jeśli ktoś mieszka na Ursusie, małe szanse, że przyjedzie"*. Waliduje feature startowej lokalizacji + sortowania po odległości.

**Meta:** bardzo otwarta, chętna. Kawiarnia różnicuje się doświadczeniem (matcha ceremonialna, desery pieczone na miejscu, Ube, herbaty, atmosfera), nie samą kawą - to "lokal z doświadczeniem" jak vintage ze storytellingiem.

---

## Sygnały cross-wywiadowe (N=7 B2B + zestawienie z B2C)

**🟢 Potwierdzone niezależnie (mocne):**

1. **Model freemium: user za darmo, płaci lokal - potwierdzony wprost** (Gastro: *"zacząłbym od walenia pieniędzy od knajp"*; Willa i Stołówka nie kwestionują). Insight: częsty podróżnik nie zapłaci, rzadki zapłaci - ale to wolumen usera jest kluczowy, więc bariera dla usera = 0.
2. **Cena ~100-200 zł/mies. "do przełknięcia", ale ROI musi być widoczny** (Gastro: matematyka *"20 klientów/mies. → weźmie na 99%"*; Kawiarnia: *"liczę na średnim rachunku - jak zarobię opłaty + 150 zł + jeszcze 50, to OK"*; Stołówka: *"nie dużo, jak coś z tego wyjdzie"*). Warunek stały: **kupony/QR/geolokalizacja jako atrybucja** - lokal musi WIDZIEĆ, że klient przyszedł z apki. Bez dowodu ROI nie odnowi.
3. **Done-for-you onboarding to WARUNEK zakupu** (5 lokali: Gastro *"podpisuję, płacę, mam to w dupie"*; Kawiarnia *"tak, ale żeby było zrobione ciekawie"*; Stołówka *"nie znamy się"*; Willa i Butik: brak czasu). Zaciągaj menu/zdjęcia/godziny z Google/IG automatycznie (AI), lokal tylko akceptuje + 3-6 mies. za darmo. **Najsilniejszy, najczęściej powtarzany wniosek serii.** Niuans: lokale z zasobami marketingowymi (Kawiarnia ma SMM-owca) chcą móc dopieścić - default gotowy, opcja edycji.
4. **Ruch/discovery ma wartość nawet bez natychmiastowego zakupu** (Butik + Vintage: *"niech przychodzą, żeby nas poznali"*). Kawiarnia dokłada mocny wariant: **nie umie dotrzeć do przyjezdnych** (*"nie wiem jak to robić, może przez Wasze aplikacje?"*), a goście zagraniczni robią większe rachunki. Lokal przy Airbnb/hotelu/stadionie = modelowy ICP. **Dużo lepszy niż wysycona Willa.**
5. **Oceny Google = potrzebny baseline, ale ocena ≠ jakość** (Gastro: kupowane opinie, Bona 3,9 świetna / Amigos wysoka a fatalna). Trasa: trzyma oceny jako standard + różnicuje się **notatkami dla podróżnych** (Gastro chwali: *"zjedzcie to, przygotujcie się na kolejkę ale warto"*). To godzi wcześniejsze napięcie o gwiazdki.
6. **Instagram to fundament OBECNOŚCI, ale słaby na konwersję** (ważna korekta). 3/7 lokali mocno na IG, ale Kawiarnia pokazała twardo: viralowe wideo (mln wyświetleń) + promo-kody → ~1 klient; płatne posty *"bardzo drogo, zrezygnowaliśmy"*. **Trasa łapie gościa z intencją zakupową (planuje wyjazd), nie przypadkowego widza - to nasz argument sprzedażowy.**
7. **Istniejące źródła nieaktualne/niewiarygodne** (Willa: blogi; Vintage: TripAdvisor godziny; Gastro/Willa: kupowane opinie). Zdjęcia + świeżość danych = nasz największy operacyjny temat.
8. **Decyzja "oczami"** - zdjęcia rządzą (wszystkie rozmowy). Rdzeń karty dobry.
9. **Menu / aktualności = naturalna treść wizytówki, bez ciągłego prowadzenia** (Gastro: *"raz wrzucasz, potem hula"* vs martwy Instagram; Stołówka: menu dnia; Butik/Willa: kolekcje/eventy).
10. **Zależność od pogody / sezonowości** (Willa, Butik, Stołówka, Gastro). Wartość Trasy głównie POZA szczytem.

**🟡 Napięcia / sygnały do decyzji:**

- **Oceny gwiazdkowe - w większości rozwiązane:** Gastro godzi to najlepiej (oceny jako baseline + notatki jako wartość dodana). Ryzyko zostaje: część userów (planistka z Wyw. 4) czyta wszystko, część patrzy tylko na średnią.
- **WTP zależy od segmentu:** Willa (wysycona) ≈ 0 za leady; retail + gastro poza sezonem = realny budżet (już wydają na Instagram/Embargo/Uber Eats). **Wszyscy płacą za EFEKT, nie za narzędzie.**
- **Persona planowania:** "leniwy planista" (Willa, Gastro) vs "planistka 100%" (Wyw. 4). Produkt obsługuje oba: auto-plan (AI układa) + pełna edycja.

**🔵 Szanse produktowe/biznesowe (uszeregowane wg siły sygnału):**

- **Kupony/vouchery** - podwójna rola: atrybucja ROI dla lokalu + promocja dla usera. Model Tastetown (20% raz/mies.) działa dla gastro (1+1 nie, bo food cost). Prawdopodobnie kluczowy element monetyzacji.
- **Analityka z REKOMENDACJAMI, nie tylko liczbami** (Kawiarnia mocno: chce raportu *"co poprawić, żeby gości przyszło więcej"*, tygodniowo na maila; nie rozumie wahań ruchu). Wysokowartościowy hak Premium, oś "narzędzia". Dołóż rozróżnienie ruch organiczny vs promo-driven + retencja (Kawiarnia: nie wie, czy goście wracają).
- **Prywatny kanał feedbacku do lokalu** (Kawiarnia: woli ankietę do właściciela niż złośliwą publiczną opinię). Obok publicznych notatek dla podróżnych - prywatny sygnał "co poprawić".
- **Filtry dietetyczne** (wege/bezgluten/keto) - Gastro mocno (własna historia: brak śniadania w Łodzi), + dynamika "pary". Google tego nie filtruje.
- **Done-for-you jako proces akwizycji** (patrz pkt 3) - nie tylko onboarding, ale sposób sprzedaży: gotowy profil "na tacy".
- **Loyalty/pieczątki jako moduł Premium** (Gastro: luka w Embargo - kontrola kradzieży przez pracowników). Przyszła szansa.
- **CRM/komunikacja z klientem** (Butik: ręczne SMS-y). Oś "narzędzia", nie ranking.
- **Wizytówka z narracją** (Vintage: storytelling) - różnicuje niemasowe miejsca.
- **Praktyczne, aktualne fakty** (godziny, język, cena) przed wizytą (Vintage/Brno).

**Ryzyko strażnicze:** napięcie "wyrównywanie szans" vs "kupowanie widoczności" (Willa) NADAL aktualne - żaden z modeli powyżej (kupony, narzędzia, lojalność) nie sprzedaje pozycji w rankingu, i dobrze. Trzymać monetyzację z dala od rankingu.

**Zestawienie z rundą B2C** ([wywiady-analiza.md](wywiady-analiza.md)): menu+zdjęcia, oszczędność czasu i "zrób to za mnie" powtarzają się po obu stronach rynku. Model mentalny "Tinder" (B2C) + forma "w prawo/w lewo" (rozpoznana przez rozmówców B2B) = spójny, ale kolizja z zakazem "swipe/match".
