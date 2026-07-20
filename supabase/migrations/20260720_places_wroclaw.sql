-- Migration: Wrocław places seed data
-- 2026-07-20
--
-- Source: "Baza danych miejsc - Wrocław.csv"
-- Category mapping from CSV:
--   Kawiarnia   → cafe
--   Piekarnia   → cafe   (subcategory: bakery)
--   Cukiernia   → cafe   (subcategory: pastry / icecream)
--   Restauracja → restaurant
--   Bar         → bar
--   Muzeum      → museum (galerie → gallery)
--   Park        → park
--   Market      → market
--   Landmark    → monument (punkty widokowe → viewpoint)
--   Rozrywka    → experience
--
-- Photos are pulled at runtime via the Google Places proxy (google_place_id / photo_url
-- are intentionally left NULL here, same as other city seeds).

INSERT INTO public.places (city, place_name, category, address, latitude, longitude, rating, price_level, vibe_tags, description, best_time) VALUES

-- ── KAWIARNIE ────────────────────────────────────────────────────────────────

('Wrocław', 'A. COFFEE (Brunch Café)', 'cafe',
 'Wrocław', 51.1095, 17.0320, 4.6, 2,
 ARRAY['brunch', 'specialty coffee', 'śniadania'],
 'Kameralna kawiarnia brunchowa ze specialty coffee i pysznymi śniadaniami w sercu Wrocławia.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Herbaciarnia Targowa', 'cafe',
 'Hala Targowa, Wrocław', 51.1128, 17.0432, 4.6, 1,
 ARRAY['herbaciarnia', 'przytulna', 'Hala Targowa'],
 'Klimatyczna herbaciarnia przy Hali Targowej z szerokim wyborem herbat ze świata i spokojną atmosferą.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Noon | Specialty coffee & food', 'cafe',
 'Wrocław', 51.1088, 17.0298, 4.7, 2,
 ARRAY['specialty coffee', 'nowoczesna', 'food'],
 'Nowoczesna kawiarnia specialty z doskonałą kawą i lekkim menu, idealna na przerwę w ciągu dnia.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Folgujemy bistro & kawiarnia specialty', 'cafe',
 'Wrocław', 51.1112, 17.0355, 4.6, 2,
 ARRAY['bistro', 'specialty coffee', 'przytulna'],
 'Bistro i kawiarnia specialty łączące dobrą kawę z sezonowym menu w przyjaznym wnętrzu.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Art Cafe Kalambur', 'cafe',
 'ul. Kuźnicza 29a, Wrocław', 51.1116, 17.0335, 4.5, 2,
 ARRAY['secesja', 'klimatyczna', 'kultowa'],
 'Kultowa kawiarnia w secesyjnym wnętrzu z artystyczną duszą, dobra kawa i wyjątkowa atmosfera.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Vinyl Cafe', 'cafe',
 'ul. Kotlarska 35/36, Wrocław', 51.1103, 17.0345, 4.6, 2,
 ARRAY['winyle', 'retro', 'klimatyczna'],
 'Klimatyczna kawiarnia z kolekcją winyli i muzyką z gramofonu, retro wnętrze i dobra kawa.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Central Cafe', 'cafe',
 'Wrocław', 51.1099, 17.0308, 4.4, 2,
 ARRAY['centrum', 'kawa', 'klasyczna'],
 'Kawiarnia w centrum miasta z dobrą kawą i domową atmosferą, dobre miejsce na spotkanie.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Cafe Freska', 'cafe',
 'Wrocław', 51.1085, 17.0330, 4.5, 2,
 ARRAY['świeża', 'przytulna', 'kawa'],
 'Sympatyczna kawiarnia ze świeżą kawą i wypiekami w przyjemnym, kameralnym wnętrzu.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Gniazdo', 'cafe',
 'Wrocław', 51.1120, 17.0360, 4.6, 2,
 ARRAY['przytulna', 'domowa', 'relaks'],
 'Przytulne miejsce z ciepłą atmosferą, dobra kawa i domowe wypieki na relaksujące popołudnie.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'KOTON Kocia Kawiarnia', 'cafe',
 'Wrocław', 51.1075, 17.0285, 4.6, 2,
 ARRAY['koty', 'cat cafe', 'relaks'],
 'Kawiarnia z kotami, idealne miejsce dla miłośników kotów i dobrej kawy w towarzystwie mruczących gospodarzy.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'FC CAFFE', 'cafe',
 'Wrocław', 51.1092, 17.0315, 4.4, 2,
 ARRAY['kawa', 'nowoczesna', 'centrum'],
 'Nowoczesna kawiarnia z aromatyczną kawą i przekąskami, dobra na szybką przerwę w mieście.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Kawiarnia Coffilm', 'cafe',
 'Wrocław', 51.1108, 17.0340, 4.6, 2,
 ARRAY['filmowa', 'klimatyczna', 'kawa'],
 'Kawiarnia z filmowym klimatem, dobra kawa i przytulne wnętrze zachęcające do dłuższego posiedzenia.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Poko Bakery & Cafe', 'cafe',
 'Wrocław', 51.1097, 17.0325, 4.7, 2,
 ARRAY['piekarnia', 'croissanty', 'kawa'],
 'Piekarnia i kawiarnia w jednym ze świeżymi wypiekami, croissantami i dobrą kawą specialty.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Atelier Cafe - Breakfast & Specialty Coffee', 'cafe',
 'Wrocław', 51.1101, 17.0332, 4.7, 2,
 ARRAY['śniadania', 'specialty coffee', 'brunch'],
 'Kawiarnia śniadaniowa ze specialty coffee i bogatym menu porannym, świetna na brunch.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Bohema Caffe', 'cafe',
 'Wrocław', 51.1113, 17.0348, 4.5, 2,
 ARRAY['bohema', 'klimatyczna', 'kawa'],
 'Klimatyczna kawiarnia z bohemską atmosferą, dobra kawa i domowe ciasta w artystycznym wnętrzu.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Słodki chłopak - Pracownia cukiernicza i kawiarnia', 'cafe',
 'Wrocław', 51.1083, 17.0302, 4.6, 2,
 ARRAY['cukiernia', 'desery', 'słodkości'],
 'Pracownia cukiernicza i kawiarnia z autorskimi deserami, ciastami i dobrą kawą.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Czekoladziarnia', 'cafe',
 'Wrocław', 51.1105, 17.0338, 4.6, 2,
 ARRAY['czekolada', 'desery', 'słodkości'],
 'Miejsce dla miłośników czekolady z gorącą czekoladą, pralinami i słodkimi deserami.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Kot Cafe', 'cafe',
 'Wrocław', 51.1078, 17.0290, 4.5, 2,
 ARRAY['koty', 'cat cafe', 'relaks'],
 'Kocia kawiarnia z przyjazną atmosferą, dobra kawa i towarzystwo kotów na relaksujące popołudnie.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Fiore Caffe | Coffee & Breakfast', 'cafe',
 'Wrocław', 51.1090, 17.0318, 4.6, 2,
 ARRAY['śniadania', 'włoska', 'kawa'],
 'Kawiarnia w stylu włoskim z dobrym espresso, croissantami i śniadaniami na start dnia.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Cafe Borówka', 'cafe',
 'Wrocław', 51.1115, 17.0352, 4.5, 2,
 ARRAY['przytulna', 'domowa', 'ciasta'],
 'Urokliwa kawiarnia z domowymi ciastami i dobrą kawą w ciepłym, przytulnym wnętrzu.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Kocia Kawiarnia Cat&Alice', 'cafe',
 'Wrocław', 51.1073, 17.0295, 4.6, 2,
 ARRAY['koty', 'cat cafe', 'relaks'],
 'Kawiarnia z kotami w bajkowym klimacie, idealna na kawę w towarzystwie kocich mieszkańców.',
 ARRAY['afternoon', 'evening']),

