-- Migration: Budapest places seed data
-- 2026-03-29

-- Category mapping from CSV:
--   Kawiarnia       → cafe
--   Restauracja     → restaurant
--   Śniadanie       → cafe
--   Bar             → bar
--   Muzeum          → museum
--   Architektura    → monument
--   Park            → park
--   Landmark        → monument
--   Punkt widokowy  → viewpoint
--   Zakupy          → shopping
--   Zabytek         → monument
--   Cukiernia       → cafe
--   Piekarnia       → cafe
--   Rozrywka        → experience

INSERT INTO public.places (city, place_name, category, address, latitude, longitude, rating, price_level, vibe_tags, description, best_time) VALUES

-- ── KAWIARNIE (CAFES) ─────────────────────────────────────────

('Budapeszt', '9BAR', 'cafe',
 'Király utca, Budapest VII', 47.5018, 19.0645, 4.6, 2,
 ARRAY['specialty coffee', 'hipsterska', 'Dzielnica Żydowska'],
 'Kultowy bar kawowy w sercu Dzielnicy Żydowskiej z doskonałą kawą specialty i klimatyczną atmosferą.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Dehogynem kávéműhely', 'cafe',
 'Budapest V', 47.5001, 19.0592, 4.5, 2,
 ARRAY['specialty coffee', 'lokalna', 'przytulna'],
 'Niezależna kawiarnia specialty prowadzona z pasją, ceniona przez budapeszteńskich miłośników kawy.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Bors Gastro Bar', 'cafe',
 'Kazinczy utca 10, Budapest VII', 47.4999, 19.0597, 4.7, 1,
 ARRAY['street food', 'szybko', 'tanie'],
 'Ikoniczna kanapkarna i bar kawowy w Dzielnicy Żydowskiej – kultowe miejsce na szybki, smaczny lunch.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Molnár''s kürtőskalács', 'cafe',
 'Váci utca, Budapest V', 47.4997, 19.0527, 4.6, 1,
 ARRAY['kürtőskalács', 'tradycja', 'słodkości'],
 'Słynna budka z kürtőskalács – węgierskim ciastem kominowym pieczonym na ogniu, idealne na słodką chwilę.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Café Gerbeaud', 'cafe',
 'Vörösmarty tér 7-8, Budapest V', 47.4983, 19.0518, 4.5, 4,
 ARRAY['historyczna', 'elegancka', 'ikona'],
 'Legendarny wiedeński salon kawowy z 1858 roku na placu Vörösmarty – symbol budapeszteńskiej kawiarni.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Zoo Café', 'cafe',
 'Állatkerti körút, Budapest XIV', 47.5150, 19.0785, 4.4, 2,
 ARRAY['zoo', 'park', 'dla dzieci'],
 'Kawiarnia przy budapeszteńskim zoo, idealna na przerwę podczas spaceru po City Parku.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Művész Coffee House', 'cafe',
 'Andrássy út 29, Budapest VI', 47.5035, 19.0628, 4.5, 3,
 ARRAY['historyczna', 'artystyczna', 'Andrássy'],
 'Legendarny salon artystyczny przy alei Andrássy, niegdyś ulubione miejsce budapeszteńskiej bohemy.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Waycup kávézó', 'cafe',
 'Budapest VI', 47.5025, 19.0640, 4.6, 2,
 ARRAY['specialty coffee', 'nowoczesna', 'baristas'],
 'Nowoczesna kawiarnia specialty z dobrze wyszkolonym baristą i dbałością o każdy detal parzenia.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Anna Café', 'cafe',
 'Budapest V', 47.5010, 19.0558, 4.5, 2,
 ARRAY['przytulna', 'kawiarnia', 'centrum'],
 'Urocza kawiarnia w centrum Budapesztu, doceniana za ciepłą atmosferę i dobre wypieki.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'espresso embassy', 'cafe',
 'Arany János utca 15, Budapest V', 47.5030, 19.0594, 4.7, 2,
 ARRAY['specialty coffee', 'minimalistyczna', 'baristas'],
 'Jedna z najlepszych kawiarni specialty w Budapeszcie z perfekcyjnym espresso i starannym serwisem.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Goosebumps Coffee Lab', 'cafe',
 'Budapest VII', 47.4990, 19.0605, 4.6, 2,
 ARRAY['specialty coffee', 'wegańska', 'innowacyjna'],
 'Eksperymentalna kawiarnia specialty z wegańskim menu i autorskimi metodami parzenia kawy.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'The Goat Herder', 'cafe',
 'István utca, Budapest VII', 47.5010, 19.0650, 4.5, 2,
 ARRAY['specialty coffee', 'klimatyczna', 'VII. dzielnica'],
 'Klimatyczny lokal w Dzielnicy Żydowskiej łączący kawę specialty z dobrą kuchnią i miłą atmosferą.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'New York Café', 'cafe',
 'Erzsébet körút 9-11, Budapest VII', 47.4978, 19.0676, 4.6, 4,
 ARRAY['historyczna', 'luksusowa', 'ikona'],
 'Najpiękniejsza kawiarnia Budapesztu – otwarty w 1894 roku przepyszny salon z pozłacanymi dekoracjami.',
 ARRAY['morning', 'afternoon', 'evening']),

