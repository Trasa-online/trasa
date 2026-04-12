-- Migration: Warsaw places seed data
-- 2026-04-12

-- Category mapping from CSV:
--   Kawiarnia       → cafe
--   Herbaciarnia    → cafe
--   Cukiernia       → cafe
--   Piekarnia       → cafe
--   Restauracja     → restaurant
--   Śniadania       → restaurant
--   Foodhall        → market
--   Bar             → bar
--   Klub            → club
--   Muzeum          → museum
--   Park            → park
--   Zakupy          → shopping
--   Landmark        → monument
--   Punkt widokowy  → viewpoint
--   Rozrywka        → experience

INSERT INTO public.places (city, place_name, category, address, latitude, longitude, rating, price_level, vibe_tags, description, best_time) VALUES

-- ── HERBACIARNIE ─────────────────────────────────────────────────────────────

('Warszawa', 'Herbaciarnia Same Fusy', 'cafe',
 'Warszawa', 52.2481, 21.0452, 4.6, 1,
 ARRAY['herbaciarnia', 'przytulna', 'Praga'],
 'Klimatyczna herbaciarnia na Pradze z szerokim wyborem herbat ze świata i spokojną atmosferą.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'MOYA MATCHA', 'cafe',
 'Warszawa', 52.2340, 21.0190, 4.5, 2,
 ARRAY['matcha', 'herbata', 'nowoczesna'],
 'Specjalistyczny bar matcha z japońską herbatą ceremonialną i wyjątkowymi napojami na bazie matcha.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Pijalnia Ziół Dary Natury', 'cafe',
 'Warszawa', 52.2297, 21.0122, 4.3, 1,
 ARRAY['herbaciarnia', 'zioła', 'naturalna'],
 'Tradycyjna pijalnia ziół z bogatą ofertą naparów leczniczych i relaksacyjnych.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Bubble Tea 7', 'cafe',
 'Warszawa', 52.2310, 21.0080, 4.4, 1,
 ARRAY['bubble tea', 'azjatycka', 'młodzieżowa'],
 'Popularny bar z bubble tea oferujący szeroki wybór smaków i dodatków – idealne dla miłośników azjatyckich napojów.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'BubbleJoy Taiwan - Chmielna', 'cafe',
 'ul. Chmielna, Warszawa', 52.2307, 21.0108, 4.5, 1,
 ARRAY['bubble tea', 'tajwan', 'Chmielna'],
 'Autentyczne tajwańskie bubble tea na popularnej ulicy Chmielnej – świeże owoce, prawdziwa herbata.',
 ARRAY['afternoon', 'evening']),

-- ── KAWIARNIE ────────────────────────────────────────────────────────────────

