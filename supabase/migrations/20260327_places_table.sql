-- Migration: create public.places table with Kraków seed data
-- 2026-03-27

CREATE TABLE public.places (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  city        TEXT        NOT NULL,
  place_name  TEXT        NOT NULL,
  category    TEXT        NOT NULL,  -- cafe, restaurant, bar, museum, monument, park, viewpoint, shopping, experience
  address     TEXT,
  latitude    FLOAT,
  longitude   FLOAT,
  rating      FLOAT,
  price_level INT,                   -- 1-4
  photo_url   TEXT,
  vibe_tags   TEXT[]      DEFAULT '{}',
  description TEXT,
  best_time   TEXT[]      DEFAULT '{}',  -- morning, afternoon, evening
  is_active   BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active places"
  ON public.places
  FOR SELECT
  USING (is_active = true);

-- Index
CREATE INDEX places_city_category_idx ON public.places (city, category);

-- ============================================================
-- SEED DATA: Kraków
-- ============================================================

INSERT INTO public.places (city, place_name, category, address, latitude, longitude, rating, price_level, vibe_tags, description, best_time) VALUES

-- ── CAFES ────────────────────────────────────────────────────

('Kraków', 'SUNJA', 'cafe',
 'ul. Józefa 14, Kraków', 50.0530, 19.9440, 4.6, 2,
 ARRAY['specialty coffee', 'klimatyczna', 'hipsterska'],
 'Klimatyczna kawiarnia specialty w sercu Kazimierza z wyjątkową kawą i spokojną atmosferą.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Nefes Cafe', 'cafe',
 'ul. Dietla 19, Kraków', 50.0527, 19.9460, 4.5, 2,
 ARRAY['specialty coffee', 'przytulna', 'slow'],
 'Urokliwa kawiarnia przy Dietla serwująca świetną kawę z dbałością o każdy szczegół.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'KRUSZ', 'cafe',
 'ul. Starowiślna 13, Kraków', 50.0560, 19.9460, 4.7, 2,
 ARRAY['specialty coffee', 'minimalistyczna', 'modna'],
 'Minimalistyczna kawiarnia specialty ceniona za precyzję parzenia i spokojne wnętrze.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Fable Cafe', 'cafe',
 'ul. Józefa 25, Kraków', 50.0518, 19.9430, 4.6, 2,
 ARRAY['specialty coffee', 'śniadania', 'instagramowa'],
 'Urocza kawiarnia specialty na Kazimierzu z pysznym śniadaniem i aromatyczną kawą.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Przełom – Listening Cafe Bar', 'cafe',
 'ul. Meiselsa 7, Kraków', 50.0510, 19.9438, 4.5, 2,
 ARRAY['muzyka', 'winylem', 'klimatyczna'],
 'Kawiarnia-bar, gdzie przy kawie słuchasz muzyki z analogowych winyli w wyjątkowym nastroju.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Cuda Niewidy', 'cafe',
 'ul. Bracka 9, Kraków', 50.0600, 19.9380, 4.4, 2,
 ARRAY['przytulna', 'retro', 'domowa'],
 'Przytulna kawiarnia ze starymi meblami i ciepłą atmosferą, idealna na popołudniową przerwę.',
 ARRAY['morning', 'afternoon']),

-- ── RESTAURANTS ──────────────────────────────────────────────

('Kraków', 'Unity Eye', 'restaurant',
 'ul. Lubicz 17, Kraków', 50.0647, 19.9470, 4.5, 4,
 ARRAY['sky bar', 'widokowa', 'ekskluzywna'],
 'Restauracja na najwyższym piętrze z panoramicznym widokiem na Kraków i wyrafinowaną kuchnią.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Zorza – Breakfast & Cafe', 'restaurant',
 'ul. Dietla 28, Kraków', 50.0530, 19.9450, 4.6, 2,
 ARRAY['śniadania', 'kawiarnia', 'codzienna'],
 'Jasna, nowoczesna restauracja śniadaniowa z kremową kawą i pysznym brunsem przez cały dzień.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Indian Indus Tandoor', 'restaurant',
 'ul. Grodzka 43, Kraków', 50.0575, 19.9390, 4.5, 2,
 ARRAY['indyjska', 'pikantna', 'egzotyczna'],
 'Autentyczna restauracja indyjska z tandoor i aromatycznymi curry w samym centrum Krakowa.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Polenez Kebab & Turecka Restauracja', 'restaurant',
 'ul. Starowiślna 39, Kraków', 50.0514, 19.9458, 4.4, 1,
 ARRAY['kebab', 'turecka', 'street food'],
 'Kultowy lokal z autentycznym kebabem i potrawami kuchni tureckiej w przystępnych cenach.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Miyama Sushi', 'restaurant',
 'ul. Sławkowska 14, Kraków', 50.0630, 19.9370, 4.5, 3,
 ARRAY['sushi', 'japońska', 'świeże'],
 'Elegancka restauracja sushi z fresh rybami i japońską estetyką w centrum Krakowa.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Otto Pompieri', 'restaurant',
 'ul. Starowiślna 21, Kraków', 50.0525, 19.9456, 4.6, 3,
 ARRAY['włoska', 'pizza', 'romantyczna'],
 'Włoska tratoria z chrupiącą pizzą na cienkim cieście i domowym makaronem.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Halicka Eatery & Bar', 'restaurant',
 'ul. Halicka 9, Kraków', 50.0498, 19.9440, 4.6, 3,
 ARRAY['nowoczesna', 'fusion', 'klimatyczna'],
 'Nowoczesna restauracja na Kazimierzu łącząca lokalne składniki z kuchnią śródziemnomorską.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Qrudo Food & Wine', 'restaurant',
 'ul. Józefa 12, Kraków', 50.0525, 19.9435, 4.7, 3,
 ARRAY['wino', 'premium', 'romantyczna'],
 'Kameralna restauracja z starannie dobranymi winami i kuchnią opartą na sezonowych produktach.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'Emalia Zabłocie', 'restaurant',
 'ul. Lipowa 4, Kraków', 50.0440, 19.9530, 4.5, 2,
 ARRAY['industrialna', 'śniadania', 'hipsterska'],
 'Restauracja w dawnej fabryce na Zabłociu – świetne śniadania i lunche w industrialnym wnętrzu.',
 ARRAY['morning', 'afternoon']),

-- ── CAFE (ŚNIADANIA) ─────────────────────────────────────────

('Kraków', 'Eggzystencja', 'cafe',
 'ul. Starowiślna 42, Kraków', 50.0515, 19.9455, 4.7, 2,
 ARRAY['śniadania', 'eko', 'specialty coffee'],
 'Kultowe miejsce na Kazimierzu słynące z ekologicznych jaj i kreatywnych śniadań.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Las Kraków Breakfast & Prosecco', 'cafe',
 'ul. Bracka 4, Kraków', 50.0605, 19.9378, 4.6, 2,
 ARRAY['śniadania', 'prosecco', 'brunch'],
 'Jasna kawiarnia ze śniadaniami przez cały dzień i opcją brunsowego prosecco na poranną okazję.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Camelot Cafe', 'cafe',
 'ul. Świętego Tomasza 17, Kraków', 50.0623, 19.9380, 4.5, 2,
 ARRAY['śniadania', 'retro', 'przytulna'],
 'Jedna z najstarszych kawiarni Krakowa – ciepła atmosfera, dobra kawa i domowe wypieki.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Poranki – Breakfast, Coffee & Cake', 'cafe',
 'ul. Józefińska 10, Kraków', 50.0488, 19.9428, 4.6, 2,
 ARRAY['śniadania', 'ciasta', 'spokój'],
 'Przytulna kawiarnia śniadaniowa na Kazimierzu z domowymi ciastami i odprężającą atmosferą.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Zmęczeni', 'cafe',
 'ul. Dietla 15, Kraków', 50.0529, 19.9462, 4.4, 1,
 ARRAY['śniadania', 'casualowa', 'tania'],
 'Nieformalna kawiarnia śniadaniowa, gdzie można się zatrzymać i nabrać sił na dalszy dzień.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Breaking Bread – Kalwaryjska', 'cafe',
 'ul. Kalwaryjska 9, Kraków', 50.0470, 19.9420, 4.6, 2,
 ARRAY['śniadania', 'pieczywo', 'rzemieślnicza'],
 'Rzemieślnicza piekarnia-kawiarnia z wyjątkowym pieczywem na zakwasie i pysznym śniadaniem.',
 ARRAY['morning', 'afternoon']),

-- ── BARS ─────────────────────────────────────────────────────

('Kraków', 'Soul Resto Bar', 'bar',
 'ul. Józefa 8, Kraków', 50.0524, 19.9432, 4.5, 2,
 ARRAY['koktajle', 'muzyka', 'klimatyczna'],
 'Klimatyczny bar z duszą na Kazimierzu, świetne koktajle i żywa muzyka w weekendy.',
 ARRAY['evening']),

('Kraków', 'RUMOUR Cocktail Bar', 'bar',
 'ul. Sławkowska 19, Kraków', 50.0627, 19.9372, 4.7, 3,
 ARRAY['koktajle', 'premium', 'speakeasy'],
 'Ukryty bar koktajlowy z precyzyjnie komponowanymi drinkami i tajemniczą atmosferą speakeasy.',
 ARRAY['evening']),

('Kraków', 'Forum Panorama', 'bar',
 'ul. Marii Konopnickiej 28, Kraków', 50.0518, 19.9280, 4.4, 2,
 ARRAY['widokowa', 'Wisła', 'letnia'],
 'Barowy raj na tarasie Hotelu Forum z panoramicznym widokiem na Wawel i Wisłę.',
 ARRAY['afternoon', 'evening']),

('Kraków', 'HEVRE', 'bar',
 'ul. Meiselsa 18, Kraków', 50.0508, 19.9436, 4.5, 2,
 ARRAY['kulturalna', 'żydowska', 'klimatyczna'],
 'Bar i centrum kultury w dawnej synagodze na Kazimierzu, tętniące życiem każdego wieczoru.',
 ARRAY['evening']),

('Kraków', 'Pełnia Social Club', 'bar',
 'ul. Brzozowa 7, Kraków', 50.0505, 19.9450, 4.5, 2,
 ARRAY['alternatywna', 'muzyka', 'lokalna'],
 'Niezależny klub społeczny z wyjątkową selekcją piw i alternatywną muzyką na żywo.',
 ARRAY['evening']),

-- ── MUSEUMS ──────────────────────────────────────────────────

('Kraków', 'Wheels & Heels Museum', 'museum',
 'ul. Wielicka 68, Kraków', 50.0380, 19.9610, 4.6, 2,
 ARRAY['moda', 'buty', 'unikatowe'],
 'Jedyne w swoim rodzaju muzeum historii butów i kółek – fascynujące dla miłośników mody.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Muzeum Książąt Czartoryskich', 'museum',
 'ul. Świętego Jana 19, Kraków', 50.0635, 19.9377, 4.7, 2,
 ARRAY['sztuka', 'historia', 'Da Vinci'],
 'Muzeum skrywające "Damę z gronostajem" Leonarda da Vinci – jeden z największych skarbów Krakowa.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Zamek Królewski na Wawelu', 'museum',
 'Wawel 5, Kraków', 50.0541, 19.9355, 4.8, 2,
 ARRAY['zamek', 'historia', 'ikona'],
 'Symboliczny zamek królewski na wzgórzu wawelskim – serce polskiej historii i kultury.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Fabryka Emalia Oskara Schindlera', 'museum',
 'ul. Lipowa 4, Kraków', 50.0444, 19.9530, 4.8, 2,
 ARRAY['II wojna', 'historia', 'wzruszające'],
 'Poruszające muzeum w dawnej fabryce Schindlera opowiadające historię Krakowa podczas II wojny światowej.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Stara Synagoga', 'museum',
 'ul. Szeroka 24, Kraków', 50.0512, 19.9448, 4.6, 1,
 ARRAY['żydowska', 'historia', 'Kazimierz'],
 'Najstarsza zachowana synagoga w Polsce, dziś muzeum kultury i historii żydowskiej.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Muzeum Archeologiczne w Krakowie', 'museum',
 'ul. Senacka 3, Kraków', 50.0594, 19.9357, 4.5, 1,
 ARRAY['archeologia', 'prehistoria', 'Świętosław'],
 'Muzeum prezentujące wykopaliska z Małopolski, od pradziejów po średniowiecze.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Rynek Podziemny', 'museum',
 'Rynek Główny 1, Kraków', 50.0619, 19.9368, 4.7, 2,
 ARRAY['podziemia', 'średniowiecze', 'multimedialne'],
 'Multimedialne muzeum pod Rynkiem Głównym odkrywające średniowieczne życie dawnego Krakowa.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Muzeum Krakowa – Pałac Krzysztofory', 'museum',
 'Rynek Główny 35, Kraków', 50.0618, 19.9365, 4.5, 2,
 ARRAY['historia', 'sztuka', 'centrum'],
 'Oddział Muzeum Krakowa w zabytkowym pałacu z ekspozycją historii miasta.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Muzeum Inżynierii i Techniki', 'museum',
 'ul. Św. Wawrzyńca 15, Kraków', 50.0529, 19.9519, 4.7, 2,
 ARRAY['technika', 'dla dzieci', 'interaktywne'],
 'Fascynujące muzeum z historycznymi maszynami i interaktywnymi ekspozycjami dla całej rodziny.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'MuFo Rakowicka – Muzeum Fotografii', 'museum',
 'ul. Rakowicka 22a, Kraków', 50.0668, 19.9470, 4.6, 1,
 ARRAY['fotografia', 'sztuka', 'wystawy'],
 'Muzeum fotografii prezentujące zarówno historyczne archiwum, jak i współczesne wystawy artystyczne.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Muzeum Lotnictwa Polskiego', 'museum',
 'al. Jana Pawła II 39, Kraków', 50.0690, 19.9740, 4.7, 2,
 ARRAY['lotnictwo', 'dla dzieci', 'historia'],
 'Jedno z największych muzeów lotnictwa w Europie z setkami historycznych samolotów na zewnątrz i wewnątrz.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Muzeum Sztuki i Techniki Japońskiej Manggha', 'museum',
 'ul. Marii Konopnickiej 26, Kraków', 50.0522, 19.9277, 4.7, 2,
 ARRAY['japońska', 'sztuka', 'Wisła'],
 'Muzeum japońskiej sztuki i techniki z widokiem na Wawel, projekt Aratę Isozaki.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'MOCAK – Muzeum Sztuki Współczesnej', 'museum',
 'ul. Lipowa 4, Kraków', 50.0445, 19.9528, 4.6, 2,
 ARRAY['sztuka współczesna', 'Zabłocie', 'wystawy'],
 'Krakowskie centrum sztuki współczesnej z odważnymi wystawami czasowymi i stałą kolekcją.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Be Happy Museum Kraków', 'museum',
 'ul. Grodzka 3, Kraków', 50.0612, 19.9378, 4.4, 2,
 ARRAY['interaktywne', 'zabawa', 'zdjęcia'],
 'Interaktywne muzeum szczęścia z kolorowymi instalacjami stworzonymi do wspólnej zabawy i selfie.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Bricks & Figs – Muzeum LEGO', 'museum',
 'ul. Starowiślna 14, Kraków', 50.0557, 19.9458, 4.6, 2,
 ARRAY['LEGO', 'dla dzieci', 'kreatywność'],
 'Muzeum pełne imponujących budowli z klocków LEGO – raj dla dzieci i dorosłych fanów marki.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Pracownia i Muzeum Witrażu', 'museum',
 'al. Krasińskiego 23, Kraków', 50.0589, 19.9274, 4.8, 2,
 ARRAY['witraże', 'rzemiosło', 'historia'],
 'Żywa pracownia z muzeum witrażu, gdzie można zobaczyć tworzenie kolorowych okien z bliska.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'WOMAI – Centrum Nauki i Zmysłów', 'museum',
 'ul. Szlak 10, Kraków', 50.0660, 19.9320, 4.5, 2,
 ARRAY['nauka', 'dla dzieci', 'zmysły'],
 'Interaktywne centrum nauki dla rodzin, gdzie dzieci eksplorują świat zmysłów i fizyki.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Muzeum Iluzji Kraków', 'museum',
 'Rynek Główny 28, Kraków', 50.0620, 19.9360, 4.4, 2,
 ARRAY['iluzje', 'zdjęcia', 'zabawa'],
 'Muzeum optycznych iluzji pełne sal z perspektywicznymi instalacjami – świetna zabawa z aparatem.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Krakow Pinball Museum', 'museum',
 'ul. Józefa 8, Kraków', 50.0524, 19.9435, 4.8, 2,
 ARRAY['pinball', 'gry', 'retro'],
 'Unikalne muzeum z działającymi automatami pinballowymi – graj tyle ile chcesz za jedną opłatą.',
 ARRAY['afternoon', 'evening']),

-- ── MONUMENTS ────────────────────────────────────────────────

('Kraków', 'Wieża Ratuszowa', 'monument',
 'Rynek Główny 1, Kraków', 50.0617, 19.9368, 4.5, 1,
 ARRAY['zabytek', 'widok', 'centrum'],
 'Gotycka wieża ratuszowa na Rynku Głównym z platformą widokową i muzeum historycznym.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Rydlówka', 'monument',
 'ul. Tetmajera 28, Kraków', 50.0570, 19.9100, 4.4, 1,
 ARRAY['literatura', 'Wyspiański', 'historia'],
 'Dworek, w którym odbył się słynny ślub inspirujący Stanisława Wyspiańskiego do napisania "Wesela".',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Biblioteka Uniwersytetu Ignatianum', 'monument',
 'ul. Kopernika 26, Kraków', 50.0621, 19.9440, 4.3, 1,
 ARRAY['architektura', 'nowoczesna', 'akademicka'],
 'Imponujący budynek biblioteki jezuickiego Ignatianum z nowoczesną architekturą i cennymi zbiorami.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Bazylika Mariacka', 'monument',
 'Plac Mariacki 5, Kraków', 50.0617, 19.9393, 4.8, 1,
 ARRAY['gotyk', 'ikona', 'hejnał'],
 'Gotycka bazylika z XIV-wiecznym ołtarzem Wita Stwosza i wieżą, z której co godzinę gra hejnał.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Katedra Wawelska', 'monument',
 'Wawel 3, Kraków', 50.0541, 19.9360, 4.8, 1,
 ARRAY['katedra', 'królowie', 'Wawel'],
 'Królewska katedra na Wawelu – miejsce koronacji i pochówku polskich królów przez wieki.',
 ARRAY['morning', 'afternoon']),

-- ── PARKS ────────────────────────────────────────────────────

('Kraków', 'Park Decjusza', 'park',
 'ul. 28 Lipca 1943 17a, Kraków', 50.0700, 19.8820, 4.6, 1,
 ARRAY['vila', 'zieleń', 'spacer'],
 'Malowniczy park przy renesansowej willi Decjusza na Woli Justowskiej, idealne miejsce na spacer.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Zalew Zesławice', 'park',
 'ul. Ptaszyckiego, Kraków', 50.1000, 20.0050, 4.5, 1,
 ARRAY['woda', 'kąpiel', 'przyroda'],
 'Zbiornik wodny na obrzeżach Krakowa z plażą, trasami rowerowymi i spokojną przyrodą.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Park kieszonkowy Ogród nad Sudołem', 'park',
 'ul. Sudół, Kraków', 50.0980, 19.9520, 4.3, 1,
 ARRAY['kieszonkowy', 'zieleń', 'spokój'],
 'Mały ogród kieszonkowy w dzielnicy Prądnik Biały – zielona oaza wśród miejskiej zabudowy.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Park Olsza nad Białuchą', 'park',
 'ul. Białucha, Kraków', 50.0870, 19.9640, 4.4, 1,
 ARRAY['rzeka', 'zieleń', 'spacer'],
 'Park wzdłuż potoku Białucha w dzielnicy Olsza – spokojne tereny zielone do codziennych spacerów.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Park przy Stawie Płaszowskim', 'park',
 'ul. Lipska, Kraków', 50.0360, 20.0040, 4.3, 1,
 ARRAY['staw', 'przyroda', 'cisza'],
 'Park z malowniczym stawem na Płaszowie, popularny wśród okolicznych mieszkańców i biegaczy.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Park Reduta', 'park',
 'ul. Reduta, Kraków', 50.0620, 19.9060, 4.4, 1,
 ARRAY['zieleń', 'spacer', 'rekreacja'],
 'Spokojny park w zachodniej części Krakowa z alejkami idealnie nadającymi się do rekreacji.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Park im. Anny i Erazma Jerzmanowskich', 'park',
 'ul. Jerzmanowskiego, Kraków', 50.0300, 19.9620, 4.5, 1,
 ARRAY['historyczny', 'zieleń', 'spokój'],
 'Zabytkowy park na Podgórzu z alejkami obsadzonymi starodrzewiem i historycznym klimatem.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Park Wisławy Szymborskiej', 'park',
 'ul. Rakowicka, Kraków', 50.0680, 19.9530, 4.4, 1,
 ARRAY['poetka', 'zieleń', 'kulturalny'],
 'Park poświęcony pamięci noblistki Wisławy Szymborskiej – miejsce spacerów i literackich wspomnień.',
 ARRAY['morning', 'afternoon']),

-- ── VIEWPOINTS ───────────────────────────────────────────────

('Kraków', 'Kopiec Kraka (Krakusa)', 'viewpoint',
 'ul. Rękawka, Kraków', 50.0363, 19.9534, 4.7, 1,
 ARRAY['kopiec', 'panorama', 'historia'],
 'Tajemniczy prehistoryczny kopiec na Podgórzu z piękną panoramą całego Krakowa.',
 ARRAY['morning', 'afternoon', 'evening']),

-- ── SHOPPING ─────────────────────────────────────────────────

('Kraków', 'Numlla the Store', 'shopping',
 'ul. Józefa 19, Kraków', 50.0520, 19.9433, 4.6, 3,
 ARRAY['concept store', 'design', 'moda'],
 'Ekskluzywny concept store na Kazimierzu z wyselekcjonowaną modą, biżuterią i przedmiotami dizajnerskimi.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Kamienie i Minerały Kraków', 'shopping',
 'ul. Floriańska 29, Kraków', 50.0640, 19.9395, 4.7, 2,
 ARRAY['minerały', 'kryształy', 'unikatowe'],
 'Sklep z kryształami, minerałami i kamieniami szlachetnymi – prawdziwa gratka dla miłośników geologii.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Bacówka Towary Tradycyjne', 'shopping',
 'ul. Szewska 8, Kraków', 50.0612, 19.9360, 4.5, 2,
 ARRAY['regionalne', 'tradycja', 'pamiątki'],
 'Sklep z tradycyjnymi wyrobami góralskimi i regionalnymi produktami wprost z Podhala.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Tajfuny', 'shopping',
 'ul. Józefa 30, Kraków', 50.0518, 19.9440, 4.5, 2,
 ARRAY['vintage', 'second hand', 'moda'],
 'Butik vintage na Kazimierzu z unikalnymi ubraniami z drugiej ręki w świetnym stanie.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Komis Turnusy', 'shopping',
 'ul. Dietla 54, Kraków', 50.0495, 19.9462, 4.4, 1,
 ARRAY['second hand', 'ubrania', 'okazje'],
 'Popularny komisowy sklep odzieżowy z ciekawymi znaleziskami w bardzo przystępnych cenach.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'LEON & MIKO Pottery Shop', 'shopping',
 'ul. Józefa 22, Kraków', 50.0520, 19.9436, 4.8, 3,
 ARRAY['ceramika', 'rękodzieło', 'prezent'],
 'Urocza pracownia ceramiczna z ręcznie robionymi naczyniami i biżuterią – idealne na prezent.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Balagan', 'shopping',
 'ul. Józefa 9, Kraków', 50.0522, 19.9432, 4.6, 2,
 ARRAY['vintage', 'design', 'Kazimierz'],
 'Charyzmatyczny sklep z vintage meblami, dekoracjami i przedmiotami designerskimi na Kazimierzu.',
 ARRAY['morning', 'afternoon']),

-- ── CAFE (CUKIERNIA) ─────────────────────────────────────────

('Kraków', 'Cukiernia Kawiarnia Cichowscy', 'cafe',
 'ul. Lea 16, Kraków', 50.0702, 19.9270, 4.7, 2,
 ARRAY['słodkości', 'cukiernia', 'domowe'],
 'Rodzinna cukiernia z przepysznymi tortami, ciastami i wypiekami według tradycyjnych receptur.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Szarotka Cukiernia Pracownia', 'cafe',
 'ul. Karmelicka 20, Kraków', 50.0616, 19.9300, 4.6, 2,
 ARRAY['słodkości', 'cukiernia', 'rzemieślnicza'],
 'Rzemieślnicza pracownia cukiernicza z wyjątkowymi tortami i czekoladkami robionymi ręcznie.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'CAKE DEALER Cukiernia', 'cafe',
 'ul. Starowiślna 5, Kraków', 50.0561, 19.9457, 4.6, 2,
 ARRAY['słodkości', 'nowoczesna', 'Instagram'],
 'Nowoczesna cukiernia z efektownymi tortami i ciastkami, które wyglądają jak dzieła sztuki.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Cukiernia Michałek', 'cafe',
 'ul. Długa 1, Kraków', 50.0654, 19.9345, 4.5, 1,
 ARRAY['słodkości', 'tradycja', 'klasyczna'],
 'Klasyczna krakowska cukiernia z pyszną kremówką, eklery i deserami według sprawdzonych receptur.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Cukiernia Śliwa (rok zał. 1958)', 'cafe',
 'ul. Kalwaryjska 6, Kraków', 50.0472, 19.9415, 4.7, 1,
 ARRAY['słodkości', 'legenda', 'tradycja'],
 'Legendarna cukiernia otwarta w 1958 roku z niezapomnianymi ptysimi i tortami owocowymi.',
 ARRAY['morning', 'afternoon']),

('Kraków', 'Słodko i Czule', 'cafe',
 'ul. Brzozowa 3, Kraków', 50.0508, 19.9448, 4.6, 2,
 ARRAY['słodkości', 'przytulna', 'domowe'],
 'Przytulna kawiarnia-cukiernia z domowymi ciastkami i ciepłą, niemal rodzinną atmosferą.',
 ARRAY['morning', 'afternoon']),

-- ── EXPERIENCE ───────────────────────────────────────────────

('Kraków', 'Dom Strachu – Lost Souls Alley', 'experience',
 'ul. Floriańska 24, Kraków', 50.0637, 19.9392, 4.5, 2,
 ARRAY['horror', 'atrakcja', 'adrenalina'],
 'Nawiedzony dom strachu w centrum Krakowa – ekscytująca przygoda pełna emocji i adrenaliny.',
 ARRAY['afternoon', 'evening']);
