CREATE TABLE IF NOT EXISTS public.route_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  personality_type TEXT,
  title TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  pins JSONB DEFAULT '[]',
  cover_photos TEXT[] DEFAULT '{}',
  creator_handle TEXT DEFAULT '@trasa',
  point_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  fork_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.route_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active templates"
  ON public.route_templates FOR SELECT USING (is_active = true);

-- Seed: Kraków templates
INSERT INTO public.route_templates (city, personality_type, title, tags, pins, cover_photos, creator_handle, point_count) VALUES
(
  'Kraków',
  'maximizer',
  'Maximizer',
  ARRAY['Wawel', 'Sukiennice', 'Kazimierz', 'MOCAK', 'Kawiarnia Płyś', 'Planty', 'Veganico'],
  '[
    {"place_name": "Wawel", "address": "Wawel 5, 31-001 Kraków", "latitude": 50.0543, "longitude": 19.9352, "category": "monument", "description": "Ikoniczny zamek i wzgórze na lewym brzegu Wisły. Obowiązkowy punkt na mapie Krakowa.", "suggested_time": "09:00", "duration_minutes": 90},
    {"place_name": "Sukiennice", "address": "Rynek Główny 1-3, 31-042 Kraków", "latitude": 50.0617, "longitude": 19.9373, "category": "market", "description": "Historyczne centrum handlowe na Rynku Głównym. Pamiątki, biżuteria i lokalne wyroby.", "suggested_time": "11:00", "duration_minutes": 45},
    {"place_name": "Kościół Mariacki", "address": "pl. Mariacki 5, 31-042 Kraków", "latitude": 50.0617, "longitude": 19.9390, "category": "church", "description": "Gotycka bazylika z XIV w. Słynny ołtarz Wita Stwosza i hejnał z wieży.", "suggested_time": "11:55", "duration_minutes": 30},
    {"place_name": "Kawiarnia Płyś", "address": "ul. Szewska 14, 31-009 Kraków", "latitude": 50.0619, "longitude": 19.9361, "category": "cafe", "description": "Kultowa kawiarnia w sercu Starego Miasta. Idealna na kawę i ciastko po spacerze.", "suggested_time": "13:00", "duration_minutes": 60},
    {"place_name": "MOCAK", "address": "ul. Lipowa 4, 30-702 Kraków", "latitude": 50.0519, "longitude": 19.9601, "category": "museum", "description": "Muzeum Sztuki Współczesnej w Krakowie. Nowoczesne wystawy w dawnej fabryce Schindlera.", "suggested_time": "14:30", "duration_minutes": 90},
    {"place_name": "Kazimierz", "address": "ul. Szeroka, 31-053 Kraków", "latitude": 50.0517, "longitude": 19.9431, "category": "walk", "description": "Klimatyczna żydowska dzielnica z galeriami, vintage shopami i świetnymi restauracjami.", "suggested_time": "16:30", "duration_minutes": 90},
    {"place_name": "Veganico", "address": "ul. Józefa 9, 31-056 Kraków", "latitude": 50.0510, "longitude": 19.9445, "category": "restaurant", "description": "Wegańska restauracja w Kazimierzu. Kreatywna kuchnia w przyjaznej atmosferze.", "suggested_time": "19:00", "duration_minutes": 75},
    {"place_name": "Planty", "address": "Park Planty, Kraków", "latitude": 50.0597, "longitude": 19.9375, "category": "park", "description": "Pierścień zieleni otaczający Stare Miasto. Idealny wieczorny spacer.", "suggested_time": "20:30", "duration_minutes": 40}
  ]'::jsonb,
  ARRAY[
    'https://images.unsplash.com/photo-1562979314-bee7453e911c?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=400&h=300&fit=crop'
  ],
  '@trasa',
  8
),
(
  'Kraków',
  'flow_seeker',
  'Flow seeker',
  ARRAY['Kawiarnia Płyś', 'Sukiennice', 'MOCAK', 'Kazimierz'],
  '[
    {"place_name": "Kawiarnia Płyś", "address": "ul. Szewska 14, 31-009 Kraków", "latitude": 50.0619, "longitude": 19.9361, "category": "cafe", "description": "Spokojny poranek z kawą w sercu miasta. Zacznij dzień bez pośpiechu.", "suggested_time": "10:00", "duration_minutes": 75},
    {"place_name": "Sukiennice", "address": "Rynek Główny 1-3, 31-042 Kraków", "latitude": 50.0617, "longitude": 19.9373, "category": "market", "description": "Spacer po Rynku i Sukiennicach. Poczuj atmosferę krakowskiego serca.", "suggested_time": "12:00", "duration_minutes": 60},
    {"place_name": "MOCAK", "address": "ul. Lipowa 4, 30-702 Kraków", "latitude": 50.0519, "longitude": 19.9601, "category": "museum", "description": "Muzeum Sztuki Współczesnej — bez pośpiechu, z uwagą na każdą wystawę.", "suggested_time": "14:00", "duration_minutes": 120},
    {"place_name": "Kazimierz", "address": "ul. Szeroka, 31-053 Kraków", "latitude": 50.0517, "longitude": 19.9431, "category": "walk", "description": "Wieczorny spacer po Kazimierzu. Kolacja w ulubionej knajpce.", "suggested_time": "17:00", "duration_minutes": 120}
  ]'::jsonb,
  ARRAY[
    'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1562979314-bee7453e911c?w=400&h=300&fit=crop'
  ],
  '@trasa',
  4
),
(
  'Kraków',
  'experience_hunter',
  'Experience hunter',
  ARRAY['Wawel', 'Sukiennice', 'Kawiarnia Płyś', 'MOCAK', 'Veganico', 'Kazimierz', 'Planty'],
  '[
    {"place_name": "Wawel", "address": "Wawel 5, 31-001 Kraków", "latitude": 50.0543, "longitude": 19.9352, "category": "monument", "description": "Start od Wawelu — najważniejszy zabytek Krakowa. Wejdź do zamku i katedry.", "suggested_time": "09:00", "duration_minutes": 75},
    {"place_name": "Sukiennice", "address": "Rynek Główny 1-3, 31-042 Kraków", "latitude": 50.0617, "longitude": 19.9373, "category": "market", "description": "Rynek i Sukiennice — serce Krakowa. Idealne na zakup pamiątek i spacer.", "suggested_time": "10:30", "duration_minutes": 45},
    {"place_name": "Kawiarnia Płyś", "address": "ul. Szewska 14, 31-009 Kraków", "latitude": 50.0619, "longitude": 19.9361, "category": "cafe", "description": "Przerwa na kawę i coś słodkiego przed dalszym zwiedzaniem.", "suggested_time": "11:30", "duration_minutes": 45},
    {"place_name": "MOCAK", "address": "ul. Lipowa 4, 30-702 Kraków", "latitude": 50.0519, "longitude": 19.9601, "category": "museum", "description": "Współczesna sztuka w industrialnym otoczeniu dawnej fabryki Schindlera.", "suggested_time": "13:00", "duration_minutes": 90},
    {"place_name": "Veganico", "address": "ul. Józefa 9, 31-056 Kraków", "latitude": 50.0510, "longitude": 19.9445, "category": "restaurant", "description": "Wegański lunch w Kazimierzu — kreatywne podejście do kuchni roślinnej.", "suggested_time": "15:00", "duration_minutes": 60},
    {"place_name": "Kazimierz", "address": "ul. Szeroka, 31-053 Kraków", "latitude": 50.0517, "longitude": 19.9431, "category": "walk", "description": "Klimatyczna dzielnica żydowska — vintage, galerie, muzyka na żywo.", "suggested_time": "16:30", "duration_minutes": 90},
    {"place_name": "Planty", "address": "Park Planty, Kraków", "latitude": 50.0597, "longitude": 19.9375, "category": "park", "description": "Wieczorny spacer po parku otaczającym Stare Miasto.", "suggested_time": "20:00", "duration_minutes": 45}
  ]'::jsonb,
  ARRAY[
    'https://images.unsplash.com/photo-1562979314-bee7453e911c?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=400&h=300&fit=crop'
  ],
  '@trasa',
  7
);