('Warszawa', 'Pijalnia Czekolady E.Wedel', 'cafe',
 'ul. Szpitalna 8, Warszawa', 52.2371, 21.0144, 4.6, 2,
 ARRAY['czekolada', 'historyczna', 'legenda'],
 'Legendarna pijalnia czekolady marki Wedel – obowiązkowe miejsce w Warszawie, gorąca czekolada i praliny od 1851 roku.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Croque Madame', 'cafe',
 'Warszawa', 52.2350, 21.0200, 4.5, 2,
 ARRAY['śniadania', 'brunch', 'francuska'],
 'Klimatyczna kawiarnia ze świetnymi śniadaniami i brunchami w paryskim stylu.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Shabby Chic Coffee & Wine Bar', 'cafe',
 'Warszawa', 52.2280, 21.0150, 4.5, 2,
 ARRAY['vintage', 'wino', 'przytulna'],
 'Urokliwa kawiarnia w stylu shabby chic – doskonała kawa i wino w romantycznym wnętrzu.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Vincent Boulangerie Patisserie', 'cafe',
 'Warszawa', 52.2295, 21.0110, 4.7, 2,
 ARRAY['piekarnia', 'croissanty', 'francuska'],
 'Autentyczna francuska piekarnia i cukiernia z doskonałymi croissantami, bagietkami i wypiekami.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'TO LUBIĘ', 'cafe',
 'Warszawa', 52.2315, 21.0095, 4.5, 2,
 ARRAY['lokalna', 'specialty coffee', 'cowork'],
 'Popularna kawiarnia z pyszną kawą specialty i domową atmosferą – ulubione miejsce freelancerów.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Kawiarnia Kafka', 'cafe',
 'ul. Oboźna 3, Powiśle, Warszawa', 52.2388, 21.0279, 4.6, 2,
 ARRAY['literacka', 'Powiśle', 'klimatyczna'],
 'Kultowa kawiarnia na Powiślu z literacką duszą, świetną kawą i niezwykłą atmosferą.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Pożegnanie z Afryką', 'cafe',
 'ul. Nowy Świat, Warszawa', 52.2342, 21.0186, 4.6, 2,
 ARRAY['specialty coffee', 'herbata', 'legenda'],
 'Kultowy sklep i kawiarnia z kawą i herbatą z całego świata – ikona Nowego Światu od ponad 30 lat.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Wrzenie Świata', 'cafe',
 'ul. Krucza 46, Warszawa', 52.2293, 21.0208, 4.6, 2,
 ARRAY['bookstore cafe', 'alternatywna', 'Śródmieście'],
 'Kawiarnia-księgarnia z niezależnym klimatem, dobra kawa i bogaty wybór książek i prasy.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'STOR Café', 'cafe',
 'Warszawa', 52.2320, 21.0160, 4.6, 2,
 ARRAY['specialty coffee', 'skandynawska', 'minimalistyczna'],
 'Minimalistyczna kawiarnia specialty w skandynawskim stylu z doskonałą kawą filtrowaną i espresso.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Coffeedesk Kawiarnia - Próżna', 'cafe',
 'ul. Próżna, Warszawa', 52.2347, 21.0112, 4.6, 2,
 ARRAY['specialty coffee', 'Próżna', 'profesjonalna'],
 'Kawiarnia marki Coffeedesk – mekka miłośników kawy specialty z szerokim wyborem ziaren i metod parzenia.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Kawiarnia Patio', 'cafe',
 'Warszawa', 52.2300, 21.0130, 4.5, 2,
 ARRAY['ogródek', 'przytulna', 'letnia'],
 'Kawiarnia z urokliwym patio i ogrodem – idealne miejsce na letnią kawę na świeżym powietrzu.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Ministerstwo Kawy', 'cafe',
 'Warszawa', 52.2331, 21.0155, 4.7, 2,
 ARRAY['specialty coffee', 'kultowe', 'Śródmieście'],
 'Jedno z czołowych miejsc ze specialty coffee w Warszawie – profesjonalni bariści i wyjątkowe ziarna.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Kawiarnia Kawałek', 'cafe',
 'Warszawa', 52.2360, 21.0180, 4.5, 2,
 ARRAY['ciasta', 'domowa', 'sąsiedzka'],
 'Kameralna kawiarnia z przepysznymi domowymi ciastami i przyjazną, sąsiedzką atmosferą.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Cukiernia Warszawska - Stare Miasto', 'cafe',
 'Stare Miasto, Warszawa', 52.2478, 21.0128, 4.5, 2,
 ARRAY['Stare Miasto', 'tradycja', 'cukiernia'],
 'Tradycyjna cukiernia przy Starym Mieście z klasycznymi warszawskimi ciastami i deserami.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Pół na Puł', 'cafe',
 'Warszawa', 52.2310, 21.0165, 4.5, 2,
 ARRAY['vintage', 'klimatyczna', 'Śródmieście'],
 'Kawiarnia z charakterem łącząca elementy starego i nowego – świetna kawa, domowe wypieki.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Keks Coffee & Bar', 'cafe',
 'Warszawa', 52.2270, 21.0140, 4.6, 2,
 ARRAY['specialty coffee', 'bar', 'Mokotów'],
 'Kawiarnia i bar łączące specialty coffee w ciągu dnia z koktajlami wieczorem.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Proces Kawki', 'cafe',
 'Warszawa', 52.2265, 21.0090, 4.5, 2,
 ARRAY['Mokotów', 'sąsiedzka', 'kawa'],
 'Sympatyczna kawiarnia na Mokotowie z dobrą kawą i domową atmosferą.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'WakeCup Cafe', 'cafe',
 'Warszawa', 52.2350, 21.0150, 4.5, 2,
 ARRAY['specialty coffee', 'śniadania', 'nowoczesna'],
 'Nowoczesna kawiarnia specialty z pyszną kawą i bogatym menu śniadaniowym.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Miau Cafe', 'cafe',
 'Warszawa', 52.2289, 21.0065, 4.6, 2,
 ARRAY['koty', 'cat cafe', 'relaks'],
 'Kawiarnia z kotami – idealne miejsce dla miłośników kotów i dobrej kawy (wiek 13+).',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Bella Kafeteria', 'cafe',
 'Warszawa', 52.2330, 21.0195, 4.5, 2,
 ARRAY['włoska', 'kawa', 'śniadania'],
 'Kafeteria w stylu włoskim z doskonałym espresso, croissantami i lekkimi śniadaniami.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Kawiarnia Cafe Central Hoża', 'cafe',
 'ul. Hoża, Warszawa', 52.2260, 21.0178, 4.5, 2,
 ARRAY['klasyczna', 'Śródmieście', 'kawa'],
 'Klasyczna kawiarnia przy ul. Hożej – dobra kawa, ciasta i miła obsługa.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Le Petit Cafe', 'cafe',
 'Warszawa', 52.2355, 21.0160, 4.5, 2,
 ARRAY['francuska', 'kameralna', 'kawa'],
 'Mała, urokliwa kawiarnia w paryskim stylu – doskonałe place do pracy lub randki.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'relax cafe bar centrum', 'cafe',
 'Centrum, Warszawa', 52.2305, 21.0105, 4.3, 2,
 ARRAY['relaks', 'centrum', 'kawa'],
 'Przytulne miejsce w centrum Warszawy na kawę i odpoczynek od miejskiego zgiełku.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'dobro&dobro cafe', 'cafe',
 'Warszawa', 52.2285, 21.0175, 4.6, 2,
 ARRAY['cowork', 'specialty', 'wegańska'],
 'Kawiarnia z dobrą kawą specialty i przyjaznym podejściem do diety roślinnej.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Relaks', 'cafe',
 'Warszawa', 52.2320, 21.0120, 4.4, 1,
 ARRAY['sąsiedzka', 'relaks', 'przytulna'],
 'Małe, kameralne miejsce na kawę i chwilę oddechu od codziennego biegu.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'YOLO', 'cafe',
 'Warszawa', 52.2295, 21.0085, 4.4, 2,
 ARRAY['nowoczesna', 'brunch', 'kolorowa'],
 'Nowoczesna i kolorowa kawiarnia popularna wśród młodych warszawiaków – Instagram worthy.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'White Bear Coffee Warszawa Marszałkowska', 'cafe',
 'ul. Marszałkowska, Warszawa', 52.2284, 21.0085, 4.6, 2,
 ARRAY['specialty coffee', 'Marszałkowska', 'minimalistyczna'],
 'Minimalistyczna kawiarnia specialty przy Marszałkowskiej z doskonałą kawą i prostym, eleganckim wnętrzem.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Kawiarnia Waszyngton', 'cafe',
 'Warszawa', 52.2250, 21.0200, 4.5, 2,
 ARRAY['kawa', 'ciasta', 'Mokotów'],
 'Popularna kawiarnia na Mokotowie z szerokim wyborem ciast i napojów.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Kawiarnia Czytelnia', 'cafe',
 'Warszawa', 52.2340, 21.0140, 4.6, 2,
 ARRAY['bookstore cafe', 'czytanie', 'cisza'],
 'Kawiarnia połączona z czytelnią – idealne miejsce dla miłośników książek i dobrej kawy.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Forum', 'cafe',
 'Warszawa', 52.2310, 21.0200, 4.4, 2,
 ARRAY['kawa', 'centrum', 'klasyczna'],
 'Kawiarnia w centrum Warszawy z dobrą kawą i miłą atmosferą.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'U Krawca Cafe', 'cafe',
 'Warszawa', 52.2365, 21.0095, 4.6, 2,
 ARRAY['klimatyczna', 'vintage', 'kawa'],
 'Klimatyczna kawiarnia z charakterem – stare tkaniny, dobra kawa i domowe wypieki.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Cynamoonka', 'cafe',
 'Warszawa', 52.2255, 21.0155, 4.6, 2,
 ARRAY['cynamon', 'wypieki', 'przytulna'],
 'Urocza kawiarnia słynąca z cynamonowych bułek i przepysznych ciast domowej roboty.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Panattoni Café Bar', 'cafe',
 'Warszawa', 52.2295, 21.0030, 4.4, 2,
 ARRAY['biurowiec', 'centrum', 'kawa'],
 'Nowoczesna kawiarnia w centrum biznesowym Warszawy – idealna na przerwę w pracy.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Mariensztat Coffee', 'cafe',
 'Mariensztat, Warszawa', 52.2440, 21.0240, 4.6, 2,
 ARRAY['Mariensztat', 'specialty', 'ogródek'],
 'Kawiarnia specialty w historycznej dzielnicy Mariensztat z przyjemnym ogródkiem nad Wisłą.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Cafe Trakt', 'cafe',
 'ul. Krakowskie Przedmieście, Warszawa', 52.2430, 21.0145, 4.5, 2,
 ARRAY['Trakt Królewski', 'historyczna', 'centrum'],
 'Kawiarnia przy Trakcie Królewskim z widokiem na jedną z najpiękniejszych ulic Warszawy.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Kawiarnia Aroma Speciality Coffee', 'cafe',
 'Warszawa', 52.2270, 21.0120, 4.7, 2,
 ARRAY['specialty coffee', 'aroma', 'profesjonalna'],
 'Kawiarnia specialty z pasją do kawy – starannie wyselekcjonowane ziarna i fachowi bariści.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Śmietankowe Cafe Wola', 'cafe',
 'Wola, Warszawa', 52.2340, 20.9900, 4.5, 2,
 ARRAY['Wola', 'desery', 'sąsiedzka'],
 'Sympatyczna kawiarnia na Woli z pysznymi lodami, kremami i domowymi wypiekami.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Koza Cafe', 'cafe',
 'Warszawa', 52.2380, 21.0160, 4.6, 2,
 ARRAY['klimatyczna', 'koza', 'centrum'],
 'Kameralna kawiarnia z klimatycznym wnętrzem i znakomitą kawą specialty.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Cafe Filtry Dobra Kawa', 'cafe',
 'ul. Filtrowa, Warszawa', 52.2188, 21.0125, 4.6, 2,
 ARRAY['Filtry', 'Ochota', 'specialty coffee'],
 'Kawiarnia specialty przy Filtrach z doskonałą kawą filtrowaną i spokojną atmosferą.',
 ARRAY['morning', 'afternoon']),

-- ── PIEKARNIE ────────────────────────────────────────────────────────────────