-- ── RESTAURACJE ───────────────────────────────────────────────

('Budapeszt', 'PAUSE Kitchen & Bar', 'restaurant',
 'Budapest V', 47.5020, 19.0560, 4.6, 3,
 ARRAY['nowoczesna', 'fusion', 'centrum'],
 'Stylowa restauracja w centrum z kreatywną kuchnią łączącą lokalne składniki z azjatyckimi inspiracjami.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'VIRTU Restaurant', 'restaurant',
 'Budapest V', 47.5015, 19.0555, 4.7, 4,
 ARRAY['fine dining', 'premium', 'sezonowa'],
 'Elegancka restauracja z sezonowym menu opartym na lokalnych produktach i nowoczesnym podejściu do kuchni.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Beerstro14 Steak House', 'restaurant',
 'Budapest V', 47.4998, 19.0573, 4.5, 3,
 ARRAY['steak', 'piwo', 'mięsna'],
 'Połączenie craft browaru z restauracją steakową – idealne dla miłośników dobrego mięsa i lokalnego piwa.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Retek Bisztro', 'restaurant',
 'Budapest VI', 47.5028, 19.0610, 4.6, 2,
 ARRAY['węgierska', 'bistro', 'domowa'],
 'Klimatyczne bistro z autentyczną kuchnią węgierską i świeżo przygotowanymi daniami w przystępnych cenach.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Mama Goulash', 'restaurant',
 'Budapest V', 47.4992, 19.0532, 4.5, 2,
 ARRAY['gulasz', 'węgierska', 'tradycja'],
 'Specjalista od gulaszu i tradycyjnych węgierskich potraw – prosto, smacznie i w dobrej cenie.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Street Food Karavan Budapest', 'restaurant',
 'Kazinczy utca 18, Budapest VII', 47.4990, 19.0630, 4.5, 1,
 ARRAY['street food', 'food trucks', 'tanie'],
 'Kultowe skupisko food trucków w Dzielnicy Żydowskiej z kuchnią z całego świata i luzacką atmosferą.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Epicurean', 'restaurant',
 'Budapest V', 47.5018, 19.0540, 4.6, 3,
 ARRAY['śródziemnomorska', 'wino', 'romantyczna'],
 'Kameralna restauracja z bogatą kartą win i kuchnią śródziemnomorską, idealna na romantyczną kolację.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Tapassio', 'restaurant',
 'Budapest V', 47.5005, 19.0548, 4.5, 2,
 ARRAY['tapas', 'hiszpańska', 'dzielenie'],
 'Autentyczny bar tapas z szerokością wyboru małych przekąsek i dobrym winem do towarzystwa.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Ramenji Ramen', 'restaurant',
 'Budapest VII', 47.4988, 19.0600, 4.6, 2,
 ARRAY['ramen', 'japońska', 'zupa'],
 'Najlepszy ramen w Budapeszcie – prawdziwe japońskie zupy ramen z długo gotowanym bulionem.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Hoppá! Bistro', 'restaurant',
 'Budapest V', 47.5022, 19.0575, 4.5, 2,
 ARRAY['bistro', 'codzienne', 'lunche'],
 'Przyjazne bistro popularne wśród lokalnych pracowników z pysznym lunchem i codziennie zmieniającą się ofertą.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Retro Lángos Budapest', 'restaurant',
 'Budapest V', 47.4972, 19.0556, 4.5, 1,
 ARRAY['lángos', 'węgierska', 'street food'],
 'Kultowe miejsce z lángosem – węgierskim smażonym plackiem z rozlicznymi dodatkami, pysznym street foodem.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Nokedli Factory', 'restaurant',
 'Budapest VII', 47.5000, 19.0620, 4.6, 2,
 ARRAY['nokedli', 'węgierska', 'komfort'],
 'Restauracja wyspecjalizowana w nokedli (węgierskich kopytka) z klasycznymi sosami i współczesnymi wersjami.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Leo Rooftop Budapest', 'restaurant',
 'Budapest V', 47.5070, 19.0530, 4.5, 3,
 ARRAY['rooftop', 'widokowa', 'cocktails'],
 'Restauracja na dachu z panoramicznym widokiem na centrum Budapesztu – idealna na zachód słońca.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Mazel Tov', 'restaurant',
 'Akácfa utca 47, Budapest VII', 47.4989, 19.0635, 4.7, 3,
 ARRAY['śródziemnomorska', 'Ruin Bar', 'klimatyczna'],
 'Jeden z najbardziej klimatycznych restauracyjnych ogrodów Budapesztu, serwujący kuchnię śródziemnomorską.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Hungarikum Bisztró', 'restaurant',
 'Steindl Imre utca 13, Budapest V', 47.4984, 19.0528, 4.6, 2,
 ARRAY['węgierska', 'tradycja', 'lokalna'],
 'Autentyczne bistro z tradycyjną kuchnią węgierską – gulasze, tokaj, foie gras i sezonowe dania.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Chin Chin Izakaya', 'restaurant',
 'Budapest V', 47.4975, 19.0558, 4.6, 3,
 ARRAY['izakaya', 'japońska', 'sake'],
 'Japońska izakaya z szerokim wyborem małych dań do sake i rzemieślniczego piwa, klimat prosto z Tokio.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'IDA Bistro', 'restaurant',
 'Budapest V', 47.5008, 19.0588, 4.6, 3,
 ARRAY['nowoczesna', 'europejska', 'premium'],
 'Eleganckie bistro z sezonowym menu opartym na najlepszych lokalnych produktach i europejskiej kuchni.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'MADHOUSE BISTRO & BAR', 'restaurant',
 'Budapest VII', 47.4996, 19.0605, 4.5, 2,
 ARRAY['bistro', 'bar', 'eklektyczna'],
 'Eklektyczne bistro-bar z energetyczną atmosferą, zróżnicowanym menu i dobrymi koktajlami.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Grumpy Budapest', 'restaurant',
 'Budapest VI', 47.5012, 19.0622, 4.5, 2,
 ARRAY['brunch', 'śniadania', 'kawiarnia'],
 'Modna restauracja brunchowa z kreatywnym podejściem do klasycznych śniadań i lunchy w artystycznej oprawie.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Párisi Passage Restaurant', 'restaurant',
 'Ferenciek tere 5, Budapest V', 47.5002, 19.0524, 4.6, 3,
 ARRAY['historyczna', 'pasaż', 'elegancka'],
 'Restauracja w zabytkowym secesyjnym pasażu Párisi – przepiękne wnętrze i kuchnia na europejskim poziomie.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Hell''s Kitchen', 'restaurant',
 'Budapest V', 47.4987, 19.0515, 4.5, 2,
 ARRAY['węgierska', 'nowoczesna', 'rynkowa'],
 'Nowoczesne spojrzenie na tradycyjną kuchnię węgierską – blisko Centralnego Rynku, zawsze świeże składniki.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Klauzál Café & Restaurant', 'restaurant',
 'Klauzál tér 2, Budapest VII', 47.4997, 19.0608, 4.5, 2,
 ARRAY['Dzielnica Żydowska', 'plac', 'bistro'],
 'Przyjemna restauracja przy placu Klauzála w Dzielnicy Żydowskiej – dobre jedzenie i idealne do obserwowania życia placu.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Gozsdu Court', 'restaurant',
 'Holló utca 12, Budapest VII', 47.4990, 19.0630, 4.5, 2,
 ARRAY['pasaż', 'restauracje', 'Dzielnica Żydowska'],
 'Zabytkowy pasaż z wieloma restauracjami, barami i kawiarniami – tętniące serce budapeszteńskiego życia nocnego.',
 ARRAY['afternoon', 'evening']),

