-- KONTA LOKALI NIE SA UZYTKOWNIKAMI APKI (zgloszenie Nat 2026-09-21: „wizytowki biznesowe
-- tworza konto w apce natywnej, a nie powinny").
--
-- Kazdy uzytkownik auth dostaje wiersz `profiles` (trigger `handle_new_user` + `register-business`
-- zaklada go jawnie), wiec lokal - „Oter Coffeebar" - stal w wyszukiwarce ludzi i mial swoj
-- profil publiczny z zakladkami „Plany / Kolekcje" i guzikiem „Obserwuj". Dotychczasowy filtr
-- po `business_profiles_public.owner_user_id` lapal tylko AKTYWNE wizytowki (widok), wiec
-- lokal czekajacy na weryfikacje przechodzil, a przy okazji ukrywal ZALOZYCIELKE (Nat jest
-- wlascicielka testowego lokalu i ma zwykle konto B2C).
--
-- Flaga `profiles.is_business` = „to konto jest WYLACZNIE lokalem". Ustawia ja trigger przy
-- przypieciu `owner_user_id` do wizytowki, ale TYLKO gdy profil nie ma zadnego sladu B2C
-- (planow, obserwacji, kolekcji poza prywatna „Ogolne") - osoba, ktora najpierw byla userem,
-- a potem przejela lokal, zostaje widoczna. Klient filtruje po tej kolumnie (wyszukiwarka
-- ludzi, profil publiczny, zapraszanie).

alter table public.profiles add column if not exists is_business boolean not null default false;
grant select (is_business) on public.profiles to anon, authenticated;

create or replace function public.profile_has_b2c_footprint(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.routes r where r.user_id = p_user)
      or exists (select 1 from public.followers f where f.follower_id = p_user or f.following_id = p_user)
      or exists (select 1 from public.discovery_collections c where c.user_id = p_user and c.list_status <> 'to_visit')
      or exists (select 1 from public.group_session_members m where m.user_id = p_user);
$$;
revoke execute on function public.profile_has_b2c_footprint(uuid) from public, anon, authenticated;

create or replace function public.mark_business_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_user_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.owner_user_id is not distinct from old.owner_user_id then return new; end if;
  if not public.profile_has_b2c_footprint(new.owner_user_id) then
    update public.profiles set is_business = true where id = new.owner_user_id and is_business = false;
  end if;
  return new;
end;
$$;
revoke execute on function public.mark_business_owner_profile() from public, anon, authenticated;

drop trigger if exists trg_mark_business_owner_profile on public.business_profiles;
create trigger trg_mark_business_owner_profile
  after insert or update of owner_user_id on public.business_profiles
  for each row execute function public.mark_business_owner_profile();

-- Backfill: dzisiejsi wlasciciele bez sladu B2C.
update public.profiles p
   set is_business = true
 where p.is_business = false
   and exists (select 1 from public.business_profiles bp where bp.owner_user_id = p.id)
   and not public.profile_has_b2c_footprint(p.id);
