-- Migration: Trójmiasto seed data — Gdynia (65 places)
-- 2026-04-17
-- city = 'Trójmiasto' to match city picker selection

INSERT INTO public.places (city, place_name, category, address, latitude, longitude, rating, price_level, vibe_tags, description, best_time) VALUES

-- ── RESTAURACJE ──────────────────────────────────────────────────────────────

('Trójmiasto', 'Sztuczka', 'restaurant',
 'Gdynia', 54.5189, 18.5305, 4.6, 2,
 ARRAY['kreatywna kuchnia', 'klimatyczna', 'lokalna'],
 'Klimatyczna restauracja z kreatywną kuchnią i starannie dobranymi smakami.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Malika', 'restaurant',
 'Gdynia', 54.5185, 18.5310, 4.5, 2,
 ARRAY['bliskowschodnia', 'egzotyczna', 'aromatyczna'],
 'Restauracja z kuchnią bliskowschodnią — intensywne przyprawy, ciepła atmosfera.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Czerwony Piec', 'restaurant',
 'Gdynia', 54.5192, 18.5300, 4.5, 2,
 ARRAY['pizza', 'włoska', 'wypiekana w piecu'],
 'Pizza i dania z pieca opalanego drewnem — chrupiące ciasto, świeże składniki.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Mandu', 'restaurant',
 'Gdynia', 54.5195, 18.5295, 4.6, 2,
 ARRAY['azjatycka', 'pierogi', 'fusion'],
 'Restauracja inspirowana kuchnią azjatycką, znana z pierogów mandu i ramenów.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Haos', 'restaurant',
 'Gdynia', 54.5183, 18.5318, 4.6, 3,
 ARRAY['nowoczesna', 'fine dining', 'sezonowe składniki'],
 'Nowoczesna restauracja z sezowym menu i starannie skomponowanymi daniami.',
 ARRAY['evening']),

('Trójmiasto', 'Pueblo', 'restaurant',
 'Gdynia', 54.5188, 18.5308, 4.4, 2,
 ARRAY['meksykańska', 'tacos', 'kolorowa'],
 'Meksykańskie smaki w centrum Gdyni — tacos, guacamole i margarita.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Tłusta Kaczka', 'restaurant',
 'Gdynia', 54.5191, 18.5302, 4.5, 2,
 ARRAY['polska', 'tradycyjna', 'domowa'],
 'Polska kuchnia w nowoczesnym wydaniu — kaczka, pierogi i klasyczne zupy.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Searcle', 'restaurant',
 'Gdynia', 54.5186, 18.5315, 4.5, 2,
 ARRAY['ryby', 'owoce morza', 'morski klimat'],
 'Restauracja z rybami i owocami morza — świeże dostawy prosto z trójmiejskich portów.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Cozzi Ristorante', 'restaurant',
 'Gdynia', 54.5190, 18.5295, 4.7, 3,
 ARRAY['włoska', 'pasta', 'elegancka'],
 'Elegancka włoska restauracja z autentyczną pastą, risotto i rozbudowaną kartą win.',
 ARRAY['evening']),

('Trójmiasto', 'Tawerna Orłowska', 'restaurant',
 'ul. Orłowska, Gdynia', 54.4833, 18.5833, 4.5, 2,
 ARRAY['ryby', 'nadmorska', 'widok na morze'],
 'Tawerna przy klifie orłowskim z rybami i widokiem na Zatokę Gdańską.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Przystanek Orłowo', 'restaurant',
 'Gdynia-Orłowo', 54.4840, 18.5820, 4.4, 2,
 ARRAY['morska', 'ryby', 'plaża'],
 'Przytulna restauracja w dzielnicy Orłowo z daniami rybnymi i klimatem nadmorskim.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Karczma Gdyńska', 'restaurant',
 'Gdynia', 54.5175, 18.5280, 4.3, 2,
 ARRAY['polska', 'regionalna', 'tradycyjna'],
 'Karczma z kuchnią polską i regionalną — bigos, żurek, pierogi na domową modłę.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'El Greco', 'restaurant',
 'Gdynia', 54.5185, 18.5310, 4.4, 2,
 ARRAY['grecka', 'śródziemnomorska', 'gyros'],
 'Restauracja z kuchnią grecką — souvlaki, musaka i świeże sałatki.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Aleja 40', 'restaurant',
 'Gdynia', 54.5193, 18.5288, 4.6, 2,
 ARRAY['bistro', 'nowoczesna', 'sezonowa'],
 'Nowoczesne bistro z sezonowym menu i starannie dobranymi lokalnymi produktami.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Fedde Bistro', 'restaurant',
 'Gdynia', 54.5187, 18.5320, 4.6, 2,
 ARRAY['skandynawska', 'bistro', 'design'],
 'Bistro z wpływami skandynawskimi, minimalistycznym wnętrzem i świetnymi śniadaniami.',
 ARRAY['morning', 'lunch']),