-- ── ŚNIADANIA (BRUNCH) ────────────────────────────────────────

('Budapeszt', 'VINYL & WOOD', 'cafe',
 'Budapest VII', 47.5005, 19.0572, 4.7, 2,
 ARRAY['brunch', 'winylem', 'industrialna'],
 'Wyjątkowa kawiarnia z muzyką z winyli, pysznym brunchem i industrialnym wnętrzem w Dzielnicy Żydowskiej.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Blueberry Brunch', 'cafe',
 'Budapest V', 47.4993, 19.0582, 4.6, 2,
 ARRAY['brunch', 'śniadania', 'świeże'],
 'Specjalista od brunchu z świeżymi składnikami, pysznym jajkiem benedykt i długimi porankami przy stole.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Stika Gastropub', 'cafe',
 'Budapest VI', 47.5025, 19.0598, 4.5, 2,
 ARRAY['gastropub', 'brunch', 'piwo rzemieślnicze'],
 'Klimatyczny gastropub z niedzielnym brunchem i szerokim wyborem piw rzemieślniczych.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'DoubleShot Coffee & Brunch', 'cafe',
 'Budapest V', 47.5018, 19.0544, 4.6, 2,
 ARRAY['brunch', 'specialty coffee', 'centrum'],
 'Połączenie najlepszej kawy specialty z kreatywnym brunchem serwowanym przez cały dzień.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'EGGDROP PROJECT', 'cafe',
 'Budapest VII', 47.4980, 19.0596, 4.6, 2,
 ARRAY['brunch', 'jajka', 'street food'],
 'Autorskie miejsce stawiające jajko w centrum każdego dania – kreatywny brunch i street food w jednym.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Lion''s Locker Coffee & Brunch', 'cafe',
 'Budapest VI', 47.5015, 19.0612, 4.5, 2,
 ARRAY['brunch', 'kawiarnia', 'VI. dzielnica'],
 'Urokliwa kawiarnia brunchowa w modnej szóstej dzielnicy ze świeżymi sałatami i dobą kawą.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'CONI Bar & Brunch', 'cafe',
 'Budapest V', 47.4998, 19.0588, 4.5, 2,
 ARRAY['brunch', 'bar', 'nowoczesna'],
 'Nowoczesny bar brunchowy z oryginalnym menu i przyjemną atmosferą idealną na weekendowe śniadanie.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Best Bagel Basilica', 'cafe',
 'Budapest V', 47.5005, 19.0540, 4.6, 1,
 ARRAY['bajgle', 'śniadania', 'Bazylika'],
 'Świeże bajgle z różnorodnymi nadzieniami, tuż obok Bazyliki Świętego Stefana – idealne na szybkie śniadanie.',
 ARRAY['morning', 'afternoon']),

