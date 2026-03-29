-- Migration: supplement Kraków places from creator database
-- Adds places not yet in the places table (restaurants, bars, misc)
-- 2026-03-29

INSERT INTO public.places (city, place_name, category, address, latitude, longitude, rating, price_level, vibe_tags, description, best_time) VALUES

-- ── RESTAURANTS (new) ─────────────────────────────────────────

('Kraków', 'Shadow Resto & Bar', 'restaurant',
 'ul. Józefa 12, Kraków', 50.0524, 19.9435, 4.5, 3,
 ARRAY['klimatyczna', 'koktajle', 'Kazimierz'],
 'Mroczno-elegancki lokal na Kazimierzu łączący fine dining z barem koktajlowym w jednym miejscu.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Pimiento Argentino Grill', 'restaurant',
 'ul. Sławkowska 24, Kraków', 50.0628, 19.9370, 4.6, 3,
 ARRAY['argentyńska', 'steak', 'grill'],
 'Autentyczna restauracja argentyńska z wyśmienitymi stekami z grilla i bogatą kartą win.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Pierwszy Stopień', 'restaurant',
 'ul. Starowiślna 29, Kraków', 50.0518, 19.9455, 4.5, 2,
 ARRAY['polskie', 'pierogi', 'klasyczna'],
 'Sympatyczna restauracja z solidną kuchnią polską i pierogi jak u babci w centrum Krakowa.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Prosciuttko Panino e Vino', 'restaurant',
 'ul. Starowiślna 22, Kraków', 50.0522, 19.9454, 4.7, 2,
 ARRAY['włoska', 'kanapki', 'wino'],
 'Włoski bar kanapkowy z wyśmienitymi panini, prosciutto i dobrym wyborem wina.',
 ARRAY['morning', 'afternoon', 'evening']),

('Kraków', 'Restauracja Starka', 'restaurant',
 'ul. Józefa 14, Kraków', 50.0524, 19.9437, 4.5, 3,
 ARRAY['polska', 'tradycyjna', 'wódka'],
 'Restauracja z kuchnią staropolską, domowymi nalewkami i serdeczną atmosferą na Kazimierzu.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Pierogi MR Vincent', 'restaurant',
 'ul. Bożego Ciała 12, Kraków', 50.0516, 19.9432, 4.6, 1,
 ARRAY['pierogi', 'polskie', 'street food'],
 'Kultowe miejsce z ręcznie robionymi pierogami w dziesiątkach wariantów – ulubione przez krakowian.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Salta House Steakhouse & Sharing', 'restaurant',
 'ul. Starowiślna 14, Kraków', 50.0556, 19.9458, 4.6, 3,
 ARRAY['steak', 'sharing', 'premium'],
 'Nowoczesny steakhouse z daniami do wspólnego dzielenia i starannie dobranymi mięsami.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Kuchnia Polska Gąska', 'restaurant',
 'ul. Sławkowska 34, Kraków', 50.0633, 19.9370, 4.7, 3,
 ARRAY['polska', 'gąska', 'tradycja'],
 'Elegancka restauracja z autorską interpretacją kuchni polskiej w pięknych wnętrzach.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Ristorante Sant''Antioco', 'restaurant',
 'ul. Sławkowska 10, Kraków', 50.0627, 19.9372, 4.6, 3,
 ARRAY['włoska', 'sardyńska', 'romantyczna'],
 'Kuchnia sardyńska prosto z wyspy – świeże makarony, owoce morza i domowe wino.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Sorrento Trattoria', 'restaurant',
 'ul. Szewska 2, Kraków', 50.0614, 19.9360, 4.5, 2,
 ARRAY['włoska', 'pizza', 'casual'],
 'Przyjazna tratoria w stylu włoskim z chrupiącą pizzą i makaronem w sercu Krakowa.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Filthy', 'restaurant',
 'ul. Józefa 14, Kraków', 50.0523, 19.9438, 4.6, 2,
 ARRAY['burgers', 'street food', 'modna'],
 'Kultowy lokal z wyjątkowymi burgerami i bezkompromisowym podejściem do smaku.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Pizzeria Dolabella Due', 'restaurant',
 'ul. Dolabella 11, Kraków', 50.0624, 19.9415, 4.6, 2,
 ARRAY['pizza', 'neapolitańska', 'piec opalany'],
 'Autentyczna neapolitańska pizzeria z piecem opalanym drewnem i ciastem na zakwasie.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Salta Resto', 'restaurant',
 'ul. Starowiślna 12, Kraków', 50.0553, 19.9459, 4.5, 2,
 ARRAY['polska', 'nowoczesna', 'casual'],
 'Przyjazna restauracja z ciekawym menu opartym na lokalnych składnikach w przystępnych cenach.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Butcher Grill', 'restaurant',
 'ul. Sławkowska 18, Kraków', 50.0628, 19.9371, 4.6, 3,
 ARRAY['mięso', 'grill', 'premium'],
 'Restauracja mięsna z starannie wyselekcjonowanymi cięciami i grillowanymi specjałami.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Bharat Flame', 'restaurant',
 'ul. Gertrudy 5, Kraków', 50.0600, 19.9378, 4.5, 2,
 ARRAY['indyjska', 'curry', 'pikantna'],
 'Restauracja indyjska z bogatą kartą curry, tandoori i wegetariańskich specjałów.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Brasserie L''Olympique', 'restaurant',
 'ul. Floriańska 3, Kraków', 50.0631, 19.9388, 4.6, 3,
 ARRAY['francuska', 'brasserie', 'elegancka'],
 'Paryska brasserie w stylu retro z klasyczną kuchnią francuską i bogatą kartą win.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Kuchnia u Doroty', 'restaurant',
 'ul. Szewska 5, Kraków', 50.0614, 19.9362, 4.5, 2,
 ARRAY['polska', 'domowa', 'obiadowa'],
 'Przytulna restauracja z domową kuchnią polską – pyszne obiady jak u mamy w centrum miasta.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Restauracja Smakołyki', 'restaurant',
 'ul. Starowiślna 8, Kraków', 50.0549, 19.9460, 4.4, 2,
 ARRAY['polska', 'tradycyjna', 'przytulna'],
 'Klasyczna polska restauracja z szerokim menu tradycyjnych dań i domową atmosferą.',
 ARRAY['afternoon', 'evening']),