('Trójmiasto', 'Bangkok Thai', 'restaurant',
 'Gdynia', 54.5182, 18.5305, 4.4, 2,
 ARRAY['tajska', 'azjatycka', 'ostra'],
 'Restauracja tajska z autentycznymi curry, pad thai i zupami tom yum.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Ogniem i Piecem', 'restaurant',
 'Gdynia', 54.5195, 18.5292, 4.5, 2,
 ARRAY['pizza', 'piec opałowy', 'włoska'],
 'Pizzeria z piecem opałowym — cienkie ciasto, świeże składniki, włoski klimat.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Pasta Miasta', 'restaurant',
 'Gdynia', 54.5188, 18.5312, 4.6, 2,
 ARRAY['pasta', 'włoska', 'domowa'],
 'Restauracja z domową pastą robioną na miejscu — różnorodne sosy i świeże składniki.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Barracuda', 'restaurant',
 'Gdynia', 54.5170, 18.5255, 4.5, 3,
 ARRAY['ryby', 'owoce morza', 'portowa'],
 'Restauracja rybna przy basenie portowym z widokiem na Skwer Kościuszki.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Rucola', 'restaurant',
 'Gdynia', 54.5191, 18.5300, 4.5, 2,
 ARRAY['włoska', 'pizza', 'makaron'],
 'Włoska restauracja z klasyczną pizzą, świeżym makaronem i winem.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Vinegre del Mar', 'restaurant',
 'Gdynia', 54.5185, 18.5308, 4.6, 3,
 ARRAY['śródziemnomorska', 'wino', 'tapas'],
 'Restauracja śródziemnomorska z tapas, świeżymi rybami i wyśmienitą kartą win.',
 ARRAY['evening']),

('Trójmiasto', 'Białe Wino i Owoce', 'restaurant',
 'Gdynia', 54.5192, 18.5298, 4.7, 3,
 ARRAY['wine bar', 'owoce morza', 'elegancka'],
 'Stylowy wine bar z owocami morza, serami i naturalnym winem.',
 ARRAY['afternoon', 'evening']),

('Trójmiasto', 'Trafik', 'restaurant',
 'Gdynia', 54.5180, 18.5322, 4.4, 2,
 ARRAY['bistro', 'burgery', 'miejska'],
 'Miejskie bistro z burgerami, makaronem i codziennie zmienianym menu dnia.',
 ARRAY['lunch', 'evening']),

('Trójmiasto', 'Oberża 86', 'restaurant',
 'Gdynia', 54.5186, 18.5314, 4.5, 2,
 ARRAY['polska', 'klimatyczna', 'piwo kraftowe'],
 'Klimatyczna oberża z polską kuchnią i bogatym wyborem piw kraftowych.',
 ARRAY['evening']),

-- ── KAWIARNIE ────────────────────────────────────────────────────────────────

('Trójmiasto', 'Black and White Coffee', 'cafe',
 'Gdynia', 54.5190, 18.5305, 4.7, 2,
 ARRAY['specialty coffee', 'minimalistyczna', 'third wave'],
 'Minimalistyczna kawiarnia specialty z precyzyjnym parzeniem i świetną espresso.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Flow Cafe', 'cafe',
 'Gdynia', 54.5188, 18.5310, 4.6, 2,
 ARRAY['specialty coffee', 'spokojne', 'do pracy'],
 'Przytulna kawiarnia idealna do pracy i spotkań z dobrą kawą specialty.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Tłok', 'cafe',
 'Gdynia', 54.5195, 18.5295, 4.5, 1,
 ARRAY['zatłoczona', 'miejska', 'kawa na wynos'],
 'Popularna kawiarnia przy głównej ulicy — tłoczna, dynamiczna, dobra kawa.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Uboga Krewna', 'cafe',
 'Gdynia', 54.5183, 18.5318, 4.6, 2,
 ARRAY['vintage', 'klimatyczna', 'ciasta'],
 'Klimatyczna kawiarnia w stylu vintage z domowymi ciastami i spokojną atmosferą.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Kofeina', 'cafe',
 'Gdynia', 54.5191, 18.5302, 4.5, 2,
 ARRAY['specialty coffee', 'lokalna', 'espresso'],
 'Lokalna kawiarnia z dobrą kawą, śniadaniami i codzienną społecznością stałych bywalców.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Cafe Strych', 'cafe',
 'Gdynia', 54.5187, 18.5320, 4.6, 2,
 ARRAY['klimatyczna', 'poddasze', 'artystyczna'],
 'Kawiarnia na poddaszu z artystycznym klimatem, dobrą kawą i domowymi wypiekami.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Contrast Cafe', 'cafe',
 'Gdynia', 54.5193, 18.5290, 4.6, 2,
 ARRAY['specialty coffee', 'nowoczesna', 'design'],
 'Nowoczesna kawiarnia z kontrastowym designem i kawą third wave.',
 ARRAY['morning', 'afternoon']),