-- ── PIEKARNIE ────────────────────────────────────────────────────────────────

('Wrocław', 'Di Bakery / Piekarnia Dinette', 'cafe',
 'Wrocław', 51.1102, 17.0328, 4.7, 2,
 ARRAY['piekarnia', 'croissanty', 'rzemieślnicza'],
 'Rzemieślnicza piekarnia z doskonałymi croissantami i wypiekami na zakwasie, świeżo każdego dnia.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Piekarnia & Cukiernia Machela', 'cafe',
 'Wrocław', 51.1087, 17.0305, 4.6, 1,
 ARRAY['piekarnia', 'cukiernia', 'tradycyjna'],
 'Tradycyjna piekarnia i cukiernia ze świeżym pieczywem, ciastami i klasycznymi wypiekami.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'bakeMAnia', 'cafe',
 'Wrocław', 51.1094, 17.0312, 4.6, 1,
 ARRAY['piekarnia', 'świeże', 'chleb'],
 'Piekarnia z szeroką ofertą pieczywa i słodkich wypieków, chleb na zakwasie i świeże bułki.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Pastel - bread & other stories', 'cafe',
 'Wrocław', 51.1109, 17.0342, 4.7, 2,
 ARRAY['piekarnia', 'rzemieślnicza', 'zakwas'],
 'Rzemieślnicza piekarnia z chlebem na zakwasie i autorskimi wypiekami, jakość i świeżość na pierwszym miejscu.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Bakery Street Piekarnia - Kawiarnia', 'cafe',
 'Wrocław', 51.1081, 17.0300, 4.5, 2,
 ARRAY['piekarnia', 'kawiarnia', 'świeże'],
 'Piekarnia i kawiarnia w jednym ze świeżym pieczywem, wypiekami i dobrą kawą.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Piekarnia O Zboże!', 'cafe',
 'Wrocław', 51.1118, 17.0358, 4.6, 1,
 ARRAY['piekarnia', 'zakwas', 'rzemieślnicza'],
 'Piekarnia rzemieślnicza z pieczywem na zakwasie i naturalnych składnikach, świeże wypieki codziennie.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Piekarnia Sąsiedzi', 'cafe',
 'Wrocław', 51.1071, 17.0288, 4.6, 1,
 ARRAY['piekarnia', 'sąsiedzka', 'świeże'],
 'Sąsiedzka piekarnia ze świeżym chlebem i wypiekami, przyjazne miejsce z lokalnym charakterem.',
 ARRAY['morning', 'afternoon']),

-- ── CUKIERNIE ────────────────────────────────────────────────────────────────

('Wrocław', 'Fokies / Smochi', 'cafe',
 'Wrocław', 51.1096, 17.0322, 4.6, 2,
 ARRAY['cukiernia', 'desery', 'słodkości'],
 'Cukiernia z autorskimi deserami i słodkościami, kolorowe wypieki idealne na słodką przerwę.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Cukiernia NANAN', 'cafe',
 'Wrocław', 51.1104, 17.0334, 4.7, 2,
 ARRAY['cukiernia', 'torty', 'desery'],
 'Elegancka cukiernia ze znakomitymi tortami, deserami i słodkościami wykonanymi z pasją.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Gorąca Pączkarnia F-Wiatrak', 'cafe',
 'Wrocław', 51.1089, 17.0310, 4.5, 1,
 ARRAY['pączki', 'słodkości', 'na ciepło'],
 'Pączkarnia z gorącymi pączkami prosto z pieca, słodki przystanek na szybką przyjemność.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Mae''s Cookies', 'cafe',
 'Wrocław', 51.1100, 17.0326, 4.6, 2,
 ARRAY['ciastka', 'cookies', 'słodkości'],
 'Miejsce słynące z amerykańskich cookies, chrupiące ciastka w wielu smakach i dobra kawa.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Creme de la creme', 'cafe',
 'Wrocław', 51.1112, 17.0346, 4.6, 2,
 ARRAY['cukiernia', 'desery', 'elegancka'],
 'Cukiernia z wyrafinowanymi deserami i ciastami, eleganckie słodkości na wyjątkowe okazje.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Lodo Vibe Lody Rzemieślnicze', 'cafe',
 'Wrocław', 51.1093, 17.0320, 4.7, 1,
 ARRAY['lody', 'rzemieślnicze', 'desery'],
 'Lodziarnia rzemieślnicza z lodami z naturalnych składników w wyjątkowych, sezonowych smakach.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Lody Baroli', 'cafe',
 'Wrocław', 51.1106, 17.0336, 4.7, 1,
 ARRAY['lody', 'rzemieślnicze', 'lato'],
 'Rzemieślnicza lodziarnia z kremowymi lodami i owocowymi sorbetami, idealne na letni spacer.',
 ARRAY['afternoon', 'evening']),

-- ── RESTAURACJE ──────────────────────────────────────────────────────────────