-- ── BARY ──────────────────────────────────────────────────────

('Budapeszt', 'Jardín cocktail Bar', 'bar',
 'Budapest VII', 47.5000, 19.0595, 4.7, 3,
 ARRAY['koktajle', 'ogród', 'rzemieślnicza'],
 'Ukryty koktajlowy ogród w Dzielnicy Żydowskiej z autorskimi drinkami i magiczną zieloną atmosferą.',
 ARRAY['evening']),

('Budapeszt', 'Liz & Chain Rooftop Bar', 'bar',
 'Budapest I', 47.4988, 19.0468, 4.6, 3,
 ARRAY['rooftop', 'Dunaj', 'widokowa'],
 'Bar na dachu z zapierającym dech widokiem na Most Łańcuchowy i Dunaj – absolutny must w Budapeszcie.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Beer Brothers', 'bar',
 'Budapest VII', 47.4995, 19.0580, 4.5, 2,
 ARRAY['piwo rzemieślnicze', 'craft', 'lokalne'],
 'Specjalista od piw rzemieślniczych z szeroką selekcją węgierskich i zagranicznych browarów craft.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Kiadó Kocsma', 'bar',
 'Budapest VII', 47.4992, 19.0605, 4.5, 1,
 ARRAY['Ruin Bar', 'lokalna', 'bohema'],
 'Autentyczny węgierski pub w stylu ruin bar z tanią wódką pálinka i prawdziwą miejscową atmosferą.',
 ARRAY['evening']),

('Budapeszt', 'Parabolic Lázárus Brewery', 'bar',
 'Budapest VIII', 47.4975, 19.0648, 4.6, 2,
 ARRAY['browar', 'piwo rzemieślnicze', 'craft'],
 'Browar rzemieślniczy z własnymi warkami na miejscu i wyjątkowym barem degustacyjnym w klimatycznej piwnicy.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Élesztő kézműves söröző', 'bar',
 'Tűzoltó utca 22, Budapest IX', 47.4870, 19.0626, 4.7, 2,
 ARRAY['browar', 'craft beer', 'podwórko'],
 'Kultowy ogród piwny w podwórku z największym wyborem craft beer na Węgrzech i luźną atmosferą.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Kazamata Club', 'bar',
 'Budapest I', 47.4990, 19.0380, 4.5, 2,
 ARRAY['jaskinia', 'Wzgórze Zamkowe', 'unikalne'],
 'Bar wydrążony w naturalnych jaskiniach pod Wzgórzem Zamkowym – niezwykłe wnętrze i świetna impreza.',
 ARRAY['evening']),

