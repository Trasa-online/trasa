-- Koniec maszynowych opisow miejsc (2026-09-08, decyzja Nat)
--
-- 920 z 1354 wierszy w `places` mialo opis wygenerowany maszynowo ("Restauracja
-- specjalizujaca sie w makaronach..."). Trafialy one na wizytowke miejsca w stanie ZERO,
-- czyli lokalu, ktory nie ma u nas konta i nigdy tego tekstu nie autoryzowal. Opis na
-- wizytowce ma pochodzic od WLASCICIELA (business_profiles.description) albo nie byc wcale.
--
-- Tresc archiwizujemy zamiast kasowac bezpowrotnie: to 920 wierszy, ktore kosztowaly czas
-- i pieniadze, a decyzja o ich losie moze sie jeszcze zmienic. Przywrocenie to jeden UPDATE.

alter table public.places add column if not exists description_archive text;

update public.places
   set description_archive = coalesce(description_archive, description),
       description = null
 where coalesce(btrim(description), '') <> '';

-- Blokada na przyszlosc: cokolwiek probuje zapisac opis do `places`, dostaje NULL.
-- Wyzwalacz, a nie tylko dyscyplina w kodzie - zrodel zapisu bylo kilka (skrypty contentowe,
-- funkcje brzegowe), a cichy powrot opisow bylby nie do wychwycenia w przegladzie kodu.
create or replace function public.places_block_description()
returns trigger
language plpgsql
as $$
begin
  new.description := null;
  return new;
end; $$;

drop trigger if exists trg_places_block_description on public.places;
create trigger trg_places_block_description
  before insert or update of description on public.places
  for each row execute function public.places_block_description();

comment on column public.places.description is
  'ZAWSZE NULL - wyzwalacz trg_places_block_description blokuje zapis. Opis wizytowki pochodzi wylacznie z business_profiles.description (wlasciciel lokalu).';
comment on column public.places.description_archive is
  'Archiwum maszynowych opisow wyczyszczonych 2026-09-08. Trzymane na wypadek zmiany decyzji.';