('Wrocław', 'Vegan AF Ramen', 'restaurant',
 'Wrocław', 51.1097, 17.0296, 4.7, 2,
 ARRAY['wegańska', 'ramen', 'azjatycka'],
 'Wegańska ramenownia z aromatycznymi bulionami i azjatyckimi smakami w roślinnym wydaniu.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'VaffaNapoli', 'restaurant',
 'Wrocław', 51.1108, 17.0330, 4.7, 2,
 ARRAY['pizza', 'neapolitańska', 'włoska'],
 'Autentyczna pizza neapolitańska pieczona w piecu opałowym, ciasto na zakwasie i włoskie składniki.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Petit by Herman', 'restaurant',
 'Wrocław', 51.1101, 17.0338, 4.7, 3,
 ARRAY['bistro', 'francuska', 'nowoczesna'],
 'Kameralne bistro z nowoczesną kuchnią o francuskim akcencie, sezonowe menu i staranne wykonanie.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Bar Witek', 'restaurant',
 'Wrocław', 51.1090, 17.0308, 4.5, 1,
 ARRAY['bar mleczny', 'domowa', 'tanie'],
 'Bar z domową kuchnią w przystępnych cenach, klasyczne polskie dania na szybki, sycący posiłek.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Mandarin House', 'restaurant',
 'Wrocław', 51.1085, 17.0315, 4.5, 2,
 ARRAY['chińska', 'azjatycka', 'kuchnia'],
 'Restauracja chińska z klasycznymi daniami kuchni azjatyckiej przyrządzanymi z autentycznych receptur.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Bułka z Masłem Włodkowica', 'restaurant',
 'ul. Włodkowica, Wrocław', 51.1082, 17.0270, 4.6, 2,
 ARRAY['śniadania', 'brunch', 'Włodkowica'],
 'Popularne miejsce na śniadanie i brunch przy klimatycznej Włodkowica, świeże kanapki i dobra kawa.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'CULTO', 'restaurant',
 'Wrocław', 51.1103, 17.0342, 4.6, 3,
 ARRAY['włoska', 'nowoczesna', 'wino'],
 'Nowoczesna restauracja z włoską kuchnią i dobrą kartą win, eleganckie wnętrze i sezonowe menu.',
 ARRAY['evening']),

('Wrocław', 'Królestwo Ziemniaka', 'restaurant',
 'Wrocław', 51.1099, 17.0320, 4.5, 2,
 ARRAY['ziemniaki', 'polska', 'sycąca'],
 'Restauracja z kultem ziemniaka, sycące dania z ziemniakiem w roli głównej w wielu wariantach.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'ato ramen wro', 'restaurant',
 'Wrocław', 51.1094, 17.0304, 4.7, 2,
 ARRAY['ramen', 'japońska', 'azjatycka'],
 'Ramenownia z aromatycznymi bulionami i autentycznym japońskim ramenem gotowanym na miejscu.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Whiskey in the Jar', 'restaurant',
 'Wrocław', 51.1107, 17.0334, 4.5, 2,
 ARRAY['grill', 'żeberka', 'amerykańska'],
 'Restauracja słynąca z grillowanych żeberek i mięs w amerykańskim stylu, sycące porcje i dobre piwo.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Konspira', 'restaurant',
 'pl. Solny 11, Wrocław', 51.1093, 17.0298, 4.6, 2,
 ARRAY['polska', 'PRL', 'klimatyczna'],
 'Restauracja z polską kuchnią w klimacie PRL i konspiracji, tradycyjne dania i historyczny wystrój.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Vivere Italiano', 'restaurant',
 'Wrocław', 51.1086, 17.0312, 4.6, 2,
 ARRAY['włoska', 'pizza', 'bezglutenowa'],
 'Włoska restauracja z pizzą, owocami morza i winem, dostępne również dania bezglutenowe.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Emily. Italian Stories.', 'restaurant',
 'Wrocław', 51.1104, 17.0340, 4.6, 3,
 ARRAY['włoska', 'nowoczesna', 'wino'],
 'Nowoczesna włoska restauracja z autorskim podejściem do klasyki, dobra pasta i selekcja win.',
 ARRAY['evening']),

('Wrocław', 'Piwnica Świdnicka', 'restaurant',
 'Rynek 1, Wrocław', 51.1097, 17.0313, 4.4, 3,
 ARRAY['Rynek', 'polska', 'historyczna'],
 'Jedna z najstarszych restauracji Europy w podziemiach wrocławskiego Ratusza, polska kuchnia w zabytkowych wnętrzach.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Jolie - Brasserie Cafe', 'restaurant',
 'Wrocław', 51.1102, 17.0336, 4.6, 2,
 ARRAY['brasserie', 'francuska', 'brunch'],
 'Brasserie i kawiarnia w francuskim stylu z brunchem, sałatami i deserami w eleganckim wnętrzu.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Chatka przy Jatkach', 'restaurant',
 'ul. Jatki, Wrocław', 51.1108, 17.0322, 4.6, 2,
 ARRAY['polska', 'klimatyczna', 'Jatki'],
 'Klimatyczna restauracja przy zabytkowych Jatkach z polską kuchnią i przytulnym, kameralnym wnętrzem.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Drevny Kocur', 'restaurant',
 'Wrocław', 51.1091, 17.0307, 4.5, 2,
 ARRAY['piwo', 'słowiańska', 'pub'],
 'Restauracja i browar w słowiańskim klimacie z piwem własnej produkcji i sycącą kuchnią.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'STÓŁ na Szwedzkiej - studio kulinarne', 'restaurant',
 'ul. Szwedzka, Wrocław', 51.1050, 17.0250, 4.8, 3,
 ARRAY['fine dining', 'autorska', 'studio kulinarne'],
 'Autorskie studio kulinarne z sezonowym menu degustacyjnym, wyjątkowe doświadczenie dla smakoszy.',
 ARRAY['evening']),

