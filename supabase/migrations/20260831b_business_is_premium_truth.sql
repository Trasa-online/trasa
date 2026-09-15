-- business_profiles.is_premium = REALNY status platnego konta (decyzja Nat 2026-08-31).
-- Stan przed: DEFAULT true, wiec KAZDE zalozone konto bylo "premium", a kolumna `plan` (legacy
-- zero/basic/premium) przy rejestracji zawsze dostawala 'zero'. Zadna z kolumn nie mowila prawdy
-- i nic ich nie czytalo. Od teraz is_premium jest zrodlem prawdy dla funkcji premium-only
-- (pierwsza: sekcja "Od uzytkownikow" na wizytowce).
alter table public.business_profiles alter column is_premium set default false;

-- Reset: nikt nie jest premium...
update public.business_profiles set is_premium = false where is_premium is distinct from false;

-- ...poza kontami wskazanymi przez Nat.
update public.business_profiles b
set is_premium = true
from public.places p
where p.id = b.place_id
  and p.place_name in ('Orest Coffee & Vintage', 'Wanderlust coffee place');