('Warszawa', 'Piekarnia Aromat', 'cafe',
 'Warszawa', 52.2310, 21.0150, 4.6, 1,
 ARRAY['piekarnia', 'chleb', 'rzemieślnicza'],
 'Rzemieślnicza piekarnia z chlebem na zakwasie i świeżymi wypiekami każdego dnia.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Canela Bakery', 'cafe',
 'Warszawa', 52.2350, 21.0190, 4.7, 2,
 ARRAY['piekarnia', 'kanelbullar', 'skandynawska'],
 'Piekarnia z przepysznymi skandynawskimi wypiekami – słynne bułki cynamonowe i croissanty.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'eter — vegan bakery & speciality coffee', 'cafe',
 'Warszawa', 52.2290, 21.0060, 4.7, 2,
 ARRAY['wegańska', 'piekarnia', 'specialty coffee'],
 'Wegańska piekarnia rzemieślnicza z doskonałą kawą specialty – ciasta i chleby bez produktów odzwierzęcych.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Piekarnia DEJ', 'cafe',
 'Warszawa', 52.2380, 21.0050, 4.6, 1,
 ARRAY['piekarnia', 'zakwas', 'rzemieślnicza'],
 'Piekarnia z wypiekami na zakwasie, rogalami i sezonowymi specjałami.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'BAKERY BROWARY WARSZAWSKIE', 'cafe',
 'Browary Warszawskie, Wola, Warszawa', 52.2289, 20.9851, 4.6, 2,
 ARRAY['Browary', 'Wola', 'piekarnia'],
 'Nowoczesna piekarnia w kompleksie Browary Warszawskie z świeżymi wypiekami i kawą.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Pracownia L''Artisan Boulanger', 'cafe',
 'Warszawa', 52.2360, 21.0120, 4.7, 2,
 ARRAY['francuska', 'baguette', 'artisan'],
 'Francuska pracownia pieczywa z autentycznymi bagietkami, croissantami i brioszkamii.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Piekarnia Rzemieślnicza | Manufaktura Wypieków', 'cafe',
 'Warszawa', 52.2320, 21.0080, 4.6, 2,
 ARRAY['rzemieślnicza', 'zakwas', 'manufaktura'],
 'Rzemieślnicza piekarnia z bogatą ofertą chlebów na zakwasie i słodkich wypieków.',
 ARRAY['morning', 'afternoon']),

-- ── CUKIERNIE ────────────────────────────────────────────────────────────────

('Warszawa', 'La Bomboniera', 'cafe',
 'Warszawa', 52.2340, 21.0160, 4.6, 2,
 ARRAY['czekoladki', 'cukiernia', 'elegancka'],
 'Elegancka cukiernia z ręcznie robionymi czekoladkami, pralinami i wyśmienitymi deserami.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Cheesecake Corner', 'cafe',
 'Warszawa', 52.2300, 21.0170, 4.7, 2,
 ARRAY['cheesecake', 'ciasta', 'sernik'],
 'Kawiarnia specjalizująca się w cheesecake''ach w dziesiątkach smaków – raj dla miłośników serników.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'A.Blikle', 'cafe',
 'ul. Nowy Świat 35, Warszawa', 52.2334, 21.0181, 4.6, 2,
 ARRAY['legenda', 'pączki', 'tradycja'],
 'Legendarna cukiernia Blikle na Nowym Świecie – kultowe pączki z różą, czynna od 1869 roku.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Cukiernia Kawiarnia DESEO Browary Warszawskie', 'cafe',
 'Browary Warszawskie, Wola, Warszawa', 52.2285, 20.9848, 4.7, 2,
 ARRAY['Browary', 'desery', 'nowoczesna'],
 'Nowoczesna cukiernia i kawiarnia w kompleksie Browary z wyjątkowymi tortami i deserami.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Słodki Karmel - Różowa Kawiarnia & Cukiernia', 'cafe',
 'Warszawa', 52.2260, 21.0230, 4.6, 2,
 ARRAY['różowa', 'karmel', 'Instagram'],
 'Różowa kawiarnia Instagram-worthy z deserami karamelowymi i wyjątkowo instagramowalnym wnętrzem.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Migdałowa - Pracownia Wypieków', 'cafe',
 'Warszawa', 52.2330, 21.0050, 4.7, 2,
 ARRAY['migdały', 'wypieki', 'rzemieślnicza'],
 'Pracownia wypieków z migdałami i orzechami – tarty, ciastka i torty na wyjątkowe okazje.',
 ARRAY['afternoon']),

('Warszawa', 'Macarons Store', 'cafe',
 'Warszawa', 52.2310, 21.0130, 4.5, 2,
 ARRAY['macarons', 'francuska', 'kolorowe'],
 'Specjalistyczny sklep z makaronikami w dziesiątkach smaków i kolorów.',
 ARRAY['afternoon']),

('Warszawa', '5 ciastek', 'cafe',
 'Warszawa', 52.2380, 21.0200, 4.6, 2,
 ARRAY['ciasta', 'domowe', 'przytulna'],
 'Małe miejsce z pięcioma wyjątkowymi ciastkami dnia – prosta filozofia, wyśmienity smak.',
 ARRAY['afternoon']),

('Warszawa', 'Pracownia Zagożdźński', 'cafe',
 'Warszawa', 52.2290, 21.0085, 4.6, 2,
 ARRAY['tradycja', 'torty', 'cukiernictwo'],
 'Renomowana pracownia cukiernicza z tradycją – torty, ciasta i wypieki na zamówienie.',
 ARRAY['afternoon']),

('Warszawa', 'Sucré', 'cafe',
 'Warszawa', 52.2370, 21.0155, 4.6, 2,
 ARRAY['lodziarnia', 'lody rzemieślnicze', 'desery'],
 'Rzemieślnicza lodziarnia z lodami z naturalnych składników w wyjątkowych smakach.',
 ARRAY['afternoon', 'evening']),

-- ── RESTAURACJE ──────────────────────────────────────────────────────────────

('Warszawa', 'Bułkę przez Bibuułkę', 'restaurant',
 'ul. Zgoda, Warszawa', 52.2355, 21.0148, 4.6, 2,
 ARRAY['śniadania', 'kanapki', 'brunch'],
 'Kultowe miejsce na śniadanie i brunch – znane z kanapek na świeżo pieczonych bułkach.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Ave Pegaz', 'restaurant',
 'Warszawa', 52.2450, 21.0175, 4.5, 3,
 ARRAY['polska kuchnia', 'klimatyczna', 'Stare Miasto'],
 'Restauracja z polską kuchnią w historycznym centrum Warszawy – tradycja i smak.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Bottegas - Pizza neapolitańska', 'restaurant',
 'Śródmieście, Warszawa', 52.2285, 21.0190, 4.7, 2,
 ARRAY['pizza', 'neapolitańska', 'włoska'],
 'Autentyczna pizza neapolitańska pieczona w piecu opałowym – jedna z najlepszych pizz w Warszawie.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Browar Warszawski Restauracja Grill', 'restaurant',
 'Browary Warszawskie, Wola, Warszawa', 52.2289, 20.9855, 4.6, 3,
 ARRAY['browar', 'grill', 'Browary'],
 'Restauracja przy Browarach Warszawskich z grillem, piwem własnej produkcji i industrialnym klimatem.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Azia Restaurants - Centrum Praskie Koneser', 'restaurant',
 'Centrum Praskie Koneser, Praga, Warszawa', 52.2514, 21.0478, 4.6, 3,
 ARRAY['azjatycka', 'Koneser', 'Praga'],
 'Restauracja azjatycka w klimatycznym Koneserze na Pradze – sushi, ramen i kuchnia fusion.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Stary Dom', 'restaurant',
 'Warszawa', 52.2475, 21.0138, 4.5, 3,
 ARRAY['polska', 'tradycyjna', 'Stare Miasto'],
 'Restauracja z tradycyjną polską kuchnią w historycznych wnętrzach Starego Miasta.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Gospoda Kwiaty Polskie', 'restaurant',
 'Stare Miasto, Warszawa', 52.2489, 21.0121, 4.5, 3,
 ARRAY['polska', 'Stare Miasto', 'gospoda'],
 'Klimatyczna gospoda na Starym Mieście z polską kuchnią regionalną i tradycyjnymi przepisami.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Beef and Pepper Steak house', 'restaurant',
 'Warszawa', 52.2310, 21.0095, 4.6, 3,
 ARRAY['steki', 'mięso', 'steakhouse'],
 'Klasyczny steakhouse z doskonałymi stekami, szerokimi przekrojami wołowiny i sosem pieprzowym.',
 ARRAY['evening']),