('Wrocław', 'Lwia Brama', 'restaurant',
 'Wrocław', 51.1100, 17.0330, 4.5, 3,
 ARRAY['polska', 'europejska', 'elegancka'],
 'Elegancka restauracja z polską i europejską kuchnią, staranne dania i dobra karta win.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Targowa - Craft Beer and Food', 'restaurant',
 'Hala Targowa, Wrocław', 51.1127, 17.0430, 4.6, 2,
 ARRAY['craft beer', 'burgery', 'Hala Targowa'],
 'Miejsce z piwem kraftowym i dobrą kuchnią przy Hali Targowej, burgery i przekąski do piwa.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Pod Papugami - Restaurant & Cocktail Bar', 'restaurant',
 'Wrocław', 51.1098, 17.0316, 4.5, 2,
 ARRAY['koktajle', 'restauracja', 'bar'],
 'Restauracja i cocktail bar z autorskimi drinkami i międzynarodowym menu w centrum miasta.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Restauracja Pod Fredrą', 'restaurant',
 'Rynek, Wrocław', 51.1095, 17.0318, 4.4, 3,
 ARRAY['Rynek', 'polska', 'klasyczna'],
 'Restauracja przy Rynku z klasyczną polską kuchnią i widokiem na wrocławski Ratusz.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Thai Thai Wrocław', 'restaurant',
 'Wrocław', 51.1088, 17.0324, 4.6, 2,
 ARRAY['tajska', 'pad thai', 'azjatycka'],
 'Restauracja tajska z autentycznymi daniami kuchni Tajlandii i aromatycznymi przyprawami.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Kurna Chata', 'restaurant',
 'Wrocław', 51.1084, 17.0308, 4.5, 2,
 ARRAY['polska', 'regionalna', 'klimatyczna'],
 'Restauracja z regionalną polską kuchnią w rustykalnym, klimatycznym wnętrzu w stylu chaty.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Campo Modern Grill', 'restaurant',
 'Wrocław', 51.1103, 17.0344, 4.6, 3,
 ARRAY['grill', 'mięso', 'nowoczesna'],
 'Nowoczesna restauracja z grillem i doskonałym mięsem, steki i dania z ognia w eleganckim wydaniu.',
 ARRAY['evening']),

('Wrocław', 'Sexy Bull', 'restaurant',
 'Wrocław', 51.1106, 17.0332, 4.6, 3,
 ARRAY['steki', 'mięso', 'steakhouse'],
 'Steakhouse z premium wołowiną i soczystymi stekami, mięsne uczty w efektownej oprawie.',
 ARRAY['evening']),

('Wrocław', 'The Cork R32', 'restaurant',
 'Wrocław', 51.1092, 17.0326, 4.6, 3,
 ARRAY['wino', 'nowoczesna', 'fine dining'],
 'Restauracja z autorską kuchnią i rozbudowaną kartą win, wyrafinowane dania w kameralnym wnętrzu.',
 ARRAY['evening']),

('Wrocław', 'Rynek 26', 'restaurant',
 'Rynek 26, Wrocław', 51.1096, 17.0310, 4.5, 3,
 ARRAY['Rynek', 'europejska', 'elegancka'],
 'Restauracja przy Rynku z europejską kuchnią i eleganckim wnętrzem w samym sercu Wrocławia.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'La Maddalena', 'restaurant',
 'Wrocław', 51.1101, 17.0338, 4.6, 3,
 ARRAY['włoska', 'pasta', 'wino'],
 'Włoska restauracja ze świeżą pastą, owocami morza i winem, autentyczne smaki Italii.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'PANCZO Antoniego', 'restaurant',
 'Wrocław', 51.1089, 17.0318, 4.6, 2,
 ARRAY['meksykańska', 'tacos', 'street food'],
 'Restauracja z kuchnią meksykańską, tacos, burrito i aromatyczne dania w klimacie street foodu.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Dinette', 'restaurant',
 'Wrocław', 51.1102, 17.0329, 4.7, 2,
 ARRAY['bistro', 'brunch', 'nowoczesna'],
 'Bistro z nowoczesną kuchnią i doskonałym brunchem, sezonowe dania i wypieki własnej roboty.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Giselle Cafe Bistro', 'restaurant',
 'Wrocław', 51.1099, 17.0334, 4.5, 2,
 ARRAY['bistro', 'kawiarnia', 'brunch'],
 'Kawiarnia i bistro z lekkim menu, śniadaniami i deserami w eleganckim, przytulnym wnętrzu.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Lepione', 'restaurant',
 'ul. Kuźnicza 43, Wrocław', 51.1114, 17.0335, 4.6, 1,
 ARRAY['pierogi', 'polska', 'domowa'],
 'Miejsce z ręcznie lepionymi pierogami w wielu odsłonach, domowa polska kuchnia w przystępnej cenie.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Trattoria Siesta Nuova', 'restaurant',
 'Wrocław', 51.1087, 17.0322, 4.6, 2,
 ARRAY['włoska', 'pasta', 'trattoria'],
 'Włoska trattoria z domową pastą, pizzą i klasykami kuchni śródziemnomorskiej w ciepłej atmosferze.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Orientuj Się - kuchnia azjatycka', 'restaurant',
 'Wrocław', 51.1083, 17.0314, 4.6, 2,
 ARRAY['azjatycka', 'fusion', 'street food'],
 'Restauracja z kuchnią azjatycką w nowoczesnym wydaniu, aromatyczne dania fusion i street food.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Wok in', 'restaurant',
 'Wrocław', 51.1091, 17.0320, 4.4, 1,
 ARRAY['azjatycka', 'wok', 'szybka'],
 'Bar z daniami z woka przyrządzanymi na bieżąco, szybka i aromatyczna kuchnia azjatycka.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Le Barometre Bistro & Cocktail Bar', 'restaurant',
 'Wrocław', 51.1100, 17.0335, 4.6, 3,
 ARRAY['bistro', 'koktajle', 'francuska'],
 'Bistro i cocktail bar z francuskim akcentem, autorskie drinki i eleganckie dania na wieczór.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Sushi Corner', 'restaurant',
 'Wrocław', 51.1094, 17.0328, 4.6, 2,
 ARRAY['sushi', 'japońska', 'ryby'],
 'Restauracja sushi ze świeżymi rybami i autentycznymi rolkami przyrządzanymi na miejscu.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Woosabi Włodkowica - Urban Oasis', 'restaurant',
 'ul. Włodkowica, Wrocław', 51.1081, 17.0272, 4.6, 2,
 ARRAY['azjatycka', 'ramen', 'Włodkowica'],
 'Azjatycka restauracja przy Włodkowica z ramenem, bao i daniami fusion w miejskiej oazie.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Charlotte. Chleb i Wino', 'restaurant',
 'Wrocław', 51.1096, 17.0311, 4.6, 2,
 ARRAY['bistro', 'wino', 'francuska'],
 'Piekarnio-bistro w francuskim stylu z chlebem, winem i śniadaniami przez cały dzień.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Burger Ltd', 'restaurant',
 'Wrocław', 51.1090, 17.0316, 4.6, 2,
 ARRAY['burgery', 'rzemieślnicze', 'street food'],
 'Rzemieślnicze burgery z wysokiej jakości mięsem i autorskimi sosami, burger bar z charakterem.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Piec Na Szewskiej', 'restaurant',
 'ul. Szewska, Wrocław', 51.1105, 17.0328, 4.5, 2,
 ARRAY['pizza', 'włoska', 'Szewska'],
 'Pizzeria przy ul. Szewskiej z pizzą z pieca i włoskim menu w centrum miasta.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Peruwiana', 'restaurant',
 'Wrocław', 51.1087, 17.0320, 4.6, 3,
 ARRAY['peruwiańska', 'ceviche', 'egzotyczna'],
 'Restauracja z kuchnią peruwiańską, ceviche i egzotyczne smaki Ameryki Południowej.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Oliwa i Ogień', 'restaurant',
 'ul. Oławska, Wrocław', 51.1093, 17.0335, 4.6, 3,
 ARRAY['grill', 'śródziemnomorska', 'nowoczesna'],
 'Restauracja z kuchnią z ognia i śródziemnomorskimi smakami, mięsa i ryby z grilla w nowoczesnym wydaniu.',
 ARRAY['evening']),