-- ── PIEKARNIE / CUKIERNIE / LODZIARNIE ────────────────────────────────────

('Trójmiasto', 'Piekarnia Ruciński', 'cafe',
 'Gdynia', 54.5188, 18.5308, 4.5, 1,
 ARRAY['piekarnia', 'tradycyjna', 'chleb'],
 'Rodzinna piekarnia z wieloletnią tradycją — chleby na zakwasie i świeże bułki.',
 ARRAY['morning']),

('Trójmiasto', 'Piekarnia Raszczyk', 'cafe',
 'Gdynia', 54.5182, 18.5315, 4.5, 1,
 ARRAY['piekarnia', 'wypieki', 'tradycja'],
 'Gdyńska piekarnia znana z doskonałych wypieków i aromatycznego chleba.',
 ARRAY['morning']),

('Trójmiasto', 'Piekarnia Pellowski', 'cafe',
 'Gdynia', 54.5196, 18.5288, 4.6, 1,
 ARRAY['piekarnia', 'regionalna', 'tradycja'],
 'Tradycyjna trójmiejska piekarnia z wielopokoleniową historią i znakomitym pieczywem.',
 ARRAY['morning']),

('Trójmiasto', 'Cukiernia Sowa', 'cafe',
 'Gdynia', 54.5185, 18.5312, 4.4, 2,
 ARRAY['cukiernia', 'torty', 'klasyczna'],
 'Klasyczna cukiernia z tortami na zamówienie i szerokim wyborem słodkości.',
 ARRAY['afternoon']),

('Trójmiasto', 'Cukiernia Markiza', 'cafe',
 'Gdynia', 54.5190, 18.5300, 4.5, 2,
 ARRAY['cukiernia', 'elegancka', 'ciasta'],
 'Elegancka cukiernia z wykwintnymi ciastami i handmade czekoladkami.',
 ARRAY['afternoon']),

('Trójmiasto', 'Bajadera', 'cafe',
 'Gdynia', 54.5186, 18.5318, 4.5, 2,
 ARRAY['cukiernia', 'vintage', 'pralinki'],
 'Urokliwa cukiernia w klimacie retro z domowymi pralinkami i lodami.',
 ARRAY['afternoon']),

('Trójmiasto', 'Mariola Lody', 'cafe',
 'Gdynia', 54.5192, 18.5295, 4.7, 1,
 ARRAY['lody', 'rzemieślnicze', 'naturalne'],
 'Kultowa lodziarnia z naturalnymi lodami rzemieślniczymi — kolejki latem nieuniknione.',
 ARRAY['afternoon', 'evening']),

('Trójmiasto', 'Lody Bosko', 'cafe',
 'Gdynia', 54.5184, 18.5310, 4.6, 1,
 ARRAY['lody', 'owocowe', 'sezonowe'],
 'Lodziarnia z sezonowymi smakami na bazie lokalnych owoców.',
 ARRAY['afternoon', 'evening']),

('Trójmiasto', 'Good Lood', 'cafe',
 'Gdynia', 54.5189, 18.5302, 4.6, 1,
 ARRAY['lody', 'wegańskie', 'rzemieślnicze'],
 'Rzemieślnicze lody z opcjami wegańskimi i nieoczywistymi połączeniami smaków.',
 ARRAY['afternoon', 'evening']),

-- ── KULTURA / MUZEA ──────────────────────────────────────────────────────────

