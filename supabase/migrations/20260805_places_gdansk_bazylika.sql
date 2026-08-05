-- Bazylika Mariacka (Gdansk) - pominieta w 20260805_places_trojmiasto_supplement przez
-- zbyt szeroki dedup (matchowala Bazylike Mariacka w Krakowie). Dodajemy dla Gdanska.
INSERT INTO public.places (city, place_name, category, address, is_active)
SELECT 'Gdańsk', 'Bazylika Mariacka', 'monument', 'Gdańsk', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.places WHERE city = 'Gdańsk' AND place_name = 'Bazylika Mariacka'
);