-- ── BARY ─────────────────────────────────────────────────────────────────────

('Wrocław', 'XIII Igieł', 'bar',
 'Wrocław', 51.1099, 17.0330, 4.6, 2,
 ARRAY['koktajle', 'klimatyczny', 'kultowy'],
 'Kultowy bar koktajlowy z autorskimi drinkami i klimatycznym wnętrzem, miejsce dla wtajemniczonych.',
 ARRAY['evening']),

('Wrocław', 'Schody Donikąd', 'bar',
 'Wrocław', 51.1102, 17.0338, 4.6, 2,
 ARRAY['koktajle', 'alternatywny', 'klimatyczny'],
 'Alternatywny bar z autorskimi koktajlami i niebanalną atmosferą, ukryte miejsce z charakterem.',
 ARRAY['evening']),

('Wrocław', 'Nietota', 'bar',
 'Wrocław', 51.1104, 17.0334, 4.6, 2,
 ARRAY['klub', 'muzyka', 'alternatywny'],
 'Klimatyczny bar i klub z muzyką na żywo i alternatywną publicznością, tętniące życiem miejsce nocą.',
 ARRAY['evening']),

('Wrocław', 'Pinta', 'bar',
 'Wrocław', 51.1097, 17.0326, 4.6, 2,
 ARRAY['craft beer', 'multitap', 'piwo'],
 'Multitap z piwem kraftowym z lokalnych i zagranicznych browarów, kilkanaście kranów do wyboru.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Vertigo Jazz Club & Restaurant', 'bar',
 'ul. Oławska 13, Wrocław', 51.1094, 17.0332, 4.6, 3,
 ARRAY['jazz', 'muzyka na żywo', 'koktajle'],
 'Jazz club i restauracja z koncertami na żywo, koktajle i kolacja w eleganckiej, muzycznej oprawie.',
 ARRAY['evening']),

('Wrocław', 'Przedwojenna', 'bar',
 'Wrocław', 51.1101, 17.0328, 4.6, 2,
 ARRAY['retro', 'nalewki', 'przedwojenny'],
 'Bar w przedwojennym klimacie z nalewkami i klasycznymi trunkami, podróż do dawnego Wrocławia.',
 ARRAY['evening']),

('Wrocław', 'SETKA - Restauracja Polska', 'bar',
 'Wrocław', 51.1098, 17.0322, 4.5, 2,
 ARRAY['wódka', 'polska', 'nalewki'],
 'Bar i restauracja z polskimi trunkami, nalewkami i klasyczną kuchnią w swojskim klimacie.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Św. Jan - pub regionalny', 'bar',
 'Wrocław', 51.1106, 17.0336, 4.6, 2,
 ARRAY['pub', 'piwo', 'regionalny'],
 'Regionalny pub z lokalnym piwem i swojską atmosferą, dobre miejsce na wieczór z przyjaciółmi.',
 ARRAY['evening']),

('Wrocław', 'Papa Bar Cocktail Bar & Food', 'bar',
 'Wrocław', 51.1092, 17.0324, 4.6, 2,
 ARRAY['koktajle', 'food', 'klimatyczny'],
 'Cocktail bar z autorskimi drinkami i dobrym jedzeniem, klimatyczne miejsce na wieczór w mieście.',
 ARRAY['evening']),

-- ── MUZEA I GALERIE ──────────────────────────────────────────────────────────

('Wrocław', 'MOYA Galeria', 'gallery',
 'Wrocław', 51.1100, 17.0340, 4.6, 1,
 ARRAY['galeria', 'sztuka', 'wystawy'],
 'Galeria sztuki z wystawami współczesnych artystów, kameralna przestrzeń dla miłośników sztuki.',
 ARRAY['afternoon']),

('Wrocław', 'Panorama Racławicka', 'museum',
 'ul. Purkyniego 11, Wrocław', 51.1103, 17.0455, 4.8, 2,
 ARRAY['panorama', 'historia', 'malarstwo'],
 'Monumentalne malowidło panoramiczne bitwy pod Racławicami, jedna z największych atrakcji Wrocławia.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Kolejkowo Wrocław', 'museum',
 'Sky Tower, Wrocław', 51.0942, 17.0198, 4.7, 2,
 ARRAY['makieta', 'kolejki', 'rodzinne'],
 'Interaktywna makieta kolejowa z miniaturowym światem w ruchu, atrakcja dla całej rodziny.',
 ARRAY['afternoon']),