('Trójmiasto', 'Muzeum Miasta Gdyni', 'museum',
 'ul. Zawiszy Czarnego 1, Gdynia', 54.5224, 18.5290, 4.5, 1,
 ARRAY['historia', 'modernizm', 'Gdynia'],
 'Muzeum opowiadające historię Gdyni — od rybackiej wioski do nowoczesnego portu.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Muzeum Emigracji', 'museum',
 'ul. Polska 1, Gdynia', 54.5225, 18.5306, 4.8, 2,
 ARRAY['emigracja', 'historia', 'interaktywne'],
 'Wyjątkowe muzeum w dawnej hali odpraw emigrantów — poruszające wystawy o polskiej diasporze.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Muzeum Marynarki Wojennej', 'museum',
 'ul. Zawiszy Czarnego 1B, Gdynia', 54.5220, 18.5285, 4.4, 1,
 ARRAY['marynarka', 'historia', 'militaria'],
 'Muzeum z eksponatami marynarki wojennej — uzbrojenie, mundury i historia PMW.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Dar Pomorza', 'monument',
 'Nabrzeże Pomorskie, Gdynia', 54.5228, 18.5278, 4.7, 2,
 ARRAY['żaglowiec', 'muzeum', 'port'],
 'Zabytkowy żaglowiec zacumowany przy nabrzeżu — muzeum na wodzie z historią polskiej marynarki.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'ORP Błyskawica', 'monument',
 'Nabrzeże Pomorskie, Gdynia', 54.5231, 18.5287, 4.7, 2,
 ARRAY['okręt wojenny', 'historia', 'muzeum'],
 'Zabytkowy niszczyciel z II wojny światowej — jeden z symboli Gdyni i muzeum na wodzie.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Centrum Nauki Experyment', 'experience',
 'al. Zwycięstwa 96/98, Gdynia', 54.5094, 18.5086, 4.7, 2,
 ARRAY['nauka', 'interaktywne', 'dzieci'],
 'Interaktywne centrum nauki — setki eksperymentów do samodzielnego przeprowadzenia.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Teatr Muzyczny', 'museum',
 'pl. Grunwaldzki 1, Gdynia', 54.5152, 18.5315, 4.6, 3,
 ARRAY['teatr', 'musical', 'kultura'],
 'Jeden z najważniejszych teatrów muzycznych w Polsce — musicale z rozmachu i wysmakowane spektakle.',
 ARRAY['evening']),

('Trójmiasto', 'Teatr Gdynia Główna', 'museum',
 'ul. Pl. Konstytucji 1, Gdynia', 54.5230, 18.5330, 4.5, 2,
 ARRAY['teatr', 'dramat', 'kultura'],
 'Teatr w zaadaptowanym budynku dawnego dworca — awangardowy repertuar i klimatyczne wnętrze.',
 ARRAY['evening']),

('Trójmiasto', 'Konsulat Kultury', 'museum',
 'ul. Świętojańska 53, Gdynia', 54.5200, 18.5295, 4.6, 1,
 ARRAY['galeria', 'sztuka', 'wernisaże'],
 'Centrum kultury z galerią sztuki współczesnej, warsztatami i wydarzeniami artystycznymi.',
 ARRAY['afternoon', 'evening']),

('Trójmiasto', 'InfoBox', 'museum',
 'ul. Świętojańska 30, Gdynia', 54.5195, 18.5300, 4.3, 1,
 ARRAY['architektura', 'modernizm', 'wystawy'],
 'Punkt informacyjny i galeria poświęcona architekturze modernistycznej Gdyni.',
 ARRAY['morning', 'afternoon']),

-- ── ROZRYWKA ─────────────────────────────────────────────────────────────────

('Trójmiasto', 'JumpCity Gdynia', 'experience',
 'Gdynia', 54.5100, 18.4990, 4.5, 2,
 ARRAY['trampoliny', 'aktywne', 'dzieci'],
 'Park trampolin z mnóstwem atrakcji — idealne na aktywne popołudnie.',
 ARRAY['afternoon']),

('Trójmiasto', 'Adventure Park Kolibki', 'experience',
 'Park Kolibki, Gdynia', 54.4892, 18.5486, 4.6, 2,
 ARRAY['park linowy', 'outdoor', 'adrenalina'],
 'Park linowy w lesie kolibkowskim — trasy dla różnych grup wiekowych z widokami na zatokę.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'U7 Gdynia', 'experience',
 'Gdynia', 54.5105, 18.5010, 4.6, 2,
 ARRAY['escape room', 'zagadki', 'team'],
 'Escape roomy w klimatycznych dekoracjach — świetna zabawa dla grup i par.',
 ARRAY['afternoon', 'evening']),