('Warszawa', 'San Thai Restaurant', 'restaurant',
 'Warszawa', 52.2295, 21.0165, 4.6, 2,
 ARRAY['tajska', 'pad thai', 'azjatycka'],
 'Autentyczna restauracja tajska z klasycznymi daniami kuchni tajskiej przyrządzanymi według oryginalnych receptur.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Restauracja U Wieniawy', 'restaurant',
 'Warszawa', 52.2265, 21.0150, 4.5, 3,
 ARRAY['polska', 'klasyczna', 'tradycja'],
 'Restauracja z polską kuchnią klasyczną w ciepłej, domowej atmosferze.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Specjały Regionalne - restauracja polska Stare Miasto', 'restaurant',
 'Stare Miasto, Warszawa', 52.2489, 21.0115, 4.5, 2,
 ARRAY['polska', 'regionalna', 'Stare Miasto'],
 'Restauracja z regionalną kuchnią polską – pierogi, żurek, bigos i inne polskie specjały.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Stara Kamienica', 'restaurant',
 'Stare Miasto, Warszawa', 52.2480, 21.0120, 4.5, 3,
 ARRAY['Stare Miasto', 'polska', 'kamienica'],
 'Restauracja w zabytkowej kamienicy z polską kuchnią i klimatycznym wnętrzem.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Żebra i Kości', 'restaurant',
 'Warszawa', 52.2280, 21.0120, 4.6, 2,
 ARRAY['BBQ', 'żeberka', 'mięsna'],
 'Restauracja specjalizująca się w żeberkach i kościach – slow food, intensywne smaki.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'STOLICA', 'restaurant',
 'Warszawa', 52.2324, 21.0068, 4.5, 3,
 ARRAY['polska', 'nowoczesna', 'design'],
 'Nowoczesna restauracja z polską kuchnią fine dining w eleganckim otoczeniu.',
 ARRAY['evening']),

('Warszawa', 'Restauracja Primitivo Kuchnia i Wino', 'restaurant',
 'Warszawa', 52.2305, 21.0195, 4.7, 3,
 ARRAY['śródziemnomorska', 'wino', 'fine dining'],
 'Elegancka restauracja śródziemnomorska z doskonałą listą win i wyjątkowymi daniami.',
 ARRAY['evening']),

('Warszawa', 'Sushi Kado - Restauracja Sushi Warszawa Wola', 'restaurant',
 'Wola, Warszawa', 52.2330, 20.9890, 4.6, 2,
 ARRAY['sushi', 'japońska', 'Wola'],
 'Restauracja sushi na Woli z świeżymi rybami i autentycznymi przepisami japońskiej kuchni.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Nova Wola - Restauracja z kuchnią polską', 'restaurant',
 'Wola, Warszawa', 52.2345, 20.9880, 4.5, 2,
 ARRAY['polska', 'Wola', 'nowoczesna'],
 'Restauracja z nowoczesnym podejściem do polskiej kuchni na dynamicznie rozwijającej się Woli.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Restauracja Future & Wine', 'restaurant',
 'Warszawa', 52.2295, 21.0150, 4.6, 3,
 ARRAY['wino', 'nowoczesna', 'fine dining'],
 'Restauracja łącząca nowoczesne gotowanie z wyjątkową selekcją win naturalnych.',
 ARRAY['evening']),

('Warszawa', 'Podwale 25 Kompania Piwna', 'restaurant',
 'ul. Podwale 25, Warszawa', 52.2460, 21.0161, 4.5, 2,
 ARRAY['piwo', 'Stare Miasto', 'tradycja'],
 'Kultowa restauracja-piwiarnia przy murach Starego Miasta z polską kuchnią i piwem regionalnym.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Restauracja Szynk Praski', 'restaurant',
 'Praga, Warszawa', 52.2505, 21.0470, 4.5, 2,
 ARRAY['Praga', 'polska', 'szynk'],
 'Klimatyczna restauracja na Pradze serwująca tradycyjną polską kuchnię z regionalnym charakterem.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Seagull - Brunch & Speciality Coffee', 'restaurant',
 'Warszawa', 52.2360, 21.0220, 4.7, 2,
 ARRAY['brunch', 'specialty coffee', 'Powiśle'],
 'Popularny brunch spot na Powiślu z doskonałą kawą specialty i wyjątkowymi śniadaniami.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Bishop Cafe | Coffee, Breakfast & Wine', 'restaurant',
 'Warszawa', 52.2285, 21.0095, 4.6, 2,
 ARRAY['śniadania', 'wino', 'brunch'],
 'Kawiarnia i restauracja łącząca doskonałe śniadania z wieczorną kartą win.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'the morning after (the night before)', 'restaurant',
 'Warszawa', 52.2300, 21.0185, 4.6, 2,
 ARRAY['brunch', 'hangover food', 'klimatyczna'],
 'Restauracja brunchowa z poczuciem humoru – idealna na śniadanie po długiej nocy w mieście.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Restauracja Podniebna', 'restaurant',
 'Warszawa', 52.2295, 21.0175, 4.5, 3,
 ARRAY['polska', 'klasyczna', 'przytulna'],
 'Restauracja z polską kuchnią i przytulną atmosferą – miejsce dla smakoszy tradycji.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Manekin', 'restaurant',
 'Warszawa', 52.2340, 21.0155, 4.5, 1,
 ARRAY['naleśniki', 'studencka', 'tanie'],
 'Kultowa sieć naleśnikarni z niesamowitą ofertą naleśników słodkich i wytrawnych – ceny przystępne.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Pyzy, Flaki Gorące!', 'restaurant',
 'Praga, Warszawa', 52.2508, 21.0455, 4.7, 1,
 ARRAY['pyzy', 'flaki', 'uliczne jedzenie'],
 'Kultowe miejsce na Pradze – pyzy z mięsem i flaczki według oryginalnych warszawskich receptur.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Whiskey in the Jar', 'restaurant',
 'Warszawa', 52.2490, 21.0145, 4.5, 2,
 ARRAY['whiskey', 'irlandzki', 'pub'],
 'Irlandzki pub w centrum Warszawy z szerokim wyborem whiskey i klasycznym jedzeniem pubowym.',
 ARRAY['evening']),