('Wrocław', 'Hydropolis', 'museum',
 'ul. Na Grobli 17, Wrocław', 51.1031, 17.0640, 4.7, 3,
 ARRAY['woda', 'interaktywne', 'nauka'],
 'Nowoczesne centrum wiedzy o wodzie z interaktywnymi ekspozycjami, jedno z najciekawszych muzeów miasta.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Muzeum Uniwersytetu Wrocławskiego', 'museum',
 'pl. Uniwersytecki 1, Wrocław', 51.1141, 17.0388, 4.7, 1,
 ARRAY['Aula Leopoldina', 'historia', 'barok'],
 'Muzeum w gmachu uniwersytetu z barokową Aulą Leopoldina i Wieżą Matematyczną, perła architektury.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Muzeum Gry i Komputery Minionej Ery', 'museum',
 'Wrocław', 51.1088, 17.0290, 4.7, 2,
 ARRAY['retro', 'komputery', 'gry'],
 'Muzeum retro komputerów i gier z możliwością grania w kultowe tytuły z minionych lat.',
 ARRAY['afternoon']),

('Wrocław', 'Muzeum Narodowe we Wrocławiu', 'museum',
 'pl. Powstańców Warszawy 5, Wrocław', 51.1108, 17.0447, 4.6, 2,
 ARRAY['sztuka', 'kolekcja', 'malarstwo'],
 'Jedno z głównych muzeów sztuki w Polsce z bogatą kolekcją malarstwa, rzeźby i sztuki użytkowej.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Muzeum Iluzji Wrocław', 'museum',
 'Wrocław', 51.1097, 17.0315, 4.5, 2,
 ARRAY['iluzje', 'interaktywne', 'zdjęcia'],
 'Interaktywne muzeum iluzji optycznych, idealne na zabawną sesję zdjęciową pełną niespodzianek.',
 ARRAY['afternoon']),

('Wrocław', 'Muzeum Miejskie Wrocławia', 'museum',
 'Stary Ratusz, Rynek, Wrocław', 51.1097, 17.0312, 4.6, 2,
 ARRAY['Rynek', 'historia miasta', 'Ratusz'],
 'Muzeum historii Wrocławia w zabytkowym Ratuszu, opowieść o dziejach miasta na przestrzeni wieków.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'MovieGate', 'museum',
 'Wrocław', 51.1090, 17.0300, 4.6, 2,
 ARRAY['film', 'interaktywne', 'kino'],
 'Interaktywne muzeum filmu z rekwizytami i scenografiami, wejście za kulisy kina.',
 ARRAY['afternoon']),

('Wrocław', 'Pawilon Czterech Kopuł - Muzeum Sztuki Współczesnej', 'museum',
 'ul. Wystawowa 1, Wrocław', 51.1058, 17.0790, 4.6, 2,
 ARRAY['sztuka współczesna', 'architektura', 'wystawy'],
 'Muzeum sztuki współczesnej w modernistycznym Pawilonie Czterech Kopuł przy Hali Stulecia.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Muzeum Motoryzacji i Techniki Zamek Topacz', 'museum',
 'Ślęza k. Wrocławia', 51.0250, 16.9200, 4.6, 2,
 ARRAY['motoryzacja', 'zabytkowe auta', 'technika'],
 'Muzeum zabytkowej motoryzacji przy Zamku Topacz z kolekcją klasycznych aut i motocykli.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Muzeum Pana Tadeusza', 'museum',
 'Rynek 6, Wrocław', 51.1101, 17.0290, 4.7, 2,
 ARRAY['literatura', 'interaktywne', 'Rynek'],
 'Nowoczesne muzeum literackie wokół rękopisu Pana Tadeusza, multimedialna opowieść przy Rynku.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Galeria Neon Side', 'gallery',
 'ul. Ruska 46, Wrocław', 51.1102, 17.0270, 4.6, 1,
 ARRAY['neony', 'street art', 'Instagram'],
 'Podwórko pełne zabytkowych neonów i street artu, klimatyczne miejsce na spacer i zdjęcia.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Studio BWA Wrocław', 'gallery',
 'Wrocław', 51.1099, 17.0305, 4.5, 1,
 ARRAY['galeria', 'sztuka współczesna', 'wystawy'],
 'Galeria sztuki współczesnej z wystawami i wydarzeniami artystycznymi w centrum miasta.',
 ARRAY['afternoon']),

-- ── PARKI ────────────────────────────────────────────────────────────────────

('Wrocław', 'Ogród Botaniczny Uniwersytetu Wrocławskiego', 'park',
 'ul. Sienkiewicza 23, Wrocław', 51.1150, 17.0470, 4.8, 1,
 ARRAY['ogród', 'natura', 'rośliny'],
 'Zabytkowy ogród botaniczny z bogatą kolekcją roślin, oaza zieleni na Ostrowie Tumskim.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Ogród Japoński', 'park',
 'Park Szczytnicki, Wrocław', 51.1052, 17.0800, 4.7, 1,
 ARRAY['japoński', 'ogród', 'relaks'],
 'Urokliwy ogród japoński w Parku Szczytnickim ze stawami i mostkami, spokojne miejsce na spacer.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Park Południowy', 'park',
 'Wrocław', 51.0870, 17.0200, 4.7, 1,
 ARRAY['park', 'natura', 'spacer'],
 'Zabytkowy park w stylu angielskim ze stawem i alejami, ulubione miejsce na spacer i odpoczynek.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Ogród Barokowy Ossolineum', 'park',
 'ul. Szewska 37, Wrocław', 51.1120, 17.0398, 4.7, 1,
 ARRAY['barokowy', 'ogród', 'kameralny'],
 'Kameralny ogród barokowy przy Zakładzie Ossolińskich, spokojny zakątek zieleni w centrum.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Park Mikołaja Kopernika', 'park',
 'Wrocław', 51.1088, 17.0480, 4.6, 1,
 ARRAY['park', 'spacer', 'natura'],
 'Park nad fosą miejską z alejami i zielenią, przyjemne miejsce na spacer blisko centrum.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Park Brochowski', 'park',
 'Brochów, Wrocław', 51.0700, 17.1200, 4.5, 1,
 ARRAY['park', 'lokalny', 'spacer'],
 'Lokalny park na Brochowie z zielenią i placem zabaw, spokojne miejsce z dala od zgiełku.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Park Juliusza Słowackiego', 'park',
 'Wrocław', 51.1105, 17.0450, 4.6, 1,
 ARRAY['park', 'centrum', 'spacer'],
 'Park w centrum miasta nad fosą, blisko Muzeum Narodowego i Panoramy Racławickiej.',
 ARRAY['morning', 'afternoon', 'evening']),

-- ── MARKETY ──────────────────────────────────────────────────────────────────

