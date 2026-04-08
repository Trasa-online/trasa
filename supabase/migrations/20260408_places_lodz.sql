-- Migration: seed places for Łódź
-- 2026-04-08

INSERT INTO public.places (city, place_name, category, address, latitude, longitude, rating, price_level, vibe_tags, description, best_time) VALUES

-- ── CAFES ────────────────────────────────────────────────────

('Łódź', 'Cafe Malarnia', 'cafe',
 'ul. Piotrkowska 86, Łódź', 51.7694, 19.4560, 4.6, 2,
 ARRAY['artystyczna', 'klimatyczna', 'piotrkowska'],
 'Klimatyczna kawiarnia w kamienicy przy Piotrkowskiej z klimatem artystycznej Łodzi.',
 ARRAY['morning', 'afternoon']),

('Łódź', 'Magnetofon Cafe', 'cafe',
 'ul. Roosevelta 3, Łódź', 51.7681, 19.4578, 4.5, 2,
 ARRAY['specialty coffee', 'vintage', 'klimatyczna'],
 'Specialty kawiarnia z winylami i klimatem lat 80. Jedna z najlepszych kaw w Łodzi.',
 ARRAY['morning', 'afternoon']),

('Łódź', 'Cafe Strych', 'cafe',
 'ul. Piotrkowska 102, Łódź', 51.7703, 19.4558, 4.4, 2,
 ARRAY['studencka', 'przytulna', 'tanie jedzenie'],
 'Przytulna kawiarnia na poddaszu kamienicy przy Piotrkowskiej. Popularna wśród studentów i artystów.',
 ARRAY['morning', 'afternoon', 'evening']),

-- ── RESTAURANTS ──────────────────────────────────────────────

('Łódź', 'Senses Restaurant', 'restaurant',
 'ul. Piotrkowska 17, Łódź', 51.7656, 19.4562, 4.7, 3,
 ARRAY['fine dining', 'nowoczesna kuchnia', 'elegancka'],
 'Jeden z najlepszych restaurantów w Łodzi — nowoczesna kuchnia polska w eleganckiej oprawie.',
 ARRAY['afternoon', 'evening']),

('Łódź', 'Anatewka', 'restaurant',
 'ul. 6 Sierpnia 2, Łódź', 51.7610, 19.4520, 4.6, 2,
 ARRAY['żydowska', 'klimatyczna', 'tradycyjna'],
 'Restauracja żydowska przy Manufakturze. Żydowskie przysmaki w klimatycznym wnętrzu.',
 ARRAY['afternoon', 'evening']),

('Łódź', 'Presto Ristorante', 'restaurant',
 'ul. Piotrkowska 67, Łódź', 51.7683, 19.4561, 4.5, 2,
 ARRAY['włoska', 'pizza', 'makaron'],
 'Sprawdzona włoska restauracja przy Piotrkowskiej z autentycznymi smakami.',
 ARRAY['afternoon', 'evening']),

-- ── BARS ─────────────────────────────────────────────────────

('Łódź', 'Wytwórnia', 'bar',
 'ul. Łąkowa 29, Łódź', 51.7669, 19.4491, 4.6, 2,
 ARRAY['kultowe', 'muzyczne', 'hipsterskie'],
 'Kultowe miejsce łódzkiej sceny muzycznej i artystycznej. Koncerty, wystawy, świetna atmosfera.',
 ARRAY['evening']),

('Łódź', 'Piano Rouge', 'bar',
 'ul. Piotrkowska 90, Łódź', 51.7697, 19.4558, 4.5, 2,
 ARRAY['jazzowe', 'koktajle', 'eleganckie'],
 'Bar jazzowy w stylu retro z świetnymi koktajlami i żywą muzyką jazzową.',
 ARRAY['evening']),

-- ── MUSEUMS ──────────────────────────────────────────────────