('Warszawa', 'Soul Kitchen', 'restaurant',
 'Warszawa', 52.2295, 21.0165, 4.6, 2,
 ARRAY['soul food', 'nowoczesna', 'klimatyczna'],
 'Restauracja z soul foodem i nowoczesnym twistem – komfortowe jedzenie z duszą.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Casa di Tuzza Pizza Napoletana', 'restaurant',
 'Warszawa', 52.2450, 21.0180, 4.7, 2,
 ARRAY['pizza', 'neapolitańska', 'Stare Miasto'],
 'Autentyczna neapolitańska pizza w pobliżu Starego Miasta – ciasto na zakwasie, produkty z Neapolu.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Restauracja VIVA TANGO Steakhouse Argentino', 'restaurant',
 'Warszawa', 52.2260, 21.0130, 4.6, 3,
 ARRAY['argentyński', 'steki', 'tango'],
 'Argentyński steakhouse z doskonałym mięsem z pampy i taneczną atmosferą Buenos Aires.',
 ARRAY['evening']),

('Warszawa', 'Restauracja U Barssa', 'restaurant',
 'Warszawa', 52.2475, 21.0128, 4.5, 3,
 ARRAY['polska', 'Stare Miasto', 'ryby'],
 'Restauracja przy Starym Mieście z polską kuchnią i doskonałymi rybami.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Prodiż Warszawski', 'restaurant',
 'Warszawa', 52.2485, 21.0132, 4.6, 2,
 ARRAY['polska', 'prodiż', 'tradycja'],
 'Restauracja serwująca potrawy z prodiża – tradycyjna kuchnia warszawska.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'HOŻА Steakhouse', 'restaurant',
 'ul. Hoża, Warszawa', 52.2262, 21.0180, 4.6, 3,
 ARRAY['steakhouse', 'Hoża', 'steki'],
 'Elegancki steakhouse przy ul. Hożej z premium wołowiną i bogatą kartą win.',
 ARRAY['evening']),

('Warszawa', 'Amar Beirut', 'restaurant',
 'Warszawa', 52.2340, 21.0095, 4.7, 2,
 ARRAY['libańska', 'mezze', 'Bliski Wschód'],
 'Autentyczna restauracja libańska z mezze, hummusem i tradycyjnymi potrawami Bliskiego Wschodu.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Zachcianek - Stare Miasto', 'restaurant',
 'Stare Miasto, Warszawa', 52.2492, 21.0113, 4.5, 2,
 ARRAY['polska', 'pierogi', 'Stare Miasto'],
 'Restauracja przy Starym Mieście z polską kuchnią domową – pierogi, barszcz i inne klasyki.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Restauracja Polska Czerwony Wieprz', 'restaurant',
 'Praga, Warszawa', 52.2520, 21.0460, 4.6, 2,
 ARRAY['polska', 'Praga', 'PRL nostalgic'],
 'Restauracja z polską kuchnią w stylu PRL-owskim na klimatycznej Pradze.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Café Mozaika', 'restaurant',
 'Warszawa', 52.2310, 21.0170, 4.5, 2,
 ARRAY['kawiarnia', 'restauracja', 'mozaika'],
 'Kawiarnia i restauracja z różnorodnym menu łączącym polskie i śródziemnomorskie smaki.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Munja Browary Warszawskie', 'restaurant',
 'Browary Warszawskie, Wola, Warszawa', 52.2290, 20.9854, 4.6, 2,
 ARRAY['Browary', 'bałkańska', 'Wola'],
 'Restauracja bałkańska w kompleksie Browary Warszawskie – cevapi, burek i śródziemnomorskie smaki.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Restauracja Kamienne Schodki', 'restaurant',
 'ul. Kamienne Schodki, Stare Miasto, Warszawa', 52.2489, 21.0118, 4.5, 3,
 ARRAY['Stare Miasto', 'polska', 'historyczna'],
 'Restauracja przy jednej z najstarszych ulic Starego Miasta z polską kuchnią w zabytkowych wnętrzach.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Hard Rock Cafe', 'restaurant',
 'ul. Złota, Warszawa', 52.2298, 21.0026, 4.5, 3,
 ARRAY['Hard Rock', 'burgery', 'muzyka'],
 'Kultowa sieć Hard Rock Cafe z burgerami, pamiątkami rockowych legend i głośną muzyką.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Burgerlab', 'restaurant',
 'Warszawa', 52.2301, 21.0140, 4.6, 2,
 ARRAY['burgery', 'rzemieślnicze', 'nowoczesne'],
 'Rzemieślnicze burgery z wysokiej jakości mięsem i autorskimi sosami – burger bar z pasją.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Le Cedre Praga - Lebanese Restaurant', 'restaurant',
 'Praga, Warszawa', 52.2510, 21.0488, 4.6, 2,
 ARRAY['libańska', 'Praga', 'hummus'],
 'Libańska restauracja na Pradze z autentycznym hummusem, falafelami i świeżymi mezze.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'U Fukiera', 'restaurant',
 'Rynek Starego Miasta 27, Warszawa', 52.2489, 21.0113, 4.6, 4,
 ARRAY['fine dining', 'polska', 'Stare Miasto'],
 'Jedna z najstarszych i najbardziej prestiżowych restauracji w Warszawie przy Rynku Starego Miasta.',
 ARRAY['evening']),

('Warszawa', 'Karmnik Restauracja & Cocktail Bar - Stare Miasto', 'restaurant',
 'Stare Miasto, Warszawa', 52.2484, 21.0126, 4.6, 3,
 ARRAY['Stare Miasto', 'koktajle', 'restauracja'],
 'Restauracja i cocktail bar przy Starym Mieście – nowoczesna polska kuchnia i autorskie drinki.',
 ARRAY['afternoon', 'evening']),

-- ── FOODHALLE ────────────────────────────────────────────────────────────────

('Warszawa', 'Hala Koszyki', 'market',
 'ul. Koszykowa 63, Warszawa', 52.2253, 21.0172, 4.6, 2,
 ARRAY['foodhall', 'Śródmieście', 'zabytkowa'],
 'Zabytkowa hala targowa z lat 1908-1909 zamieniona w nowoczesny foodhall z restauracjami i barami.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Browary Warszawskie', 'market',
 'ul. Grzybowska 62, Wola, Warszawa', 52.2289, 20.9851, 4.6, 2,
 ARRAY['Wola', 'foodhall', 'browar'],
 'Kompleks rewitalizacyjny na Woli z restauracjami, barami, sklepami i Muzeum Polskiej Wódki.',
 ARRAY['afternoon', 'evening']),

-- ── BARY ─────────────────────────────────────────────────────────────────────

('Warszawa', 'Biały Nalew', 'bar',
 'Warszawa', 52.2280, 20.9930, 4.6, 1,
 ARRAY['kraftowe piwo', 'lokalne', 'Wola'],
 'Bar z kraftowym piwem w przystępnych cenach – ulubione miejsce miłośników lokalnego browaru.',
 ARRAY['evening']),

('Warszawa', 'H.4.0.S', 'bar',
 'Warszawa', 52.2315, 21.0160, 4.5, 2,
 ARRAY['koktajle', 'hipsterski', 'centrum'],
 'Klimatyczny bar z autorskimi koktajlami w industrialnym wnętrzu – miejsce dla wtajemniczonych.',
 ARRAY['evening']),