('Wrocław', 'Hala Targowa', 'market',
 'ul. Piaskowa 17, Wrocław', 51.1128, 17.0432, 4.6, 1,
 ARRAY['targ', 'zabytkowa', 'lokalne'],
 'Zabytkowa hala targowa z lokalnymi produktami, świeżymi warzywami, serami i regionalnymi smakołykami.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Targowisko MŁYN', 'market',
 'Wrocław', 51.1000, 17.0100, 4.5, 1,
 ARRAY['targ', 'lokalne', 'świeże'],
 'Lokalne targowisko ze świeżymi produktami od rolników i wytwórców, prosto do koszyka.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Wrocławski Bazar Smakoszy', 'market',
 'Wrocław', 51.1085, 17.0280, 4.6, 2,
 ARRAY['food market', 'lokalne', 'smakołyki'],
 'Bazar dla smakoszy z lokalnymi i rzemieślniczymi produktami, sery, wędliny i specjały regionalne.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Piecownia', 'market',
 'Wrocław', 51.1095, 17.0295, 4.6, 2,
 ARRAY['food hall', 'street food', 'piwo'],
 'Miejsce z dobrym jedzeniem i piwem w klimacie food hallu, street food i lokalne przekąski.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Folkstar Wrocław', 'market',
 'Wrocław', 51.1098, 17.0300, 4.6, 2,
 ARRAY['folk', 'design', 'lokalne'],
 'Sklep i przestrzeń z polskim designem oraz folkowymi produktami od lokalnych twórców.',
 ARRAY['afternoon']),

-- ── LANDMARKI ────────────────────────────────────────────────────────────────

('Wrocław', 'Fontanna Multimedialna', 'monument',
 'Pergola, ul. Wystawowa 1, Wrocław', 51.1065, 17.0785, 4.7, 1,
 ARRAY['fontanna', 'pokazy', 'Pergola'],
 'Multimedialna fontanna przy Hali Stulecia z pokazami wody, świateł i muzyki, efektowna atrakcja wieczorem.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Wrocławski Ratusz', 'monument',
 'Rynek, Wrocław', 51.1097, 17.0313, 4.8, 1,
 ARRAY['Rynek', 'gotyk', 'zabytek'],
 'Gotycki Ratusz na Rynku, jeden z najpiękniejszych w Europie i symbol Wrocławia.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Katedra św. Jana Chrzciciela', 'monument',
 'Ostrów Tumski, Wrocław', 51.1140, 17.0465, 4.7, 1,
 ARRAY['katedra', 'Ostrów Tumski', 'gotyk'],
 'Gotycka katedra na Ostrowie Tumskim z wieżą widokową, serce najstarszej części Wrocławia.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Uniwersytet Wrocławski', 'monument',
 'pl. Uniwersytecki 1, Wrocław', 51.1141, 17.0390, 4.7, 1,
 ARRAY['barok', 'architektura', 'zabytek'],
 'Barokowy gmach główny uniwersytetu z Aulą Leopoldina, jedna z wizytówek architektonicznych miasta.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Pomnik Anonimowego Przechodnia', 'monument',
 'ul. Piłsudskiego / Świdnicka, Wrocław', 51.1055, 17.0290, 4.7, 1,
 ARRAY['pomnik', 'sztuka', 'symbol'],
 'Wymowna instalacja figur znikających i wyłaniających się z chodnika, jeden z symboli Wrocławia.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Most Tumski', 'monument',
 'Ostrów Tumski, Wrocław', 51.1128, 17.0455, 4.7, 1,
 ARRAY['most', 'kłódki', 'Ostrów Tumski'],
 'Zabytkowy Most Tumski zwany mostem zakochanych, romantyczne miejsce z kłódkami miłości.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Hala Stulecia', 'monument',
 'ul. Wystawowa 1, Wrocław', 51.1069, 17.0772, 4.7, 1,
 ARRAY['UNESCO', 'architektura', 'zabytek'],
 'Modernistyczna Hala Stulecia wpisana na listę UNESCO, ikona architektury i miejsce wydarzeń.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Taras Widokowy Sky Tower', 'viewpoint',
 'ul. Powstańców Śląskich 95, Wrocław', 51.0940, 17.0197, 4.6, 2,
 ARRAY['widok', 'panorama', 'wieżowiec'],
 'Taras widokowy na 49. piętrze Sky Tower z panoramą całego Wrocławia i okolic.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Katedra św. Marii Magdaleny', 'monument',
 'ul. Szewska, Wrocław', 51.1094, 17.0347, 4.6, 1,
 ARRAY['katedra', 'gotyk', 'Mostek Pokutnic'],
 'Gotycka katedra z Mostkiem Pokutnic łączącym wieże, punkt widokowy w centrum miasta.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Mostek Pokutnic', 'viewpoint',
 'Katedra św. Marii Magdaleny, Wrocław', 51.1094, 17.0348, 4.6, 2,
 ARRAY['widok', 'panorama', 'legenda'],
 'Mostek widokowy między wieżami Katedry św. Marii Magdaleny z panoramą Rynku i owianą legendą historią.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Bazylika św. Elżbiety Węgierskiej', 'monument',
 'ul. św. Elżbiety 1, Wrocław', 51.1104, 17.0296, 4.7, 1,
 ARRAY['bazylika', 'wieża widokowa', 'gotyk'],
 'Gotycka bazylika przy Rynku z najwyższą wieżą widokową w mieście i wspaniałą panoramą Wrocławia.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Stary Cmentarz Żydowski (Muzeum Sztuki Cmentarnej)', 'monument',
 'ul. Ślężna 37/39, Wrocław', 51.0930, 17.0230, 4.7, 1,
 ARRAY['cmentarz', 'historia', 'zabytek'],
 'Zabytkowy cmentarz żydowski jako muzeum sztuki cmentarnej, klimatyczne i pełne historii miejsce.',
 ARRAY['morning', 'afternoon']),

('Wrocław', 'Rzeźba Pociąg do nieba', 'monument',
 'ul. Paczkowska, Wrocław', 51.0850, 17.0500, 4.6, 1,
 ARRAY['rzeźba', 'sztuka', 'symbol'],
 'Efektowna rzeźba lokomotywy wznoszącej się pionowo w niebo, nietuzinkowy punkt na mapie miasta.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Iglica', 'monument',
 'Pergola, ul. Wystawowa, Wrocław', 51.1070, 17.0760, 4.5, 1,
 ARRAY['iglica', 'Hala Stulecia', 'symbol'],
 'Charakterystyczna stalowa Iglica przy Hali Stulecia, jeden z symboli powojennego Wrocławia.',
 ARRAY['morning', 'afternoon', 'evening']),