-- ── CAFE / BREAKFAST (new) ────────────────────────────────────

('Kraków', 'MO-JA Cafe & Bistro', 'cafe',
 'ul. Starowiślna 16, Kraków', 50.0557, 19.9460, 4.5, 2,
 ARRAY['śniadania', 'bistro', 'codzienna'],
 'Casualowa kawiarnia-bistro z solidnymi śniadaniami, lunchami i dobrą kawą przez cały dzień.',
 ARRAY['morning', 'afternoon']),

-- ── BARS (new) ────────────────────────────────────────────────

('Kraków', 'Lastriko', 'bar',
 'ul. Józefa 22, Kraków', 50.0520, 19.9436, 4.6, 2,
 ARRAY['naturalnie wino', 'hipsterski', 'Kazimierz'],
 'Nowoczesny wine bar na Kazimierzu z szerokim wyborem naturalnych win i dobrej muzyki.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Mr. Black', 'bar',
 'ul. Sławkowska 9, Kraków', 50.0626, 19.9373, 4.5, 2,
 ARRAY['koktajle', 'ciemna', 'stylowa'],
 'Elegancki czarny bar z autorskimi koktajlami i klimatycznym oświetleniem w centrum.',
 ARRAY['evening']),

('Kraków', 'Tawerna Wilczy Dół', 'bar',
 'ul. Floriańska 27, Kraków', 50.0639, 19.9392, 4.4, 2,
 ARRAY['pub', 'piwo', 'klimatyczna'],
 'Rustykalny pub z szerokim wyborem piw rzemieślniczych i ciepłą, niemal zbójnicką atmosferą.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'PANDORA. Cocktail BAR', 'bar',
 'ul. Meiselsa 10, Kraków', 50.0510, 19.9437, 4.5, 2,
 ARRAY['koktajle', 'Kazimierz', 'nocne życie'],
 'Koktajlowy bar na Kazimierzu z kreatywnym menu drinków i imprezami do białego rana.',
 ARRAY['evening']),