('Warszawa', 'Same Krafty - Multitap', 'bar',
 'Warszawa', 52.2260, 21.0165, 4.6, 2,
 ARRAY['kraft beer', 'multitap', 'piwo'],
 'Multitap z kilkudziesięcioma kranami z polskim i zagranicznym piwem kraftowym.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'JABEERWOCKY Craft Beer Pub & Pizza', 'bar',
 'Warszawa', 52.2475, 21.0122, 4.7, 2,
 ARRAY['craft beer', 'pizza', 'Stare Miasto'],
 'Craft beer pub przy Starym Mieście z pizza napoletańską i imponującą selekcją kraftowego piwa.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Pijana Wiśnia', 'bar',
 'Warszawa', 52.2482, 21.0130, 4.6, 1,
 ARRAY['wino wiśniowe', 'Stare Miasto', 'tanie'],
 'Bar przy Starym Mieście słynący z wyjątkowego wina wiśniowego podawanego z czekoladką.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'W Oparach Absurdu', 'bar',
 'Warszawa', 52.2499, 21.0125, 4.7, 2,
 ARRAY['Stare Miasto', 'koktajle', 'kultowy'],
 'Kultowy bar koktajlowy przy Starym Mieście z unikatową atmosferą i kreatywnymi drinkami.',
 ARRAY['evening']),

('Warszawa', 'Kraken Rum Bar', 'bar',
 'Warszawa', 52.2492, 21.0118, 4.5, 2,
 ARRAY['rum', 'Stare Miasto', 'tropikalny'],
 'Bar z rum bar z bogatą selekcją rumów z całego świata przy Starym Mieście.',
 ARRAY['evening']),

('Warszawa', 'WarSaw Pub', 'bar',
 'Warszawa', 52.2330, 21.0200, 4.4, 2,
 ARRAY['pub', 'centrum', 'sport'],
 'Pub w centrum Warszawy z szerokim wyborem piwa i transmisją wydarzeń sportowych.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'British Bulldog Pub', 'bar',
 'Warszawa', 52.2348, 21.0155, 4.4, 2,
 ARRAY['angielski pub', 'piwo', 'sport'],
 'Klasyczny angielski pub z piwem beczkowym i sportami transmitowanymi na żywo.',
 ARRAY['afternoon', 'evening']),

-- ── KLUBY ────────────────────────────────────────────────────────────────────

('Warszawa', 'level 27 Warsaw - Rooftop', 'club',
 'Renaissance Warsaw Airport Hotel, Warszawa', 52.1640, 20.9633, 4.5, 3,
 ARRAY['rooftop', 'widok', 'klub'],
 'Klub na 27. piętrze z panoramicznym widokiem na Warszawę – koktajle i muzyka pod gwiazdami.',
 ARRAY['evening']),

-- ── MUZEA ────────────────────────────────────────────────────────────────────

('Warszawa', 'POLIN Muzeum Historii Żydów Polskich', 'museum',
 'ul. Mordechaja Anielewicza 6, Warszawa', 52.2499, 20.9946, 4.8, 2,
 ARRAY['historia', 'Żydzi', 'Muranów'],
 'Światowej klasy muzeum opowiadające tysiącletnią historię Żydów polskich. Nominowane do nagrody European Museum of the Year.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Muzeum Powstania Warszawskiego', 'museum',
 'ul. Grzybowska 79, Warszawa', 52.2321, 20.9843, 4.8, 1,
 ARRAY['Powstanie', 'historia', 'patriotyzm'],
 'Jedno z najważniejszych muzeów w Polsce poświęcone Powstaniu Warszawskiemu 1944 – poruszające i multimedialne.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Muzeum Pałacu Króla Jana III w Wilanowie', 'museum',
 'ul. St. Kostki Potockiego 10/16, Wilanów, Warszawa', 52.1647, 21.0888, 4.7, 2,
 ARRAY['Wilanów', 'barok', 'pałac'],
 'Rezydencja Króla Jana III Sobieskiego – perła baroku w pięknym parku na obrzeżach Warszawy.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Muzeum Polskiej Wódki', 'museum',
 'Browary Warszawskie, ul. Jana Kazimierza 3, Warszawa', 52.2289, 20.9850, 4.5, 3,
 ARRAY['wódka', 'Browary', 'degustacja'],
 'Interaktywne muzeum historii polskiej wódki z degustacją – wyjątkowe doświadczenie dla dorosłych.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Muzeum Narodowe w Warszawie', 'museum',
 'Al. Jerozolimskie 3, Warszawa', 52.2285, 21.0264, 4.6, 2,
 ARRAY['sztuka', 'kolekcja', 'malarstwo'],
 'Największe muzeum sztuki w Polsce z kolekcją liczącą ponad 800 000 obiektów – od starożytności po współczesność.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Muzeum Świat Iluzji', 'museum',
 'Warszawa', 52.2297, 21.0100, 4.5, 2,
 ARRAY['iluzje', 'optyczne', 'interaktywne'],
 'Interaktywne muzeum iluzji optycznych – idealne na zabawną sesję zdjęciową z niespodziankami.',
 ARRAY['afternoon']),

('Warszawa', 'Muzeum Życia w PRL', 'museum',
 'ul. Ząbkowska, Praga, Warszawa', 52.2520, 21.0470, 4.5, 1,
 ARRAY['PRL', 'Praga', 'nostalgia'],
 'Muzeum codziennego życia w czasach PRL na klimatycznej Pradze – powrót do przeszłości.',
 ARRAY['afternoon']),

('Warszawa', 'Centrum Pieniądza NBP', 'museum',
 'ul. Świętokrzyska 11/21, Warszawa', 52.2311, 20.9914, 4.6, 1,
 ARRAY['pieniądze', 'NBP', 'finanse'],
 'Interaktywne muzeum historii pieniądza i bankowości prowadzone przez Narodowy Bank Polski.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Muzeum Wojska Polskiego w Warszawie', 'museum',
 'Al. Jerozolimskie 3, Warszawa', 52.2231, 21.0361, 4.5, 1,
 ARRAY['wojsko', 'historia', 'broń'],
 'Muzeum historii wojska polskiego z bogatą kolekcją broni, mundurów i eksponatów militarnych.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Warszawskie Muzeum Komputerów i Gier', 'museum',
 'Warszawa', 52.2660, 20.9840, 4.6, 2,
 ARRAY['komputery', 'gry', 'retro'],
 'Muzeum historii komputerów i gier wideo – kolekcja retro sprzętu i możliwość grania w stare tytuły.',
 ARRAY['afternoon']),

('Warszawa', 'Muzeum Sztuki Nowoczesnej w Warszawie', 'museum',
 'Plac Defilad 1, Warszawa', 52.2351, 21.0072, 4.6, 1,
 ARRAY['sztuka nowoczesna', 'PKiN', 'współczesna'],
 'Muzeum sztuki nowoczesnej i współczesnej – przekrojowa kolekcja i ważne wystawy czasowe.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Muzeum Warszawy', 'museum',
 'Rynek Starego Miasta 28-42, Warszawa', 52.2497, 21.0117, 4.6, 2,
 ARRAY['Stare Miasto', 'historia Warszawy', 'rynek'],
 'Muzeum w kamienicach przy Rynku Starego Miasta opowiadające historię Warszawy na przestrzeni wieków.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'melt museum', 'museum',
 'Praga, Warszawa', 52.2550, 21.0450, 4.5, 2,
 ARRAY['neonowe', 'fotogeniczne', 'Praga'],
 'Kolorowe i fotogeniczne muzeum z instalacjami neonowymi – idealne na instagramowe zdjęcia.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Stacja Muzeum', 'museum',
 'ul. Towarowa 3, Warszawa', 52.2264, 20.9807, 4.6, 2,
 ARRAY['kolej', 'lokomotywy', 'historia'],
 'Muzeum kolejnictwa z zabytkowym taborem – lokomotywy parowe, wagony i historia polskich kolei.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Zachęta – Narodowa Galeria Sztuki', 'museum',
 'Plac Małachowskiego 3, Warszawa', 52.2385, 21.0112, 4.6, 1,
 ARRAY['galeria sztuki', 'współczesna', 'centrum'],
 'Prestiżowa galeria sztuki współczesnej w zabytkowym budynku przy Placu Małachowskiego.',
 ARRAY['morning', 'afternoon']),

