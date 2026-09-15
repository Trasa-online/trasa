-- Wyjazd grupowy na PUBLICZNYM profilu uczestnika (zgloszenie Nat 2026-09-05).
--
-- Objaw: "Trip do Wro" nie pokazywal sie na profilu Barta ani Adriana, choc oboje sa
-- uczestnikami. Na profilu hosta (wlascicielki wyjazdu) byl widoczny normalnie.
--
-- Przyczyna: PublicProfile szukal takich wyjazdow pytajac KLIENTEM o group_session_members
-- ("w jakich sesjach jest wlasciciel tego profilu?"). Polityka SELECT na tej tabeli
-- (is_group_session_member, kwiecien 2026) przepuszcza wylacznie sesje, w ktorych sam jestes
-- czlonkiem. Osoba spoza grupy dostawala wiec pusta liste - bez bledu, po cichu - i wyjazd
-- znikal z profilu uczestnika. Czlonkowie grupy widzieli go poprawnie, stad wrazenie
-- "czasem dziala". Zmierzone na produkcji: profil uczestnika + widz z grupy = wyjazd jest,
-- ten sam profil + widz z zewnatrz = pusto.
--
-- Rozwiazanie: funkcja SECURITY DEFINER, ktora czyta czlonkostwa po stronie serwera, ale
-- oddaje WYLACZNIE wyjazdy juz publiczne (is_shared + status='published' + nieukryte przez
-- admina) - czyli dokladnie to, co kazdy i tak widzi na profilu hosta. Nie ujawnia skladu
-- grupy, wyjazdow roboczych ani zadnej kolumny spoza karty wyjazdu (jawna lista kolumn,
-- swiadomie BEZ hidden_for_users / tagged_members / new_for_users).

create or replace function public.public_group_routes_for_user(p_user uuid)
returns table (
  id uuid,
  title text,
  city text,
  start_date date,
  day_number integer,
  folder_id uuid,
  views integer,
  saves_count integer,
  likes_count integer,
  created_at timestamptz,
  user_id uuid,
  tags text[],
  review_narrative text,
  ai_summary text,
  cover_url text,
  list_cover_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.city, r.start_date, r.day_number, r.folder_id,
         r.views, r.saves_count, r.likes_count, r.created_at,
         r.user_id, r.tags, r.review_narrative, r.ai_summary,
         r.cover_url, r.list_cover_url
  from public.routes r
  where r.group_session_id is not null
    and r.user_id <> p_user                      -- wlasne wyjazdy leca osobna galezia
    and r.is_shared = true
    and r.status = 'published'                   -- robocze zostaja prywatne
    and coalesce(r.hidden_by_admin, false) = false
    and exists (
      select 1 from public.group_session_members m
      where m.session_id = r.group_session_id
        and m.user_id = p_user
    )
  order by r.created_at desc
$$;

revoke all on function public.public_group_routes_for_user(uuid) from public;
grant execute on function public.public_group_routes_for_user(uuid) to anon, authenticated;

comment on function public.public_group_routes_for_user(uuid) is
  'Publiczne wyjazdy grupowe, w ktorych dany user bral udzial nie bedac hostem. Uzywane przez profil publiczny - klient nie moze czytac group_session_members obcej osoby.';