('Wrocław', 'Bastion Sakwowy', 'viewpoint',
 'Wzgórze Polskie, Wrocław', 51.1120, 17.0410, 4.5, 1,
 ARRAY['wzgórze', 'widok', 'spacer'],
 'Wzniesienie na dawnych fortyfikacjach z widokiem na centrum, spokojne miejsce na spacer i odpoczynek.',
 ARRAY['afternoon', 'evening']),

-- ── ROZRYWKA ─────────────────────────────────────────────────────────────────

('Wrocław', '7siekier - Axe Throwing Club', 'experience',
 'Wrocław', 51.1085, 17.0295, 4.8, 2,
 ARRAY['rzucanie siekierą', 'aktywność', 'grupowe'],
 'Klub rzucania siekierą, adrenalina i zabawa w grupie, świetne miejsce na wieczór ze znajomymi.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Pixel XL', 'experience',
 'Wrocław', 51.1092, 17.0308, 4.7, 2,
 ARRAY['gry', 'arcade', 'retro'],
 'Salon gier arcade i retro automatów, rozrywka dla graczy w każdym wieku.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Kwatera Główna Centrum Laser Tag', 'experience',
 'Wrocław', 51.1080, 17.0290, 4.7, 2,
 ARRAY['laser tag', 'aktywność', 'grupowe'],
 'Centrum laser tag z emocjonującą rozgrywką w grupie, świetna zabawa dla znajomych i rodzin.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'EXIT19.PL', 'experience',
 'Wrocław', 51.1096, 17.0300, 4.8, 2,
 ARRAY['escape room', 'zagadki', 'grupowe'],
 'Escape roomy z wciągającymi scenariuszami i zagadkami, godzina emocji dla drużyny.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Let Me Out Escape Room', 'experience',
 'Wrocław', 51.1099, 17.0304, 4.8, 2,
 ARRAY['escape room', 'zagadki', 'grupowe'],
 'Escape roomy z klimatycznymi pokojami i pomysłowymi zagadkami, wyzwanie dla całej ekipy.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Apex One', 'experience',
 'Wrocław', 51.1088, 17.0298, 4.7, 2,
 ARRAY['VR', 'gry', 'nowoczesne'],
 'Centrum rozrywki z wirtualną rzeczywistością i nowoczesnymi grami, immersyjna zabawa dla grup.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Quiz Game Wrocław - Teleturniej na żywo', 'experience',
 'Wrocław', 51.1094, 17.0302, 4.8, 2,
 ARRAY['quiz', 'teleturniej', 'grupowe'],
 'Teleturniej na żywo w formie interaktywnego quizu, zabawa i rywalizacja dla drużyn.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Gamestate Wroclavia', 'experience',
 'Wroclavia, ul. Sucha 1, Wrocław', 51.0970, 17.0360, 4.6, 2,
 ARRAY['arcade', 'gry', 'rodzinne'],
 'Duży salon gier arcade w centrum handlowym Wroclavia, rozrywka dla rodzin i grup znajomych.',
 ARRAY['afternoon', 'evening']),

('Wrocław', 'Bobolandia', 'experience',
 'Wrocław', 51.1000, 17.0400, 4.5, 2,
 ARRAY['dzieci', 'plac zabaw', 'rodzinne'],
 'Sala zabaw dla dzieci z atrakcjami i placem zabaw, idealne miejsce na rodzinne wyjście.',
 ARRAY['morning', 'afternoon']);

-- ── Taxonomy: primary_category + subcategory dla Wrocławia ───────────────────
-- (nowe rekordy wstawione po globalnej migracji taksonomii 20260417 - ustawiamy ręcznie)

UPDATE public.places SET primary_category = CASE category
  WHEN 'restaurant' THEN 'food'
  WHEN 'cafe'       THEN 'food'
  WHEN 'bar'        THEN 'food'
  WHEN 'market'     THEN 'food'
  WHEN 'museum'     THEN 'culture'
  WHEN 'gallery'    THEN 'culture'
  WHEN 'monument'   THEN 'culture'
  WHEN 'church'     THEN 'culture'
  WHEN 'park'       THEN 'outdoor'
  WHEN 'viewpoint'  THEN 'outdoor'
  WHEN 'club'       THEN 'entertainment'
  WHEN 'shopping'   THEN 'shopping'
  WHEN 'experience' THEN 'entertainment'
  ELSE 'other'
END
WHERE city = 'Wrocław';

UPDATE public.places SET subcategory = CASE category
  WHEN 'restaurant' THEN 'restaurant'
  WHEN 'cafe'       THEN 'cafe'
  WHEN 'bar'        THEN 'bar'
  WHEN 'market'     THEN 'market'
  WHEN 'museum'     THEN 'museum'
  WHEN 'gallery'    THEN 'gallery'
  WHEN 'monument'   THEN 'monument'
  WHEN 'church'     THEN 'church'
  WHEN 'park'       THEN 'park'
  WHEN 'viewpoint'  THEN 'viewpoint'
  WHEN 'club'       THEN 'club'
  WHEN 'shopping'   THEN 'mall'
  WHEN 'experience' THEN 'activity'
  ELSE category
END
WHERE city = 'Wrocław';

-- Subcategory overrides (piekarnie / cukiernie / lodziarnie)
UPDATE public.places SET subcategory = 'bakery'
WHERE city = 'Wrocław' AND (place_name ILIKE '%piekarnia%' OR place_name ILIKE '%bakery%' OR place_name ILIKE '%bakeMAnia%');

UPDATE public.places SET subcategory = 'pastry'
WHERE city = 'Wrocław' AND place_name IN (
  'Fokies / Smochi', 'Cukiernia NANAN', 'Gorąca Pączkarnia F-Wiatrak',
  'Mae''s Cookies', 'Creme de la creme', 'Czekoladziarnia',
  'Słodki chłopak - Pracownia cukiernicza i kawiarnia'
);

UPDATE public.places SET subcategory = 'icecream'
WHERE city = 'Wrocław' AND place_name IN ('Lodo Vibe Lody Rzemieślnicze', 'Lody Baroli');