-- ── PARKI ────────────────────────────────────────────────────────────────────

('Warszawa', 'Łazienki Królewskie', 'park',
 'ul. Agrykoli 1, Warszawa', 52.2137, 21.0361, 4.8, 1,
 ARRAY['park', 'Pałac na Wyspie', 'pawie'],
 'Najpiękniejszy park w Warszawie z Pałacem na Wyspie, romantycznymi ogrodami i słynnymi pawiami.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Ogród Saski', 'park',
 'ul. Marszałkowska/Królewska, Warszawa', 52.2418, 21.0093, 4.7, 1,
 ARRAY['zabytkowy', 'fontanna', 'centrum'],
 'Najstarszy ogród publiczny w Polsce z Grobem Nieznanego Żołnierza i fontanną – serce Warszawy.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Multimedialny Park Fontann', 'park',
 'ul. Wybrzeże Kościuszkowskie, Warszawa', 52.2420, 21.0282, 4.7, 1,
 ARRAY['fontanny', 'światło', 'spektakl'],
 'Park fontann z spektakularnymi pokazami wodnymi z muzyką i świetlami – hit każdego lata.',
 ARRAY['evening']),

('Warszawa', 'Park Skaryszewski im. I.J. Paderewskiego', 'park',
 'al. Zielieniecka, Praga Południe, Warszawa', 52.2390, 21.0576, 4.7, 1,
 ARRAY['Praga', 'jezioro', 'spacer'],
 'Piękny park z jeziorem na Pradze Południe – idealne miejsce na spacer, jogging lub piknik.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Ogród Botaniczny Uniwersytetu Warszawskiego', 'park',
 'Al. Ujazdowskie 4, Warszawa', 52.2228, 21.0319, 4.7, 1,
 ARRAY['rośliny', 'nauka', 'ogród'],
 'Zabytkowy ogród botaniczny UW z palmarnią i kolekcją roślin z całego świata.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Park Ujazdowski', 'park',
 'ul. Agrykoli/Ujazdowskie, Warszawa', 52.2190, 21.0263, 4.7, 1,
 ARRAY['ujazdowski', 'Zamek Ujazdowski', 'spacer'],
 'Zielony park przy Zamku Ujazdowskim z fontanną, alejkami i widokiem na CSW.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Wilanów Park', 'park',
 'ul. St. Kostki Potockiego, Wilanów, Warszawa', 52.1647, 21.0889, 4.7, 1,
 ARRAY['Wilanów', 'pałac', 'barokowy'],
 'Barokowy park przy Pałacu Wilanowskim z geometrycznymi ogrodami, rzeźbami i stawem.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Pole Mokotowskie', 'park',
 'ul. Pole Mokotowskie, Mokotów, Warszawa', 52.2101, 21.0071, 4.7, 1,
 ARRAY['Mokotów', 'piknik', 'sport'],
 'Rozległy park na Mokotowie – idealne miejsce na piknik, jogging i aktywny wypoczynek.',
 ARRAY['morning', 'afternoon']),

-- ── ZAKUPY ───────────────────────────────────────────────────────────────────

('Warszawa', 'Złote Tarasy', 'shopping',
 'ul. Złota 59, Warszawa', 52.2284, 21.0034, 4.5, 2,
 ARRAY['galeria', 'centrum', 'szklany dach'],
 'Nowoczesna galeria handlowa w centrum Warszawy ze spektakularnym szklanym dachem przy Dworcu Centralnym.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Elektrownia Powiśle', 'shopping',
 'ul. Dobra 42, Powiśle, Warszawa', 52.2378, 21.0308, 4.7, 3,
 ARRAY['Powiśle', 'rewitalizacja', 'butiki'],
 'Zrewitalizowana elektrownia na Powiślu z butikowym handlem, restauracjami i kawiarniami.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Fabryka Norblina', 'shopping',
 'ul. Żelazna 51/53, Wola, Warszawa', 52.2290, 20.9862, 4.6, 2,
 ARRAY['Wola', 'rewitalizacja', 'foodhall'],
 'Kompleks rewitalizacyjny w dawnej fabryce Norblina z restauarcjami, sklepami i biurami.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Hala Mirowska', 'shopping',
 'Plac Mirowski, Warszawa', 52.2394, 20.9954, 4.5, 1,
 ARRAY['targ', 'warzywa', 'tradycja'],
 'Zabytkowa hala targowa z 1901 roku – świeże warzywa, owoce i lokalne produkty.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Westfield Mokotów', 'shopping',
 'ul. Wołoska 12, Mokotów, Warszawa', 52.1979, 21.0127, 4.4, 2,
 ARRAY['Mokotów', 'galeria', 'sieciówki'],
 'Duże centrum handlowe na Mokotowie z szeroką ofertą sklepów, restauracji i kina.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Giełda staroci na Kole', 'shopping',
 'ul. Obozowa, Koło, Warszawa', 52.2524, 20.9653, 4.6, 1,
 ARRAY['staroci', 'antyki', 'pchli targ'],
 'Największy pchli targ w Warszawie – antyki, staroci, meble PRL i niespodzianki każdej niedzieli.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Sklep firmowy Zakłady Ceramiczne BOLESŁAWIEC', 'shopping',
 'Warszawa', 52.2310, 21.0290, 4.7, 2,
 ARRAY['ceramika', 'Bolesławiec', 'rękodzieło'],
 'Oficjalny sklep ceramiki z Bolesławca – oryginalna polska ceramika w charakterystyczne wzory.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Look Inside - starocie i antyki', 'shopping',
 'Warszawa', 52.2390, 21.0150, 4.6, 2,
 ARRAY['antyki', 'starocie', 'vintage'],
 'Sklep z antykami i starsociami – unikalne przedmioty z PRL, meble vintage i stare druki.',
 ARRAY['morning', 'afternoon']),

-- ── LANDMARKI / ZABYTKI ──────────────────────────────────────────────────────