('Budapeszt', 'Brody House', 'bar',
 'Brody Sándor utca 10, Budapest VIII', 47.4993, 19.0635, 4.6, 3,
 ARRAY['artystyczna', 'koktajle', 'boutique'],
 'Artystyczna rezydencja z barem i kawiarnią w pięknie odrestaurowanej kamienicy – ulubione miejsce kreatywnych.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Old Butcher''s Pub', 'bar',
 'Budapest VI', 47.4980, 19.0605, 4.5, 2,
 ARRAY['pub', 'irlandzki', 'sporty'],
 'Klimatyczny pub w angielskim stylu z szeroką selekcją piw i transmisją sportów – przyjazny dla obcokrajowców.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'KEG sörmű vház', 'bar',
 'Budapest VII', 47.4988, 19.0608, 4.5, 2,
 ARRAY['piwo rzemieślnicze', 'craft', 'Dzielnica Żydowska'],
 'Dom rzemieślniczego piwa w Dzielnicy Żydowskiej z zawsze rotującą kartą 30 piw z całego świata.',
 ARRAY['afternoon', 'evening']),

-- ── MUZEA ─────────────────────────────────────────────────────

('Budapeszt', 'Muzeum Skalnego Szpitala', 'museum',
 'Lovas út 4/c, Budapest I', 47.5015, 19.0355, 4.8, 3,
 ARRAY['II wojna', 'jaskinia', 'historia'],
 'Szpital wojenny ukryty w naturalnych jaskiniach Wzgórza Zamkowego – wstrząsające muzeum historii medycyny wojennej.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Terror Háza', 'museum',
 'Andrássy út 60, Budapest VI', 47.5072, 19.0699, 4.8, 3,
 ARRAY['historia', 'komunizm', 'wzruszające'],
 'Muzeum w dawnej siedzibie tajnych służb – poruszająca dokumentacja terroru nazistowskiego i sowieckiego na Węgrzech.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Flippermuseum', 'museum',
 'Budapest VII', 47.5028, 19.0588, 4.8, 2,
 ARRAY['pinball', 'gry', 'retro'],
 'Muzeum z ponad 130 działającymi automatami pinballowymi z różnych dekad – graj tyle ile chcesz za jedną opłatą.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Węgierskie Muzeum Narodowe', 'museum',
 'Múzeum körút 14-16, Budapest VIII', 47.4929, 19.0601, 4.6, 1,
 ARRAY['historia', 'narodowe', 'Węgry'],
 'Główne muzeum historii Węgier z bogatą kolekcją od pradziejów po współczesność w pięknym neoklasycznym budynku.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Węgierska Galeria Narodowa', 'museum',
 'Szent György tér 2, Budapest I', 47.4967, 19.0390, 4.7, 2,
 ARRAY['sztuka', 'Wzgórze Zamkowe', 'malarstwo'],
 'Narodowe muzeum sztuki węgierskiej we Zamku Królewskim – od średniowiecza po XX wiek w pięknych wnętrzach.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Muzeum Sztuk Pięknych', 'museum',
 'Dózsa György út 41, Budapest XIV', 47.5148, 19.0795, 4.7, 2,
 ARRAY['sztuka europejska', 'Plac Bohaterów', 'kolekcja'],
 'Jedno z największych muzeów sztuki w Europie Środkowej z bogatymi zbiorami od antyku po XIX wiek.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Holocaust Memorial Center', 'museum',
 'Páva utca 39, Budapest IX', 47.4887, 19.0616, 4.9, 2,
 ARRAY['Holokaust', 'historia', 'wzruszające'],
 'Poruszające centrum upamiętniające Holokaust na Węgrzech – obowiązkowe miejsce dla każdego odwiedzającego Budapeszt.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Muzeum Etnograficzne', 'museum',
 'Kossuth Lajos tér 12, Budapest V', 47.5070, 19.0520, 4.6, 2,
 ARRAY['etnografia', 'kultura', 'Kossuth'],
 'Nowe muzeum etnograficzne w spektakularnym nowoczesnym budynku z bogatą kolekcją kultury ludowej Węgier.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Dom Muzyki Węgierskiej', 'museum',
 'Olof Palme sétány 3, Budapest XIV', 47.5180, 19.0800, 4.7, 2,
 ARRAY['muzyka', 'Liget', 'architektura'],
 'Spektakularny budynek Fujimoto w City Parku z interaktywną ekspozycją historii muzyki węgierskiej.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Zwack Unicum Museum', 'museum',
 'Dandár utca 1, Budapest IX', 47.4820, 19.0668, 4.6, 2,
 ARRAY['Unicum', 'likier', 'historia'],
 'Muzeum w dawnej destylarni opowiadające historię rodziny Zwack i legendy Unicumu – z degustacją w pakiecie.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Time Machine Budapest', 'museum',
 'Budapest V', 47.4972, 19.0588, 4.5, 2,
 ARRAY['immersive', 'historia', 'interaktywne'],
 'Immersywne muzeum zabierające w podróż przez historię Budapesztu za pomocą nowoczesnej technologii.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'IKONO Budapest', 'museum',
 'Budapest V', 47.5010, 19.0580, 4.5, 2,
 ARRAY['instagramowe', 'interaktywne', 'sztuka'],
 'Kolorowe immersywne centrum sztuki i fotografii z instalacjami stworzonymi do zachwytu i selfie.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Budapest Retro Élményközpont', 'museum',
 'Budapest V', 47.5005, 19.0620, 4.5, 2,
 ARRAY['retro', 'komunizm', 'nostalgia'],
 'Centrum doświadczeń z epoki komunistycznej – meble, gadżety i historyczne rekwizyty z PRL-owskich Węgier.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Aeropark Aviation Museum', 'museum',
 'BUD Airport Repülőtéri út, Budapest', 47.4320, 19.2680, 4.7, 2,
 ARRAY['lotnictwo', 'samoloty', 'dla dzieci'],
 'Muzeum lotnictwa przy lotnisku z historycznymi samolotami węgierskich i radzieckich linii – raj dla entuzjastów.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Madame Tussauds Budapest', 'museum',
 'Andrássy út 28, Budapest VI', 47.5030, 19.0625, 4.5, 3,
 ARRAY['figury woskowe', 'Andrássy', 'turystyczne'],
 'Budapeszteńska filia słynnego muzeum figur woskowych z węgierskimi i światowymi celebrytami.',
 ARRAY['morning', 'afternoon']),

