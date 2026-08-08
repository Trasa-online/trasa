-- Tagi list miejsc (discovery_collections). Zastepuja glowna "notke do listy" (description
-- zostaje w bazie, ale krok 2 kreatora pokazuje tagi zamiast notki). Tagi = predefiniowane
-- (np. "Przyjazne dla psów", "Miejsca z vibem") + wlasne uzytkownika. Wyswietlane w /lista/:id.
ALTER TABLE public.discovery_collections
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