('Warszawa', 'Pałac Kultury i Nauki', 'monument',
 'Plac Defilad 1, Warszawa', 52.2318, 21.0059, 4.7, 1,
 ARRAY['PKiN', 'ikona', 'widok'],
 'Największy i najbardziej rozpoznawalny budynek Warszawy – staliniowski dar z 1955 roku, najwyższy budynek w Polsce.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Zamek Królewski w Warszawie', 'monument',
 'Plac Zamkowy 4, Warszawa', 52.2478, 21.0143, 4.8, 2,
 ARRAY['zamek', 'Stare Miasto', 'historia'],
 'Siedziba królów polskich odbudowana po II wojnie światowej – symbol odrodzenia Warszawy i polskiej tożsamości.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Biblioteka Uniwersytecka w Warszawie', 'monument',
 'ul. Dobra 56/66, Powiśle, Warszawa', 52.2379, 21.0220, 4.7, 1,
 ARRAY['BUW', 'ogród na dachu', 'architektura'],
 'Nowoczesna biblioteka z ogrodami na dachu i wiszącym mostem – architektoniczna ikona Powiśla.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Pomnik Powstania Warszawskiego', 'monument',
 'ul. Długa 26/28, Warszawa', 52.2461, 21.0012, 4.8, 1,
 ARRAY['pomnik', 'Powstanie', 'patriotyzm'],
 'Monumentalny pomnik ku czci uczestników Powstania Warszawskiego – niezwykle poruszające dzieło.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Pałac na Wyspie', 'monument',
 'Łazienki Królewskie, Warszawa', 52.2145, 21.0349, 4.8, 1,
 ARRAY['Łazienki', 'klasycyzm', 'wyspa'],
 'Najpiękniejszy pałac w Polsce otoczony wodą – arcydzieło klasycyzmu w Łazienkach Królewskich.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Kościół Akademicki św. Anny', 'monument',
 'Krakowskie Przedmieście 68, Warszawa', 52.2450, 21.0148, 4.7, 1,
 ARRAY['kościół', 'Trakt Królewski', 'taras widokowy'],
 'Barokowy kościół przy początku Traktu Królewskiego z tarasem widokowym na dzwonnicy.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Grób Nieznanego Żołnierza', 'monument',
 'Plac Marszałka Józefa Piłsudskiego, Warszawa', 52.2418, 21.0093, 4.8, 1,
 ARRAY['pomnik', 'grób', 'patriotyzm'],
 'Grób Nieznanego Żołnierza w arkadach Pałacu Saskiego – miejsce pamięci narodowej z wartą honorową.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Pomnik Bohaterów Warszawskiego Getta', 'monument',
 'ul. Anielewicza 6, Muranów, Warszawa', 52.2499, 20.9940, 4.8, 1,
 ARRAY['Getto', 'historia', 'POLIN'],
 'Przejmujący pomnik upamiętniający bohaterów Powstania w Getcie Warszawskim z 1943 roku.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Fotoplastikon Warszawski', 'monument',
 'Al. Jerozolimskie 51, Warszawa', 52.2338, 21.0196, 4.6, 1,
 ARRAY['unikat', 'stereofoton', 'XIX wiek'],
 'Jedyny działający fotoplastikon w Polsce – pokaz zdjęć trójwymiarowych z XIX i XX wieku.',
 ARRAY['afternoon']),

('Warszawa', 'Bazylika Katedralna św. Michała Archanioła i św. Floriana', 'monument',
 'ul. Floriańska 3, Praga, Warszawa', 52.2551, 21.0440, 4.7, 1,
 ARRAY['katedra', 'Praga', 'neogotyk'],
 'Neogotycka bazylika na Pradze – kościół ocalały z Powstania Warszawskiego, symbol praskiej dzielnicy.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Pałac Prezydencki w Warszawie', 'monument',
 'Krakowskie Przedmieście 46/48, Warszawa', 52.2415, 21.0140, 4.6, 1,
 ARRAY['prezydent', 'Trakt Królewski', 'klasycyzm'],
 'Siedziba Prezydenta RP – monumentalny pałac klasycystyczny przy Krakowskim Przedmieściu.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Sejm Rzeczypospolitej Polskiej', 'monument',
 'ul. Wiejska 4/6/8, Warszawa', 52.2184, 21.0213, 4.4, 1,
 ARRAY['Sejm', 'polityka', 'historia'],
 'Siedziba parlamentu RP – zabytkowy budynek Sejmu dostępny podczas dni otwartych.',
 ARRAY['morning', 'afternoon']),

-- ── PUNKTY WIDOKOWE ──────────────────────────────────────────────────────────

('Warszawa', 'Taras Widokowy na dzwonnicy kościoła św. Anny', 'viewpoint',
 'Krakowskie Przedmieście 68, Warszawa', 52.2450, 21.0148, 4.7, 1,
 ARRAY['widok', 'panorama', 'Stare Miasto'],
 'Jeden z najpiękniejszych widoków na Stare Miasto i Wisłę – taras na dzwonnicy kościoła przy Trakcie Królewskim.',
 ARRAY['morning', 'afternoon', 'evening']),

('Warszawa', 'Varso Tower', 'viewpoint',
 'ul. Chmielna 69, Warszawa', 52.2319, 21.0032, 4.6, 3,
 ARRAY['najwyższy', 'widok', 'nowoczesny'],
 'Najwyższy budynek w Unii Europejskiej z platformą widokową oferującą spektakularną panoramę Warszawy.',
 ARRAY['afternoon', 'evening']),

-- ── ROZRYWKA ─────────────────────────────────────────────────────────────────

('Warszawa', 'Centrum Nauki Kopernik', 'experience',
 'ul. Wybrzeże Kościuszkowskie 20, Warszawa', 52.2420, 21.0282, 4.7, 2,
 ARRAY['nauka', 'interaktywne', 'dzieci'],
 'Jedno z najlepszych centrów nauki w Europie z setkami interaktywnych eksponatów dla dzieci i dorosłych.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Pixel XL', 'experience',
 'Warszawa', 52.2315, 21.0080, 4.5, 2,
 ARRAY['gry wideo', 'konsole', 'retro'],
 'Centrum gier wideo z konsolami z różnych epok – od Atari przez SNES po PlayStation.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Quiz Mate - Quiz na żywo!', 'experience',
 'Warszawa', 52.2290, 21.0160, 4.7, 2,
 ARRAY['quiz', 'wiedza', 'zabawa w grupie'],
 'Wieczory quizowe na żywo dla drużyn – świetna zabawa w grupie z atrakcyjnymi nagrodami.',
 ARRAY['evening']),

('Warszawa', 'Zagrywki', 'experience',
 'ul. Nowy Świat 22, Warszawa', 52.2340, 21.0185, 4.6, 2,
 ARRAY['planszówki', 'gry', 'kawiarnia'],
 'Kawiarnia z grami planszowymi – setki gier do wyboru, kawa i przekąski.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Room Escape Warszawa', 'experience',
 'Warszawa', 52.2300, 21.0100, 4.6, 2,
 ARRAY['escape room', 'zagadki', 'drużyna'],
 'Profesjonalne pokoje ucieczki z wciągającymi scenariuszami i zagadkami dla grup.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Smart Kids Planet - Centrum Mądrej Zabawy', 'experience',
 'Centrum handlowe, Warszawa', 52.2295, 21.0055, 4.5, 2,
 ARRAY['dzieci', 'zabawa', 'edukacyjna'],
 'Interaktywne centrum zabawy dla dzieci łączące naukę z doskonałą rozrywką.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Stacja Grawitacja Warszawa', 'experience',
 'al. Jerozolimskie 148, Warszawa', 52.2301, 21.0028, 4.7, 2,
 ARRAY['trampoliny', 'sport', 'adrenalina'],
 'Park trampolin z parkouram, siatkami i strefami sportowymi – doskonałe dla całej rodziny.',
 ARRAY['afternoon', 'evening']),

('Warszawa', 'Sensorysie', 'experience',
 'Warszawa', 52.2310, 21.0155, 4.6, 2,
 ARRAY['zmysły', 'interaktywne', 'dzieci'],
 'Centrum sensoryczne dla dzieci rozwijające wszystkie zmysły poprzez zabawę i eksplorację.',
 ARRAY['morning', 'afternoon']),

('Warszawa', 'Fun Park Digiloo - Sala Zabaw', 'experience',
 'Warszawa', 52.2285, 21.0065, 4.5, 2,
 ARRAY['dzieci', 'sala zabaw', 'urodziny'],
 'Duża sala zabaw dla dzieci z aktywnościami cyfrowymi i analogowymi – idealna na urodziny.',
 ARRAY['morning', 'afternoon']);
