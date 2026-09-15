-- Korekta po weryfikacji z Nat (2026-08-31): realne konta biznesowe to BAJKA, Antykwariat
-- Zakladka, Wanderlust coffee place i Orest Coffee & Vintage. Dopoki nie ma billingu,
-- "realne konto = premium" (funkcje premium-only, np. sekcja "Od uzytkownikow").
-- Poza lista zostaja: dwa lokale testowe oraz "good good..." (profil bez wlasciciela i bez
-- activated_at = wizytowka do przejecia, nie zalozone konto).
update public.business_profiles b
set is_premium = true
from public.places p
where p.id = b.place_id
  and p.place_name in ('BAJKA', 'Antykwariat Zakładka', 'Wanderlust coffee place', 'Orest Coffee & Vintage');