-- ── ARCHITEKTURA / ZABYTKI ────────────────────────────────────

('Budapeszt', 'Parlament Węgierski', 'monument',
 'Kossuth Lajos tér 1-3, Budapest V', 47.5072, 19.0467, 4.9, 1,
 ARRAY['ikona', 'gotyk', 'Dunaj'],
 'Jeden z najpiękniejszych parlamentów świata i symbol Budapesztu – neogotycki kolos nad Dunajem z 1902 roku.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Baszta Rybacka', 'monument',
 'Szentháromság tér 5, Budapest I', 47.5019, 19.0344, 4.8, 1,
 ARRAY['Wzgórze Zamkowe', 'widok', 'neogotyk'],
 'Bajkowa neogotycka baszta na Wzgórzu Zamkowym z fantastycznym widokiem na Parlament i Dunaj.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Bazylika Świętego Stefana', 'monument',
 'Szent István tér 1, Budapest V', 47.5005, 19.0534, 4.8, 1,
 ARRAY['kościół', 'neorenesans', 'centrum'],
 'Największy kościół Budapesztu z platformą widokową na dachu i relikwią prawej dłoni Świętego Stefana.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Zamek Królewski', 'monument',
 'Szent György tér, Budapest I', 47.4967, 19.0399, 4.8, 1,
 ARRAY['zamek', 'historia', 'Wzgórze Zamkowe'],
 'Monumentalny zamek królewski dominujący nad Wzgórzem Zamkowym – dziś siedziba galerii i muzeum historii.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Kościół Macieja', 'monument',
 'Szentháromság tér 2, Budapest I', 47.5017, 19.0341, 4.8, 2,
 ARRAY['gotyk', 'Wzgórze Zamkowe', 'koronacje'],
 'Gotycki kościół Wniebowzięcia NMP na Wzgórzu Zamkowym – miejsce koronacji królów węgierskich z XIV wieku.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Zamek Vajdahunyad', 'monument',
 'Városliget, Budapest XIV', 47.5156, 19.0783, 4.7, 1,
 ARRAY['zamek', 'City Park', 'bajkowy'],
 'Romantico-gotycki zamek w City Parku zbudowany na wystawę millenijalną 1896 roku – magiczny o każdej porze.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Wielka Synagoga', 'monument',
 'Dohány utca 2, Budapest VII', 47.4984, 19.0595, 4.8, 2,
 ARRAY['synagoga', 'żydowska', 'historyczna'],
 'Największa synagoga w Europie zbudowana w 1859 roku – centrum żydowskiego życia Budapesztu z muzeum w kompleksie.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Aleja Andrássy', 'monument',
 'Andrássy út, Budapest VI', 47.5010, 19.0700, 4.8, 1,
 ARRAY['UNESCO', 'bulwar', 'paryski'],
 'Majestatyczna aleja wpisana na listę UNESCO łącząca centrum z City Parkiem – paryska elegancja w sercu Budapesztu.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Plac Bohaterów', 'monument',
 'Hősök tere, Budapest XIV', 47.5148, 19.0769, 4.8, 1,
 ARRAY['UNESCO', 'pomniki', 'historia'],
 'Monumentalny plac z kolumnadą upamiętniającą tysiąclecie państwa węgierskiego – ikoniczny i pełen historii.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Buty na Brzegu Dunaju', 'monument',
 'Pesti alsó rakpart, Budapest V', 47.5067, 19.0456, 4.8, 1,
 ARRAY['pomnik', 'Holokaust', 'Dunaj'],
 'Poruszający pomnik 60 żelaznych butów nad Dunajem upamiętniający Żydów zamordowanych tu podczas II wojny.',
 ARRAY['morning', 'afternoon', 'evening']),