('Kraków', 'Piwnica Pod Baranami', 'bar',
 'Rynek Główny 27, Kraków', 50.0619, 19.9365, 4.6, 2,
 ARRAY['legenda', 'kabaret', 'historia'],
 'Legendarna piwnica pod Rynkiem – miejsce słynnego kabaretu i krakowskiej bohemy od dekad.',
 ARRAY['evening']),

('Kraków', 'Single Scena Music Bar', 'bar',
 'ul. Sławkowska 13, Kraków', 50.0626, 19.9372, 4.5, 2,
 ARRAY['muzyka', 'live', 'klimatyczna'],
 'Bar z regularnymi koncertami na żywo i doskonałą akustyką – raj dla miłośników muzyki.',
 ARRAY['evening']),

('Kraków', 'Bezogródek Tropical Spot', 'bar',
 'ul. Lipowa 6a, Kraków', 50.0445, 19.9535, 4.5, 2,
 ARRAY['food truck', 'letni ogródek', 'Zabłocie'],
 'Tropikalny food truck park na Zabłociu z ogródkiem, koktajlami i imprezami pod gołym niebem.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Empire Of Cocktails', 'bar',
 'ul. Starowiślna 4, Kraków', 50.0562, 19.9458, 4.6, 3,
 ARRAY['koktajle', 'premium', 'bar'],
 'Koktajlowe imperium z setkami receptur drinków i bartenderami traktującymi miksologię jak sztukę.',
 ARRAY['evening']),

('Kraków', 'Pub Polski', 'bar',
 'ul. Starowiślna 21, Kraków', 50.0524, 19.9455, 4.4, 1,
 ARRAY['pub', 'polskie piwo', 'lokalni'],
 'Tradycyjny polski pub z dobrym piwem, prostą przekąską i serdeczną, niewymuszoną atmosferą.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Black Gallery Pub', 'bar',
 'ul. Mikołajska 24, Kraków', 50.0621, 19.9396, 4.4, 2,
 ARRAY['mroczny', 'punk', 'alternatywny'],
 'Alternatywny pub z mrocznym klimatem, muzyką rockową i wyborem piw rzemieślniczych.',
 ARRAY['evening']),

('Kraków', 'Eszeweria', 'bar',
 'ul. Józefa 9, Kraków', 50.0522, 19.9433, 4.5, 2,
 ARRAY['koktajle', 'Kazimierz', 'artsy'],
 'Artystyczny bar na Kazimierzu łączący klimat galerii ze świetnymi koktajlami i winem.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Multi Qlti Tap Bar', 'bar',
 'ul. Sławkowska 2, Kraków', 50.0623, 19.9367, 4.6, 2,
 ARRAY['craft beer', 'rzemieślnicze', 'wybór'],
 'Bar z kilkudziesięcioma kranami piwa rzemieślniczego z całej Polski i świata – raj dla piwosza.',
 ARRAY['afternoon', 'evening']),

('Kraków', '442 Sport Pub', 'bar',
 'ul. Starowiślna 16, Kraków', 50.0556, 19.9458, 4.4, 1,
 ARRAY['sport', 'mecze', 'pub'],
 'Pub sportowy z dużymi ekranami do oglądania meczów i szerokim wyborem zimnych piw.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Bierhalle Kraków', 'bar',
 'ul. Sławkowska 3, Kraków', 50.0623, 19.9368, 4.5, 2,
 ARRAY['browar', 'piwo', 'bawarski'],
 'Bawarski pub z własnym browarem, tradycyjnymi kuflami piwa i serdeczną atmosferą festynu.',
 ARRAY['afternoon', 'evening']),

-- ── MUSEUM (new) ─────────────────────────────────────────────

('Kraków', 'Muzeum Gier Wideo – Krakow Arcade Museum', 'museum',
 'ul. Starowiślna 4a, Kraków', 50.0561, 19.9455, 4.7, 2,
 ARRAY['gry', 'retro', 'dla dzieci'],
 'Muzeum gier wideo z działającymi automatami arcade i konsolami od Atari po PS4 – graj tyle chcesz.',
 ARRAY['afternoon', 'evening']);