('Trójmiasto', 'Zoltar Gdynia', 'experience',
 'Gdynia', 54.5195, 18.5305, 4.5, 2,
 ARRAY['gry', 'rozrywka', 'retro'],
 'Centrum rozrywki z grami i atrakcjami dla całej rodziny.',
 ARRAY['afternoon', 'evening']),

('Trójmiasto', 'Pixel XL Gdynia', 'experience',
 'Gdynia', 54.5188, 18.5298, 4.6, 2,
 ARRAY['VR', 'gry wideo', 'nowoczesne'],
 'Centrum gier VR i e-sportów — najnowocześniejszy sprzęt i godziny frajdy.',
 ARRAY['afternoon', 'evening']),

-- ── ZAKUPY ───────────────────────────────────────────────────────────────────

('Trójmiasto', 'Riviera Gdynia', 'shopping',
 'ul. Kazimierza Górskiego 2, Gdynia', 54.5094, 18.4986, 4.3, 2,
 ARRAY['galeria', 'zakupy', 'restauracje'],
 'Największa galeria handlowa w Gdyni z ponad 200 sklepami i centrum rozrywki.',
 ARRAY['afternoon']),

('Trójmiasto', 'Centrum Batory', 'shopping',
 'ul. Jana z Kolna 11, Gdynia', 54.5183, 18.5266, 4.1, 2,
 ARRAY['centrum handlowe', 'zakupy', 'centrum'],
 'Centrum handlowe w sercu Gdyni z szeroką ofertą sklepów i punktów usługowych.',
 ARRAY['afternoon']),

('Trójmiasto', 'Hala Targowa Gdynia', 'market',
 'ul. Wójta Radtkego, Gdynia', 54.5175, 18.5335, 4.4, 1,
 ARRAY['targ', 'lokalne', 'świeże produkty'],
 'Historyczna hala targowa z lokalną żywnością, rybami i produktami prosto od rolników.',
 ARRAY['morning']),

('Trójmiasto', 'Targowisko Chylonia', 'market',
 'Gdynia-Chylonia', 54.5450, 18.4850, 4.0, 1,
 ARRAY['targ', 'tanie zakupy', 'lokalne'],
 'Duże targowisko z szerokim asortymentem — owoce, warzywa, odzież i artykuły codziennego użytku.',
 ARRAY['morning']),

('Trójmiasto', 'Szafa Vintage', 'shopping',
 'Gdynia', 54.5185, 18.5310, 4.6, 1,
 ARRAY['vintage', 'second hand', 'unikatowe'],
 'Sklep z ubraniami vintage i second hand — unikatowe znaleziska w przystępnych cenach.',
 ARRAY['afternoon']),

-- ── OUTDOOR / NATURA ─────────────────────────────────────────────────────────

('Trójmiasto', 'Park Centralny', 'park',
 'Gdynia', 54.5178, 18.5124, 4.5, 1,
 ARRAY['park', 'zieleń', 'spacery'],
 'Główny park Gdyni z alejkami spacerowymi, stawem i ciszą od miejskiego zgiełku.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Park Kolibki', 'park',
 'Gdynia-Orłowo', 54.4892, 18.5486, 4.6, 1,
 ARRAY['las', 'park', 'przyroda'],
 'Malowniczy park leśny przy klifie orłowskim — trasy rowerowe i spacerowe nad morzem.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Klif Orłowski', 'viewpoint',
 'Gdynia-Orłowo', 54.4787, 18.5866, 4.8, 1,
 ARRAY['widok', 'klif', 'morze'],
 'Malowniczy klif z widokiem na Zatokę Gdańską — jeden z piękniejszych punktów widokowych na Pomorzu.',
 ARRAY['morning', 'afternoon']),

('Trójmiasto', 'Kamienna Góra', 'viewpoint',
 'Gdynia', 54.5081, 18.5250, 4.7, 1,
 ARRAY['widok', 'panorama', 'wzgórze'],
 'Wzgórze z panoramicznym widokiem na port gdyński i Zatokę Gdańską — obowiązkowy punkt.',
 ARRAY['morning', 'afternoon', 'evening']),

('Trójmiasto', 'Bulwar Nadmorski', 'viewpoint',
 'al. Jana Pawła II, Gdynia', 54.5167, 18.5248, 4.7, 1,
 ARRAY['promenada', 'morze', 'port'],
 'Nadmorska promenada wzdłuż portu — widok na statki, Dar Pomorza i Zatokę Gdańską.',
 ARRAY['morning', 'afternoon', 'evening']);