-- ── PARKI ─────────────────────────────────────────────────────

('Budapeszt', 'Wyspa Małgorzaty', 'park',
 'Margit-sziget, Budapest', 47.5258, 19.0478, 4.8, 1,
 ARRAY['wyspa', 'spacer', 'zieleń'],
 'Zielona oaza na Dunaju z parkiem, fontanną muzyczną, bassenami i ścieżką rowerową – idealna na relaks.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'City Park (Városliget)', 'park',
 'Városliget, Budapest XIV', 47.5183, 19.0795, 4.7, 1,
 ARRAY['park', 'zamek', 'zoo'],
 'Najstarszy publiczny park Budapesztu z zamkiem Vajdahunyad, zoo, wannami Szechenyi i Muzeum Sztuk Pięknych.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Memento Park', 'park',
 'Balatoni út, Budapest XXII', 47.4306, 18.9974, 4.6, 2,
 ARRAY['komunizm', 'pomniki', 'PRL'],
 'Park ze zgromadzonymi pomnikami z ery komunistycznej – Leniny, Marksy i Stalin wycofane z ulic Budapesztu.',
 ARRAY['morning', 'afternoon']),

-- ── PUNKTY WIDOKOWE ───────────────────────────────────────────

('Budapeszt', 'Most Łańcuchowy', 'viewpoint',
 'Széchenyi Lánchíd, Budapest', 47.4985, 19.0443, 4.7, 1,
 ARRAY['most', 'Dunaj', 'ikona'],
 'Symbol Budapesztu – most z 1849 roku łączący Budę z Pesztem, piękny szczególnie po zmroku w iluminacji.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Wzgórze Gellerta', 'viewpoint',
 'Gellért-hegy, Budapest XI', 47.4869, 19.0474, 4.8, 1,
 ARRAY['panorama', 'Dunaj', 'ikona'],
 'Najpiękniejszy punkt widokowy Budapesztu z panoramą całego miasta – zamki, mosty i Dunaj jak na dłoni.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Wzgórze Zamkowe (Várhegy)', 'viewpoint',
 'Várhegy, Budapest I', 47.4967, 19.0399, 4.8, 1,
 ARRAY['zamek', 'Dunaj', 'panorama'],
 'Historyczne wzgórze z zamkiem, kościołami i przepięknym widokiem na Peszt, mosty i Dunaj.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Most Wolności', 'viewpoint',
 'Szabadság híd, Budapest', 47.4878, 19.0540, 4.8, 1,
 ARRAY['most', 'piknik', 'bulwar'],
 'Zielony stalowy most z 1896 roku – latem pokrywany kocami i piknikującymi mieszkańcami, idealne zdjęcia.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Budapest Castle Hill Funicular', 'viewpoint',
 'Clark Ádám tér, Budapest I', 47.4981, 19.0391, 4.6, 2,
 ARRAY['funicular', 'Dunaj', 'Wzgórze Zamkowe'],
 'Historyczna kolejka linowo-terenowa (1870) ze wspaniałym widokiem na Dunaj podczas wjazdu na Wzgórze Zamkowe.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'János-hegy', 'viewpoint',
 'János-hegy, Budapest II', 47.5240, 18.9658, 4.7, 1,
 ARRAY['wzgórze', 'panorama', 'las'],
 'Najwyższy punkt Budapesztu (527m) z drewnianą wieżą widokową i widokiem na całe miasto i okolice.',
 ARRAY['morning', 'afternoon']),

-- ── ZAKUPY ────────────────────────────────────────────────────