('Łódź', 'Muzeum Sztuki ms2', 'museum',
 'ul. Ogrodowa 19, Łódź', 51.7719, 19.4489, 4.6, 1,
 ARRAY['sztuka współczesna', 'awangarda', 'must-see'],
 'Jedno z najważniejszych muzeów sztuki nowoczesnej w Polsce. Kolekcja awangardy światowej klasy.',
 ARRAY['morning', 'afternoon']),

('Łódź', 'Centralne Muzeum Włókiennictwa', 'museum',
 'ul. Piotrkowska 282, Łódź', 51.7887, 19.4542, 4.5, 1,
 ARRAY['historia', 'przemysłowe', 'unikalne'],
 'Muzeum w zabytkowej fabryce włókienniczej — historia przemysłowej Łodzi i tkanin z całego świata.',
 ARRAY['morning', 'afternoon']),

('Łódź', 'EC1 Łódź — Miasto Kultury', 'museum',
 'ul. Targowa 1/3, Łódź', 51.7752, 19.4693, 4.7, 1,
 ARRAY['industrialne', 'nauka', 'architektura'],
 'Dawna elektrownia przebudowana na centrum kultury z planetarium i interaktywnymi wystawami.',
 ARRAY['morning', 'afternoon', 'evening']),

-- ── PARKS & VIEWPOINTS ───────────────────────────────────────

('Łódź', 'Park im. Józefa Piłsudskiego', 'park',
 'al. Unii Lubelskiej 7, Łódź', 51.7558, 19.4552, 4.5, 1,
 ARRAY['zielona', 'spacer', 'jezioro'],
 'Największy park w Łodzi z jeziorem Arturówek. Idealne miejsce na spacer i odpoczynek.',
 ARRAY['morning', 'afternoon']),

('Łódź', 'Park Źródliska', 'park',
 'ul. Piłsudskiego 15, Łódź', 51.7648, 19.4590, 4.4, 1,
 ARRAY['historyczny', 'spacer', 'centrum'],
 'Zabytkowy park w centrum Łodzi z fontannami i alejkami. Idealne na popołudniowy spacer.',
 ARRAY['morning', 'afternoon']),

-- ── MONUMENTS & EXPERIENCE ───────────────────────────────────

('Łódź', 'ul. Piotrkowska', 'walk',
 'ul. Piotrkowska, Łódź', 51.7694, 19.4558, 4.8, 1,
 ARRAY['must-see', 'deptak', 'ikona'],
 'Najdłuższa ulica handlowa w Polsce — serce Łodzi. Kamienice, murale, kawiarnie i historia.',
 ARRAY['morning', 'afternoon', 'evening']),

('Łódź', 'Manufaktura', 'shopping',
 'ul. Ogrodowa 17, Łódź', 51.7720, 19.4487, 4.7, 2,
 ARRAY['must-see', 'fabryka', 'shopping', 'historia'],
 'Dawna fabryka Izraela Poznańskiego zamieniona w centrum handlowo-kulturalne. Architektura robi wrażenie.',
 ARRAY['morning', 'afternoon', 'evening']),

('Łódź', 'Muzeum Kinematografii', 'museum',
 'pl. Zwycięstwa 1, Łódź', 51.7705, 19.4480, 4.6, 1,
 ARRAY['kino', 'historia', 'unikalne'],
 'Muzeum w pałacu fabrykanta Scheiblera. Historia polskiego kina i Łódzkiej Szkoły Filmowej.',
 ARRAY['morning', 'afternoon']),

('Łódź', 'Księży Młyn', 'walk',
 'ul. Przędzalniana 72, Łódź', 51.7645, 19.4720, 4.5, 1,
 ARRAY['industrialne', 'murale', 'historia'],
 'Zabytkowe osiedle robotnicze z XIX w. przy dawnej fabryce Scheiblera. Klimatyczne murale i industrialna architektura.',
 ARRAY['morning', 'afternoon']);
