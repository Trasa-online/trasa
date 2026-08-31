-- is_premium WYLICZANE AUTOMATYCZNIE (decyzja Nat 2026-08-31: "nie chce przelacznika,
-- nie bede tego ustawiac recznie"). Kazdy, kto zaklada KONTO biznesowe, dostaje funkcje
-- premium (dzis: sekcja "Od uzytkownikow" ze zdjeciami spolecznosci na wizytowce).
--
-- Definicja zywego konta:
--   owner_user_id IS NOT NULL  - profil przejety/zalozony przez wlasciciela
--                                (wizytowki zaseedowane "do przejecia" maja NULL),
--   is_active                  - aktywna (moderacja: approve -> true, reject -> false),
--   NOT is_draft               - rejestracja dokonczona (BusinessStart tworzy szkic).
--
-- GDY WEJDZIE BILLING (subskrypcje mies./roczne): NIE wracamy do recznego przelacznika -
-- podmieniamy TYLKO tresc tej funkcji na warunek "ma aktywna subskrypcje" (status +
-- current_period_end). Front czyta `is_premium` -> `MockPlace.businessIsPremium` i nie
-- wymaga wtedy zadnej zmiany.
create or replace function public.sync_business_is_premium()
returns trigger
language plpgsql
as $$
begin
  new.is_premium := (
    new.owner_user_id is not null
    and coalesce(new.is_active, false)
    and not coalesce(new.is_draft, false)
  );
  return new;
end;
$$;

drop trigger if exists trg_business_is_premium on public.business_profiles;
create trigger trg_business_is_premium
  before insert or update on public.business_profiles
  for each row execute function public.sync_business_is_premium();

-- Przelicz istniejace wiersze (trigger BEFORE UPDATE nadpisze is_premium wlasciwa wartoscia).
update public.business_profiles set updated_at = updated_at;