('Budapeszt', 'Centralny Rynek', 'shopping',
 'Vámház körút 1-3, Budapest IX', 47.4877, 19.0611, 4.7, 1,
 ARRAY['targ', 'lokalnie', 'tradycja'],
 'Największy i najpiękniejszy targ Budapesztu z 1897 roku – papryki, foie gras, haft i wszystko co węgierskie.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Szimpla Sunday Farmers'' Market', 'shopping',
 'Kazinczy utca 14, Budapest VII', 47.4992, 19.0633, 4.7, 1,
 ARRAY['farmers market', 'ekologiczne', 'niedziela'],
 'Słynny niedzielny targ na terenie Ruin Baru Szimpla z lokalnymi produktami, rzemiosłem i jedzeniem.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Lehel Market', 'shopping',
 'Váci út 9, Budapest XIII', 47.5233, 19.0589, 4.5, 1,
 ARRAY['targ', 'lokalne', 'codzienne'],
 'Lokalna hala targowa w XIII dzielnicy z freskami Imre Vargha – autentyczne miejsce zakupów mieszkańców.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Ecseri pchli targ', 'shopping',
 'Nagykőrösi út 156, Budapest XIX', 47.4537, 19.1163, 4.5, 1,
 ARRAY['pchli targ', 'antyki', 'vintage'],
 'Największy i najsłynniejszy pchli targ Węgier z antykami, komunistycznymi pamiątkami i unikalnymi znaleziskami.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Love Art Budapest Gallery', 'shopping',
 'Budapest V', 47.4982, 19.0542, 4.6, 2,
 ARRAY['rękodzieło', 'design', 'prezenty'],
 'Galeria z ręcznie robionymi prezentami i designerskimi pamiątkami z Budapesztu – najlepsze alternatywne souveniry.',
 ARRAY['morning', 'afternoon']),

-- ── PIEKARNIE / CUKIERNIE ─────────────────────────────────────

('Budapeszt', 'Artizán Bakery', 'cafe',
 'Budapest V', 47.5020, 19.0588, 4.7, 2,
 ARRAY['piekarnia', 'rzemieślnicza', 'croissanty'],
 'Rzemieślnicza piekarnia z wyjątkowymi croissantami, chlebem na zakwasie i słodkościami z najlepszych składników.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Lisboa Pastry & Bakery', 'cafe',
 'Budapest VII', 47.4988, 19.0612, 4.7, 1,
 ARRAY['pastel de nata', 'piekarnia', 'portugalia'],
 'Portugieska piekarnia słynąca z najlepszych pastel de nata w Budapeszcie i innych wypieków z Lizbony.',
 ARRAY['morning', 'afternoon']),

-- ── ROZRYWKA / DOŚWIADCZENIA ──────────────────────────────────

('Budapeszt', 'Łaźnie Széchenyi', 'experience',
 'Állatkerti körút 11, Budapest XIV', 47.5191, 19.0802, 4.7, 2,
 ARRAY['termy', 'basen', 'relaks'],
 'Największy i najpiękniejszy kompleks termalny Budapesztu z neorenesansowym budynkiem z 1913 roku.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Węgierska Opera Państwowa', 'experience',
 'Andrássy út 22, Budapest VI', 47.5030, 19.0609, 4.8, 3,
 ARRAY['opera', 'Andrássy', 'kultura'],
 'Jedno z najpiękniejszych budynków operowych na świecie – zarówno spektakle jak i wycieczki są niezapomniane.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Thermal Beer Spa', 'experience',
 'Városliget, Budapest XIV', 47.5188, 19.0800, 4.6, 3,
 ARRAY['termy', 'piwo', 'unikalne'],
 'Jedyna w swoim rodzaju atrakcja: moczenie się w wannach pełnych ciepłego piwa rzemieślniczego.',
 ARRAY['afternoon', 'evening']),

('Budapeszt', 'Budapeszteński Ogród Zoologiczny', 'experience',
 'Állatkerti körút 6-12, Budapest XIV', 47.5187, 19.0787, 4.6, 2,
 ARRAY['zoo', 'City Park', 'dla dzieci'],
 'Jeden z najstarszych ogrodów zoologicznych na świecie (1866) z piękną secesyjną architekturą wejścia.',
 ARRAY['morning', 'afternoon']),

('Budapeszt', 'Łaźnia Rudas', 'experience',
 'Döbrentei tér 9, Budapest I', 47.4887, 19.0389, 4.7, 2,
 ARRAY['termy', 'tureckie', 'historia'],
 'Turecka łaźnia z XVI wieku z oryginalnymi kupolami i basenem termalnym – weekendowe imprezy pool party.',
 ARRAY['morning', 'afternoon', 'evening']),

('Budapeszt', 'Łaźnia Lukács', 'experience',
 'Frankel Leó utca 25-29, Budapest II', 47.5133, 19.0294, 4.6, 2,
 ARRAY['termy', 'lokalne', 'autentyczne'],
 'Autentyczna łaźnia termalna mniej turystyczna niż Széchenyi – chętnie odwiedzana przez budapeszteńczyków.',
 ARRAY['morning', 'afternoon', 'evening']);
